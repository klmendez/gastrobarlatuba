import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingBag } from "lucide-react";

function savedCount() {
  try {
    const value = window.localStorage.getItem("la-tuba-cart");
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.reduce((sum, item) => sum + (item?.product?.id ? Number(item.qty) || 1 : 0), 0) : 0;
  } catch {
    return 0;
  }
}

export default function CartBubble() {
  const [count, setCount] = useState(savedCount);
  const { pathname } = useLocation();

  useEffect(() => {
    const update = (event: Event) => setCount(Number((event as CustomEvent<number>).detail) || savedCount());
    window.addEventListener("la-tuba-cart-updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("la-tuba-cart-updated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  if (!count || pathname.startsWith("/admin") || pathname.startsWith("/armar")) return null;

  return <div className="public-cart-bar fixed inset-x-0 bottom-0 z-40 bg-crema/95 px-3 pt-2 backdrop-blur">
    <Link to="/armar/personalizar" className="mx-auto flex min-h-14 max-w-xl items-center justify-center gap-3 rounded-xl bg-rojo px-4 py-3 text-sm font-medium text-crema shadow-lg hover:bg-rojo-dark">
      <ShoppingBag size={22} aria-hidden="true" />
      <span>Ver pedido · {count} {count === 1 ? 'producto' : 'productos'}</span>
    </Link>
  </div>;
}
