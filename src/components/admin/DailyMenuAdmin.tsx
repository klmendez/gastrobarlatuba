import { useEffect, useState } from "react";
import { Download, Image as ImageIcon, Plus, Save, Share2, Trash2, X } from "lucide-react";
import { DailyMenuService, EMPTY_DAILY_MENU, todayInBogota, type DailyMenuConfig, type DailyMenuSpecial } from "../../services/dailyMenuService";
import { cop } from "../../lib/format";
import { generateDailyMenuPoster } from "../../lib/dailyMenuPoster";

type ListKey = "soups" | "sides" | "proteins";
const fresh = (): DailyMenuConfig => ({ ...EMPTY_DAILY_MENU, id: undefined, scheduledDate: todayInBogota(), soups: [""], sides: [""], proteins: [""], specials: [] });

export default function DailyMenuAdmin() {
  const [menus, setMenus] = useState<DailyMenuConfig[]>([]);
  const [menu, setMenu] = useState<DailyMenuConfig>(fresh);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [poster, setPoster] = useState<{ url: string; filename: string; date: string; image: Blob } | null>(null);
  const load = () => DailyMenuService.list().then(setMenus);
  useEffect(() => { void load().catch(() => setMessage("No se pudieron cargar los menús. Revisa tu conexión.")); }, []);
  useEffect(() => () => { if (poster) URL.revokeObjectURL(poster.url); }, [poster]);

  const generatePoster = async () => {
    if (!menu.id || generating) return;
    setGenerating(true); setMessage("");
    try {
      const savedMenu = (await DailyMenuService.list()).find(item => item.id === menu.id);
      if (!savedMenu) throw new Error('No se encontró el menú guardado. Vuelve a cargarlo.');
      const image = await generateDailyMenuPoster(savedMenu);
      setPoster({ url: URL.createObjectURL(image), filename: `menu-la-tuba-${savedMenu.scheduledDate}.png`, date: savedMenu.scheduledDate, image });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo generar la imagen.'); }
    finally { setGenerating(false); }
  };

  const sharePoster = async () => {
    if (!poster) return;
    const file = new File([poster.image], poster.filename, { type: "image/png" });
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      setMessage("Este dispositivo no permite compartir im?genes desde el navegador. Descarga la imagen para subirla desde la aplicaci?n.");
      return;
    }
    try {
      await navigator.share({ files: [file], title: `Men? La Tuba ${poster.date}` });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("No se pudo compartir la imagen. Puedes descargarla e intentarlo desde la aplicaci?n.");
    }
  };

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
      <div className="daily-actions"><button type="submit" disabled={saving || menu.price <= 0} className="bg-[#793713] px-4 py-2 text-sm font-semibold text-white"><Save size={15} /> {saving ? "Guardando..." : "Guardar menú"}</button><button type="button" disabled={!menu.id || generating || saving} onClick={() => void generatePoster()} className="border border-[#793713]/35 px-4 py-2 text-sm disabled:opacity-40"><ImageIcon size={15} /> {generating ? 'Generando…' : 'Generar imagen'}</button>{menu.id && <button type="button" onClick={remove}><Trash2 size={15} /> Eliminar</button>}</div>
      <p className="daily-hint">La imagen usa el menú guardado. Guarda los cambios antes de generarla.</p>
    </form>
    <aside className="daily-list"><div className="daily-list-heading"><strong>Menús programados</strong><button type="button" onClick={() => { setMenu(fresh()); setMessage(""); }}>+ Nuevo</button></div>
      {menus.length === 0 && <p className="daily-hint">Aún no hay menús programados.</p>}
      {menus.map((item) => <button key={item.id} type="button" onClick={() => { setMenu(item); setMessage(""); }} className={`daily-list-item ${menu.id === item.id ? "is-selected" : ""}`}><b>{item.dateLabel}</b><span>{item.scheduledDate} · {cop(item.price)} · {item.active ? "Activo" : "Oculto"}</span></button>)}
    </aside>
    {poster && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-labelledby="poster-title"><div className="flex max-h-[90dvh] w-full max-w-xl flex-col bg-[#fff8e8] p-4"><div className="flex items-center justify-between gap-3"><div><h2 id="poster-title" className="font-serif text-xl">Imagen del menú</h2><p className="text-xs text-[#806958]">Menú guardado para {poster.date}</p></div><button type="button" onClick={() => setPoster(null)} aria-label="Cerrar imagen" className="p-2"><X size={20} /></button></div><div className="my-4 min-h-0 flex-1 overflow-y-auto"><img src={poster.url} alt={`Imagen generada del menú para ${poster.date}`} className="mx-auto h-auto max-w-full" /></div><div className="mb-3 flex flex-wrap gap-2"><button type="button" onClick={() => void sharePoster()} className="inline-flex min-h-11 items-center gap-2 border border-[#793713] px-4 py-2 text-sm"><Share2 size={17} /> Compartir imagen</button><a href="https://business.facebook.com/latest/composer" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center border border-[#793713] px-4 py-2 text-sm">Abrir Meta Business Suite</a></div>{message && <p role="status" className="mb-3 text-sm">{message}</p>}<p className="mb-3 text-xs">Para programar la historia, descarga la imagen y s?bela en Meta Business Suite. Compartir no programa ni publica autom?ticamente.</p><a href={poster.url} download={poster.filename} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#793713] px-4 py-3 text-sm font-semibold text-white"><Download size={17} /> Descargar imagen PNG</a></div></div>}
  </div>;
}
