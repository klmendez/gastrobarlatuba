const message = "Venimos desde el sitio web de La Tuba Gastrobar y nos interesa un menú web como ese";
const akoraUrl = `https://api.whatsapp.com/send?phone=573148320587&text=${encodeURIComponent(message)}`;

export default function Footer() {
  return <footer className="site-footer flex min-h-14 items-center justify-center border-t border-rojo/10 px-4 py-4 text-center text-xs text-stone-600">
    <a href={akoraUrl} target="_blank" rel="noreferrer" className="transition hover:text-crema">Desarrollado por Akora</a>
  </footer>;
}
