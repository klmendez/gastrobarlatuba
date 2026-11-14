import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { DailyMenuService, EMPTY_DAILY_MENU, todayInBogota, type DailyMenuConfig, type DailyMenuSpecial } from "../../services/dailyMenuService";
import { cop } from "../../lib/format";

type ListKey = "soups" | "sides" | "proteins";
const fresh = (): DailyMenuConfig => ({ ...EMPTY_DAILY_MENU, id: undefined, scheduledDate: todayInBogota(), soups: [""], sides: [""], proteins: [""], specials: [] });

export default function DailyMenuAdmin() {
  const [menus, setMenus] = useState<DailyMenuConfig[]>([]);
  const [menu, setMenu] = useState<DailyMenuConfig>(fresh);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const load = () => DailyMenuService.list().then(setMenus);
  useEffect(() => { void load().catch(() => setMessage("No se pudieron cargar los menús. Revisa tu conexión.")); }, []);

  const changeSpecial = (index: number, patch: Partial<DailyMenuSpecial>) => setMenu((m) => ({ ...m, specials: m.specials.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const clean = { ...menu, soups: menu.soups.map(v => v.trim()).filter(Boolean), sides: menu.sides.map(v => v.trim()).filter(Boolean), proteins: menu.proteins.map(v => v.trim()).filter(Boolean), specials: menu.specials.filter((item) => item.name.trim()) };
      const id = await DailyMenuService.save(clean); setMenu({ ...clean, id }); setMessage("Menú programado correctamente."); await load();
    } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "No se pudo guardar."); } finally { setSaving(false); }
  };
  const remove = async () => { if (!menu.id || !confirm("¿Eliminar este menú?")) return; await DailyMenuService.remove(menu.id); setMenu(fresh()); await load(); };

  const options = (title: string, key: ListKey) => <label className="daily-options">
    <span>{title}</span>
    <textarea rows={3} value={menu[key].join("\n")} onChange={(e) => setMenu((m) => ({ ...m, [key]: e.target.value.split("\n") }))} placeholder="Una opción por línea" />
  </label>;

  return <div className="daily-layout">
    <form onSubmit={save} className="daily-editor">
      <div className="daily-fields">
        <label>Fecha<input type="date" required value={menu.scheduledDate} onChange={(e) => setMenu({ ...menu, scheduledDate: e.target.value })} /></label>
        <label>Precio corriente<input type="number" min="0" step="500" required value={menu.price || ""} onChange={(e) => setMenu({ ...menu, price: Number(e.target.value) })} /></label>
        <label>Título<input value={menu.title} onChange={(e) => setMenu({ ...menu, title: e.target.value })} /></label>
        <label>Encabezado<input value={menu.dateLabel} onChange={(e) => setMenu({ ...menu, dateLabel: e.target.value })} placeholder="Menú del viernes" /></label>
      </div>
      <p className="daily-hint">Escribe una opción por línea.</p>
      <div className="daily-groups">
        {options("Sopas", "soups")}{options("Principios", "sides")}{options("Proteínas", "proteins")}
        <section className="daily-specials"><div className="daily-special-heading"><strong>Especiales</strong><button type="button" onClick={() => setMenu({ ...menu, specials: [...menu.specials, { name: "", price: 0 }] })}><Plus size={14} /> Agregar</button></div>
          {menu.specials.length === 0 && <p className="daily-hint">Con precio independiente.</p>}
          {menu.specials.map((item, index) => <div className="daily-special-row" key={index}>
            <input aria-label="Nombre del especial" value={item.name} onChange={(e) => changeSpecial(index, { name: e.target.value })} placeholder="Especial" />
            <input aria-label="Precio del especial" type="number" min="0" step="500" value={item.price || ""} onChange={(e) => changeSpecial(index, { price: Number(e.target.value) })} placeholder="Precio" />
            <button type="button" aria-label="Quitar especial" onClick={() => setMenu({ ...menu, specials: menu.specials.filter((_, i) => i !== index) })}><Trash2 size={15} /></button>
          </div>)}
        </section>
      </div>
      <label className="daily-publish"><input type="checkbox" checked={menu.active} onChange={(e) => setMenu({ ...menu, active: e.target.checked })} /> Publicar en la fecha programada</label>
      {message && <p role="status" className="daily-hint">{message}</p>}
      <div className="daily-actions"><button type="submit" disabled={saving || menu.price <= 0} className="bg-[#793713] px-4 py-2 text-sm font-semibold text-white"><Save size={15} /> {saving ? "Guardando..." : "Guardar menú"}</button>{menu.id && <button type="button" onClick={remove}><Trash2 size={15} /> Eliminar</button>}</div>
    </form>
    <aside className="daily-list"><div className="daily-list-heading"><strong>Menús programados</strong><button type="button" onClick={() => { setMenu(fresh()); setMessage(""); }}>+ Nuevo</button></div>
      {menus.length === 0 && <p className="daily-hint">Aún no hay menús programados.</p>}
      {menus.map((item) => <button key={item.id} type="button" onClick={() => { setMenu(item); setMessage(""); }} className={`daily-list-item ${menu.id === item.id ? "is-selected" : ""}`}><b>{item.dateLabel}</b><span>{item.scheduledDate} · {cop(item.price)} · {item.active ? "Activo" : "Oculto"}</span></button>)}
    </aside>
  </div>;
}
