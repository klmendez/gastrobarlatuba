import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { cop } from '../../lib/format';
import { bogotaToday, periodDates, type AdminPeriod } from '../../lib/adminPeriods';

type Statistics = { orders: number; active_orders: number; cancelled: number; order_total: number; outstanding: number; collected: number; refunded: number; cash: number; transfer: number; customers: number; prospects: number; reservations: number; products: { name: string; quantity: number }[]; services: { name: string; count: number }[] };
const serviceNames: Record<string, string> = { local: 'En el local', llevar: 'Para llevar', domicilio: 'Domicilio' };
const choices: { value: AdminPeriod; label: string }[] = [{ value: 'dia', label: 'Día' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mes' }];

export default function StatisticsAdmin() {
  const [period, setPeriod] = useState<AdminPeriod>('mes');
  const [date, setDate] = useState(bogotaToday);
  const [result, setResult] = useState<Statistics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const { from, until } = periodDates(date, period);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) { if (active) { setLoading(false); setError('No hay conexión con Supabase.'); } return; }
      if (active) { setLoading(true); setError(''); }
      const { data, error: requestError } = await supabase.rpc('la_tuba_statistics', { p_from: from, p_until: until });
      if (!active) return;
      if (requestError) { setResult(null); setError('No se pudieron cargar las estadísticas. Comprueba tu sesión y vuelve a intentar.'); }
      else setResult(data as Statistics);
      setLoading(false);
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [from, until, revision]);

  const cards = result ? [
    { label: 'Pedidos registrados', value: result.orders, detail: `${result.cancelled} cancelados` },
    { label: 'Valor de pedidos', value: cop(result.order_total), detail: 'Sin pedidos cancelados' },
    { label: 'Cobrado', value: cop(result.collected), detail: 'Movimientos recibidos en el periodo' },
    { label: 'Devuelto', value: cop(result.refunded), detail: 'Devoluciones del periodo' },
    { label: 'Cobro neto', value: cop(result.collected - result.refunded), detail: 'Cobros menos devoluciones' },
    { label: 'Saldo pendiente', value: cop(result.outstanding), detail: 'De los pedidos creados en el periodo' },
    { label: 'Reservas solicitadas', value: result.reservations, detail: 'Creadas durante el periodo' },
    { label: 'Clientes / prospectos', value: `${result.customers} / ${result.prospects}`, detail: 'Totales actuales, no del periodo' },
  ] : [];

  return <div className="space-y-6 text-[#321506]">
    <header><h2 className="font-serif text-2xl text-[#542006]">Estadísticas de La Tuba</h2><p className="mt-2 text-sm text-[#806958]">Datos de Supabase, actualizados automáticamente cada 30 segundos. Zona horaria: Colombia.</p></header>
    <div className="flex flex-wrap items-end gap-3"><fieldset><legend className="mb-1 text-xs font-semibold uppercase">Periodo</legend><div className="flex">{choices.map(choice => <button key={choice.value} type="button" aria-pressed={period === choice.value} onClick={() => setPeriod(choice.value)} className={`border px-4 py-2 text-sm ${period === choice.value ? 'border-[#6b2c0e] bg-[#6b2c0e] text-white' : 'border-[#d9c6ad] bg-white'}`}>{choice.label}</button>)}</div></fieldset><label className="text-xs font-semibold uppercase">Fecha de referencia<input type="date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} className="mt-1 block border bg-white px-3 py-2 text-sm font-normal" /></label><button type="button" onClick={() => setRevision(value => value + 1)} className="border px-4 py-2 text-sm">Actualizar</button></div>
    <p className="text-xs text-[#806958]">Desde {from} hasta antes de {until}. La semana empieza el lunes.</p>
    {loading && !result && <p role="status">Cargando estadísticas…</p>}
    {error && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {result && <><div className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => <div key={card.label} className="border-b border-[#d9c6ad] py-4"><p className="text-xs font-semibold uppercase text-[#806958]">{card.label}</p><p className="mt-2 text-2xl font-semibold">{card.value}</p><p className="mt-1 text-xs text-[#806958]">{card.detail}</p></div>)}</div><div className="grid gap-6 lg:grid-cols-2"><section className="border-t border-[#6b2c0e]/30 py-4"><h3 className="font-serif text-xl">Productos más pedidos</h3><p className="mt-1 text-xs text-[#806958]">Unidades de pedidos no cancelados; no representa utilidad.</p>{result.products.length ? <ol className="mt-3 divide-y divide-[#d9c6ad]">{result.products.map(product => <li key={product.name} className="flex justify-between gap-3 py-2 text-sm"><span>{product.name}</span><b>{product.quantity}</b></li>)}</ol> : <p className="mt-4 text-sm text-[#806958]">No hay productos pedidos en este periodo.</p>}</section><section className="border-t border-[#6b2c0e]/30 py-4"><h3 className="font-serif text-xl">Servicios y medios de pago</h3><div className="mt-3 space-y-2 text-sm">{result.services.map(service => <p key={service.name} className="flex justify-between"><span>{serviceNames[service.name] || service.name}</span><b>{service.count} pedidos</b></p>)}{!result.services.length && <p>No hay pedidos en este periodo.</p>}<hr className="border-[#d9c6ad]" /><p className="flex justify-between"><span>Efectivo neto</span><b>{cop(result.cash)}</b></p><p className="flex justify-between"><span>Transferencia neta</span><b>{cop(result.transfer)}</b></p></div></section></div><p className="text-xs text-[#806958]">Los cobros se cuentan por la fecha en que se registraron, incluso si el pedido se hizo otro día. La rentabilidad requiere datos de costos.</p></>}
  </div>;
}
