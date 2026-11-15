import { useEffect, useRef, useState } from "react";
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
  const [justAdded, setJustAdded] = useState(false);
  const previousCount = useRef(count);
  const { pathname } = useLocation();

  useEffect(() => {
    let dismissTimer: number | undefined;
    const update = (event: Event) => {
      const nextCount = Number((event as CustomEvent<number>).detail) || savedCount();
      if (nextCount > previousCount.current) {
        setJustAdded(true);
        window.clearTimeout(dismissTimer);
        dismissTimer = window.setTimeout(() => setJustAdded(false), 5000);
      }
      previousCount.current = nextCount;
      setCount(nextCount);
    };
    window.addEventListener("la-tuba-cart-updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.clearTimeout(dismissTimer);
      window.removeEventListener("la-tuba-cart-updated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  if (!count || pathname.startsWith("/admin") || pathname.startsWith("/armar")) return null;

  return <div className="public-cart-bar fixed inset-x-0 bottom-0 z-40 bg-crema/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
    {justAdded && <p role="status" className="mx-auto mb-2 w-fit animate-bounce rounded-full bg-[#fff4dc] px-4 py-2 text-center text-sm font-semibold text-[#542006] shadow-md">
      ¡Producto agregado! Toca aquí para continuar
    </p>}
    <Link to="/armar/personalizar" onClick={() => setJustAdded(false)} className={`mx-auto flex min-h-14 max-w-xl items-center justify-center gap-3 rounded-xl bg-rojo px-4 py-3 text-sm font-medium text-crema shadow-lg transition hover:bg-rojo-dark ${justAdded ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-crema" : ""}`}>
      <ShoppingBag size={22} aria-hidden="true" />
      <span>{justAdded ? "Ver pedido · Continuar" : `Ver pedido · ${count} ${count === 1 ? 'producto' : 'productos'}`}</span>
    </Link>
  </div>;
}
