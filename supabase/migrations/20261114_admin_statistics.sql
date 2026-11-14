-- Estadísticas agregadas en servidor, accesibles únicamente a administradores.
create or replace function public.la_tuba_statistics(p_from date, p_until date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.is_la_tuba_admin() then raise exception 'Acceso denegado'; end if;
  if p_from is null or p_until is null or p_from >= p_until or p_until - p_from > 3660 then raise exception 'Periodo inválido'; end if;
  with selected as (
    select * from public.orders where business='la_tuba'
      and created_at >= (p_from::timestamp at time zone 'America/Bogota')
      and created_at < (p_until::timestamp at time zone 'America/Bogota')
  ), payments as (
    select p.amount,p.method from public.order_payments p join public.orders o on o.id=p.order_id
    where o.business='la_tuba' and p.created_at >= (p_from::timestamp at time zone 'America/Bogota')
      and p.created_at < (p_until::timestamp at time zone 'America/Bogota')
  ), products as (
    select coalesce(nullif(trim(i->'product'->>'name'),''),'Producto') name,
      sum(case when coalesce(i->>'qty','') ~ '^[0-9]+$' then (i->>'qty')::integer else 0 end)::bigint quantity
    from selected o cross join lateral jsonb_array_elements(o.items) i
    where o.status <> 'cancelado' group by 1 order by quantity desc, name limit 8
  )
  select jsonb_build_object(
    'orders', (select count(*) from selected),
    'active_orders', (select count(*) from selected where status <> 'cancelado'),
    'cancelled', (select count(*) from selected where status = 'cancelado'),
    'order_total', (select coalesce(sum(total),0) from selected where status <> 'cancelado'),
    'outstanding', (select coalesce(sum(greatest(total-paid_total,0)),0) from selected where status <> 'cancelado'),
    'collected', (select coalesce(sum(amount) filter(where amount>0),0) from payments),
    'refunded', (select coalesce(-sum(amount) filter(where amount<0),0) from payments),
    'cash', (select coalesce(sum(amount) filter(where method='Efectivo'),0) from payments),
    'transfer', (select coalesce(sum(amount) filter(where method='Transferencia'),0) from payments),
    'services', (select coalesce(jsonb_agg(jsonb_build_object('name',service,'count',n) order by n desc),'[]'::jsonb) from (select service,count(*) n from selected where status <> 'cancelado' group by service) s),
    'products', (select coalesce(jsonb_agg(jsonb_build_object('name',name,'quantity',quantity) order by quantity desc,name),'[]'::jsonb) from products),
    'customers', (select count(*) from public.customers),
    'prospects', (select count(*) from public.prospects),
    'reservations', (select count(*) from public.reservations where created_at >= (p_from::timestamp at time zone 'America/Bogota') and created_at < (p_until::timestamp at time zone 'America/Bogota'))
  ) into result;
  return result;
end $$;
revoke all on function public.la_tuba_statistics(date,date) from public, anon;
grant execute on function public.la_tuba_statistics(date,date) to authenticated;
