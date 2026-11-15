import { Link } from "react-router-dom";

const options = [
  { title: "Menú del día", description: "Elige sopa, principio, proteína o un especial.", image: "/historias/6.png", to: "/menu-del-dia" },
  { title: "Productos", description: "Descubre los productos de La Tuba.", image: "/historias/5.png", to: "/productos" },
  { title: "Nuestra carta", description: "Explora todos los platos disponibles de La Tuba.", image: "/historias/2.png", to: "/catalogo" },
];

export default function ElegirPedido() {
  return <div className="min-h-dvh bg-crema px-5 pb-16 pt-20 sm:pt-24"><main className="mx-auto max-w-2xl"><header className="border-b border-rojo/15 pb-6 text-center"><h1 className="font-serif text-3xl text-rojo-dark sm:text-4xl">¿De dónde quieres elegir?</h1></header><div className="divide-y divide-rojo/15">{options.map((option) => <Link key={option.to} to={option.to} className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-4 py-5"><img src={option.image} alt="" className="h-20 w-20 rounded-full object-cover" /><span><strong className="block text-lg text-rojo-dark">{option.title}</strong><span className="mt-1 block text-sm leading-relaxed text-stone-500">{option.description}</span></span><span className="text-xl text-rojo"></span></Link>)}</div></main></div>;
}
