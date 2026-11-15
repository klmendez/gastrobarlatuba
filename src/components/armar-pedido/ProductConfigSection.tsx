import type { OrderItem } from "../../lib/whatsapp";
import { cop } from "../../lib/format";
import { getBasePrice } from "../../lib/pricing";
import ProductImage from "../ProductImage";
import { Minus, Plus } from "lucide-react";

type Props = {
  items: OrderItem[];
  updateItem: (itemId: string, patch: Partial<OrderItem>) => void;
  duplicateItem: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  activeProductId?: string | null;
  onFocusProduct?: (itemId: string | null) => void;
  onGoToNext?: () => void;
  onAddAnotherProduct?: () => void;
  showIncompleteWarning?: boolean;
  disabledToppingIds?: string[];
};

export default function ProductConfigSection({
  items,
  removeItem,
  updateItem,
  activeProductId,
  onFocusProduct,
  onGoToNext,
  onAddAnotherProduct,
}: Props) {
  if (!items.length) return null;

  return <section>
    <div className="hidden border-b border-stone-200 pb-3 sm:block">
      <h2 className="text-center text-lg font-semibold text-stone-900">Revisa tus platos</h2>
      <p className="text-center text-xs text-stone-500">Ajusta la cantidad o agrega una indicación para cocina.</p>
    </div>

    <div className="divide-y divide-stone-200">
      {items.map((item) => {
        const active = activeProductId === item.id;
        const price = getBasePrice(item.product, null, item.size);
        return <article key={item.id} className="py-4">
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-4">
            <div className="aspect-square overflow-hidden bg-crema-dark"><ProductImage src={item.product.image ?? "/la-tuba-logo.png"} alt={item.product.name} className="h-full w-full object-cover" /></div>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold leading-tight text-stone-900">{item.product.name}</h3><p className="mt-1 text-sm font-semibold text-rojo">{cop(price)}</p></div><button type="button" onClick={() => removeItem(item.id)} className="text-xs text-stone-400 hover:text-rojo">Quitar</button></div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center rounded-full border border-stone-200"><button type="button" aria-label={`Quitar una unidad de ${item.product.name}`} onClick={() => item.qty > 1 ? updateItem(item.id, { qty: item.qty - 1 }) : removeItem(item.id)} className="flex h-11 w-11 items-center justify-center text-rojo"><Minus size={16} aria-hidden="true" /></button><span className="min-w-6 text-center text-sm font-medium tabular-nums">{item.qty}</span><button type="button" aria-label={`Agregar una unidad de ${item.product.name}`} onClick={() => updateItem(item.id, { qty: item.qty + 1 })} className="flex h-11 w-11 items-center justify-center text-rojo"><Plus size={16} aria-hidden="true" /></button></div>
                <button type="button" onClick={() => onFocusProduct?.(active ? null : item.id)} className="border-b border-rojo pb-0.5 text-xs font-semibold text-rojo">{active ? "Cerrar" : item.note?.trim() ? "Editar indicación" : "Personalizar"}</button>
              </div>
            </div>
          </div>

          {active && <div className="mt-4 sm:ml-[6.5rem]">
            <label htmlFor={`note-${item.id}`} className="text-sm font-semibold text-stone-900">¿Cómo deseas tu plato? <span className="font-normal text-stone-400">(opcional)</span></label>
            <p className="mt-1 text-xs text-stone-500">Ejemplo: menos sal, sin cebolla o salsa aparte.</p>
            <textarea id={`note-${item.id}`} value={item.note ?? ""} onChange={(event) => updateItem(item.id, { note: event.target.value })} maxLength={180} rows={2} placeholder="Escribe una indicación para cocina" className="mt-2 w-full resize-none border border-stone-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-rojo" />
            <button type="button" onClick={() => onFocusProduct?.(null)} className="mt-3 bg-rojo px-5 py-2 text-xs font-semibold text-crema">Guardar indicación</button>
          </div>}

          {!active && item.note?.trim() && <p className="ml-[5.25rem] mt-3 border-l-2 border-rojo pl-3 text-xs text-stone-600 sm:ml-[6.5rem]">{item.note.trim()}</p>}
        </article>;
      })}
    </div>

    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onAddAnotherProduct} className="min-h-11 border border-stone-300 px-5 text-sm font-semibold text-stone-600">Agregar otro plato</button>
      <button type="button" onClick={onGoToNext} className="hidden min-h-11 items-center gap-2 rounded-full bg-rojo px-5 text-sm font-medium text-crema transition-colors hover:bg-rojo-dark sm:flex">Continuar con mis datos <span aria-hidden="true">→</span></button>
    </div>
  </section>;
}
