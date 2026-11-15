import { INSTAGRAM } from "../data/constants";

function instagramUrl(value: string) {
  if (value.startsWith("http")) return value;
  const user = value.replace("@", "").trim();
  return `https://www.instagram.com/${user}`;
}

export default function Terminos() {
  return (
    <div className="bg-crema text-rojo-dark pt-24 lg:pt-28">
      <div className="mx-auto max-w-3xl px-4 pb-16">
        <header className="mb-10 text-center">
          <h1 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
            Términos y condiciones
          </h1>
          <div className="mx-auto mt-4 h-px w-16 bg-white/20" />
        </header>

        <section className="space-y-6 text-sm sm:text-base text-stone-700 leading-relaxed">
          <p>
            Elige platos de la carta, bebidas y opciones del menú del día disponibles.
            Puedes revisar las cantidades y dejar indicaciones para cocina antes de confirmar.
          </p>

          <p>
            Puedes pedir para consumir en mesa, recoger o recibir a domicilio.
            Si eliges domicilio, selecciona tu barrio y dirección para consultar
            el costo de envío en el resumen.
          </p>

          <p>
            Antes de confirmar, revisa los productos, el valor total y el medio de pago.
            Elegir un medio de pago no significa que se haya realizado el cobro.
          </p>

          <p>
            Consulta nuestros canales de contacto:{" "}
            <a href={INSTAGRAM ? instagramUrl(INSTAGRAM) : "/contacto"} className="font-semibold text-rojo hover:underline underline-offset-4">
              {INSTAGRAM || "Contacto"}
            </a>
            . Nos encanta conocer tu experiencia.
          </p>
        </section>

        {/* acento final */}
        <div className="mt-12 h-px w-full bg-gradient-to-r from-transparent via-red-600/30 to-transparent" />
      </div>
    </div>
  );
}
