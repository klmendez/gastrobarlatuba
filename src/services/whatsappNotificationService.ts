import type { PedidoFirestore, OrderStatus } from '../types/order';
import { cop } from '../lib/format';
import { WHATSAPP_PHONE } from '../data/constants';

export class WhatsAppNotificationService {
  private static readonly BUSINESS_PHONE = `57${WHATSAPP_PHONE}`;

  // Mensaje especial para cambios en productos
  private static readonly PRODUCT_CHANGE_MESSAGE = (order: PedidoFirestore & { id: string }) => 
    `Hola ${order.cliente.nombres}! 📝\n\nHemos realizado algunos ajustes a tu pedido ${order.numeroOrden}.\n\n🔄 *Cambios realizados*\nRevisa los detalles actualizados.\n\nTotal actualizado: ${cop(order.total)}\n\n¿Todo está bien? Responde para confirmar.\n\n¡Gracias por tu comprensión! 🌶️`;

  // Mensaje de nuevo pedido para el negocio
  private static readonly NEW_ORDER_BUSINESS_MESSAGE = (order: PedidoFirestore & { id: string }) => {
    const items = order.items.map((item, index) => 
      `${index + 1}. x${item.qty} ${item.product.name}${item.version ? ` (${item.version})` : ''}${item.size ? ` - ${item.size}` : ''}`
    ).join('\n');

    return `🔔 *NUEVO PEDIDO* 🔔\n\n📋 *Orden:* ${order.numeroOrden}\n👤 *Cliente:* ${order.cliente.nombres}\n📱 *Teléfono:* ${order.cliente.celular}\n\n🛍️ *Productos:*\n${items}\n\n💰 *Total:* ${cop(order.total)}\n💳 *Pago:* ${order.formaPago}\n🚚 *Servicio:* ${order.servicio === 'domicilio' ? 'Domicilio' : 'Para llevar'}\n\n${order.servicio === 'domicilio' ? `📍 *Dirección:*\n${order.cliente.direccion}` : ''}\n\n⚡ *Estado:* ${order.estado === 'no_pagado' ? 'Pendiente de pago' : 'Pagado'}\n\n🌶️ ¡Nuevo La Tuba Gastrobar!`;
  };

  // Enviar notificación al cliente sobre cambio de estado
  static sendStatusNotification(order: PedidoFirestore & { id: string }, newStatus: OrderStatus): void {
    const name = order.cliente.nombres || 'cliente';
    const code = order.numeroOrden;
    const destination = order.servicio === 'local' ? 'Te lo serviremos en La Tuba.' : order.servicio === 'llevar' ? 'Te avisaremos cuando esté listo para recoger.' : 'Lo llevaremos a tu dirección.';
    const messages: Record<OrderStatus, string> = {
      no_pagado: `Hola ${name}, el pedido ${code} tiene un saldo pendiente de ${cop(Math.max(0, order.total - (order.paidTotal ?? 0)))}. Gracias por elegir La Tuba.`,
      pagado: `Hola ${name}, actualizamos el estado del pedido ${code}. ${destination} Gracias por elegir La Tuba.`,
      preparando: `Hola ${name}, estamos preparando tu pedido ${code}. ${destination}`,
      en_camino: order.servicio === 'domicilio' ? `Hola ${name}, tu pedido ${code} va en camino${order.cliente.direccion ? ` a ${order.cliente.direccion}` : ''}.` : order.servicio === 'llevar' ? `Hola ${name}, tu pedido ${code} está listo para recoger en La Tuba.` : `Hola ${name}, tu pedido ${code} está listo para servir en La Tuba.`,
      entregado: order.servicio === 'local' ? `¡Gracias por disfrutar en La Tuba, ${name}! Esperamos verte pronto.` : `¡Gracias por tu pedido, ${name}! Esperamos que lo disfrutes.`,
      cancelado: `Hola ${name}, tu pedido ${code} ha sido cancelado. Si tienes alguna duda, contáctanos.`,
    };
    const message = messages[newStatus];
    this.sendWhatsAppMessage(order.cliente.celular, message);
  }

  // Enviar notificación sobre cambios en productos
  static sendProductChangeNotification(order: PedidoFirestore & { id: string }): void {
    const message = this.PRODUCT_CHANGE_MESSAGE(order);
    this.sendWhatsAppMessage(order.cliente.celular, message);
  }

  // Notificar al negocio sobre nuevo pedido
  static sendNewOrderNotification(order: PedidoFirestore & { id: string }): void {
    const message = this.NEW_ORDER_BUSINESS_MESSAGE(order);
    this.sendWhatsAppMessage(this.BUSINESS_PHONE, message);
  }

  // Mensaje personalizado
  static sendCustomMessage(phone: string, message: string): void {
    this.sendWhatsAppMessage(phone, message);
  }

  // Función base para enviar mensajes de WhatsApp
  private static sendWhatsAppMessage(phone: string, message: string): void {
    const cleanPhone = phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodedMessage}`;
    
    // Abrir WhatsApp en nueva ventana
    window.open(whatsappUrl, '_blank');
  }

  // Generar mensaje de confirmación de pedido (usado por CartDrawer)
  static generateOrderConfirmationMessage(order: PedidoFirestore & { id: string }): string {
    const items = order.items.map((item, index) => 
      `${index + 1}. x${item.qty} ${item.product.name}${item.version ? ` (${item.version})` : ''}${item.size ? ` - ${item.size}` : ''}`
    ).join('\n');

    return `🌶️ *Nuevo Pedido - La Tuba Gastrobar* 🌶️\n\n📋 *Número:* ${order.numeroOrden}\n👤 *Cliente:* ${order.cliente.nombres}\n📱 *Teléfono:* ${order.cliente.celular}\n\n🛍️ *Productos:*\n${items}\n\n💰 *Total:* ${cop(order.total)}\n💳 *Pago:* ${order.formaPago}\n🚚 *Servicio:* ${order.servicio === 'domicilio' ? 'Domicilio' : 'Para llevar'}\n\n${order.servicio === 'domicilio' ? `📍 *Dirección:*\n${order.cliente.direccion}\n${order.cliente.coordenadas ? '📱 Ubicación compartida en tiempo real' : ''}` : ''}\n\n✅ *Confirma este pedido para continuar*\n\n¡Gracias por elegir La Tuba Gastrobar! 🔥`;
  }

  // Mensajes predefinidos comunes
  static readonly PREDEFINED_MESSAGES = {
    confirmPayment: (orderNumber: string) => 
      `¡Hola! Hemos recibido tu pago para el pedido ${orderNumber}. ¡Comenzamos a preparar tu La Tuba Gastrobar! 🌶️✅`,
    
    readyForPickup: (orderNumber: string) => 
      `¡Tu pedido ${orderNumber} está listo para recoger! Te esperamos en nuestro punto. 🥡✨`,
    
    delayNotification: (orderNumber: string, extraMinutes: number) => 
      `Disculpa la demora con tu pedido ${orderNumber}. Necesitamos ${extraMinutes} minutos adicionales para asegurar la mejor calidad. ¡Gracias por tu paciencia! 🌶️⏱️`,
    
    thankYou: (customerName: string) => 
      `¡Gracias ${customerName} por elegir La Tuba Gastrobar! Esperamos verte pronto. 🌶️❤️`,
  };
}
