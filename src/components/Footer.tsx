const message = "Venimos desde el sitio web de La Tuba Gastrobar y nos interesa un menú web como ese";
const akoraUrl = `https://api.whatsapp.com/send?phone=573148320587&text=${encodeURIComponent(message)}`;

export default function Footer() {
  return <footer className="fixed inset-x-0 bottom-0 z-30 flex h-7 items-center justify-center border-t border-white/10 bg-[#1d1009] px-4 text-center text-[10px] tracking-[0.16em] text-crema/75">
    <a href={akoraUrl} target="_blank" rel="noreferrer" className="transition hover:text-crema">Desarrollado por Akora</a>
  </footer>;
}
