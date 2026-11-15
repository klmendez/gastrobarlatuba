import { Component, type ReactNode } from 'react';

export default class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section className="mx-auto max-w-lg px-5 pb-16 pt-28 text-center">
      <h1 className="text-2xl">No pudimos abrir esta sección</h1>
      <p role="alert" className="mt-4">Comprueba tu conexión y vuelve a intentarlo. Recargar no borra el pedido guardado en este navegador.</p>
      <button type="button" onClick={() => window.location.reload()} className="mt-6 bg-rojo px-6 py-3 text-white">Volver a intentar</button>
    </section>;
    return this.props.children;
  }
}
