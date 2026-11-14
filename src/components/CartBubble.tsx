import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingBag } from "lucide-react";

function savedCount() {
  try {
    const value = window.localStorage.getItem("la-tuba-cart");
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter(item => item?.product?.id).length : 0;
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

  if (!count || pathname.startsWith("/admin")) return null;

  const onOrderFlow = pathname.startsWith("/armar");

  return <Link to="/armar?carrito=1" aria-label={`Abrir carrito con ${count} productos`} className={`fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-rojo text-crema shadow-lg transition hover:bg-rojo-dark sm:bottom-12 sm:right-6 sm:h-16 sm:w-16 ${onOrderFlow ? "bottom-24" : "bottom-10"}`}>
    <ShoppingBag size={23} />
    <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-crema bg-white px-1 text-xs font-semibold text-rojo">{count}</span>
  </Link>;
}
