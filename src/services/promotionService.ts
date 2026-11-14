import { Timestamp } from 'firebase/firestore';
import { supabase } from '../lib/supabase';
import type { Promotion } from '../types/promotion';

function db() { if (!supabase) throw new Error('Supabase no está configurado'); return supabase; }
function map(row: { id: string; data: Record<string, unknown> | null; active: boolean }): Promotion & { id: string } {
  const data = (row.data || {}) as unknown as Promotion & { fechaInicio?: string; fechaFin?: string };
  return { ...data, id: row.id, activa: row.active, fechaInicio: data.fechaInicio ? Timestamp.fromDate(new Date(data.fechaInicio)) : undefined, fechaFin: data.fechaFin ? Timestamp.fromDate(new Date(data.fechaFin)) : undefined };
}
function serialize(data: Partial<Promotion>) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? value.toDate().toISOString() : value && typeof value === 'object' && '_methodName' in value ? null : value]));
}
export class PromotionService {
  static async getPromotions(): Promise<(Promotion & { id: string })[]> { const { data, error } = await db().from('promotions').select('*').order('created_at', { ascending: false }); if (error) throw new Error(error.message); return (data ?? []).map(map); }
  static async getActivePromotions(): Promise<(Promotion & { id: string })[]> { const now = Date.now(); return (await this.getPromotions()).filter(p => p.activa && (!p.fechaInicio || p.fechaInicio.toMillis() <= now) && (!p.fechaFin || p.fechaFin.toMillis() >= now)); }
  static async addPromotion(data: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> { const { data: row, error } = await db().from('promotions').insert({ data: serialize(data), active: data.activa }).select('id').single(); if (error) throw new Error(error.message); return row.id; }
  static async updatePromotion(id: string, data: Partial<Promotion>): Promise<void> { const { data: old, error: readError } = await db().from('promotions').select('*').eq('id', id).single(); if (readError) throw new Error(readError.message); const { error } = await db().from('promotions').update({ data: { ...old.data, ...serialize(data) }, active: data.activa ?? old.active, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw new Error(error.message); }
  static async deletePromotion(id: string): Promise<void> { const { error } = await db().from('promotions').delete().eq('id', id); if (error) throw new Error(error.message); }
  static async incrementUsage(id: string): Promise<void> { void id; /* El registro público no modifica promociones sin autorización. */ }
}
