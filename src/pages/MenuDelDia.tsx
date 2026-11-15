import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DailyMenuService, EMPTY_DAILY_MENU, type DailyMenuConfig } from "../services/dailyMenuService";
import { cop } from "../lib/format";
import type { OrderItem } from "../lib/whatsapp";
import type { Product } from "../data/products";

type ChoiceKey = "soup" | "side" | "protein" | "special";

export default function MenuDelDia() {
  const navigate = useNavigate();
  const [menu, setMenu] = useState<DailyMenuConfig>(EMPTY_DAILY_MENU);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [choices, setChoices] = useState<Record<ChoiceKey, string>>({ soup: "", side: "", protein: "", special: "" });

  useEffect(() => {
    let active = true;
    DailyMenuService.get().then(data => { if (active) setMenu(data); })
      .catch(() => { if (active) setError("No pudimos cargar el menú. Revisa tu conexión y vuelve a intentarlo."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const standardComplete = Boolean((!menu.soups.length || choices.soup) && (!menu.sides.length || choices.side) && (!menu.proteins.length || choices.protein));
  const selectedSpecial = menu.specials.find((item) => item.name === choices.special);
  const selectedPrice = selectedSpecial ? selectedSpecial.price : menu.price;
  const canAdd = menu.active && selectedPrice > 0 && (standardComplete || Boolean(selectedSpecial));
  const choose = (key: ChoiceKey, value: string) => setChoices((current) => key === "special"
    ? { soup: "", side: "", protein: "", special: value }
    : { ...current, [key]: value, special: "" });

  const addOrder = () => {
    if (!canAdd) return;
    const selected = choices.special ? [`Especial: ${choices.special}`] : [`Sopa: ${choices.soup}`, `Principio: ${choices.side}`, `Proteína: ${choices.protein}`];
    const productName = selectedSpecial ? selectedSpecial.name : (menu.title || "Menú del día");
    const product: Product = { id: `carta-menu-dia-${Date.now()}`, category: "frutafresh", categoryId: "menu-del-dia", name: productName, description: selected.join(" · "), image: "/historias/6.png", toppingsIncludedMax: 0, prices: { fijo: selectedPrice } };
    const item: OrderItem = { id: `item-${Date.now()}`, product, qty: 1, version: null, size: null, toppingIds: [], extrasQty: {}, extraSelections: {}, note: selected.join("\n") };
    product.dailyMenuId = menu.id;
    product.menuChoices = choices;
    const saved = window.localStorage.getItem("la-tuba-cart");
    let cart: OrderItem[] = [];
    try { const parsed = saved ? JSON.parse(saved) : []; cart = Array.isArray(parsed) ? parsed : []; } catch { cart = []; }
    cart.push(item);
    window.localStorage.setItem("la-tuba-cart", JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent("la-tuba-cart-updated", { detail: cart.length }));
    navigate("/armar/personalizar");
  };

  if (loading) return <div className="min-h-dvh bg-crema pt-24 text-center text-sm text-stone-500">Cargando menú...</div>;
  if (error) return <div className="min-h-dvh bg-crema px-5 pt-24 text-center"><h1 className="text-3xl text-rojo-dark">Menú del día</h1><p role="alert" className="mt-3 text-sm">{error}</p><button className="mt-4 bg-rojo px-5 py-3 text-white" onClick={() => window.location.reload()}>Reintentar</button></div>;
  if (!menu.active) return <div className="min-h-dvh bg-crema px-5 pt-24 text-center"><h1 className="font-serif text-3xl text-rojo-dark">Menú del día</h1><p className="mt-3 text-sm text-stone-500">El menú de hoy todavía no ha sido publicado.</p></div>;

  const group = (title: string, key: ChoiceKey, options: string[]) => options.length ? <section className="border-t border-rojo/15 py-5">
    <h2 className="text-center text-sm font-semibold text-rojo">{title}</h2>
    <div className="mt-2 divide-y divide-rojo/10">{options.map((option) => <button key={option} type="button" aria-pressed={choices[key] === option} onClick={() => choose(key, option)} className="flex w-full items-center justify-between gap-4 py-3 text-left text-sm font-semibold text-stone-800"><span>{option}</span><span className={`h-4 w-4 rounded-full border-2 ${choices[key] === option ? "border-rojo bg-rojo" : "border-stone-300"}`} /></button>)}</div>
  </section> : null;

  const specials = menu.specials.filter((item) => item.name);

  return <div className="min-h-dvh bg-crema px-5 pb-32 pt-20 sm:pt-24"><main className="mx-auto max-w-2xl"><header className="pb-7 text-center"><h1 className="font-serif text-3xl sm:text-4xl text-rojo-dark">{menu.title}</h1><p className="mt-2 text-sm text-stone-500">{menu.dateLabel}</p><p className="mt-3 text-lg font-semibold text-rojo">Menú corriente: {cop(menu.price)}</p><p className="mt-2 text-sm text-stone-500">Elige una opción de cada grupo o selecciona un especial.</p></header>{group("Sopas", "soup", menu.soups)}{group("Principios", "side", menu.sides)}{group("Proteína", "protein", menu.proteins)}{specials.length > 0 && <section className="border-t border-rojo/15 py-5"><h2 className="text-center text-sm font-semibold text-rojo">Especiales</h2><div className="mt-2 divide-y divide-rojo/10">{specials.map((special) => <button key={special.name} type="button" aria-pressed={choices.special === special.name} onClick={() => choose("special", special.name)} disabled={special.price <= 0} className="flex w-full items-center justify-between gap-4 py-3 text-left disabled:opacity-40"><span><span className="block text-sm font-semibold text-stone-800">{special.name}</span><span className="mt-0.5 block text-xs font-semibold text-rojo">{special.price > 0 ? cop(special.price) : "Precio por configurar"}</span></span><span className={`h-4 w-4 rounded-full border-2 ${choices.special === special.name ? "border-rojo bg-rojo" : "border-stone-300"}`} /></button>)}</div></section>}{!canAdd && <p role="status" className="mt-5 text-sm text-stone-700">Selecciona una opción de cada grupo o un especial para continuar.</p>}<button type="button" onClick={addOrder} disabled={!canAdd} className="mt-6 w-full bg-rojo px-6 py-4 text-sm font-semibold text-crema disabled:bg-stone-300">Agregar al pedido y continuar · {selectedPrice > 0 ? cop(selectedPrice) : ""}</button></main></div>;
}
