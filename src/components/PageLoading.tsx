import { useEffect, useState } from 'react';

export default function PageLoading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 12000);
    return () => window.clearTimeout(timer);
  }, []);
  return <section className="min-h-[60dvh] bg-crema px-6 pt-28 text-center text-rojo" aria-label="Cargando sección">
    <div className="mx-auto max-w-sm">
      <p role="status">{slow ? 'La conexión está tardando más de lo esperado.' : 'Cargando…'}</p>
      {slow && <button type="button" className="mt-5 border border-rojo px-5 py-3" onClick={() => window.location.reload()}>Volver a intentar</button>}
    </div>
  </section>;
}
