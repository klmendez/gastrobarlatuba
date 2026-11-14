import { BarChart3, Boxes, CalendarDays, ClipboardList, PlusCircle, Tag, Users, UtensilsCrossed, BookOpen } from "lucide-react";
import type { AdminSection } from "./AdminLayout";

const links = [
  { id: "pedidos", title: "Pedidos", description: "Consulta y actualiza los pedidos por tipo y estado.", icon: ClipboardList },
  { id: "registrar-venta", title: "Registrar venta", description: "Registra lo vendido directamente en el gastrobar.", icon: PlusCircle },
  { id: "menu-dia", title: "Menú del día", description: "Organiza y programa las opciones de cada fecha.", icon: UtensilsCrossed },
  { id: "reservas", title: "Reservas", description: "Revisa solicitudes y asigna mesas.", icon: CalendarDays },
  { id: "carta-bebidas", title: "Carta y bebidas", description: "Administra productos, precios, imágenes y categorías.", icon: BookOpen },
  { id: "productos", title: "Productos", description: "Gestiona los productos propios de La Tuba.", icon: BookOpen },
  { id: "inventario", title: "Inventario", description: "Controla existencias y registra entradas y salidas.", icon: Boxes },
  { id: "clientes", title: "Clientes", description: "Consulta las personas que ya realizaron pedidos.", icon: Users },
  { id: "cumpleanos", title: "Cumpleaños", description: "Revisa las fechas de cumpleaños de tus clientes.", icon: CalendarDays },
  { id: "promociones", title: "Promociones", description: "Configura descuentos, cupones y vigencias.", icon: Tag },
  { id: "estadisticas", title: "Estadísticas", description: "Consulta los resultados de La Tuba.", icon: BarChart3 },
] satisfies { id: AdminSection; title: string; description: string; icon: typeof Boxes }[];

export default function AdminHome({ onNavigate }: { onNavigate: (section: AdminSection) => void }) {
  return <div className="admin-welcome">
    <div className="admin-welcome-intro"><p>LA TUBA GASTROBAR</p><h2>Bienvenida a tu espacio</h2><span>Elige una sección para empezar a gestionar el gastrobar.</span></div>
    <div className="admin-welcome-links">{links.map(({ id, title, description, icon: Icon }) => <button key={id} type="button" onClick={() => onNavigate(id)} className="admin-welcome-link"><span className="admin-welcome-icon"><Icon size={22} /></span><span><strong>{title}</strong><small>{description}</small></span><span className="admin-welcome-arrow" aria-hidden="true">↗</span></button>)}</div>
  </div>;
}
