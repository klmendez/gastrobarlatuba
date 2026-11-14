import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { DailyMenuService } from "../../services/dailyMenuService";
import { OrderService } from "../../services/orderService";
import { ClientService, normalizePhone, type ContactLookup } from "../../services/clientService";
import { completeSubmission } from "../../lib/submission";
import { cop } from "../../lib/format";
import { useServerQuote } from "../../hooks/useServerQuote";
import { getBasePrice } from "../../lib/pricing";
import type { OrderItem, Service } from "../../lib/whatsapp";

type SaleType = "menu_dia" | "carta" | "bebida" | "otro";
type SaleItem = { id: string; name: string; price: number; category: string; qty: number; type: SaleType; dailyMenuId?: string; special?: string };
type DeliveryZone = { id: string; name: string; price: number | null };
const options = [
  { id: "menu_dia" as const, label: "Menú del día" },
  { id: "carta" as const, label: "Carta" },
  { id: "bebida" as const, label: "Bebidas y productos" },
];

export default function RegisterSale() {
  const [type, setType] = useState<SaleType>("carta");
  const [items, setItems] = useState<SaleItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<ContactLookup[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactLookup | null>(null);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [contactSearchError, setContactSearchError] = useState("");
  const [payment, setPayment] = useState<"Efectivo" | "Transferencia">("Efectivo");
  const [service, setService] = useState<Service>("local");
  const [tableNumber, setTableNumber] = useState("");
  const [address, setAddress] = useState("");
  const [reference, setReference] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zoneError, setZoneError] = useState("");
  const [collectNow, setCollectNow] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const selected = useMemo(() => items.filter(item => item.qty > 0), [items]);
  const orderItems: OrderItem[] = useMemo(() => selected.map(item => ({ id: item.id, product: { id: item.dailyMenuId ?? item.id, ...(item.dailyMenuId ? { dailyMenuId: item.dailyMenuId, menuChoices: item.special ? { special: item.special } : {} } : {}), name: item.name, description: item.category, category: "frutafresh", categoryId: item.type === "menu_dia" ? "menu-del-dia" : `${item.type}-${item.category}`, toppingsIncludedMax: 0, prices: { fijo: item.price } }, qty: item.qty, version: null, size: null, toppingIds: [], extrasQty: {}, extraSelections: {} })), [selected]);
  const selectedZone = zones.find(zone => zone.id === zoneId);
  const quote = useServerQuote({ items: orderItems, servicio: service, canal: 'admin', cliente: service === 'domicilio' ? { barrioId: zoneId, barrio: selectedZone?.name ?? '', direccion: address.trim() } : {} });
  const total = quote.data?.total ?? selected.reduce((sum, item) => sum + item.price * item.qty, 0);

  useEffect(() => {
    let active = true;
    const query = contactQuery.trim();
    const timer = window.setTimeout(async () => {
      if (query.length < 2) { setContactResults([]); setSearchingContacts(false); setContactSearchError(""); return; }
      setSearchingContacts(true); setContactSearchError("");
      try {
        const results = await ClientService.searchContactsForOrder(query);
        if (active) setContactResults(results);
      } catch (error) {
        if (active) { setContactResults([]); setContactSearchError(error instanceof Error ? error.message : "No se pudo buscar contactos."); }
      } finally { if (active) setSearchingContacts(false); }
    }, query.length < 2 ? 0 : 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [contactQuery]);

  useEffect(() => {
    if (service !== 'domicilio') return;
    let active = true;
    const load = async () => {
      if (!supabase) { if (active) setZoneError('No se pudo conectar con Supabase.'); return; }
      const { data, error } = await supabase.from('delivery_zones').select('id,name,price').eq('active', true).order('name');
      if (!active) return;
      if (error) { setZones([]); setZoneError('No se pudieron cargar las zonas de domicilio.'); }
      else { setZones(data ?? []); setZoneError(''); }
    };
    void load();
    return () => { active = false; };
  }, [service]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!supabase) throw new Error("No se pudo conectar con Supabase.");
        const [menu, result] = await Promise.all([DailyMenuService.get(), supabase.from("catalog_items").select("id,name,price,category,item_type").eq("available", true).eq("business", "la_tuba").order("name")]);
        if (result.error) throw result.error;
        if (!active) return;
        const catalog = (result.data ?? []).map(item => ({ ...item, type: item.item_type as SaleType, qty: 0 }));
        const menuItems: SaleItem[] = menu.active && menu.id ? [
          ...(menu.price > 0 ? [{ id: `menu-${menu.id}`, dailyMenuId: menu.id, name: menu.title, price: menu.price, category: "Menú del día", type: "menu_dia" as const, qty: 0 }] : []),
          ...menu.specials.filter(special => special.price > 0).map(special => ({ id: `menu-${menu.id}-${special.name}`, dailyMenuId: menu.id, special: special.name, name: special.name, price: special.price, category: "Especial del día", type: "menu_dia" as const, qty: 0 })),
        ] : [];
        setItems([...menuItems, ...catalog]);
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "No se pudieron cargar los productos."); }
    };
    void load();
    return () => { active = false; };
  }, []);

  const changeQty = (id: string, change: number) => setItems(current => current.map(item => item.id === id ? { ...item, qty: Math.max(0, item.qty + change) } : item));
  const save = async () => {
    if (saving.current) return;
    const cleanPhone = normalizePhone(phone);
    if (!selected.length) { setMessage("Agrega al menos un producto."); return; }
    if (!name.trim()) { setMessage("Escribe el nombre del cliente."); return; }
    if (!/^3\d{9}$/.test(cleanPhone)) { setMessage("Escribe un celular colombiano válido de 10 dígitos."); return; }
    if (service === 'local' && !tableNumber) { setMessage('Selecciona la mesa del cliente.'); return; }
    if (service === 'domicilio' && (!address.trim() || !selectedZone || selectedZone.price === null)) { setMessage('Indica la dirección y un barrio con tarifa de domicilio.'); return; }
    if (!quote.data) { setMessage(quote.error || "Espera mientras se actualizan los precios."); return; }
    const types = new Set(selected.map(item => item.type));
    const saleType = types.size === 1 ? selected[0].type : 'mixto';
    saving.current = true; setBusy(true); setMessage(""); setCreatedOrderId(null);
    try {
      const numeroOrden = OrderService.generateOrderNumber();
      const orderId = await OrderService.createOrder({ numeroOrden, items: orderItems, total: quote.data.total, subtotal: quote.data.subtotal, delivery: quote.data.delivery, cliente: { nombres: name.trim(), celular: cleanPhone, direccion: service === 'domicilio' ? address.trim() : '', ...(service === 'local' ? { mesa: Number(tableNumber) } : {}), ...(service === 'domicilio' && selectedZone ? { barrio: selectedZone.name, ...(reference.trim() ? { referencia: reference.trim() } : {}) } : {}) }, formaPago: payment, servicio: service, estado: collectNow ? "pagado" : "no_pagado", comentarios: "Pedido tomado desde administración", promociones: quote.data.promociones, descuentoTotal: quote.data.descuentoTotal, tipoVenta: saleType, canal: "admin" });
      completeSubmission("order");
      const receipt = JSON.parse(sessionStorage.getItem("la-tuba-order-receipt") || "null") as { order_number?: string } | null;
      setMessage(`Pedido ${receipt?.order_number || numeroOrden} ${collectNow ? "registrado y cobrado" : "registrado, pendiente de pago"}, vinculado al cliente.`);
      setCreatedOrderId(orderId);
      setItems(current => current.map(item => ({ ...item, qty: 0 }))); setName(""); setPhone(""); setSelectedContact(null); setContactQuery(""); setService('local'); setTableNumber(''); setAddress(''); setReference(''); setZoneId('');
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo registrar la venta."); }
    finally { saving.current = false; setBusy(false); }
  };

  return <div className="mx-auto max-w-5xl text-[#321506]">
    <div className="mb-6 border-b border-[#6b2c0e]/20 pb-4"><h2 className="font-serif text-3xl">Tomar pedido</h2><p className="mt-2 text-sm text-[#806958]">Combina platos, menús y bebidas en un solo pedido.</p></div>
    <div role="tablist" aria-label="Categorías para registrar venta" className="mb-5 flex gap-5 overflow-x-auto border-b border-[#6b2c0e]/20">{options.map(option => <button key={option.id} role="tab" aria-selected={type === option.id} onClick={() => setType(option.id)} className={`shrink-0 border-b-2 px-1 py-3 text-sm font-medium ${type === option.id ? 'border-[#6b2c0e] text-[#542006]' : 'border-transparent text-[#806958]'}`}>{option.label}{items.some(item => item.qty > 0 && (item.type === option.id || (option.id === 'bebida' && item.type === 'otro'))) && <span className="ml-1">· {items.filter(item => item.type === option.id || (option.id === 'bebida' && item.type === 'otro')).reduce((sum, item) => sum + item.qty, 0)}</span>}</button>)}</div>
    <label className="mb-5 block max-w-md text-sm text-[#654a38]">Buscar producto<input value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Escribe el nombre del plato o bebida" className="mt-1 block w-full border border-[#6b2c0e]/25 bg-white px-3 py-2" /></label>
    <div className="grid gap-8 lg:grid-cols-[1fr_19rem]">
      <div className="divide-y divide-[#6b2c0e]/15 border-y border-[#6b2c0e]/20">
        {items.filter(item => item.type === type || (type === 'bebida' && item.type === 'otro')).filter(item => item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(productSearch.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())).map(item => <div key={item.id} className="flex items-center gap-3 px-1 py-4"><span className="min-w-0 flex-1"><span className="block font-medium">{item.name}</span><small className="text-[#806958]">{item.category} · {cop(item.price)}</small></span><button aria-label={`Quitar una unidad de ${item.name}`} onClick={() => changeQty(item.id, -1)} className="h-9 w-9 border">−</button><span className="w-6 text-center">{item.qty}</span><button aria-label={`Agregar una unidad de ${item.name}`} onClick={() => changeQty(item.id, 1)} className="h-9 w-9 bg-[#6b2c0e] text-white">+</button></div>)}
        {!items.some(item => (item.type === type || (type === 'bebida' && item.type === 'otro')) && item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(productSearch.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())) && <p className="px-2 py-10 text-center text-sm text-[#806958]">{productSearch.trim() ? 'No hay productos que coincidan en esta pestaña.' : type === 'menu_dia' ? 'No hay menú activo para hoy.' : 'No hay productos disponibles en esta sección.'}</p>}
      </div>
      <aside className="border-t border-[#6b2c0e]/30 py-5">
        <h3 className="font-serif text-xl">Datos del pedido</h3>
        {selected.length > 0 && <div className="mt-4 border-y border-[#6b2c0e]/20 py-3"><p className="text-xs font-medium uppercase text-[#806958]">En el pedido</p>{selected.map(item => { const quoted = quote.data?.items.find(line => line.id === item.id); const price = quoted ? getBasePrice(quoted.product, null, null) : item.price; return <div key={item.id} className="mt-2 flex justify-between gap-3 text-sm"><span>{item.qty} × {item.name}</span><span className="shrink-0">{cop(price * item.qty)}</span></div>; })}</div>}
        <label className="mt-4 block text-xs font-semibold uppercase">Buscar cliente o prospecto<input value={contactQuery} onChange={event => { const value = event.target.value; setContactQuery(value); setContactResults([]); setSearchingContacts(value.trim().length >= 2); setContactSearchError(""); }} placeholder="Nombre o celular" className="mt-2 w-full border bg-white px-3 py-2 normal-case" /></label>
        {searchingContacts && <p className="mt-2 text-xs text-[#806958]">Buscando contactos…</p>}
        {contactSearchError && <p role="alert" className="mt-2 text-xs text-red-700">{contactSearchError}</p>}
        {contactQuery.trim().length >= 2 && !searchingContacts && !contactSearchError && <div className="mt-2 max-h-48 overflow-y-auto border bg-white" aria-label="Resultados de clientes y prospectos">
          {contactResults.length ? contactResults.map(contact => <button key={contact.id} type="button" onClick={() => { setSelectedContact(contact); setName(contact.nombres); setPhone(normalizePhone(contact.celular)); setContactQuery(""); setContactResults([]); }} className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-[#f3dfbd]"><b className="block">{contact.nombres}</b><span className="text-xs text-[#806958]">{normalizePhone(contact.celular)} · {contact.totalPedidos > 0 ? "Cliente" : "Prospecto"}</span></button>) : <p className="px-3 py-2 text-xs text-[#806958]">Sin coincidencias. Puedes escribir los datos de una persona nueva.</p>}
        </div>}
        {selectedContact && <p className="mt-3 text-xs text-[#36613a]">{selectedContact.totalPedidos > 0 ? "Cliente" : "Prospecto"} seleccionado: {selectedContact.nombres}. <button type="button" onClick={() => setSelectedContact(null)} className="font-semibold underline">Cambiar</button></p>}
        <label className="mt-4 block text-xs font-semibold uppercase">Nombre del cliente<input required readOnly={!!selectedContact} value={name} onChange={event => setName(event.target.value)} className="mt-2 w-full border bg-white px-3 py-2 read-only:bg-[#f5ebd8]" /></label>
        <label className="mt-4 block text-xs font-semibold uppercase">Celular del cliente<input required readOnly={!!selectedContact} inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="3XX XXX XXXX" className="mt-2 w-full border bg-white px-3 py-2 read-only:bg-[#f5ebd8]" /></label>
        <p className="mt-2 text-xs text-[#806958]">Selecciona un contacto existente o completa nombre y celular para crear uno nuevo.</p>
        <fieldset className="mt-5 space-y-2 text-sm"><legend className="mb-2 text-xs font-semibold uppercase">¿Cómo recibe el pedido?</legend>
          <label className="flex items-center gap-2"><input type="radio" name="saleService" checked={service === 'local'} onChange={() => setService('local')} /> En una mesa</label>
          <label className="flex items-center gap-2"><input type="radio" name="saleService" checked={service === 'llevar'} onChange={() => setService('llevar')} /> Para llevar</label>
          <label className="flex items-center gap-2"><input type="radio" name="saleService" checked={service === 'domicilio'} onChange={() => setService('domicilio')} /> Domicilio</label>
        </fieldset>
        {service === 'local' && <label className="mt-4 block text-xs font-semibold uppercase">Mesa<select value={tableNumber} onChange={event => setTableNumber(event.target.value)} className="mt-2 w-full border bg-white px-3 py-2"><option value="">Seleccionar mesa</option>{Array.from({ length: 7 }, (_, index) => <option key={index + 1} value={index + 1}>Mesa {index + 1}</option>)}</select></label>}
        {service === 'domicilio' && <><label className="mt-4 block text-xs font-semibold uppercase">Barrio<select value={zoneId} onChange={event => setZoneId(event.target.value)} className="mt-2 w-full border bg-white px-3 py-2"><option value="">Seleccionar barrio</option>{zones.map(zone => <option key={zone.id} value={zone.id} disabled={zone.price === null}>{zone.name} · {zone.price === null ? 'Sin tarifa' : cop(zone.price)}</option>)}</select></label>{zoneError && <p role="alert" className="mt-1 text-xs text-red-700">{zoneError}</p>}<label className="mt-4 block text-xs font-semibold uppercase">Dirección<input value={address} onChange={event => setAddress(event.target.value)} className="mt-2 w-full border bg-white px-3 py-2" /></label><label className="mt-4 block text-xs font-semibold uppercase">Referencia (opcional)<input value={reference} onChange={event => setReference(event.target.value)} className="mt-2 w-full border bg-white px-3 py-2" /></label></>}
        <fieldset className="mt-5 space-y-2 text-sm"><legend className="mb-2 text-xs font-semibold uppercase">¿Cuándo se cobra?</legend>
          <label className="flex items-start gap-2"><input type="radio" name="collectWhen" checked={!collectNow} onChange={() => setCollectNow(false)} /> <span>Después, en caja <small className="block text-[#806958]">Queda en Pedidos como pendiente de pago.</small></span></label>
          <label className="flex items-start gap-2"><input type="radio" name="collectWhen" checked={collectNow} onChange={() => setCollectNow(true)} /> <span>Cobrar ahora <small className="block text-[#806958]">Registra el cobro completo junto con el pedido.</small></span></label>
        </fieldset>
        <label className="mt-4 block text-xs font-semibold uppercase">{collectNow ? "Método de pago" : "Método previsto"}<select value={payment} onChange={event => setPayment(event.target.value as typeof payment)} className="mt-2 w-full border bg-white px-3 py-2"><option>Efectivo</option><option>Transferencia</option></select></label>
        {!collectNow && <p className="mt-1 text-xs text-[#806958]">Puedes registrar un método diferente cuando cobres en caja.</p>}
        {selected.length > 0 && !quote.data && <p role="status" className="mt-4 text-xs text-[#806958]">{quote.error || 'Actualizando precios…'}</p>}
        {quote.data && quote.data.descuentoTotal > 0 && <p className="mt-4 flex justify-between text-sm"><span>Descuento</span><span>−{cop(quote.data.descuentoTotal)}</span></p>}
        {service === 'domicilio' && quote.data && <p className="mt-3 flex justify-between text-sm"><span>Domicilio</span><span>{cop(quote.data.delivery)}</span></p>}
        <div className="my-5 flex justify-between border-y py-4 text-lg font-medium"><span>{selected.length && !quote.data ? 'Subtotal provisional' : 'Total'}</span><span>{cop(total)}</span></div>
        <button onClick={save} disabled={!total || !quote.data || busy} className="flex w-full items-center justify-center gap-2 bg-[#6b2c0e] px-4 py-3 font-medium text-white disabled:opacity-40"><Check size={17} /> {busy ? "Registrando…" : collectNow ? "Registrar y cobrar" : "Guardar pedido pendiente"}</button>
        <p role="status" className="mt-3 text-sm text-[#793713]">{message}</p>
        {createdOrderId && <Link to={`/admin/pedido/${createdOrderId}`} className="mt-3 inline-block text-sm font-semibold underline">Abrir pedido{collectNow ? "" : " y cobrar en caja"} →</Link>}
      </aside>
    </div>
  </div>;
}
