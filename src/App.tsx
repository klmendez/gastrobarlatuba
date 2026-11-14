import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import CartBubble from "./components/CartBubble";

const Home = lazy(() => import('./pages/Home'));
const CatalogoPage = lazy(() => import('./pages/CatalogoPage'));
const Catalogo = lazy(() => import('./pages/Catalogo'));
const ArmarPedido = lazy(() => import('./pages/ArmarPedido'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const OrderDetailPage = lazy(() => import('./pages/admin/OrderDetailPage'));
const Terminos = lazy(() => import('./pages/Terminos'));
const Contacto = lazy(() => import('./pages/Contacto'));
const EventsExperience = lazy(() => import('./pages/EventsExperience'));
const MenuDelDia = lazy(() => import('./pages/MenuDelDia'));
const ElegirPedido = lazy(() => import('./pages/ElegirPedido'));
const Reservas = lazy(() => import('./pages/Reservas'));
const AdminAuth = lazy(() => import('./components/AdminAuth'));

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return null;
}

function AppLayout() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <div className={`min-h-dvh flex flex-col ${isAdmin ? "bg-gray-50 text-neutral-900" : "bg-crema pb-7 text-neutral-900"}`}>
      <ScrollToTop />
      {!isAdmin && <Navbar />}
      <main className="flex-1">
        <Suspense fallback={<p className="p-8 text-center">Cargando…</p>}><Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<CatalogoPage />} />
          <Route path="/productos" element={<Catalogo productType="otro" />} />
          <Route path="/menu-del-dia" element={<MenuDelDia />} />
          <Route path="/elegir-pedido" element={<ElegirPedido />} />
          <Route path="/reservas" element={<Reservas />} />
          <Route path="/experiencia" element={<EventsExperience />} />
          <Route path="/eventos" element={<EventsExperience />} />
          <Route path="/armar" element={<ArmarPedido />} />
          <Route path="/armar/personalizar" element={<ArmarPedido />} />
          <Route path="/admin" element={<AdminAuth><AdminDashboard /></AdminAuth>} />
          <Route path="/admin/pedido/:id" element={<AdminAuth><OrderDetailPage /></AdminAuth>} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/contacto" element={<Contacto />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></Suspense>
      </main>
      {!isAdmin && <Footer />}
      {!isAdmin && <CartBubble />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
