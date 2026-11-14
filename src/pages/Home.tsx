import { Link } from "react-router-dom";
import { MessageCircle, Package } from "lucide-react";
import { waLink } from "../data/constants";

const highlights = [
  ["Menú del día", "/historias/6.png", "/menu-del-dia"],
  ["Nuestra carta", "/historias/2.png", "/catalogo"],
  ["Productos", "", "/productos"],
  ["Reservas", "/historias/4.png", "/reservas"],
  ["Experiencia", "/historias/5.png", "/experiencia"],
  ["Eventos", "/historias/3.png", "/eventos"],
  ["Ubicación", "/historias/Ubicación.png", "/contacto"],
] as const;

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-crema pt-14 sm:pt-16 lg:pt-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.9),transparent_55%)]" />
      <section className="relative mx-auto flex min-h-[calc(100dvh-5.25rem)] max-w-6xl flex-col items-center justify-center px-5 py-8 text-center sm:min-h-[calc(100dvh-6rem)] sm:py-12 lg:min-h-[calc(100dvh-7rem)]">
        <img src="/la-tuba-logo.png" alt="La Tuba Gastrobar" className="w-[min(76vw,27rem)] object-contain" />
        <p className="mt-6 max-w-sm text-sm leading-relaxed text-stone-600 sm:mt-8 sm:text-base">El sabor de compartir. Encuentra todo lo que pasa en La Tuba.</p>
        <nav aria-label="Accesos de La Tuba" className="mx-auto mt-9 grid w-full max-w-md grid-cols-3 place-items-start gap-x-1 gap-y-6 sm:mt-11 sm:max-w-4xl sm:grid-cols-7 sm:gap-5">
          {highlights.map(([label, image, href]) => {
            const item = <>{image ? <img src={image} alt="" className="h-[4.75rem] w-[4.75rem] rounded-full object-cover transition group-hover:scale-105 sm:h-24 sm:w-24" /> : <span className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full bg-rojo text-white sm:h-24 sm:w-24"><Package size={30} /></span>}<span className="mt-2 text-center text-sm font-semibold leading-[1.05] text-rojo-dark sm:text-base">{label}</span></>;
            return href.startsWith("/") ? <Link key={label} to={href} className="group flex w-full flex-col items-center justify-self-center">{item}</Link> : <a key={label} href={href} className="group flex w-full flex-col items-center justify-self-center">{item}</a>;
          })}
        </nav>
        <a href={waLink("Hola, quiero conocer La Tuba Gastrobar")} target="_blank" rel="noreferrer" className="mt-10 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-rojo px-8 py-3 text-sm font-semibold text-white shadow-md shadow-rojo/20 transition hover:bg-rojo-dark hover:shadow-lg sm:mt-12 sm:px-9 sm:text-base"><MessageCircle size={17} /> Escríbenos</a>
      </section>
    </main>
  );
}
