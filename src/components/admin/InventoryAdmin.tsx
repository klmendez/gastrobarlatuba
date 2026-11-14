import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import ScrollableTable from "./ScrollableTable";

type Item = { id: string; name: string; unit: string; quantity: number; minimum_quantity: number };
type Movement = { id: string; inventory_item_id: string; quantity_change: number; reason: string; created_at: string };
type Catalog = { id: string; name: string; item_type: string };
type Requirement = { inventory_item_id: string; catalog_item_id: string; quantity_required: number };
const empty = { name: "", unit: "unidad", minimum: "0", initial: "0" };

export default function InventoryAdmin() {
  const [items, setItems] = useState<Item[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [catalog, setCatalog] = useState<Catalog[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [linkItem, setLinkItem] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [form, setForm] = useState(empty);
  const [selected, setSelected] = useState("");
  const [direction, setDirection] = useState<"entrada" | "salida">("entrada");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!supabase) { setMessage("Supabase no está configurado."); return; }
    const [stock, history, products, linked] = await Promise.all([
      supabase.from("inventory_items").select("id,name,unit,quantity,minimum_quantity").order("name"),
      supabase.from("inventory_movements").select("id,inventory_item_id,quantity_change,reason,created_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("catalog_items").select("id,name,item_type").order("name"),
      supabase.from("catalog_inventory_requirements").select("inventory_item_id,catalog_item_id,quantity_required"),
    ]);
    if (stock.error || history.error || products.error || linked.error) { setMessage(stock.error?.message || history.error?.message || products.error?.message || linked.error?.message || "No se pudo cargar el inventario."); return; }
    setItems(stock.data as Item[]); setMovements(history.data as Movement[]);
    setCatalog(products.data as Catalog[]); setRequirements(linked.data as Requirement[]);
  };
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault(); if (!supabase || busy) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("create_inventory_item", { p_name: form.name.trim(), p_unit: form.unit.trim(), p_minimum: Number(form.minimum), p_initial: Number(form.initial) });
    if (error) setMessage(error.message); else { setForm(empty); setMessage("Insumo agregado."); await load(); }
    setBusy(false);
  };
  const adjust = async (event: FormEvent) => {
    event.preventDefault(); if (!supabase || busy) return;
    const quantity = Number(amount);
    if (!selected || !Number.isFinite(quantity) || quantity <= 0 || !reason.trim()) { setMessage("Selecciona un insumo e indica cantidad y motivo."); return; }
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("adjust_inventory", { p_item_id: selected, p_change: direction === "entrada" ? quantity : -quantity, p_reason: reason.trim() });
    if (error) setMessage(error.message); else { setAmount(""); setReason(""); setMessage("Movimiento registrado."); await load(); }
    setBusy(false);
  };
  const chooseLinks = (id: string) => {
    setLinkItem(id);
    setLinks(Object.fromEntries(requirements.filter(r => r.inventory_item_id === id).map(r => [r.catalog_item_id, String(r.quantity_required)])));
  };
  const saveLinks = async (event: FormEvent) => {
    event.preventDefault(); if (!supabase || !linkItem || busy) return;
    const list = Object.entries(links).map(([id, quantity]) => ({ id, quantity: Number(quantity) }));
    if (list.some(link => !Number.isFinite(link.quantity) || link.quantity <= 0)) { setMessage("Indica una cantidad mayor que cero para cada producto seleccionado."); return; }
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("set_inventory_links", { p_inventory_id: linkItem, p_links: list });
    if (error) setMessage(error.message); else { setMessage("Vínculos guardados."); await load(); }
    setBusy(false);
  };

  return <div className="inventory-layout">
    <div className="inventory-forms">
      <form onSubmit={create}><h2>Agregar al inventario</h2><div className="inventory-fields"><label>Nombre<input required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej. Arroz" /></label><label>Unidad<input required maxLength={30} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="kg, unidad..." /></label><label>Existencia inicial<input required type="number" min="0" step="0.001" value={form.initial} onChange={e => setForm({ ...form, initial: e.target.value })} /></label><label>Existencia mínima<input required type="number" min="0" step="0.001" value={form.minimum} onChange={e => setForm({ ...form, minimum: e.target.value })} /></label></div><button className="inventory-submit" disabled={busy}>Agregar</button></form>
      <form onSubmit={adjust}><h2>Registrar movimiento</h2><div className="inventory-fields"><label className="inventory-wide">Insumo<select required value={selected} onChange={e => setSelected(e.target.value)}><option value="">Selecciona un insumo</option>{items.map(item => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></label><label>Tipo<select value={direction} onChange={e => setDirection(e.target.value as typeof direction)}><option value="entrada">Entrada</option><option value="salida">Salida</option></select></label><label>Cantidad<input required type="number" min="0.001" step="0.001" value={amount} onChange={e => setAmount(e.target.value)} /></label><label className="inventory-wide">Motivo<input required maxLength={200} value={reason} onChange={e => setReason(e.target.value)} placeholder="Compra, merma, ajuste..." /></label></div><button className="inventory-submit" disabled={busy || !items.length}>Registrar movimiento</button></form>
      <form onSubmit={saveLinks}><h2>Vincular a productos</h2><p className="inventory-empty">Selecciona un insumo y marca los productos que lo usan. Indica cuánto consume cada unidad.</p><label className="inventory-link-label">Insumo<select value={linkItem} onChange={e => chooseLinks(e.target.value)}><option value="">Selecciona un insumo</option>{items.map(item => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></label>{linkItem && <div className="inventory-links">{catalog.map(product => <div key={product.id}><label><input type="checkbox" checked={product.id in links} onChange={e => { const next = { ...links }; if (e.target.checked) next[product.id] = "1"; else delete next[product.id]; setLinks(next); }} /> <span>{product.name}<small>{product.item_type === "bebida" ? "Bebida" : product.item_type === "otro" ? "Producto" : "Carta"}</small></span></label>{product.id in links && <input aria-label={`Cantidad para ${product.name}`} type="number" min="0.001" step="0.001" value={links[product.id]} onChange={e => setLinks({ ...links, [product.id]: e.target.value })} />}</div>)}</div>}<button className="inventory-submit" disabled={busy || !linkItem}>Guardar vínculos</button></form>
      {message && <p role="status" className="inventory-message">{message}</p>}
    </div>
    <div className="inventory-data"><section><h2>Existencias</h2>{items.length ? <ScrollableTable label="Existencias de inventario"><table><thead><tr><th>Insumo</th><th>Disponible</th><th>Mínimo</th><th>Estado</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{item.name}</td><td>{Number(item.quantity)} {item.unit}</td><td>{Number(item.minimum_quantity)} {item.unit}</td><td>{Number(item.quantity) <= Number(item.minimum_quantity) ? "Bajo" : "Disponible"}</td></tr>)}</tbody></table></ScrollableTable> : <p className="inventory-empty">Agrega tu primer insumo para comenzar.</p>}</section>
      <section><h2>Últimos movimientos</h2>{movements.length ? <div className="inventory-history">{movements.map(m => <div key={m.id}><span><b>{items.find(i => i.id === m.inventory_item_id)?.name || "Insumo"}</b><small>{m.reason} · {new Date(m.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</small></span><strong>{Number(m.quantity_change) > 0 ? "+" : ""}{Number(m.quantity_change)}</strong></div>)}</div> : <p className="inventory-empty">Los movimientos aparecerán aquí.</p>}</section>
    </div>
  </div>;
}
