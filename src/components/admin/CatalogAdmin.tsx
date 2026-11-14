import ScrollableTable from "./ScrollableTable";
import { useEffect, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { cop } from "../../lib/format";
import { uploadCatalogImage, validateCatalogImage } from "../../lib/catalogImage";

type CatalogItem = {
  id: string; name: string; description: string; category: string;
  item_type: "carta" | "bebida" | "otro"; price: number;
  image_url: string | null; available: boolean;
};

const empty = { name: "", description: "", category: "", item_type: "carta" as CatalogItem["item_type"], price: "", image_url: "", available: true };

export default function CatalogAdmin({ productsOnly = false }: { productsOnly?: boolean }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [form, setForm] = useState<typeof empty>({ ...empty, item_type: productsOnly ? "otro" : "carta" });
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    const timer = window.setTimeout(() => setPreview(url), 0);
    return () => { window.clearTimeout(timer); URL.revokeObjectURL(url); };
  }, [imageFile]);

  const load = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("catalog_items").select("*").order("category").order("name");
    if (error) setMessage(error.message); else setItems(((data ?? []) as CatalogItem[]).filter(item => productsOnly ? item.item_type === "otro" : item.item_type !== "otro"));
  };
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || saving) return;
    setMessage(""); setSaving(true);
    try {
      const imageUrl = imageFile ? await uploadCatalogImage(imageFile) : form.image_url.trim() || null;
      const payload = { name: form.name.trim(), description: form.description.trim(), category: form.category.trim(), item_type: form.item_type, price: Number(form.price), image_url: imageUrl, available: form.available, business: "la_tuba", updated_at: new Date().toISOString() };
      const query = editing ? supabase.from("catalog_items").update(payload).eq("id", editing) : supabase.from("catalog_items").insert(payload);
      const { error } = await query;
      if (error) throw error;
      setForm({ ...empty, item_type: productsOnly ? "otro" : "carta" }); setEditing(null); setImageFile(null); setPreview(""); setMessage("Producto guardado en la carta de La Tuba."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar el producto."); }
    finally { setSaving(false); }
  };

  const edit = (item: CatalogItem) => {
    setImageFile(null); setPreview(""); setMessage("");
    setEditing(item.id);
    setForm({ name: item.name, description: item.description, category: item.category, item_type: item.item_type, price: String(item.price), image_url: item.image_url ?? "", available: item.available });
  };

  const remove = async (id: string) => {
    if (!supabase || !confirm("¿Eliminar este producto de la carta?")) return;
    const { error } = await supabase.from("catalog_items").delete().eq("id", id);
    if (error) setMessage(error.message); else await load();
  };

  return <div className="mx-auto max-w-6xl text-[#321506]">
    <header className="admin-duplicate-heading mb-6 border-b border-[#6b2c0e]/20 pb-5"><p className="text-xs font-semibold uppercase tracking-[.24em] text-[#793713]">Catálogo de La Tuba</p><h2 className="mt-2 font-serif text-3xl text-[#542006]">Carta, bebidas y productos</h2><p className="mt-2 text-sm text-[#6c5548]">La categoría se gestiona dentro de cada producto. Aquí no se usan tamaños, gomitas, toppings ni datos de Pecado Picoso.</p></header>
    <div className="grid items-start gap-7 lg:grid-cols-[21rem_minmax(0,1fr)]">
    <form onSubmit={save} className="border-y border-[#6b2c0e]/20 bg-[#fff8e8] py-5 lg:sticky lg:top-24">
      <div className="grid gap-4 px-4">
        <label className="text-xs font-semibold uppercase tracking-wide">Nombre<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-2 w-full border border-[#6b2c0e]/25 bg-white px-3 py-2.5 text-sm font-normal normal-case" /></label>
        {!productsOnly && <label className="text-xs font-semibold uppercase tracking-wide">Tipo<select value={form.item_type} onChange={e => setForm({ ...form, item_type: e.target.value as CatalogItem["item_type"] })} className="mt-2 w-full border border-[#6b2c0e]/25 bg-white px-3 py-2.5 text-sm font-normal normal-case"><option value="carta">Plato de la carta</option><option value="bebida">Bebida</option></select></label>}
        <label className="text-xs font-semibold uppercase tracking-wide">Categoría<input required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ej. Encocados" className="mt-2 w-full border border-[#6b2c0e]/25 bg-white px-3 py-2.5 text-sm font-normal normal-case" /></label>
        <label className="text-xs font-semibold uppercase tracking-wide">Precio<input required min="0" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="mt-2 w-full border border-[#6b2c0e]/25 bg-white px-3 py-2.5 text-sm font-normal normal-case" /></label>
        <label className="text-xs font-semibold uppercase tracking-wide">Descripción<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-2 w-full border border-[#6b2c0e]/25 bg-white px-3 py-2.5 text-sm font-normal normal-case" /></label>
        <div><label className="block text-xs font-semibold uppercase tracking-wide">Foto del producto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; if (!file) return; try { validateCatalogImage(file); setImageFile(file); setMessage(""); } catch (error) { e.target.value = ""; setMessage(error instanceof Error ? error.message : "Imagen no válida."); } }} className="mt-2 block w-full text-sm font-normal normal-case" /></label><p className="mt-1 text-xs text-[#806958]">Elige una foto JPG, PNG o WebP de tu dispositivo (hasta 20 MB). Se optimiza al guardar.</p>{(imageFile ? preview : form.image_url) && <img src={imageFile ? preview : form.image_url} alt="Vista previa del producto" className="mt-3 h-32 w-32 object-cover" />}{(imageFile || form.image_url) && <button type="button" onClick={() => { setImageFile(null); setPreview(""); setForm(current => ({ ...current, image_url: "" })); }} className="mt-2 block text-xs font-semibold underline">Quitar foto</button>}</div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 px-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.available} onChange={e => setForm({ ...form, available: e.target.checked })} /> Disponible</label><button disabled={saving} className="inline-flex items-center gap-2 bg-[#6b2c0e] px-5 py-2.5 text-sm font-semibold text-[#fff4dc] disabled:opacity-50"><Plus size={16} />{saving ? "Guardando…" : editing ? "Guardar cambios" : "Agregar producto"}</button>{editing && <button type="button" disabled={saving} onClick={() => { setEditing(null); setImageFile(null); setPreview(""); setForm({ ...empty, item_type: productsOnly ? "otro" : "carta" }); }} className="text-sm underline">Cancelar</button>}<span role="status" className="text-sm text-[#793713]">{message}</span></div>
    </form>
    <ScrollableTable label="Tabla de productos"><table className="w-full border-collapse text-left text-sm"><thead><tr className="border-b-2 border-[#6b2c0e]"><th className="py-3">Producto</th><th>Tipo</th><th>Categoría</th><th>Precio</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead><tbody>{items.map(item => <tr key={item.id} className="border-b border-[#6b2c0e]/15"><td className="py-4"><span className="flex items-center gap-3">{item.image_url && <img src={item.image_url} alt="" className="h-9 w-9 shrink-0 object-cover" />}<span><b>{item.name}</b><small className="block text-[#806958]">{item.description}</small></span></span></td><td>{item.item_type === "carta" ? "Carta" : item.item_type === "bebida" ? "Bebida" : "Producto"}</td><td>{item.category}</td><td>{cop(item.price)}</td><td>{item.available ? "Disponible" : "Oculto"}</td><td><div className="flex justify-end gap-2"><button onClick={() => edit(item)} aria-label="Editar"><Edit3 size={17} /></button><button onClick={() => remove(item.id)} aria-label="Eliminar" className="text-red-700"><Trash2 size={17} /></button></div></td></tr>)}</tbody></table>{items.length === 0 && <p className="border-b border-[#6b2c0e]/20 py-10 text-center text-sm text-[#806958]">Todavía no hay productos administrables en Supabase.</p>}</ScrollableTable>
    </div>
  </div>;
}
