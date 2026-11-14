import { Link } from "react-router-dom";
import { Instagram, MessageCircle } from "lucide-react";
import { INSTAGRAM_URL, waLink } from "../data/constants";

type PageKind = "menu" | "reservas" | "experiencia" | "eventos";

const content: Record<PageKind, {
  title: string;
  intro: string;
  image: string;
  lines: string[];
  action: string;
  message?: string;
  link?: string;
}> = {
  menu: {
    title: "Lo especial de hoy",
    intro: "Cada jornada preparamos una selección distinta con el sabor de La Tuba.",
    image: "/historias/6.png",
    lines: ["Preparaciones frescas del día", "Disponibilidad limitada", "Pregunta por entrada, plato fuerte y bebida"],
    action: "Consultar el menú de hoy",
    message: "Hola, quisiera conocer el menú del día de La Tuba Gastrobar.",
  },
  reservas: {
    title: "Tu mesa en La Tuba",
    intro: "Cuéntanos cuántas personas vienen, la fecha y la hora. Confirmaremos la disponibilidad contigo.",
    image: "/historias/4.png",
    lines: ["Nombre de la reserva", "Fecha y hora", "Número de personas"],
    action: "Solicitar una reserva",
    message: "Hola, quiero reservar una mesa en La Tuba Gastrobar. Fecha: ___ Hora: ___ Personas: ___.",
  },
  experiencia: {
    title: "Sabor, música y encuentro",
    intro: "La Tuba es un lugar para compartir la cocina del Pacífico, celebrar y disfrutar sin afán.",
    image: "/historias/5.png",
    lines: ["Cocina con identidad", "Ambiente para compartir", "Momentos que continúan en nuestras redes"],
    action: "Ver nuestra experiencia",
    link: INSTAGRAM_URL,
  },
  eventos: {
    title: "Celebra con nosotros",
    intro: "Organizamos encuentros, celebraciones y experiencias especiales adaptadas a tu grupo.",
    image: "/historias/3.png",
    lines: ["Celebraciones y cumpleaños", "Encuentros de grupos", "Propuestas según tu ocasión"],
    action: "Cotizar un evento",
    message: "Hola, quiero cotizar un evento en La Tuba Gastrobar. Tipo de evento: ___ Fecha: ___ Personas: ___.",
  },
};

export default function ExplorePage({ kind }: { kind: PageKind }) {
  const page = content[kind];
  const href = page.link ?? waLink(page.message ?? "Hola, quiero información de La Tuba Gastrobar.");

  return (
    <div className="min-h-dvh bg-crema px-5 pb-16 pt-20 text-stone-900 sm:pt-24 lg:pt-28">
      <main className="mx-auto max-w-4xl">
        <header className="flex flex-col items-center gap-7 border-b border-rojo/15 pb-8 text-center sm:pb-10">
          <div>
            <h1 className="mx-auto max-w-xl font-serif text-4xl leading-tight text-rojo-dark sm:text-5xl">{page.title}</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-stone-600 sm:text-base">{page.intro}</p>
          </div>
          <img src={page.image} alt="" className="mx-auto h-40 w-40 rounded-full object-cover sm:h-52 sm:w-52" />
        </header>

        <div className="divide-y divide-rojo/10 border-b border-rojo/15">
          {page.lines.map((line, index) => (
            <div key={line} className="flex items-center gap-4 py-5">
              <span className="text-xs font-semibold text-rojo">0{index + 1}</span>
              <p className="text-sm font-semibold text-stone-800 sm:text-base">{line}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 bg-rojo px-6 py-3 text-sm font-semibold text-white">
            {page.link ? <Instagram size={18} /> : <MessageCircle size={18} />}{page.action}
          </a>
          {kind === "menu" && <Link to="/catalogo" className="inline-flex min-h-12 items-center justify-center border border-rojo px-6 py-3 text-sm font-semibold text-rojo">Ver nuestra carta</Link>}
        </div>
      </main>
    </div>
  );
}
