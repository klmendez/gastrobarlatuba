import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, ShoppingBag, X } from "lucide-react";

const links = [
  ["/", "Inicio"],
  ["/menu-del-dia", "Menú del día"],
  ["/catalogo", "Nuestra carta"],
  ["/productos", "Productos"],
  ["/reservas", "Reservas"],
  ["/eventos", "Eventos"],
  ["/experiencia", "Experiencia"],
  ["/contacto", "Ubicación"],
] as const;

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => { const timer = window.setTimeout(() => setOpen(false), 0); return () => window.clearTimeout(timer); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); }
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', escape); desktop.removeEventListener('change', closeOnDesktop); };
  }, [open]);

  return <header className="fixed inset-x-0 top-0 z-50 border-b border-rojo/10 bg-crema/95 shadow-sm backdrop-blur">
    <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:h-20 lg:px-8">
      <Link to="/" className="shrink-0" aria-label="La Tuba Gastrobar, inicio"><img src="/la-tuba-logo.png" alt="La Tuba Gastrobar" className="h-9 w-auto sm:h-11 lg:h-14" /></Link>
      <nav aria-label="Navegación principal" className="hidden items-center gap-4 lg:flex xl:gap-6">
        {links.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `text-sm font-semibold transition ${isActive ? "text-rojo" : "text-stone-600 hover:text-rojo"}`}>{label}</NavLink>)}
      </nav>
      <div className="flex items-center gap-2">
        <Link to="/armar" className="hidden items-center gap-2 rounded-full bg-rojo px-5 py-2.5 text-sm font-semibold text-crema transition hover:bg-rojo-dark sm:inline-flex"><ShoppingBag size={16} /> Mi pedido</Link>
        <button ref={menuButton} aria-expanded={open} aria-controls={open ? 'menu-movil' : undefined} type="button" onClick={() => setOpen((value) => !value)} className="p-2 text-rojo lg:hidden" aria-label={open ? "Cerrar menú" : "Abrir menú"}>{open ? <X size={24} /> : <Menu size={24} />}</button>
      </div>
    </div>
    <AnimatePresence>{open && <><motion.button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="fixed inset-0 top-14 -z-10 bg-black/35 sm:top-16" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.nav id="menu-movil" aria-label="Navegación móvil" className="absolute inset-x-3 top-[calc(100%+0.5rem)] max-h-[calc(100dvh-5rem)] overflow-y-auto border border-rojo/10 bg-crema p-4 shadow-xl lg:hidden" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>{links.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `block border-b border-rojo/10 px-2 py-3 text-base font-semibold ${isActive ? "text-rojo" : "text-stone-700"}`}>{label}</NavLink>)}<Link to="/armar" className="mt-4 flex items-center justify-center gap-2 rounded-full bg-rojo px-5 py-3 text-sm font-semibold text-crema"><ShoppingBag size={17} /> Ver mi pedido</Link></motion.nav></>}</AnimatePresence>
  </header>;
}
