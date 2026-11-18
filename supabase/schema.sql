-- La Tuba Gastrobar - estructura inicial de Supabase
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Los correos habilitados se administran desde PostgreSQL, no desde el navegador.
create table if not exists public.admin_emails (email text primary key);
alter table public.admin_emails enable row level security;
revoke all on public.admin_emails from anon, authenticated;
create or replace function public.is_la_tuba_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select auth.uid() is not null and exists (select 1 from public.admin_emails where email = lower(auth.jwt()->>'email')) $$;
revoke all on function public.is_la_tuba_admin() from public;
grant execute on function public.is_la_tuba_admin() to anon, authenticated;

create table if not exists public.daily_menus (
  id uuid primary key default gen_random_uuid(),
  scheduled_date date not null unique,
  title text not null default 'Menú del día',
  date_label text not null default 'Hoy',
  poster_style text not null default 'clasico',
  price integer not null check (price >= 0),
  active boolean not null default false,
  soups jsonb not null default '[]'::jsonb,
  sides jsonb not null default '[]'::jsonb,
  proteins jsonb not null default '[]'::jsonb,
  specials jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Catálogo exclusivo de La Tuba. La categoría vive en el producto para evitar
-- una administración separada y no se importan referencias de Pecado Picoso.
create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null,
  item_type text not null check (item_type in ('carta', 'bebida', 'otro')),
  price integer not null check (price >= 0),
  image_url text,
  available boolean not null default true,
  business text not null default 'la_tuba' check (business = 'la_tuba'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists catalog_items_business_name_unique
  on public.catalog_items (business, lower(name));

-- Existencias de insumos y productos. Los movimientos conservan una referencia
-- opcional a pedidos para permitir una integración posterior sin descuentos automáticos.
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  unit text not null check (length(trim(unit)) > 0),
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  minimum_quantity numeric(14,3) not null default 0 check (minimum_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity_change numeric(14,3) not null check (quantity_change <> 0),
  reason text not null,
  order_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
drop policy if exists "Admins read inventory" on public.inventory_items;
create policy "Admins read inventory" on public.inventory_items for select to authenticated using (public.is_la_tuba_admin());
drop policy if exists "Admins edit inventory details" on public.inventory_items;
create policy "Admins edit inventory details" on public.inventory_items for update to authenticated using (public.is_la_tuba_admin()) with check (public.is_la_tuba_admin());
drop policy if exists "Admins read inventory movements" on public.inventory_movements;
create policy "Admins read inventory movements" on public.inventory_movements for select to authenticated using (public.is_la_tuba_admin());
revoke all on public.inventory_items, public.inventory_movements from anon, authenticated;
grant select on public.inventory_items, public.inventory_movements to authenticated;
grant update (name, unit, minimum_quantity, updated_at) on public.inventory_items to authenticated;

create or replace function public.create_inventory_item(p_name text, p_unit text, p_minimum numeric, p_initial numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare item_id uuid;
begin
  if not public.is_la_tuba_admin() then raise exception 'Acceso denegado'; end if;
  if p_initial is null or p_initial < 0 or p_minimum is null or p_minimum < 0 then raise exception 'Las cantidades deben ser positivas o cero'; end if;
  insert into public.inventory_items(name, unit, quantity, minimum_quantity) values (trim(p_name), trim(p_unit), p_initial, p_minimum) returning id into item_id;
  if p_initial > 0 then insert into public.inventory_movements(inventory_item_id, quantity_change, reason) values (item_id, p_initial, 'Existencia inicial'); end if;
  return item_id;
end $$;

create or replace function public.adjust_inventory(p_item_id uuid, p_change numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_la_tuba_admin() then raise exception 'Acceso denegado'; end if;
  if p_change is null or p_change = 0 or nullif(trim(p_reason), '') is null then raise exception 'Indica una cantidad y un motivo'; end if;
  update public.inventory_items set quantity = quantity + p_change, updated_at = now() where id = p_item_id and quantity + p_change >= 0;
  if not found then raise exception 'Insumo no encontrado o existencias insuficientes'; end if;
  insert into public.inventory_movements(inventory_item_id, quantity_change, reason) values (p_item_id, p_change, trim(p_reason));
end $$;
revoke all on function public.create_inventory_item(text,text,numeric,numeric) from public;
revoke all on function public.adjust_inventory(uuid,numeric,text) from public;
grant execute on function public.create_inventory_item(text,text,numeric,numeric), public.adjust_inventory(uuid,numeric,text) to authenticated;

-- Cada producto puede necesitar varios insumos; un insumo puede servir a varios productos.
create table if not exists public.catalog_inventory_requirements (
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity_required numeric(14,3) not null check (quantity_required > 0),
  primary key (catalog_item_id, inventory_item_id)
);
alter table public.catalog_inventory_requirements enable row level security;
drop policy if exists "Admins manage inventory links" on public.catalog_inventory_requirements;
create policy "Admins manage inventory links" on public.catalog_inventory_requirements for all to authenticated using (public.is_la_tuba_admin()) with check (public.is_la_tuba_admin());
revoke all on public.catalog_inventory_requirements from anon, authenticated;
grant select, insert, update, delete on public.catalog_inventory_requirements to authenticated;

create or replace function public.set_inventory_links(p_inventory_id uuid, p_links jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_la_tuba_admin() then raise exception 'Acceso denegado'; end if;
  if jsonb_typeof(p_links) <> 'array' then raise exception 'Lista de productos inválida'; end if;
  delete from public.catalog_inventory_requirements where inventory_item_id = p_inventory_id;
  insert into public.catalog_inventory_requirements(inventory_item_id, catalog_item_id, quantity_required)
  select p_inventory_id, (entry->>'id')::uuid, (entry->>'quantity')::numeric from jsonb_array_elements(p_links) entry;
end $$;
revoke all on function public.set_inventory_links(uuid,jsonb) from public;
grant execute on function public.set_inventory_links(uuid,jsonb) to authenticated;

create or replace function public.public_catalog_items()
returns setof public.catalog_items language sql stable security definer set search_path = public as $$
  select c.* from public.catalog_items c
  where c.available and c.business = 'la_tuba' and not exists (
    select 1 from public.catalog_inventory_requirements r join public.inventory_items i on i.id = r.inventory_item_id
    where r.catalog_item_id = c.id and i.quantity < r.quantity_required
  )
$$;
revoke all on function public.public_catalog_items() from public;
grant execute on function public.public_catalog_items() to anon, authenticated;

-- Incluye personas registradas o identificadas por teléfono, aunque todavía
-- no hayan comprado. No debe usarse directamente para estadísticas de clientes.
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text not null,
  email text,
  birthday text,
  addresses jsonb not null default '[]'::jsonb,
  order_count integer not null default 0,
  total_spent integer not null default 0,
  first_order_at timestamptz,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trata el prefijo colombiano opcional como el mismo celular, sin alterar
-- números internacionales ni modificar los contactos ya almacenados.
create or replace function public.normalized_contact_phone(input_phone text)
returns text language sql immutable as $$
  select case when length(digits) = 12 and left(digits, 2) = '57' then substring(digits from 3) else digits end
  from (select regexp_replace(coalesce(input_phone, ''), '\D', '', 'g') digits) p
$$;
create or replace function public.existing_contact_phone(input_phone text)
returns text language plpgsql stable security definer set search_path = public as $$
declare normalized text := public.normalized_contact_phone(input_phone); existing text; matches integer;
begin
  select count(*), min(phone) into matches, existing from public.contacts where public.normalized_contact_phone(phone) = normalized;
  if matches > 1 then raise exception 'Existen varios contactos con este número; el administrador debe revisarlos'; end if;
  return coalesce(existing, normalized);
end $$;
revoke all on function public.existing_contact_phone(text) from public;

drop function if exists public.get_verified_contact();

-- Búsqueda solicitada por La Tuba: expone únicamente los datos necesarios
-- para completar un pedido o reserva al introducir el celular exacto.
create or replace function public.get_contact_by_phone(p_phone text)
returns table (name text, email text, birthday text, addresses jsonb)
language plpgsql stable security definer set search_path = public as $$
declare clean text := public.normalized_contact_phone(p_phone);
begin
  if length(clean) < 7 or length(clean) > 15 then return; end if;
  if (select count(*) from public.contacts c where public.normalized_contact_phone(c.phone) = clean) <> 1 then return; end if;
  return query select c.name, c.email, c.birthday, c.addresses from public.contacts c where public.normalized_contact_phone(c.phone) = clean;
end $$;
revoke all on function public.get_contact_by_phone(text) from public;
grant execute on function public.get_contact_by_phone(text) to anon, authenticated;

-- Una solicitud no bloquea mesas ni implica disponibilidad confirmada.
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  customer_name text not null,
  phone text not null,
  reservation_date date not null,
  reservation_time time not null,
  party_size integer not null check (party_size > 0 and party_size <= 500),
  space_type text not null check (space_type in ('mesas', 'lugar_completo')),
  requested_tables integer check (requested_tables between 1 and 7),
  decoration text,
  notes text,
  assigned_tables integer[] not null default '{}',
  status text not null default 'pendiente' check (status in ('pendiente','confirmada','cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((space_type = 'mesas' and requested_tables is not null) or (space_type = 'lugar_completo' and requested_tables is null)),
  check (assigned_tables <@ array[1,2,3,4,5,6,7])
);
alter table public.reservations enable row level security;
drop policy if exists "Admins manage reservations" on public.reservations;
create policy "Admins manage reservations" on public.reservations for all to authenticated using (public.is_la_tuba_admin()) with check (public.is_la_tuba_admin());
revoke all on public.reservations from anon, authenticated;
grant select, update on public.reservations to authenticated;

create or replace function public.create_reservation_request(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare clean_phone text; contact_id uuid; new_id uuid; customer_name text;
begin
  clean_phone := regexp_replace(coalesce(payload->>'phone', ''), '\D', '', 'g');
  customer_name := trim(coalesce(payload->>'name', ''));
  if length(clean_phone) < 7 or length(clean_phone) > 15 or length(customer_name) < 2 then raise exception 'Indica un nombre y celular válidos'; end if;
  if (payload->>'date')::date < (now() at time zone 'America/Bogota')::date then raise exception 'La fecha debe ser hoy o posterior'; end if;
  insert into public.contacts(phone, name) values (clean_phone, customer_name)
    on conflict (phone) do update set updated_at = now() returning id into contact_id;
  insert into public.reservations(contact_id, customer_name, phone, reservation_date, reservation_time, party_size, space_type, requested_tables, decoration, notes)
  values (contact_id, customer_name, clean_phone, (payload->>'date')::date, (payload->>'time')::time,
    (payload->>'people')::integer, payload->>'space', nullif(payload->>'tables', '')::integer,
    nullif(trim(payload->>'decoration'), ''), nullif(trim(payload->>'notes'), '')) returning id into new_id;
  return new_id;
end $$;

create or replace function public.manage_reservation(p_id uuid, p_status text, p_tables integer[])
returns void language plpgsql security definer set search_path = public as $$
declare current_res public.reservations%rowtype; start_at timestamptz;
begin
  if not public.is_la_tuba_admin() then raise exception 'Acceso denegado'; end if;
  if p_status not in ('pendiente','confirmada','cancelada') or p_tables is null or not p_tables <@ array[1,2,3,4,5,6,7] or cardinality(p_tables) <> (select count(distinct n) from unnest(p_tables) n) then raise exception 'Asignación inválida'; end if;
  perform pg_advisory_xact_lock(hashtext('la_tuba_reservations'));
  select * into current_res from public.reservations where id = p_id for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if current_res.space_type = 'lugar_completo' and cardinality(p_tables) > 0 then raise exception 'La reserva es para todo el lugar'; end if;
  if p_status = 'confirmada' and current_res.space_type = 'mesas' and cardinality(p_tables) <> current_res.requested_tables then raise exception 'Selecciona las mesas necesarias'; end if;
  if p_status <> 'cancelada' then
    start_at := (current_res.reservation_date + current_res.reservation_time) at time zone 'America/Bogota';
    if exists (select 1 from public.reservations r where r.id <> p_id and r.status in ('pendiente','confirmada')
      and (r.reservation_date + r.reservation_time) at time zone 'America/Bogota' < start_at + make_interval(mins => current_res.duration_minutes)
      and (r.reservation_date + r.reservation_time) at time zone 'America/Bogota' + make_interval(mins => r.duration_minutes) > start_at
      and (current_res.space_type = 'lugar_completo' or r.space_type = 'lugar_completo' or r.assigned_tables && p_tables)) then raise exception 'Una de estas mesas ya está asignada en ese horario'; end if;
  end if;
  update public.reservations set status = p_status, assigned_tables = p_tables, updated_at = now() where id = p_id;
end $$;
revoke all on function public.manage_reservation(uuid,text,integer[]) from public;
grant execute on function public.manage_reservation(uuid,text,integer[]) to authenticated;
revoke all on function public.create_reservation_request(jsonb) from public;
grant execute on function public.create_reservation_request(jsonb) to anon, authenticated;

create table if not exists public.reservation_settings (
  id integer primary key default 1 check (id = 1),
  open_days integer[] not null default '{}',
  slots text[] not null default '{}',
  duration_minutes integer not null default 120 check (duration_minutes between 15 and 720),
  seats_per_table integer not null default 0 check (seats_per_table between 0 and 100),
  decoration_price integer check (decoration_price > 0)
);
insert into public.reservation_settings(id) values (1) on conflict do nothing;
alter table public.reservation_settings enable row level security;
drop policy if exists "Admins manage reservation settings" on public.reservation_settings;
create policy "Admins manage reservation settings" on public.reservation_settings for all to authenticated using (public.is_la_tuba_admin()) with check (public.is_la_tuba_admin());
revoke all on public.reservation_settings from anon, authenticated;
grant select, update on public.reservation_settings to authenticated;
alter table public.reservations add column if not exists duration_minutes integer not null default 120;
alter table public.reservations add column if not exists decoration_price integer;
alter table public.reservations add column if not exists occasion text;
alter table public.reservations add column if not exists allergies text;

create or replace function public.get_reservation_settings()
returns table (seats_per_table integer, decoration_price integer)
language sql stable security definer set search_path = public as $$
  select s.seats_per_table, s.decoration_price from public.reservation_settings s where s.id = 1
$$;
revoke all on function public.get_reservation_settings() from public;
grant execute on function public.get_reservation_settings() to anon, authenticated;

create or replace function public.get_reservation_slots(p_from date, p_to date, p_people integer, p_space text)
returns table (available_date date, slot text, remaining_tables integer)
language plpgsql stable security definer set search_path = public as $$
declare settings public.reservation_settings%rowtype; day date; t text; start_at timestamptz; occupied integer; needed integer;
begin
  select * into settings from public.reservation_settings where id = 1;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 90 or p_people is null or p_people < 2 or p_space not in ('mesas','lugar_completo') or settings.seats_per_table < 1 then return; end if;
  needed := case when p_space = 'lugar_completo' then 7 else ceil(p_people::numeric / settings.seats_per_table)::integer end;
  if p_people > settings.seats_per_table * 7 or needed > 7 then return; end if;
  for day in select generate_series(p_from, p_to, '1 day'::interval)::date loop
    if extract(isodow from day)::integer = any(settings.open_days) then
      foreach t in array settings.slots loop
        if t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then continue; end if;
        start_at := (day + t::time) at time zone 'America/Bogota';
        if start_at <= now() then continue; end if;
        select coalesce(sum(case when r.space_type = 'lugar_completo' then 7 else r.requested_tables end),0)::integer into occupied
        from public.reservations r
        where r.status in ('pendiente','confirmada')
          and (r.reservation_date + r.reservation_time) at time zone 'America/Bogota' < start_at + make_interval(mins => settings.duration_minutes)
          and (r.reservation_date + r.reservation_time) at time zone 'America/Bogota' + make_interval(mins => r.duration_minutes) > start_at;
        if 7 - occupied >= needed then available_date := day; slot := t; remaining_tables := greatest(7 - occupied,0); return next; end if;
      end loop;
    end if;
  end loop;
end $$;
revoke all on function public.get_reservation_slots(date,date,integer,text) from public;
grant execute on function public.get_reservation_slots(date,date,integer,text) to anon, authenticated;

create or replace function public.create_reservation_request(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare clean_phone text; contact_id uuid; new_id uuid; customer_name text; settings public.reservation_settings%rowtype; reservation_day date; reservation_clock time; people integer; space text; tables integer; decoration text; birthday text;
begin
  perform pg_advisory_xact_lock(hashtext('la_tuba_reservations'));
  select * into settings from public.reservation_settings where id = 1;
  clean_phone := public.existing_contact_phone(payload->>'phone'); customer_name := trim(coalesce(payload->>'name', ''));
  if length(clean_phone) < 7 or length(clean_phone) > 15 or length(customer_name) < 2 then raise exception 'Indica un nombre y celular válidos'; end if;
  reservation_day := (payload->>'date')::date; reservation_clock := (payload->>'time')::time; people := (payload->>'people')::integer; space := payload->>'space';
  if reservation_day > (now() at time zone 'America/Bogota')::date + 90 or not exists (select 1 from public.get_reservation_slots(reservation_day,reservation_day,people,space) available where available.slot::time = reservation_clock) then raise exception 'La fecha u hora ya no está disponible'; end if;
  tables := case when space = 'mesas' then ceil(people::numeric / settings.seats_per_table)::integer else null end;
  decoration := nullif(trim(payload->>'decoration'), '');
  if decoration is not null and (settings.decoration_price is null or ((reservation_day + reservation_clock) at time zone 'America/Bogota') < now() + interval '8 hours') then raise exception 'La decoración requiere al menos 8 horas de antelación y un precio configurado'; end if;
  birthday := nullif(trim(payload->>'birthday'), '');
  if birthday is not null then birthday := to_char(birthday::date, 'MM-DD'); end if;
  insert into public.contacts(phone, name, birthday) values (clean_phone, customer_name, birthday)
    on conflict (phone) do update set name = excluded.name, birthday = coalesce(excluded.birthday, public.contacts.birthday), updated_at = now() returning id into contact_id;
  insert into public.reservations(contact_id, customer_name, phone, reservation_date, reservation_time, party_size, space_type, requested_tables, decoration, notes, occasion, allergies, duration_minutes, decoration_price)
  values (contact_id, customer_name, clean_phone, reservation_day, reservation_clock, people, space, tables, decoration, nullif(trim(payload->>'notes'), ''), nullif(trim(payload->>'occasion'), ''), nullif(trim(payload->>'allergies'), ''), settings.duration_minutes, case when decoration is null then null else settings.decoration_price end) returning id into new_id;
  return new_id;
end $$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references public.contacts(id) on delete set null,
  customer jsonb not null,
  items jsonb not null,
  subtotal integer not null,
  delivery integer not null default 0,
  total integer not null,
  service text not null check (service in ('local', 'llevar', 'domicilio')),
  payment_method text not null,
  status text not null default 'no_pagado',
  comments text,
  location jsonb,
  promotions jsonb not null default '[]'::jsonb,
  discount_total integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'inventory_movements_order_id_fkey' and conrelid = 'public.inventory_movements'::regclass) then
    alter table public.inventory_movements add constraint inventory_movements_order_id_fkey foreign key (order_id) references public.orders(id) on delete set null;
  end if;
end $$;

alter table public.orders add column if not exists business text not null default 'la_tuba';
alter table public.orders add column if not exists sale_type text not null default 'carta';
alter table public.orders add column if not exists channel text not null default 'web';
alter table public.orders add column if not exists admin_note text;
alter table public.orders add column if not exists payment_details jsonb;
alter table public.orders add column if not exists delivery_amount integer;
alter table public.orders add column if not exists business_amount integer;
alter table public.orders add column if not exists status_history jsonb not null default '[]'::jsonb;

create or replace function public.set_order_item_served(p_order_id uuid, p_item_id text, p_served boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_la_tuba_admin() then raise exception 'Acceso denegado'; end if;
  update public.orders o set items = (
    select coalesce(jsonb_agg(case when element->>'id' = p_item_id then jsonb_set(element, '{servido}', to_jsonb(p_served), true) else element end order by ord), '[]'::jsonb)
    from jsonb_array_elements(o.items) with ordinality as entry(element, ord)
  ), updated_at = now()
  where o.id = p_order_id and o.business = 'la_tuba' and o.service = 'local'
    and exists (select 1 from jsonb_array_elements(o.items) element where element->>'id' = p_item_id);
  if not found then raise exception 'Pedido o producto no encontrado'; end if;
end $$;
revoke all on function public.set_order_item_served(uuid,text,boolean) from public;
grant execute on function public.set_order_item_served(uuid,text,boolean) to authenticated;

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.promotions enable row level security;
drop policy if exists "Public can read active promotions" on public.promotions;
create policy "Public can read active promotions" on public.promotions for select using (active);
drop policy if exists "Authenticated users manage promotions" on public.promotions;
create policy "Authenticated users manage promotions" on public.promotions for all to authenticated using (public.is_la_tuba_admin()) with check (public.is_la_tuba_admin());
grant select on public.promotions to anon, authenticated;
grant insert, update, delete on public.promotions to authenticated;
alter table public.orders drop constraint if exists orders_business_check;
alter table public.orders add constraint orders_business_check check (business = 'la_tuba');
alter table public.orders drop constraint if exists orders_sale_type_check;
alter table public.orders add constraint orders_sale_type_check check (sale_type in ('menu_dia', 'carta', 'bebida', 'otro', 'mixto'));
alter table public.orders drop constraint if exists orders_channel_check;
alter table public.orders add constraint orders_channel_check check (channel in ('web', 'admin'));

alter table public.app_settings enable row level security;
alter table public.daily_menus enable row level security;
alter table public.catalog_items enable row level security;
alter table public.contacts enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Public can read active daily menus" on public.daily_menus;
create policy "Public can read active daily menus" on public.daily_menus
  for select using (active = true);

drop policy if exists "Authenticated users manage daily menus" on public.daily_menus;
create policy "Authenticated users manage daily menus" on public.daily_menus
  for all to authenticated using (public.is_la_tuba_admin()) with check (public.is_la_tuba_admin());

drop policy if exists "Public can read available catalog" on public.catalog_items;
create policy "Public can read available catalog" on public.catalog_items
  for select using (available = true and business = 'la_tuba');

drop policy if exists "Authenticated users manage catalog" on public.catalog_items;
create policy "Authenticated users manage catalog" on public.catalog_items
  for all to authenticated using (business = 'la_tuba' and public.is_la_tuba_admin()) with check (business = 'la_tuba' and public.is_la_tuba_admin());

drop policy if exists "Anyone can create orders" on public.orders;

drop policy if exists "Authenticated users manage orders" on public.orders;
create policy "Authenticated users manage orders" on public.orders
  for all to authenticated using (public.is_la_tuba_admin()) with check (public.is_la_tuba_admin());

drop policy if exists "Anyone can create contacts" on public.contacts;

drop policy if exists "Authenticated users manage contacts" on public.contacts;
create policy "Authenticated users manage contacts" on public.contacts
  for all to authenticated using (public.is_la_tuba_admin()) with check (public.is_la_tuba_admin());

drop policy if exists "Authenticated users manage settings" on public.app_settings;
create policy "Authenticated users manage settings" on public.app_settings
  for all to authenticated using (public.is_la_tuba_admin()) with check (public.is_la_tuba_admin());

-- Solo estas personas cuentan como clientes en el panel y las estadísticas.
-- Un contacto aparece aquí después de registrar su primer pedido.
alter table public.contacts add column if not exists document_number text;
alter table public.contacts add column if not exists admin_note text;
alter table public.contacts add column if not exists tags text[] not null default '{}';
create or replace view public.customers
with (security_invoker = true)
as
select
  id,
  phone,
  name,
  email,
  birthday,
  addresses,
  order_count,
  total_spent,
  first_order_at,
  last_order_at,
  created_at,
  updated_at,
  document_number,
  admin_note,
  tags
from public.contacts
where order_count > 0;

-- Base separada para seguimiento de personas que aún no han comprado.
-- Puede mostrarse en una sección futura de "Contactos", sin mezclarse con Clientes.
create or replace view public.prospects
with (security_invoker = true)
as
select
  id,
  phone,
  name,
  email,
  birthday,
  addresses,
  created_at,
  updated_at
from public.contacts
where order_count = 0;

-- Mantiene automáticamente las estadísticas del contacto cuando se crea,
-- cambia o elimina un pedido. Los pedidos cancelados no cuentan.
create or replace function public.refresh_contact_purchase_stats(target_contact_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contacts contact
  set
    order_count = stats.order_count,
    total_spent = stats.total_spent,
    first_order_at = stats.first_order_at,
    last_order_at = stats.last_order_at,
    updated_at = now()
  from (
    select
      count(*) filter (where status <> 'cancelado')::integer as order_count,
      coalesce(sum(total) filter (where status <> 'cancelado'), 0)::integer as total_spent,
      min(created_at) filter (where status <> 'cancelado') as first_order_at,
      max(created_at) filter (where status <> 'cancelado') as last_order_at
    from public.orders
    where customer_id = target_contact_id
  ) stats
  where contact.id = target_contact_id;
end;
$$;

create or replace function public.sync_contact_purchase_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.customer_id is not null then
    perform public.refresh_contact_purchase_stats(old.customer_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.customer_id is not null then
    perform public.refresh_contact_purchase_stats(new.customer_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_contact_stats_after_order on public.orders;
create trigger sync_contact_stats_after_order
after insert or update of status, total, customer_id or delete on public.orders
for each row execute function public.sync_contact_purchase_stats();

-- Registra el contacto y su pedido en una sola transacción segura.
create or replace function public.create_public_order(payload jsonb)
returns table (id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_phone text;
  contact_id uuid;
  customer_data jsonb;
  address_data jsonb;
  saved_order public.orders%rowtype;
  admin_sale boolean;
begin
  customer_data := coalesce(payload->'cliente', '{}'::jsonb);
  admin_sale := public.is_la_tuba_admin() and payload->>'canal' = 'admin';
  clean_phone := public.existing_contact_phone(customer_data->>'celular');
  if clean_phone = '' and not admin_sale then raise exception 'El número de celular es obligatorio'; end if;
  if not admin_sale and payload->>'servicio' = 'local' and coalesce(customer_data->>'mesa', '') not in ('1','2','3','4','5','6','7') then
    raise exception 'Selecciona una mesa válida';
  end if;

  -- Comprueba el consumo combinado de insumos compartidos al confirmar.
  if exists (
    select 1 from public.inventory_items i
    join public.catalog_inventory_requirements r on r.inventory_item_id = i.id
    join jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) item on item->'product'->>'id' = r.catalog_item_id::text
    group by i.id, i.quantity
    having sum(r.quantity_required * greatest(coalesce((item->>'qty')::numeric, 0), 0)) > i.quantity
  ) then raise exception 'No hay existencias suficientes para uno o más productos. Actualiza tu pedido.'; end if;

  if nullif(trim(customer_data->>'direccion'), '') is not null then
    address_data := jsonb_build_object(
      'direccion', trim(customer_data->>'direccion'),
      'barrio', nullif(trim(customer_data->>'barrio'), ''),
      'referencia', nullif(trim(customer_data->>'referencia'), ''),
      'lastUsed', now()
    );
  end if;

  if clean_phone <> '' then
  insert into public.contacts (phone, name, email, birthday, addresses)
  values (
    clean_phone,
    coalesce(nullif(trim(customer_data->>'nombres'), ''), 'Cliente'),
    nullif(trim(customer_data->>'correo'), ''),
    nullif(trim(customer_data->>'fechaNacimiento'), ''),
    case when address_data is null then '[]'::jsonb else jsonb_build_array(address_data) end
  )
  on conflict (phone) do update set
    name = excluded.name,
    email = coalesce(excluded.email, contacts.email),
    birthday = coalesce(excluded.birthday, contacts.birthday),
    addresses = case
      when address_data is null then contacts.addresses
      when exists (
        select 1 from jsonb_array_elements(contacts.addresses) saved
        where lower(trim(saved->>'direccion')) = lower(trim(address_data->>'direccion'))
      ) then (
        select coalesce(jsonb_agg(case
          when lower(trim(saved->>'direccion')) = lower(trim(address_data->>'direccion')) then saved || address_data
          else saved end), '[]'::jsonb)
        from jsonb_array_elements(contacts.addresses) saved
      )
      else contacts.addresses || jsonb_build_array(address_data)
    end,
    updated_at = now()
  returning contacts.id into contact_id;
  end if;

  insert into public.orders (
    order_number, customer_id, customer, items, subtotal, delivery, total,
    service, payment_method, status, comments, location, promotions, discount_total,
    business, sale_type, channel
  ) values (
    payload->>'numeroOrden', contact_id,
    customer_data || jsonb_build_object('celular', clean_phone),
    coalesce(payload->'items', '[]'::jsonb),
    coalesce((payload->>'subtotal')::integer, 0),
    coalesce((payload->>'delivery')::integer, 0),
    coalesce((payload->>'total')::integer, 0),
    payload->>'servicio', payload->>'formaPago',
    case when admin_sale then coalesce(payload->>'estado', 'no_pagado') else 'no_pagado' end,
    nullif(trim(payload->>'comentarios'), ''), customer_data->'coordenadas',
    coalesce(payload->'promociones', '[]'::jsonb),
    coalesce((payload->>'descuentoTotal')::integer, 0),
    'la_tuba', coalesce(payload->>'tipoVenta', 'carta'), case when admin_sale then 'admin' else 'web' end
  ) returning * into saved_order;

  return query select saved_order.id, saved_order.order_number;
end;
$$;

revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;

grant select on public.daily_menus to anon, authenticated;
grant select on public.catalog_items to anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant insert on public.contacts to anon, authenticated;
grant select, insert, update, delete on public.app_settings to authenticated;
grant select, insert, update, delete on public.daily_menus to authenticated;
grant select, insert, update, delete on public.catalog_items to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select on public.customers, public.prospects to authenticated;
