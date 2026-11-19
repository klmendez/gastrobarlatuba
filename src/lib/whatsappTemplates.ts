import type { PedidoFirestore } from '../types/order';
import type { FirestoreClient } from '../services/clientService';
import { cop } from './format';

export type QuickMessage = { label: string; message: string };

export function buildOrderQuickMessages(order: PedidoFirestore & { id: string }): QuickMessage[] {
  const nombre = order.cliente.nombres?.split(' ')[0] || order.cliente.nombres;
  const codigo = order.numeroOrden;
  const descuentoLinea = (order.descuentoTotal ?? 0) > 0
    ? ` (incluye descuento de ${cop(order.descuentoTotal!)})`
    : '';

  const messages: QuickMessage[] = [
    {
      label: '✅ Confirmar pedido',
      message: `Hola ${nombre}! Confirmamos tu pedido ${codigo} por ${cop(order.total)}${descuentoLinea}. ¡Gracias por tu compra! 🌶️`,
    },
    {
      label: '💳 Recordar pago',
      message: `Hola ${nombre}, tu pedido ${codigo} tiene un saldo pendiente de ${cop(Math.max(0, order.total - (order.paidTotal ?? 0)))}. Gracias.`,
    },
    {
      label: '💛 Agradecimiento',
      message: order.servicio === 'local' ? `¡Gracias por disfrutar en La Tuba, ${nombre}! Esperamos verte pronto. 💛` : `¡Gracias por tu pedido, ${nombre}! Esperamos que lo disfrutes. 💛`,
    },
  ];
  if (order.servicio === 'domicilio') messages.splice(2, 0, { label: '🛵 En camino', message: `¡Hola ${nombre}! Tu pedido ${codigo} ya va en camino. 🛵` });
  if (order.servicio === 'llevar') messages.splice(2, 0, { label: '🎉 Listo para recoger', message: `¡Hola ${nombre}! Tu pedido ${codigo} está listo para recoger. 🎉` });
  return messages;
}

export function buildClientQuickMessages(client: FirestoreClient): QuickMessage[] {
  const nombre = client.nombres?.split(' ')[0] || client.nombres;

  return [
    {
      label: '👋 Saludo',
      message: `Hola ${nombre}! Te contactamos desde La Tuba Gastrobar 👋`,
    },
    {
      label: '🎉 Promo especial',
      message: `Hola ${nombre}! Tenemos una promo especial para ti 🎉 Escríbenos para más info.`,
    },
    {
      label: '🎂 Cumpleaños',
      message: `¡Feliz cumpleaños, ${nombre}! 🎂 Tienes un descuento especial esperándote en tu próximo pedido.`,
    },
    {
      label: '😋 Reactivación',
      message: `Hola ${nombre}! Hace tiempo no sabemos de ti, ¿qué antojo tienes hoy? 😋`,
    },
  ];
}
