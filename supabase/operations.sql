-- Operación transaccional. Aplicar después de schema.sql.
create table if not exists public.delivery_zones (
  id text primary key, name text not null unique, price integer check(price >= 0), active boolean not null default true
);
alter table public.delivery_zones enable row level security;
drop policy if exists "Read delivery zones" on public.delivery_zones;
create policy "Read delivery zones" on public.delivery_zones for select using(active or public.is_la_tuba_admin());
drop policy if exists "Manage delivery zones" on public.delivery_zones;
create policy "Manage delivery zones" on public.delivery_zones for all to authenticated using(public.is_la_tuba_admin()) with check(public.is_la_tuba_admin());
grant select on public.delivery_zones to anon, authenticated;
grant insert,update,delete on public.delivery_zones to authenticated;

create table if not exists public.submission_requests (
  request_id uuid primary key, kind text not null, fingerprint text not null, result_id uuid not null, created_at timestamptz not null default now()
);
alter table public.submission_requests enable row level security;
revoke all on public.submission_requests from public, anon, authenticated;

alter table public.contacts add column if not exists document_number text;
alter table public.contacts add column if not exists admin_note text;
alter table public.contacts add column if not exists tags text[] not null default '{}';
create or replace view public.customers with(security_invoker=true) as
select id,phone,name,email,birthday,addresses,order_count,total_spent,first_order_at,last_order_at,created_at,updated_at,document_number,admin_note,tags
from public.contacts where order_count > 0;

-- Cotización: ignora los importes y descuentos proporcionados por el navegador.
create or replace function public.quote_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item jsonb; product public.catalog_items%rowtype; menu public.daily_menus%rowtype;
  clean_items jsonb := '[]'; choices jsonb; unit_price integer; qty integer; subtotal integer:=0; shipping integer:=0;
  promo public.promotions%rowtype; eligible integer; eligible_qty integer; discount integer; best integer:=0; winning jsonb:='[]';
  canonical_product jsonb; special_name text;
begin
  if jsonb_typeof(payload->'items') is distinct from 'array' then raise exception 'Agrega productos válidos'; end if;
  if jsonb_array_length(payload->'items') not between 1 and 100 then raise exception 'El pedido debe tener entre 1 y 100 líneas'; end if;
  if coalesce(payload->>'servicio','') not in ('local','llevar','domicilio') then raise exception 'Servicio inválido'; end if;
  for item in select value from jsonb_array_elements(payload->'items') loop
    if coalesce(item->>'qty','') !~ '^[0-9]+$' then raise exception 'Cantidad inválida'; end if;
    qty := (item->>'qty')::integer;
    if qty not between 1 and 100 then raise exception 'Cantidad inválida'; end if;
    if coalesce(item->'extrasQty','{}') <> '{}'::jsonb or coalesce(item->'toppingIds','[]') <> '[]'::jsonb then raise exception 'Los adicionales anteriores ya no están disponibles'; end if;
    if item->'product'->>'dailyMenuId' is not null then
      select * into menu from public.daily_menus where id=(item->'product'->>'dailyMenuId')::uuid and active and scheduled_date=(now() at time zone 'America/Bogota')::date;
      if not found then raise exception 'El menú seleccionado ya no está disponible'; end if;
      choices := coalesce(item->'product'->'menuChoices','{}'); special_name := nullif(choices->>'special','');
      if special_name is not null then
        select (s->>'price')::integer into unit_price from jsonb_array_elements(menu.specials) s where s->>'name'=special_name;
        if unit_price is null or unit_price<=0 then raise exception 'Especial no disponible'; end if;
      else
        if not (public.is_la_tuba_admin() and payload->>'canal'='admin') and ((jsonb_array_length(menu.soups)>0 and not menu.soups ? coalesce(choices->>'soup','')) or
          (jsonb_array_length(menu.sides)>0 and not menu.sides ? coalesce(choices->>'side','')) or
          (jsonb_array_length(menu.proteins)>0 and not menu.proteins ? coalesce(choices->>'protein',''))) then raise exception 'Revisa las opciones del menú diario'; end if;
        unit_price:=menu.price;
      end if;
      canonical_product := jsonb_build_object('id',menu.id,'dailyMenuId',menu.id,'menuChoices',choices,'category','frutafresh','categoryId','menu-del-dia','name',coalesce(special_name,menu.title),'description',concat_ws(' · ',nullif(choices->>'soup',''),nullif(choices->>'side',''),nullif(choices->>'protein','')),'prices',jsonb_build_object('fijo',unit_price),'toppingsIncludedMax',0,'image','/historias/6.png');
    else
      select * into product from public.catalog_items where id=(item->'product'->>'id')::uuid and available and business='la_tuba';
      if not found then raise exception 'Un producto ya no está disponible; actualiza la carta'; end if;
      unit_price:=product.price;
      canonical_product:=jsonb_build_object('id',product.id,'name',product.name,'description',product.description,'category','frutafresh','categoryId',product.item_type||'-'||product.category,'itemType',product.item_type,'prices',jsonb_build_object('fijo',unit_price),'toppingsIncludedMax',0,'image',product.image_url);
    end if;
    if unit_price<=0 then raise exception 'Producto sin precio configurado'; end if;
    clean_items:=clean_items||jsonb_build_array(jsonb_build_object('id',coalesce(nullif(item->>'id',''),gen_random_uuid()::text),'product',canonical_product,'qty',qty,'note',left(coalesce(item->>'note',''),2000),'version',null,'size',null,'toppingIds','[]'::jsonb,'extrasQty','{}'::jsonb,'extraSelections','{}'::jsonb,'servido',false));
    subtotal:=subtotal+unit_price*qty;
  end loop;
  if payload->>'servicio'='domicilio' then
    select price into shipping from public.delivery_zones where active and (id=payload->'cliente'->>'barrioId' or name=payload->'cliente'->>'barrio') limit 1;
    if shipping is null then raise exception 'El barrio no tiene tarifa de domicilio; consulta con La Tuba'; end if;
    if nullif(trim(payload->'cliente'->>'direccion'),'') is null then raise exception 'Indica la dirección de entrega'; end if;
  end if;
  for promo in select * from public.promotions where active order by id loop
    if (nullif(promo.data->>'fechaInicio','')::timestamptz>now()) or (nullif(promo.data->>'fechaFin','')::timestamptz<now()) then continue; end if;
    if nullif(trim(promo.data->>'codigo'),'') is not null and upper(trim(promo.data->>'codigo'))<>upper(trim(coalesce(payload->>'couponCode',''))) then continue; end if;
    if nullif(promo.data->>'usosMaximos','') is not null and coalesce((promo.data->>'usosActuales')::integer,0)>=(promo.data->>'usosMaximos')::integer then continue; end if;
    select coalesce(sum((i->'product'->'prices'->>'fijo')::integer*(i->>'qty')::integer),0),coalesce(sum((i->>'qty')::integer),0) into eligible,eligible_qty
      from jsonb_array_elements(clean_items) i where coalesce(jsonb_array_length(promo.data->'productosIds'),0)=0 or promo.data->'productosIds' ? (i->'product'->>'id');
    if eligible=0 or eligible_qty<coalesce((promo.data->>'cantidadMinima')::integer,0) then continue; end if;
    discount:=0;
    if promo.data->>'tipo'='porcentaje' then discount:=round(eligible*(promo.data->>'valor')::numeric/100)::integer;
    elsif promo.data->>'tipo'='valor_fijo' then discount:=(promo.data->>'valor')::integer;
    elsif promo.data->>'tipo'='2x1' then
      select coalesce(sum((i->'product'->'prices'->>'fijo')::integer*((i->>'qty')::integer/2)),0) into discount from jsonb_array_elements(clean_items) i
        where coalesce(jsonb_array_length(promo.data->'productosIds'),0)=0 or promo.data->'productosIds' ? (i->'product'->>'id');
    end if;
    discount:=greatest(0,least(discount,eligible));
    if discount>best then best:=discount; winning:=jsonb_build_array(jsonb_build_object('promoId',promo.id,'nombre',promo.data->>'nombre','tipo',promo.data->>'tipo','valor',(promo.data->>'valor')::numeric,'descuento',discount)); end if;
  end loop;
  return jsonb_build_object('items',clean_items,'subtotal',subtotal,'delivery',shipping,'descuentoTotal',best,'total',subtotal+shipping-best,'promociones',winning);
end $$;
revoke all on function public.quote_order(jsonb) from public;
grant execute on function public.quote_order(jsonb) to anon,authenticated;

create table if not exists public.order_inventory_allocations (
  order_id uuid references public.orders(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id), quantity numeric(14,3) not null check(quantity>0),
  primary key(order_id,inventory_item_id)
);
alter table public.order_inventory_allocations enable row level security;
revoke all on public.order_inventory_allocations from public,anon,authenticated;
create or replace function public.sync_order_inventory()
returns trigger language plpgsql security definer set search_path=public as $$
declare allocation record; needed record;
begin
  if tg_op='UPDATE' and new.items=old.items and (new.status='cancelado')=(old.status='cancelado') then return new; end if;
  perform pg_advisory_xact_lock(hashtext('la_tuba_inventory'));
  for allocation in select * from public.order_inventory_allocations where order_id=old.id order by inventory_item_id loop
    update public.inventory_items set quantity=quantity+allocation.quantity,updated_at=now() where id=allocation.inventory_item_id;
    insert into public.inventory_movements(inventory_item_id,quantity_change,reason,order_id) values(allocation.inventory_item_id,allocation.quantity,'Devolución por ajuste o cancelación',old.id);
  end loop;
  delete from public.order_inventory_allocations where order_id=old.id;
  if tg_op='DELETE' then return old; end if;
  if new.status='cancelado' then return new; end if;
  for needed in select r.inventory_item_id,sum(r.quantity_required*(i->>'qty')::integer) quantity
    from jsonb_array_elements(new.items) i join public.catalog_inventory_requirements r on r.catalog_item_id::text=i->'product'->>'id'
    group by r.inventory_item_id order by r.inventory_item_id loop
    update public.inventory_items set quantity=quantity-needed.quantity,updated_at=now() where id=needed.inventory_item_id and quantity>=needed.quantity;
    if not found then raise exception 'No hay existencias suficientes. Actualiza tu pedido.'; end if;
    insert into public.order_inventory_allocations values(new.id,needed.inventory_item_id,needed.quantity);
    insert into public.inventory_movements(inventory_item_id,quantity_change,reason,order_id) values(needed.inventory_item_id,-needed.quantity,'Consumo de pedido',new.id);
  end loop;
  return new;
end $$;
drop trigger if exists order_inventory_write on public.orders;
create trigger order_inventory_write after insert or update of items,status on public.orders for each row execute function public.sync_order_inventory();
drop trigger if exists order_inventory_delete on public.orders;
create trigger order_inventory_delete before delete on public.orders for each row execute function public.sync_order_inventory();

alter table public.orders add column if not exists paid_total integer not null default 0;
create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete restrict,
  amount integer not null check(amount<>0), method text not null check(method in ('Efectivo','Transferencia')),
  request_id uuid not null unique, note text, created_at timestamptz not null default now(), created_by uuid default auth.uid()
);
alter table public.order_payments enable row level security;
revoke all on public.order_payments from public,anon,authenticated;
grant select on public.order_payments to authenticated;
drop policy if exists "Admins read payments" on public.order_payments;
create policy "Admins read payments" on public.order_payments for select to authenticated using(public.is_la_tuba_admin());
create or replace function public.record_order_payment(p_order_id uuid,p_amount integer,p_method text,p_request_id uuid,p_note text default '')
returns uuid language plpgsql security definer set search_path=public as $$
declare ord public.orders%rowtype; existing public.order_payments%rowtype; result uuid;
begin
  if not public.is_la_tuba_admin() then raise exception 'Acceso denegado'; end if;
  perform pg_advisory_xact_lock(hashtext(p_request_id::text));
  select * into existing from public.order_payments where request_id=p_request_id;
  if found then
    if existing.order_id<>p_order_id or existing.amount<>p_amount or existing.method<>p_method then raise exception 'Solicitud de cobro reutilizada con datos distintos'; end if;
    return existing.id;
  end if;
  select * into ord from public.orders where id=p_order_id and business='la_tuba' for update;
  if not found or p_amount is null or p_amount=0 or ord.paid_total+p_amount<0 or ord.paid_total+p_amount>ord.total or (ord.status='cancelado' and p_amount>0) then raise exception 'Importe de cobro o devolución inválido'; end if;
  insert into public.order_payments(order_id,amount,method,request_id,note) values(p_order_id,p_amount,p_method,p_request_id,p_note) returning id into result;
  update public.orders set paid_total=paid_total+p_amount,updated_at=now() where id=p_order_id;
  return result;
end $$;
revoke all on function public.record_order_payment(uuid,integer,text,uuid,text) from public;
grant execute on function public.record_order_payment(uuid,integer,text,uuid,text) to authenticated;

-- schema.sql vuelve a crear la rutina base; conservarla sin acceso público.
drop function if exists public.create_order_record(jsonb);
alter function public.create_public_order(jsonb) rename to create_order_record;
revoke all on function public.create_order_record(jsonb) from public,anon,authenticated;
create or replace function public.create_public_order(payload jsonb)
returns table(id uuid,order_number text) language plpgsql security definer set search_path=public as $$
declare key uuid; request public.submission_requests%rowtype; hash text; quote jsonb; result record; promo jsonb; admin_sale boolean;
begin
  key:=(payload->>'requestId')::uuid;
  if key is null then raise exception 'Actualiza la página para confirmar el pedido'; end if;
  hash:=md5((payload-'numeroOrden'-'requestId'-'trackingToken')::text);
  perform pg_advisory_xact_lock(hashtext(key::text));
  select * into request from public.submission_requests where request_id=key;
  if found then
    if request.kind<>'order' or request.fingerprint<>hash then raise exception 'La solicitud ya fue utilizada con otros datos'; end if;
    return query select o.id,o.order_number from public.orders o where o.id=request.result_id; return;
  end if;
  -- Serializa consumo de cupos de promoción; el inventario además usa escrituras atómicas.
  perform pg_advisory_xact_lock(hashtext('la_tuba_promotions'));
  perform p.id from public.promotions p where p.active order by p.id for update;
  quote:=public.quote_order(payload);
  if (payload->>'total')::integer is distinct from (quote->>'total')::integer or (payload->>'subtotal')::integer is distinct from (quote->>'subtotal')::integer or (payload->>'delivery')::integer is distinct from (quote->>'delivery')::integer then
    raise exception 'Los precios o promociones cambiaron. Actualiza el resumen antes de confirmar.';
  end if;
  admin_sale:=public.is_la_tuba_admin() and payload->>'canal'='admin';
  select * into result from public.create_order_record(payload||quote);
  insert into public.submission_requests values(key,'order',hash,result.id,now());
  if payload->>'servicio'='domicilio' and payload->>'trackingToken' is not null then
    insert into public.order_tracking_tokens(order_id,token) values(result.id,(payload->>'trackingToken')::uuid);
  end if;
  for promo in select value from jsonb_array_elements(quote->'promociones') loop
    update public.promotions set data=jsonb_set(data,'{usosActuales}',to_jsonb(coalesce((data->>'usosActuales')::integer,0)+1)),updated_at=now() where public.promotions.id=(promo->>'promoId')::uuid;
  end loop;
  if admin_sale and payload->>'estado'='pagado' then perform public.record_order_payment(result.id,(quote->>'total')::integer,payload->>'formaPago',key,'Venta en caja'); end if;
  return query select result.id::uuid,result.order_number::text;
end $$;
revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon,authenticated;

-- Capacidad de edición de ubicación limitada a un pedido, por token aleatorio.
create table if not exists public.order_tracking_tokens(order_id uuid primary key references public.orders(id) on delete cascade,token uuid not null,expires_at timestamptz not null default now()+interval '8 hours');
alter table public.order_tracking_tokens enable row level security;
revoke all on public.order_tracking_tokens from public,anon,authenticated;
create or replace function public.update_order_location(p_order_id uuid,p_token uuid,p_lat double precision,p_lng double precision)
returns void language plpgsql security definer set search_path=public as $$
declare loc jsonb;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Ubicación inválida'; end if;
  if not exists(select 1 from public.order_tracking_tokens where order_id=p_order_id and token=p_token and expires_at>now()) then raise exception 'Acceso de ubicación vencido'; end if;
  loc:=jsonb_build_object('lat',p_lat,'lng',p_lng,'timestamp',floor(extract(epoch from now())*1000));
  update public.orders set customer=jsonb_set(customer,'{coordenadas}',loc),location=loc,updated_at=now() where id=p_order_id and service='domicilio' and status not in ('cancelado','entregado');
end $$;
revoke all on function public.update_order_location(uuid,uuid,double precision,double precision) from public;
grant execute on function public.update_order_location(uuid,uuid,double precision,double precision) to anon,authenticated;

drop function if exists public.create_reservation_record(jsonb);
alter function public.create_reservation_request(jsonb) rename to create_reservation_record;
revoke all on function public.create_reservation_record(jsonb) from public,anon,authenticated;
create or replace function public.create_reservation_request(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare key uuid; request public.submission_requests%rowtype; hash text; result uuid;
begin
  key:=(payload->>'requestId')::uuid; if key is null then raise exception 'Actualiza la página para reservar'; end if;
  hash:=md5((payload-'requestId')::text);
  perform pg_advisory_xact_lock(hashtext(key::text));
  select * into request from public.submission_requests where request_id=key;
  if found then
    if request.kind<>'reservation' or request.fingerprint<>hash then raise exception 'Solicitud reutilizada con otros datos'; end if;
    return request.result_id;
  end if;
  result:=public.create_reservation_record(payload);
  insert into public.submission_requests values(key,'reservation',hash,result,now());
  return result;
end $$;
revoke all on function public.create_reservation_request(jsonb) from public;
grant execute on function public.create_reservation_request(jsonb) to anon,authenticated;

create or replace function public.merge_contacts(p_keep_phone text,p_merge_phone text)
returns void language plpgsql security definer set search_path=public as $$
declare kept public.contacts%rowtype; merged public.contacts%rowtype;
begin
  if not public.is_la_tuba_admin() then raise exception 'Acceso denegado'; end if;
  perform pg_advisory_xact_lock(hashtext('la_tuba_contacts_merge'));
  select * into kept from public.contacts where phone=public.existing_contact_phone(p_keep_phone) for update;
  select * into merged from public.contacts where phone=public.existing_contact_phone(p_merge_phone) for update;
  if kept.id is null or merged.id is null or kept.id=merged.id then raise exception 'Selecciona dos contactos distintos'; end if;
  update public.contacts set email=coalesce(kept.email,merged.email),birthday=coalesce(kept.birthday,merged.birthday),addresses=kept.addresses||merged.addresses,
    document_number=coalesce(kept.document_number,merged.document_number),admin_note=concat_ws(E'\n',kept.admin_note,merged.admin_note),tags=array(select distinct unnest(kept.tags||merged.tags)) where id=kept.id;
  update public.orders set customer_id=kept.id where customer_id=merged.id;
  update public.reservations set contact_id=kept.id where contact_id=merged.id;
  delete from public.contacts where id=merged.id;
  perform public.refresh_contact_purchase_stats(kept.id);
end $$;
revoke all on function public.merge_contacts(text,text) from public;
grant execute on function public.merge_contacts(text,text) to authenticated;
revoke all on function public.refresh_contact_purchase_stats(uuid) from public,anon,authenticated;
revoke update on public.orders from authenticated;
grant update(customer,items,subtotal,delivery,total,service,payment_method,status,comments,location,promotions,discount_total,updated_at,admin_note,payment_details,delivery_amount,business_amount,status_history) on public.orders to authenticated;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title))>0), description text not null default '',
  starts_at timestamptz not null, image_url text, published boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 100),
  rating integer not null check(rating between 1 and 5), comment text not null check(length(trim(comment)) between 5 and 2000),
  approved boolean not null default false, request_id uuid not null unique, created_at timestamptz not null default now()
);
alter table public.events enable row level security;
alter table public.reviews enable row level security;
drop policy if exists "Read events" on public.events;
create policy "Read events" on public.events for select using(published or public.is_la_tuba_admin());
drop policy if exists "Admin events" on public.events;
create policy "Admin events" on public.events for all to authenticated using(public.is_la_tuba_admin()) with check(public.is_la_tuba_admin());
drop policy if exists "Read reviews" on public.reviews;
create policy "Read reviews" on public.reviews for select using(approved or public.is_la_tuba_admin());
drop policy if exists "Admin reviews" on public.reviews;
create policy "Admin reviews" on public.reviews for all to authenticated using(public.is_la_tuba_admin()) with check(public.is_la_tuba_admin());
grant select on public.events,public.reviews to anon,authenticated;
grant insert,update,delete on public.events,public.reviews to authenticated;
create or replace function public.submit_review(p_name text,p_rating integer,p_comment text,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
  insert into public.reviews(name,rating,comment,request_id) values(trim(p_name),p_rating,trim(p_comment),p_request_id)
    on conflict(request_id) do nothing returning id into result;
  if result is null then select id into result from public.reviews where request_id=p_request_id; end if;
  return result;
end $$;
revoke all on function public.submit_review(text,integer,text,uuid) from public;
grant execute on function public.submit_review(text,integer,text,uuid) to anon,authenticated;
