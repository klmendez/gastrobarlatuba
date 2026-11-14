import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Search, X } from "lucide-react";
import { useStoreProducts } from "../hooks/useStoreProducts";
import { cop } from "../lib/format";
import { isFixedPrice } from "../data/products";

type Props = { embedded?: boolean; showHeader?: boolean; productType?: "carta" | "otro" };

export default function Catalogo({ embedded = false, showHeader = true, productType = "carta" }: Props) {
  const [selectedCategory, setSelectedCategory] = useState("todas");
  const [query, setQuery] = useState("");
  const navRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { products, categories, loading, error } = useStoreProducts();
  const sectionCategories = categories.filter(category => productType === "otro" ? category.id.startsWith("otro-") : !category.id.startsWith("otro-")).sort((a, b) => Number(a.id.startsWith("bebida-")) - Number(b.id.startsWith("bebida-")));
  const carta = sectionCategories.map(category => ({ ...category, products: products.filter(product => product.categoryId === category.id) }));
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visibleCategories = carta.map((category) => ({ ...category, products: category.products.filter((item) => normalize(item.name).includes(normalize(query.trim()))) }))
    .filter((category) => category.products.length > 0);
  const resultCount = visibleCategories.reduce((total, category) => total + category.products.length, 0);
  const visibleIds = visibleCategories.map(category => category.id).join('|');

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sections = [...(contentRef.current?.querySelectorAll<HTMLElement>('[data-catalog-section]') ?? [])];
        const threshold = window.innerWidth >= 1024 ? 175 : window.innerWidth >= 640 ? 150 : 130;
        const current = sections.filter(section => section.getBoundingClientRect().top <= threshold).at(-1);
        setSelectedCategory(current?.id ?? 'todas');
      });
    };
    update(); window.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [visibleIds]);

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (nav && active) nav.scrollTo({ left: active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.clientWidth) / 2, behavior: 'smooth' });
  }, [selectedCategory]);

  return (
    <div className={embedded ? "bg-crema text-neutral-900" : "bg-crema pt-14 text-neutral-900 sm:pt-16 lg:pt-20"}>
      {showHeader && <header className="px-4 pb-3 pt-3 sm:px-8 sm:pb-6 sm:pt-5">
        <div className="mx-auto max-w-6xl text-center">
          <div>
            <div>
              <h1 className="mt-1 text-3xl text-rojo-dark sm:mt-2 sm:text-5xl" >{productType === "otro" ? "Productos de La Tuba" : "Nuestra carta"}</h1>
              <p className="mx-auto mt-1 max-w-md text-xs text-stone-500 sm:mt-2 sm:text-sm">Toca un producto para agregarlo a tu pedido.</p>
            </div>
          </div>
        </div>
      </header>}

      <nav aria-label="Categorías de la carta" className="sticky top-14 z-30 border-y border-rojo/15 bg-crema/95 px-5 backdrop-blur sm:top-16 sm:px-8 lg:top-20">
        <div ref={navRef} className="mx-auto flex max-w-6xl gap-6 overflow-x-auto scrollbar-hide">
          {[{ id: "todas", name: productType === "otro" ? "Todos" : "Toda la carta" }, ...visibleCategories].map((category) => <button key={category.id} type="button" aria-pressed={selectedCategory === category.id} onClick={() => { if (category.id === 'todas') contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); else document.getElementById(category.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className={`min-h-10 shrink-0 border-b-2 py-2 text-xs font-semibold transition-colors sm:min-h-12 sm:py-3 sm:text-sm ${selectedCategory === category.id ? "border-rojo text-rojo" : "border-transparent text-stone-500 hover:text-rojo"}`}>{category.name}</button>)}
        </div>
      </nav>

      <div ref={contentRef} className="mx-auto max-w-6xl scroll-mt-32 px-4 pb-12 sm:px-8 sm:pb-16">
        <div className="border-b border-rojo/10 py-2 sm:flex sm:justify-end sm:py-4">
          <div className="flex w-full items-center gap-2 border-b border-stone-300 sm:max-w-xs"><Search size={16} className="shrink-0 text-stone-400" /><input aria-label="Buscar un plato" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="¿Qué te provoca hoy?" className="min-h-11 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-stone-400 focus-visible:ring-1 focus-visible:ring-rojo" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda" className="p-2 text-rojo"><X size={16} /></button>}</div>
        </div>
        {visibleCategories.map((category) => <section key={category.id} id={category.id} data-catalog-section className="scroll-mt-32 py-5 sm:py-9">
          <div className="mb-2 border-b border-rojo/25 pb-2 text-center sm:mb-5 sm:pb-4">
            <h2 className="text-xl text-rojo-dark sm:text-3xl" >{category.name}</h2>
            <p className="mx-auto hidden max-w-md text-xs text-stone-500 sm:block">{category.description}</p>
          </div>
          <div className="grid gap-x-10 lg:grid-cols-2">
            {category.products.map((item) => {
              return <Link to={`/armar?producto=${encodeURIComponent(item.id)}`} key={item.id} className="group grid grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-3 border-b border-stone-200/80 py-3.5 outline-offset-4 focus-visible:outline-rojo sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-5 sm:py-5" aria-label={`Agregar ${item.name} al pedido`}>
              <div className="aspect-square overflow-hidden bg-crema-dark">{item.image ? <img src={item.image} alt={`Imagen de ${item.name}`} loading="lazy" className="h-full w-full object-cover transition duration-500 motion-safe:group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-xs font-semibold text-rojo/60">La Tuba</div>}</div>
              <div className="flex min-w-0 flex-col">
                <h3 className="text-base font-semibold leading-snug text-stone-900 transition-colors group-hover:text-rojo sm:text-lg">{item.name}</h3>
                <p className="mt-0.5 line-clamp-1 text-xs text-stone-500 sm:mt-1 sm:line-clamp-none sm:text-sm">{item.description}</p>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 sm:mt-3"><span className="text-sm font-semibold text-rojo sm:text-base">{item.category === 'frutafresh' && isFixedPrice(item.prices) ? cop(item.prices.fijo) : ''}</span><span className="inline-flex items-center gap-1 text-xs font-semibold text-rojo"><span className="border-b border-transparent group-hover:border-rojo">Agregar</span><ArrowUpRight size={15} /></span></div>
              </div>
            </Link>})}
          </div>
        </section>)}
        {loading && <p className="py-10 text-center">Cargando la carta…</p>}
        {error && <p role="alert" className="py-10 text-center">No se pudo cargar la carta. Inténtalo de nuevo.</p>}
        {!loading && !error && resultCount === 0 && <div className="py-16 text-center"><p className="font-semibold text-rojo-dark">{productType === "otro" && !query ? "Pronto encontrarás aquí nuestros productos." : "No encontramos resultados."}</p>{query && <button type="button" onClick={() => { setQuery(""); setSelectedCategory("todas"); }} className="mt-5 min-h-11 border-b border-rojo text-sm font-semibold text-rojo">Ver todos</button>}</div>}
        <div className="border-t border-rojo/15 pt-6"><p className="text-xs leading-relaxed text-stone-500">Fotografías de referencia. Consulta las presentaciones disponibles al realizar tu pedido.</p></div>
      </div>
    </div>
  );
}
