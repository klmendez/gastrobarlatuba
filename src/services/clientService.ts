import { Timestamp } from 'firebase/firestore';
import { supabase } from '../lib/supabase';

export interface ClientAddress { direccion: string; barrio?: string; referencia?: string; lastUsed: Timestamp; }
export interface FirestoreClient {
  id?: string; celular: string; nombres: string; direcciones: ClientAddress[];
  totalPedidos: number; totalGastado: number; ultimoPedido: Timestamp;
  createdAt: Timestamp; updatedAt: Timestamp; fechaNacimiento?: string;
  correo?: string; cedula?: string; notaAdmin?: string; etiquetas?: string[];
}
export interface ContactLookup { id: string; celular: string; nombres: string; totalPedidos: number; }
function db() { if (!supabase) throw new Error('Supabase no está configurado'); return supabase; }
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('57') ? digits.slice(2) : digits;
}
type ClientAddressRow = { direccion: string; barrio?: string; referencia?: string; lastUsed?: string };
type ClientRow = { id: string; phone: string; name: string; addresses?: ClientAddressRow[]; order_count: number; total_spent: number; last_order_at?: string; created_at: string; updated_at: string; birthday?: string | null; email?: string | null; document_number?: string | null; admin_note?: string | null; tags?: string[] };
function map(row: ClientRow): FirestoreClient {
  return { id: row.id, celular: row.phone, nombres: row.name,
    direcciones: (row.addresses ?? []).map((address) => ({ ...address, lastUsed: Timestamp.fromDate(new Date(address.lastUsed || row.created_at)) })),
    totalPedidos: row.order_count, totalGastado: row.total_spent,
    ultimoPedido: Timestamp.fromDate(new Date(row.last_order_at || row.created_at)),
    createdAt: Timestamp.fromDate(new Date(row.created_at)), updatedAt: Timestamp.fromDate(new Date(row.updated_at)),
    fechaNacimiento: row.birthday ?? undefined, correo: row.email ?? undefined, cedula: row.document_number ?? undefined, notaAdmin: row.admin_note ?? undefined, etiquetas: row.tags ?? [] };
}
export class ClientService {
  static async searchContactsForOrder(term: string): Promise<ContactLookup[]> {
    const query = term.trim();
    if (query.length < 2) return [];
    const { data: session, error: authError } = await db().auth.getSession();
    if (authError) throw authError;
    if (!session.session) throw new Error('Inicia sesión para buscar clientes y prospectos.');
    const digits = normalizePhone(query);
    const byName = /\D/.test(query) ? db().from('contacts').select('id,phone,name,order_count').ilike('name', `%${query.replace(/[\\%_]/g, '\\$&')}%`).limit(8) : null;
    const byPhone = digits.length >= 2 ? db().from('contacts').select('id,phone,name,order_count').ilike('phone', `%${digits}%`).limit(8) : null;
    const results = await Promise.all([byName, byPhone].filter(item => item !== null));
    const contacts = new Map<string, ContactLookup>();
    for (const result of results) {
      if (result.error) throw new Error(result.error.message);
      for (const row of result.data ?? []) contacts.set(row.id, { id: row.id, celular: row.phone, nombres: row.name, totalPedidos: row.order_count });
    }
    return [...contacts.values()].sort((a, b) => b.totalPedidos - a.totalPedidos || a.nombres.localeCompare(b.nombres, 'es')).slice(0, 8);
  }
  // Solo los administradores pueden consultar datos por teléfono sin verificar al titular.
  static async getClientByPhone(phone: string): Promise<FirestoreClient | null> {
    if (!supabase) return null;
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return null;
    const clean = normalizePhone(phone);
    const variants = clean.length === 10 ? [clean, `57${clean}`] : [clean];
    const { data, error } = await supabase.from('contacts').select('*').in('phone', variants).limit(2);
    if (error || !data || data.length !== 1) return null;
    return map(data[0]);
  }
  static async getAllClients(): Promise<FirestoreClient[]> {
    const { data: session, error: authError } = await db().auth.getSession();
    if (authError) throw authError;
    if (!session.session) throw new Error('Inicia sesión para consultar los clientes de La Tuba.');
    const { data, error } = await db().from('customers').select('*').order('last_order_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(map);
  }
  static async searchClients(term: string): Promise<FirestoreClient[]> {
    const lower = term.toLowerCase().trim();
    const digits = normalizePhone(term);
    return (await this.getAllClients()).filter(c => !lower || c.nombres.toLowerCase().includes(lower) || (digits.length > 0 && normalizePhone(c.celular).includes(digits)));
  }
  static async createManualClient(data: { celular: string; nombres: string; fechaNacimiento?: string; correo?: string; cedula?: string; notaAdmin?: string; etiquetas?: string[] }): Promise<void> {
    const { error } = await db().from('contacts').insert({
      phone: data.celular.replace(/\D/g, ''), name: data.nombres, email: data.correo || null,
      birthday: data.fechaNacimiento || null, document_number: data.cedula || null,
      admin_note: data.notaAdmin || null, tags: data.etiquetas ?? [],
    });
    if (error) throw new Error(error.message);
  }
  static async updateClient(phone: string, patch: { celular?: string; nombres?: string; fechaNacimiento?: string | null; correo?: string | null; cedula?: string | null; notaAdmin?: string | null; etiquetas?: string[] }): Promise<void> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.celular !== undefined) row.phone = patch.celular.replace(/\D/g, '');
    if (patch.nombres !== undefined) row.name = patch.nombres;
    if (patch.correo !== undefined) row.email = patch.correo;
    if (patch.fechaNacimiento !== undefined) row.birthday = patch.fechaNacimiento;
    if (patch.cedula !== undefined) row.document_number = patch.cedula;
    if (patch.notaAdmin !== undefined) row.admin_note = patch.notaAdmin;
    if (patch.etiquetas !== undefined) row.tags = patch.etiquetas;
    const { error } = await db().from('contacts').update(row).eq('phone', phone.replace(/\D/g, ''));
    if (error) throw new Error(error.message);
  }
  static async deleteClient(phone: string): Promise<void> { const { error } = await db().from('contacts').delete().eq('phone', phone.replace(/\D/g, '')); if (error) throw new Error(error.message); }
  static async mergeClients(keepPhone: string, mergePhone: string): Promise<void> {
    const { error } = await db().rpc('merge_contacts', { p_keep_phone: keepPhone, p_merge_phone: mergePhone });
    if (error) throw new Error(error.message);
  }
}
