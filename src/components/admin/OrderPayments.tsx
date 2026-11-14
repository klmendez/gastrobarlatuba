import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { cop } from '../../lib/format';
import { completeSubmission, submissionIdentity } from '../../lib/submission';
type Payment = { id: string; amount: number; method: string; created_at: string; note: string };
export default function OrderPayments({ orderId, total, onChanged }: { orderId: string; total: number; onChanged: () => void }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Efectivo');
  const [refund, setRefund] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const load = async () => { const result = await supabase!.from('order_payments').select('*').eq('order_id', orderId).order('created_at'); if(result.error) setMessage(result.error.message); else setPayments(result.data); };
  useEffect(() => { void load(); }, [orderId]);
  const paid = payments.reduce((sum,p) => sum+p.amount,0);
  const balance = Math.max(0, total - paid);
  return <section className="border-t border-rojo/20 py-4"><h3 className="font-semibold">Cobros y devoluciones</h3><p className="my-2 text-sm">Cobrado: {cop(paid)} · Saldo: {cop(balance)}</p>{balance > 0 && !refund && <button type="button" onClick={() => setAmount(String(balance))} className="mb-3 text-sm font-semibold text-rojo underline">Cobrar saldo completo ({cop(balance)})</button>}<form className="flex flex-wrap items-end gap-2" onSubmit={async event => {
    event.preventDefault(); if(lock.current || !supabase) return; lock.current=true; setSaving(true); setMessage('');
    const data={p_order_id:orderId,p_amount:Number(amount)*(refund?-1:1),p_method:method};
    const identity=submissionIdentity('payment',data);
    try { const {error}=await supabase.rpc('record_order_payment',{...data,p_request_id:identity.requestId,p_note:refund?'Devolución registrada en caja':'Cobro registrado en caja'}); if(error) throw error; completeSubmission('payment'); setAmount(''); await load(); onChanged(); setMessage(refund ? 'Devolución guardada.' : Number(amount) === balance ? 'Pago completo guardado. El saldo quedó en cero.' : 'Abono guardado. Aún queda saldo pendiente.'); }
    catch(error) { setMessage(error instanceof Error?error.message:String((error as {message?: string}).message || 'No se pudo guardar')); }
    finally {lock.current=false;setSaving(false);}
  }}><label className="text-xs">Operación<select className="block border p-2" value={refund?'refund':'payment'} onChange={e=>setRefund(e.target.value==='refund')}><option value="payment">Cobro</option><option value="refund">Devolución</option></select></label><label className="text-xs">Importe<input required min="1" step="1" type="number" className="block w-32 border p-2" value={amount} onChange={e=>setAmount(e.target.value)}/></label><select aria-label="Método de pago" className="border p-2" value={method} onChange={e=>setMethod(e.target.value)}><option>Efectivo</option><option>Transferencia</option></select><button disabled={saving} className="bg-rojo px-4 py-2 text-white">{saving?'Guardando…':'Registrar'}</button></form><p role="status" className="my-2 text-sm">{message}</p><ul className="divide-y">{payments.map(p=><li key={p.id} className="flex justify-between gap-3 py-2 text-xs"><span>{new Date(p.created_at).toLocaleString('es-CO')} · {p.method}</span><b>{cop(p.amount)}</b></li>)}</ul><p className="mt-2 text-xs text-stone-500">Cambiar el estado del pedido no registra un cobro. Registra aquí el dinero recibido o devuelto.</p></section>;
}
