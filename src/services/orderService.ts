import { Timestamp } from 'firebase/firestore';
import { supabase } from '../lib/supabase';
import type { PedidoFirestore, OrderFilters, OrderUpdate, CustomerLocation } from '../types/order';
import { normalizePhone } from './clientService';
import { submissionIdentity } from '../lib/submission';

type Order = PedidoFirestore & { id: string };
type StatusHistoryRow = { estado: PedidoFirestore['estado']; timestamp: string; nota?: string };
type OrderRow = {
  id: string; order_number: string; customer: PedidoFirestore['cliente']; items: PedidoFirestore['items'];
  subtotal: number; delivery: number; total: number; service: PedidoFirestore['servicio']; paid_total?: number;
  payment_method: PedidoFirestore['formaPago']; status: PedidoFirestore['estado']; comments?: string;
  promotions?: PedidoFirestore['promociones']; discount_total?: number; admin_note?: string;
  payment_details?: PedidoFirestore['detallesPago']; delivery_amount?: number; business_amount?: number;
  status_history?: StatusHistoryRow[]; sale_type?: PedidoFirestore['tipoVenta']; channel?: PedidoFirestore['canal']; created_at: string; updated_at: string;
};
function mapOrder(row: OrderRow): Order {
  return {
    id: row.id, numeroOrden: row.order_number, cliente: row.customer, items: row.items,
    subtotal: row.subtotal, delivery: row.delivery, total: row.total, servicio: row.service,
    paidTotal: row.paid_total ?? 0,
    formaPago: row.payment_method, estado: row.status, comentarios: row.comments,
    promociones: row.promotions ?? [], descuentoTotal: row.discount_total,
    notaAdmin: row.admin_note, detallesPago: row.payment_details,
    montoDomiciliario: row.delivery_amount, montoNegocio: row.business_amount,
    tipoVenta: row.sale_type, canal: row.channel,
    historialEstado: (row.status_history ?? []).map((h) => ({ ...h, timestamp: Timestamp.fromDate(new Date(h.timestamp)) })),
    createdAt: Timestamp.fromDate(new Date(row.created_at)), updatedAt: Timestamp.fromDate(new Date(row.updated_at)),
  };
}
function db() { if (!supabase) throw new Error('Supabase no está configurado'); return supabase; }

export class OrderService {
  static async setItemServed(orderId: string, itemId: string, served: boolean): Promise<void> {
    const { error } = await db().rpc('set_order_item_served', { p_order_id: orderId, p_item_id: itemId, p_served: served });
    if (error) throw new Error(error.message);
  }
  static async createOrder(orderData: Omit<PedidoFirestore, 'createdAt' | 'updatedAt' | 'historialEstado'>): Promise<string> {
    const stable = { ...orderData, numeroOrden: undefined };
    const identity = submissionIdentity('order', stable);
    const { data, error } = await db().rpc('create_public_order', { payload: { ...orderData, ...identity } });
    if (error) throw new Error(error.message);
    const created = Array.isArray(data) ? data[0] : data;
    if (!created?.id) throw new Error('No se pudo registrar el pedido');
    sessionStorage.setItem('la-tuba-order-tracking', JSON.stringify({ orderId: created.id, token: identity.trackingToken }));
    sessionStorage.setItem('la-tuba-order-receipt', JSON.stringify(created));
    return created.id;
  }
  static async updatePublicLocation(orderId: string, location: CustomerLocation): Promise<void> {
    const identity = JSON.parse(sessionStorage.getItem('la-tuba-order-tracking') || 'null');
    if (!identity || identity.orderId !== orderId) return;
    const { error } = await db().rpc('update_order_location', { p_order_id: orderId, p_token: identity.token, p_lat: location.lat, p_lng: location.lng });
    if (error) throw new Error(error.message);
  }
  static async getOrder(id: string): Promise<Order | null> {
    const { data, error } = await db().from('orders').select('*').eq('business', 'la_tuba').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapOrder(data) : null;
  }
  static async getOrders(filters: OrderFilters = {}): Promise<Order[]> {
    const rows: OrderRow[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      let query = db().from('orders').select('*').eq('business', 'la_tuba').order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + pageSize - 1);
      if (filters.estado && filters.estado !== 'todos') query = query.eq('status', filters.estado);
      if (filters.fechaDesde) query = query.gte('created_at', filters.fechaDesde.toISOString());
      if (filters.fechaHasta) { const end = new Date(filters.fechaHasta); end.setHours(23, 59, 59, 999); query = query.lte('created_at', end.toISOString()); }
      if (filters.fechaHastaExclusiva) query = query.lt('created_at', filters.fechaHastaExclusiva.toISOString());
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    const term = filters.busqueda?.toLowerCase().trim();
    return rows.map(mapOrder).filter(order => !term || [order.numeroOrden, order.cliente?.nombres, order.cliente?.celular].some(value => value?.toLowerCase().includes(term)));
  }
  static async updateOrder(id: string, updates: OrderUpdate): Promise<void> {
    const current = await this.getOrder(id);
    if (!current) throw new Error('Pedido no encontrado');
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const mappings: Record<string, string> = { items: 'items', formaPago: 'payment_method', detallesPago: 'payment_details', servicio: 'service', estado: 'status', notaAdmin: 'admin_note', total: 'total', subtotal: 'subtotal', delivery: 'delivery', montoDomiciliario: 'delivery_amount', montoNegocio: 'business_amount', promociones: 'promotions', descuentoTotal: 'discount_total' };
    const updateValues = updates as Record<string, unknown>;
    for (const [key, column] of Object.entries(mappings)) if (key in updates) { const value = updateValues[key]; row[column] = value && typeof value === 'object' && '_methodName' in value ? null : value; }
    if (updates.cliente) row.customer = { ...current.cliente, ...updates.cliente };
    if (updates.estado && updates.estado !== current.estado) row.status_history = [...(current.historialEstado ?? []).map(h => ({ ...h, timestamp: h.timestamp.toDate().toISOString() })), { estado: updates.estado, timestamp: new Date().toISOString(), nota: updates.notaAdmin || `Estado cambiado a ${updates.estado}` }];
    const { error } = await db().from('orders').update(row).eq('id', id).eq('business', 'la_tuba');
    if (error) throw new Error(error.message);
  }
  static async updateCustomerLocation(id: string, location: CustomerLocation): Promise<void> {
    const current = await this.getOrder(id);
    if (current) await this.updateOrder(id, { cliente: { coordenadas: location, ubicacionTiempoReal: [...(current.cliente.ubicacionTiempoReal ?? []), location].slice(-50) } });
  }
  static async deleteOrder(id: string): Promise<void> { const { error } = await db().from('orders').delete().eq('id', id).eq('business', 'la_tuba'); if (error) throw new Error(error.message); }
  static async getOrdersByPhone(phone: string): Promise<Order[]> { const clean = normalizePhone(phone); return (await this.getOrders()).filter(order => normalizePhone(order.cliente?.celular || '') === clean); }
  static async getOrdersByCustomerId(customerId: string): Promise<Order[]> {
    const { data, error } = await db().from('orders').select('*').eq('business', 'la_tuba').eq('customer_id', customerId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapOrder);
  }
  static subscribeToOrders(callback: (orders: Order[]) => void, filters: OrderFilters = {}, onError?: (error: Error) => void): () => void {
    let alive = true;
    const load = () => { void this.getOrders(filters).then(data => { if (alive) callback(data); }).catch(error => { if (alive) onError?.(error); }); };
    load();
    const channel = db().channel(`orders-${crypto.randomUUID()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load).subscribe();
    const { data: authListener } = db().auth.onAuthStateChange(() => { setTimeout(load, 0); });
    const timer = window.setInterval(load, 30000);
    return () => { alive = false; clearInterval(timer); authListener.subscription.unsubscribe(); void db().removeChannel(channel); };
  }
  static subscribeToOrder(id: string, callback: (order: Order | null) => void): () => void {
    let alive = true;
    const load = () => { void this.getOrder(id).then(order => { if (alive) callback(order); }).catch(console.error); };
    load();
    const channel = db().channel(`order-${id}-${crypto.randomUUID()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, load).subscribe();
    const timer = window.setInterval(load, 30000);
    return () => { alive = false; clearInterval(timer); void db().removeChannel(channel); };
  }
  static generateOrderNumber(): string { return `LT-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`; }
  static async getOrderStats() {
    const orders = await this.getOrders();
    return { total: orders.length, noPagado: orders.filter(o => o.estado === 'no_pagado').length, pagado: orders.filter(o => o.estado === 'pagado').length, preparando: orders.filter(o => o.estado === 'preparando').length, enCamino: orders.filter(o => o.estado === 'en_camino').length, entregado: orders.filter(o => o.estado === 'entregado').length, cancelado: orders.filter(o => o.estado === 'cancelado').length };
  }
}
