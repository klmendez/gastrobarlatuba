-- El cobro posterior actualiza saldo y estado en la misma transacción.
create or replace function public.record_order_payment(p_order_id uuid,p_amount integer,p_method text,p_request_id uuid,p_note text default '')
returns uuid language plpgsql security definer set search_path=public as $$
declare ord public.orders%rowtype; existing public.order_payments%rowtype; result uuid; next_paid integer;
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
  next_paid:=ord.paid_total+p_amount;
  update public.orders set
    paid_total=next_paid,
    payment_method=case when p_amount>0 then p_method else payment_method end,
    status=case
      when status='no_pagado' and next_paid=total then 'pagado'
      when status='pagado' and next_paid<total then 'no_pagado'
      else status
    end,
    updated_at=now()
  where id=p_order_id;
  return result;
end $$;
revoke all on function public.record_order_payment(uuid,integer,text,uuid,text) from public;
grant execute on function public.record_order_payment(uuid,integer,text,uuid,text) to authenticated;
