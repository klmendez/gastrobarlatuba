-- Una edición no puede dejar el saldo cobrado por encima del nuevo total.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_paid_total_within_total' and conrelid = 'public.orders'::regclass) then
    alter table public.orders add constraint orders_paid_total_within_total check (paid_total >= 0 and paid_total <= total) not valid;
  end if;
end $$;
alter table public.orders validate constraint orders_paid_total_within_total;
