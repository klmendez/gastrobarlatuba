import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { OrderItem } from '../lib/whatsapp';
import type { AppliedPromotion } from '../types/promotion';

export type Quote = { items: OrderItem[]; subtotal: number; delivery: number; total: number; descuentoTotal: number; promociones: AppliedPromotion[] };
export function useServerQuote(payload: unknown) {
  const key = JSON.stringify(payload);
  const [result, setResult] = useState<{ key: string; data: Quote | null; error: string }>({ key: '', data: null, error: '' });
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      if (!supabase) { if (alive) setResult({ key, data: null, error: 'Sin conexión con Supabase.' }); return; }
      try {
        const { data, error } = await supabase.rpc('quote_order', { payload: JSON.parse(key) });
        if (alive) setResult({ key, data: error ? null : data as Quote, error: error?.message || '' });
      } catch { if (alive) setResult({ key, data: null, error: 'No pudimos actualizar los precios. Revisa tu conexión.' }); }
    };
    const delay = window.setTimeout(() => { void refresh(); }, 250);
    const interval = window.setInterval(() => { void refresh(); }, 30000);
    return () => { alive = false; clearTimeout(delay); clearInterval(interval); };
  }, [key]);
  return result.key === key ? result : { key, data: null, error: 'Actualizando precios…' };
}
