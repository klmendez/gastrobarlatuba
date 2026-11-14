import { useEffect, useMemo, useState } from 'react';
import { Cake, Minus, Plus, Save, Trash2, X } from 'lucide-react';
import { OrderService } from '../../services/orderService';
import { DailyMenuService, type DailyMenuConfig } from '../../services/dailyMenuService';
import { supabase } from '../../lib/supabase';
import { cop } from '../../lib/format';
import { getBasePrice, extrasTotal, deliveryCost } from '../../lib/pricing';
import { EXTRAS } from '../../data/extras';
import { BARRIOS, type Barrio } from '../../data/barrios';
import { BIRTHDAY_DISCOUNT_PERCENT } from '../../data/constants';
import { isBirthdayToday } from '../../lib/birthday';
import type { Product } from '../../data/products';
import type { OrderItem, Service } from '../../lib/whatsapp';
import type { PedidoFirestore, OrderUpdate } from '../../types/order';
import type { AppliedPromotion } from '../../types/promotion';

type CatalogItem = { id: string; name: string; description: string | null; category: string; item_type: string; price: number; image_url: string | null };
type Props = { order: PedidoFirestore & { id: string }; onClose: () => void; onSave: () => void };

const newLine = (product: Product): OrderItem => ({
  id: crypto.randomUUID(), product, qty: 1, version: null, size: null,
  toppingIds: [], extrasQty: {}, extraSelections: {}, note: '',
});

const unitPrice = (item: OrderItem) => getBasePrice(item.product, item.version, item.size) + extrasTotal(item.extrasQty ?? {}, EXTRAS);
const lineTotal = (item: OrderItem) => unitPrice(item) * item.qty;

export default function OrderEditModal({ order, onClose, onSave }: Props) {
  const [items, setItems] = useState<OrderItem[]>(order.items);
  const [service, setService] = useState<Service>(order.servicio);
  const [address, setAddress] = useState(order.cliente.direccion || '');
  const [barrio, setBarrio] = useState<Barrio | null>(BARRIOS.find(item => item.name === order.cliente.barrio) || null);
  const [adminNote, setAdminNote] = useState(order.notaAdmin || '');
  const [birthdayDiscount, setBirthdayDiscount] = useState((order.promociones ?? []).some(promo => promo.promoId === 'birthday'));
  const [verifiedDocument, setVerifiedDocument] = useState(order.cliente.cedula || '');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [dailyMenu, setDailyMenu] = useState<DailyMenuConfig | null>(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogId, setCatalogId] = useState('');
  const [menuChoice, setMenuChoice] = useState('base');
  const [extraDescription, setExtraDescription] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!supabase) throw new Error('Supabase no está configurado.');
        const [result, menu] = await Promise.all([
          supabase.from('catalog_items').select('id,name,description,category,item_type,price,image_url').eq('available', true).eq('business', 'la_tuba').order('name'),
          DailyMenuService.get(),
        ]);
        if (result.error) throw result.error;
        if (active) { setCatalog(result.data ?? []); setDailyMenu(menu.active ? menu : null); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la carta.');
      } finally { if (active) setLoadingProducts(false); }
    };
    void load();
    return () => { active = false; };
  }, []);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + lineTotal(item), 0), [items]);
  const discountableBase = useMemo(() => items.reduce((sum, item) => item.product.categoryId === 'ajuste-manual' ? sum : sum + getBasePrice(item.product, item.version, item.size) * item.qty, 0), [items]);
  const otherPromotions = (order.promociones ?? []).filter(promo => promo.promoId !== 'birthday');
  const birthdayAmount = birthdayDiscount ? Math.round(discountableBase * BIRTHDAY_DISCOUNT_PERCENT / 100) : 0;
  const discountTotal = Math.min(subtotal, otherPromotions.reduce((sum, promo) => sum + promo.descuento, 0) + birthdayAmount);
  const delivery = service !== 'domicilio' ? 0 : service === order.servicio && barrio?.name === order.cliente.barrio ? order.delivery : deliveryCost(service, barrio);
  const total = Math.max(0, subtotal + delivery - discountTotal);
  const paidTotal = order.paidTotal ?? 0;
  const filteredCatalog = catalog.filter(product => `${product.name} ${product.category}`.toLocaleLowerCase('es').includes(catalogQuery.toLocaleLowerCase('es')));

  const addCatalogItem = () => {
    const selected = catalog.find(product => product.id === catalogId);
    if (!selected || selected.price <= 0) { setError('Selecciona un producto disponible con precio.'); return; }
    setItems(current => [...current, newLine({
      id: selected.id, name: selected.name, description: selected.description || '', category: 'frutafresh',
      categoryId: `${selected.item_type}-${selected.category}`, prices: { fijo: selected.price },
      toppingsIncludedMax: 0, image: selected.image_url || undefined,
    })]);
    setCatalogId(''); setError('');
  };

  const addMenuItem = () => {
    if (!dailyMenu?.id) return;
    const special = menuChoice.startsWith('special:') ? dailyMenu.specials[Number(menuChoice.slice(8))] : null;
    const price = special ? special.price : dailyMenu.price;
    if (!Number.isInteger(price) || price <= 0) { setError('El menú elegido no tiene un precio válido.'); return; }
    setItems(current => [...current, newLine({
      id: dailyMenu.id!, dailyMenuId: dailyMenu.id, menuChoices: special ? { special: special.name } : {},
      name: special?.name || dailyMenu.title, description: 'Menú del día', category: 'frutafresh',
      categoryId: 'menu-del-dia', prices: { fijo: price }, toppingsIncludedMax: 0,
    })]);
    setError('');
  };

  const addExtra = () => {
    const amount = Number(extraAmount);
    const description = extraDescription.trim();
    if (!description || description.length > 200 || !Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000_000) {
      setError('Escribe el detalle del adicional y un importe positivo válido.'); return;
    }
    setItems(current => [...current, newLine({
      id: crypto.randomUUID(), name: description, description: 'Cargo adicional fuera de carta',
      category: 'frutafresh', categoryId: 'ajuste-manual', prices: { fijo: amount }, toppingsIncludedMax: 0,
    })]);
    setExtraDescription(''); setExtraAmount(''); setError('');
  };

  const changeQuantity = (id: string, delta: number) => setItems(current => current.flatMap(item => item.id !== id ? [item] : item.qty + delta > 0 ? [{ ...item, qty: item.qty + delta }] : []));
  const removeItem = (id: string) => setItems(current => current.filter(item => item.id !== id));

  const save = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      if (!items.length) throw new Error('El pedido debe tener al menos un producto o adicional.');
      if (items.some(item => !Number.isSafeInteger(item.qty) || item.qty < 1 || !Number.isSafeInteger(unitPrice(item)) || unitPrice(item) <= 0)) throw new Error('Revisa las cantidades y los precios del pedido.');
      if (service === 'domicilio' && (!address.trim() || !barrio || barrio.price === null)) throw new Error('Indica dirección y barrio con tarifa de domicilio.');
      if (birthdayDiscount && !verifiedDocument.trim()) throw new Error('Escribe la cédula verificada para aplicar el descuento de cumpleaños.');
      const latest = await OrderService.getOrder(order.id);
      if (!latest) throw new Error('El pedido ya no existe.');
      if (total < (latest.paidTotal ?? 0)) throw new Error('El nuevo total sería menor que lo cobrado. Registra primero la devolución en el detalle del pedido.');
      const promotions: AppliedPromotion[] = [...otherPromotions];
      if (birthdayDiscount && birthdayAmount > 0) promotions.push({
        promoId: 'birthday', nombre: `Descuento de cumpleaños (${BIRTHDAY_DISCOUNT_PERCENT}%, verificado)`,
        tipo: 'porcentaje', valor: BIRTHDAY_DISCOUNT_PERCENT, descuento: birthdayAmount,
      });
      const update: OrderUpdate = {
        items, servicio: service, subtotal, delivery, total, descuentoTotal: discountTotal,
        promociones: promotions, notaAdmin: adminNote,
        cliente: { direccion: address.trim(), barrio: barrio?.name || '', ...(birthdayDiscount ? { cedula: verifiedDocument.trim() } : {}) },
      };
      if (latest.estado === 'pagado' && total > (latest.paidTotal ?? 0)) update.estado = 'no_pagado';
      await OrderService.updateOrder(order.id, update);
      onSave(); onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el pedido.');
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label={`Editar pedido ${order.numeroOrden}`}>
    <div className="absolute inset-0 bg-black/50" onClick={onClose} />
    <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl">
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b p-5"><div><h2 className="text-xl font-semibold">Editar pedido</h2><p className="text-sm text-gray-500">{order.numeroOrden} · {order.cliente.nombres} · {order.cliente.celular}</p></div><button type="button" onClick={onClose} aria-label="Cerrar editor" className="rounded p-2 hover:bg-gray-100"><X size={22} /></button></header>
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {error && <p role="alert" className="border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <section><h3 className="mb-3 font-semibold">Productos y adicionales</h3><div className="space-y-2">
            {items.map(item => <div key={item.id} className="rounded border p-3"><div className="flex flex-wrap items-center gap-2"><div className="min-w-40 flex-1"><b className="block">{item.product.name}</b><span className="text-xs text-gray-500">{item.product.categoryId === 'ajuste-manual' ? 'Adicional fuera de carta' : item.product.categoryId === 'menu-del-dia' ? 'Menú del día' : 'Producto'} · {cop(unitPrice(item))} c/u</span></div><div className="flex items-center gap-2"><button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label={`Restar ${item.product.name}`} className="rounded border p-1"><Minus size={16} /></button><span className="w-5 text-center">{item.qty}</span><button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label={`Sumar ${item.product.name}`} className="rounded border p-1"><Plus size={16} /></button></div><b className="min-w-20 text-right">{cop(lineTotal(item))}</b><button type="button" onClick={() => removeItem(item.id)} aria-label={`Quitar ${item.product.name}`} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 size={17} /></button></div><label className="mt-2 block text-xs text-gray-600">Indicación para este producto<input value={item.note || ''} onChange={event => setItems(current => current.map(line => line.id === item.id ? { ...line, note: event.target.value } : line))} maxLength={2000} placeholder="Por ejemplo: sin cebolla" className="mt-1 w-full rounded border px-2 py-1 text-sm" /></label></div>)}
          </div></section>
          <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Añadir otro menú del día</h3>{dailyMenu ? <div className="flex flex-wrap gap-2"><select value={menuChoice} onChange={event => setMenuChoice(event.target.value)} className="min-w-48 flex-1 rounded border p-2"><option value="base">{dailyMenu.title} · {cop(dailyMenu.price)}</option>{dailyMenu.specials.filter(special => special.price > 0).map(special => <option key={special.name} value={`special:${dailyMenu.specials.indexOf(special)}`}>{special.name} · {cop(special.price)}</option>)}</select><button type="button" onClick={addMenuItem} className="inline-flex items-center gap-1 rounded bg-[#6b2c0e] px-3 py-2 text-white"><Plus size={16} /> Añadir</button></div> : <p className="text-sm text-gray-500">No hay menú del día activo para hoy.</p>}</section>
          <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Añadir producto de la carta</h3><input value={catalogQuery} onChange={event => { setCatalogQuery(event.target.value); setCatalogId(''); }} placeholder="Buscar plato, bebida u otro producto" className="w-full rounded border p-2 text-sm" /><div className="flex flex-wrap gap-2"><select value={catalogId} onChange={event => setCatalogId(event.target.value)} className="min-w-48 flex-1 rounded border p-2"><option value="">Seleccionar producto</option>{filteredCatalog.map(product => <option key={product.id} value={product.id}>{product.name} · {cop(product.price)}</option>)}</select><button type="button" onClick={addCatalogItem} disabled={!catalogId} className="inline-flex items-center gap-1 rounded bg-[#6b2c0e] px-3 py-2 text-white disabled:opacity-40"><Plus size={16} /> Añadir</button></div>{loadingProducts && <p className="text-xs text-gray-500">Cargando productos…</p>}{!loadingProducts && !filteredCatalog.length && <p className="text-xs text-gray-500">No hay productos que coincidan.</p>}</section>
          <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Cargo adicional fuera de carta</h3><p className="text-xs text-gray-500">Para algo no registrado en el catálogo: indica qué se agregó y cuánto cuesta. No cambia los precios de la carta.</p><div className="flex flex-wrap gap-2"><input value={extraDescription} onChange={event => setExtraDescription(event.target.value)} maxLength={200} placeholder="Detalle: por ejemplo, porción adicional de arroz" className="min-w-48 flex-[2] rounded border p-2 text-sm" /><input type="number" min="1" step="1" value={extraAmount} onChange={event => setExtraAmount(event.target.value)} placeholder="Importe $" className="w-32 flex-1 rounded border p-2 text-sm" /><button type="button" onClick={addExtra} className="inline-flex items-center gap-1 rounded bg-[#6b2c0e] px-3 py-2 text-white"><Plus size={16} /> Añadir cargo</button></div></section>
          <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Servicio</h3><select value={service} onChange={event => setService(event.target.value as Service)} className="w-full rounded border p-2"><option value="local">En el local</option><option value="llevar">Para llevar</option><option value="domicilio">Domicilio</option></select>{service === 'domicilio' && <div className="grid gap-2 sm:grid-cols-2"><label className="text-sm">Dirección<input value={address} onChange={event => setAddress(event.target.value)} className="mt-1 w-full rounded border p-2" /></label><label className="text-sm">Barrio<select value={barrio?.id || ''} onChange={event => setBarrio(BARRIOS.find(item => item.id === event.target.value) || null)} className="mt-1 w-full rounded border p-2"><option value="">Seleccionar barrio</option>{BARRIOS.map(item => <option key={item.id} value={item.id}>{item.name} · {item.price === null ? 'Sin tarifa' : cop(item.price)}</option>)}</select></label></div>}</section>
          <section className="space-y-2 border-t pt-4"><h3 className="flex items-center gap-2 font-semibold"><Cake size={18} /> Descuento de cumpleaños</h3><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={birthdayDiscount} onChange={event => setBirthdayDiscount(event.target.checked)} /> Aplicar descuento verificado ({BIRTHDAY_DISCOUNT_PERCENT}% sobre productos de carta y menú){isBirthdayToday(order.cliente.fechaNacimiento) ? ' · Hoy es su cumpleaños' : ''}</label>{birthdayDiscount && <label className="block text-sm">Cédula verificada<input value={verifiedDocument} onChange={event => setVerifiedDocument(event.target.value.replace(/\D/g, ''))} placeholder="Número de cédula" className="mt-1 w-full rounded border p-2" /></label>}</section>
          <section className="space-y-2 border-t pt-4"><h3 className="font-semibold">Total del pedido</h3><p className="flex justify-between text-sm"><span>Subtotal</span><span>{cop(subtotal)}</span></p><p className="flex justify-between text-sm"><span>Domicilio</span><span>{cop(delivery)}</span></p>{discountTotal > 0 && <p className="flex justify-between text-sm"><span>Descuento</span><span>-{cop(discountTotal)}</span></p>}<p className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{cop(total)}</span></p><p className="text-xs text-gray-500">Cobrado: {cop(paidTotal)} · Saldo después de editar: {cop(Math.max(0, total - paidTotal))}. Los pagos se registran en el detalle del pedido.</p></section>
          <section className="border-t pt-4"><label className="block text-sm font-semibold">Nota interna<textarea value={adminNote} onChange={event => setAdminNote(event.target.value)} rows={3} className="mt-2 w-full rounded border p-2 font-normal" /></label></section>
        </div>
        <footer className="flex gap-3 border-t p-5"><button type="button" onClick={onClose} className="flex-1 rounded border py-2">Cancelar</button><button type="button" onClick={() => void save()} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded bg-[#6b2c0e] py-2 font-semibold text-white disabled:opacity-50"><Save size={16} /> {saving ? 'Guardando…' : 'Guardar cambios'}</button></footer>
      </div>
    </div>
  </div>;
}
