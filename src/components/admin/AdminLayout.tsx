import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Boxes, Calendar, ChevronDown, ChevronLeft, ChevronRight, Download, Home, LogOut, Menu, Package, PartyPopper, PlusCircle, Tag, Users, Utensils, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import AdminNotifications from './AdminNotifications';

export type AdminSection = "inicio" | "inventario" | "reservas" | "carta-bebidas" | "registrar-venta" | "pedidos-menu" | "pedidos-carta" | "pedidos-bebidas" | "pedidos" | "clientes" | "cumpleanos" | "estadisticas" | "productos" | "categorias" | "promociones" | "menu-dia" | "experiencia";

type Props = { activeSection?: AdminSection; onChangeSection?: (section: AdminSection) => void; onExportCSV?: () => void; children: React.ReactNode };

const sections = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "registrar-venta", label: "Registrar venta", icon: PlusCircle },
  { id: "menu-dia", label: "Menú del día", icon: Utensils },
  { id: "reservas", label: "Reservas", icon: Calendar },
  { id: "experiencia", label: "Eventos y reseñas", icon: PartyPopper },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "cumpleanos", label: "Cumpleaños", icon: Calendar },
  { id: "carta-bebidas", label: "Carta y bebidas", icon: Utensils },
  { id: "productos", label: "Productos", icon: Package },
  { id: "inventario", label: "Inventario", icon: Boxes },
  { id: "promociones", label: "Promociones", icon: Tag },
  { id: "estadisticas", label: "Estadísticas", icon: BarChart3 },
] as const;

const primarySections = sections.slice(0, 2);
const managementSections = sections.slice(2);

const orderSections = [
  { id: "pedidos-menu" as const, label: "Menú del día" },
  { id: "pedidos-carta" as const, label: "Nuestra carta" },
  { id: "pedidos-bebidas" as const, label: "Bebidas" },
  { id: "pedidos" as const, label: "Todos" },
];

const titles: Record<AdminSection, string> = {
  ...Object.fromEntries(sections.map((item) => [item.id, item.label])),
  "pedidos-menu": "Pedidos · Menú del día",
  "pedidos-carta": "Pedidos · Nuestra carta",
  "pedidos-bebidas": "Pedidos · Bebidas",
  pedidos: "Todos los pedidos",
} as Record<AdminSection, string>;

export default function AdminLayout({ activeSection = "pedidos", onChangeSection = () => {}, onExportCSV, children }: Props) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  useEffect(() => { void supabase?.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || "")); }, []);
  useEffect(() => { const timer = window.setTimeout(() => setOpen(false), 0); return () => window.clearTimeout(timer); }, [activeSection]);
  useEffect(() => {
    const keepMobileExpanded = () => { if (window.innerWidth < 1024) setCollapsed(false); };
    keepMobileExpanded();
    window.addEventListener("resize", keepMobileExpanded);
    return () => window.removeEventListener("resize", keepMobileExpanded);
  }, []);

  return <div className="admin-theme min-h-dvh bg-[#f4ead8] text-[#321506] lg:grid" style={{ gridTemplateColumns: `${collapsed ? "5rem" : "17rem"} minmax(0, 1fr)` }}>
    {open && <button type="button" aria-label="Cerrar navegación" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-[#1f0d05]/50 lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[min(17rem,88vw)] flex-col bg-[#321506] text-[#fff4dc] transition-all lg:sticky lg:top-0 lg:h-dvh ${collapsed ? "lg:w-20" : "lg:w-[17rem]"} ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
      <div className={`flex shrink-0 items-center border-b border-[#fff4dc]/15 ${collapsed ? "h-20 flex-col justify-center gap-1 px-1" : "h-20 justify-between px-4"}`}>
        <Link to="/" className="flex min-w-0 items-center gap-3"><img src="/admin-sidebar-icon.png" alt="La Tuba" className={`${collapsed ? "h-9 w-9" : "h-12 w-12"} shrink-0 rounded-full object-cover`} />{!collapsed && <span><b className="block font-serif text-lg leading-none">La Tuba</b><small className="mt-1 block text-[9px] uppercase tracking-[0.25em] text-[#e4c89c]">Administración</small></span>}</Link>
        <button type="button" onClick={() => setCollapsed((value) => !value)} className="hidden p-2 text-[#e4c89c] hover:bg-white/10 lg:block" aria-label={collapsed ? "Expandir menú" : "Comprimir menú"} title={collapsed ? "Expandir menú" : "Comprimir menú"}>{collapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}</button>
        <button type="button" onClick={() => setOpen(false)} className="p-2 lg:hidden"><X size={20} /></button>
      </div>
      <nav className="admin-sidebar-nav min-h-0 flex-1 overflow-y-auto px-3 py-3">{!collapsed && <p className="px-3 pb-3 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#b99568]">Gestión del gastrobar</p>}<div className="space-y-1">
        {primarySections.map((section) => { const Icon = section.icon; const active = activeSection === section.id; return <button key={section.id} type="button" onClick={() => onChangeSection(section.id)} className={`flex w-full items-center px-3 py-3 text-left text-sm transition ${collapsed ? "justify-center" : "gap-3"} ${active ? "bg-[#fff4dc] font-semibold text-[#542006]" : "text-[#ead6b7] hover:bg-white/10 hover:text-white"}`} title={collapsed ? section.label : undefined}><Icon size={18} />{!collapsed && <span>{section.label}</span>}{active && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#793713]" />}</button>; })}
        <button type="button" onClick={() => collapsed ? onChangeSection("pedidos") : setOrdersOpen((value) => !value)} className={`flex w-full items-center px-3 py-3 text-left text-sm transition ${collapsed ? "justify-center" : "gap-3"} ${activeSection.startsWith("pedidos") ? "bg-[#fff4dc] font-semibold text-[#542006]" : "text-[#ead6b7] hover:bg-white/10 hover:text-white"}`} title={collapsed ? "Pedidos" : undefined}><Package size={18} />{!collapsed && <><span>Pedidos</span><ChevronDown size={15} className={`ml-auto transition-transform ${ordersOpen ? "rotate-180" : ""}`} /></>}</button>
        {!collapsed && ordersOpen && <div className="ml-5 border-l border-[#fff4dc]/20 pl-3">{orderSections.map((item) => <button key={item.id} type="button" onClick={() => onChangeSection(item.id)} className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs transition ${activeSection === item.id ? "font-semibold text-white" : "text-[#cdb38c] hover:text-white"}`}><span className={`h-1.5 w-1.5 rounded-full ${activeSection === item.id ? "bg-[#fff4dc]" : "bg-[#9e7951]"}`} />{item.label}</button>)}</div>}
        {managementSections.map((section) => { const Icon = section.icon; const active = activeSection === section.id; return <button key={section.id} type="button" onClick={() => onChangeSection(section.id)} className={`flex w-full items-center px-3 py-3 text-left text-sm transition ${collapsed ? "justify-center" : "gap-3"} ${active ? "bg-[#fff4dc] font-semibold text-[#542006]" : "text-[#ead6b7] hover:bg-white/10 hover:text-white"}`} title={collapsed ? section.label : undefined}><Icon size={18} />{!collapsed && <span>{section.label}</span>}{active && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#793713]" />}</button>; })}
      </div></nav>
      <div className="border-t border-[#fff4dc]/15 p-3"><Link to="/" title={collapsed ? "Ver sitio" : undefined} className={`flex items-center px-3 py-2.5 text-sm text-[#ead6b7] hover:bg-white/10 ${collapsed ? "justify-center" : "gap-3"}`}><Home size={17} />{!collapsed && "Ver sitio"}</Link><button type="button" title={collapsed ? "Cerrar sesión" : undefined} onClick={() => { void supabase?.auth.signOut(); }} className={`mt-1 flex w-full items-center px-3 py-2.5 text-left text-sm text-[#ead6b7] hover:bg-white/10 ${collapsed ? "justify-center" : "gap-3"}`}><LogOut size={17} />{!collapsed && "Cerrar sesión"}</button></div>
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#6b2c0e]/15 bg-[#fff8e8]/95 px-4 backdrop-blur sm:px-7">
        <div className="flex items-center gap-3"><button type="button" onClick={() => setOpen(true)} className="border border-[#6b2c0e]/25 p-2 text-[#542006] lg:hidden" aria-label="Abrir navegación"><Menu size={19} /></button><div><p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#a06843]">Panel administrativo</p><h1 className="font-serif text-xl text-[#542006]">{titles[activeSection] || "Administración"}</h1></div></div>
        <div className="flex items-center gap-2"><AdminNotifications onNavigate={onChangeSection} />{onExportCSV && <button type="button" onClick={onExportCSV} className="inline-flex items-center gap-2 border border-[#6b2c0e]/25 bg-transparent px-3 py-2 text-xs font-semibold text-[#542006] hover:bg-[#f3dfbd]"><Download size={15} /><span className="hidden sm:inline">Exportar</span></button>}<span className="hidden max-w-48 truncate text-xs text-[#806958] md:block">{userEmail}</span></div>
      </header>
      <main className="admin-content p-3 sm:p-5 lg:p-6">{children}</main>
    </div>
  </div>;
}
