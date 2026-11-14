import { supabase } from '../lib/supabase';
export interface FirestoreCategory { id?: string; name: string; description?: string; image?: string; createdAt?: unknown; }
export const CategoryService = {
  async getCategories(): Promise<FirestoreCategory[]> {
    if (!supabase) throw new Error('Supabase no está configurado');
    const { data, error } = await supabase.from('catalog_items').select('category');
    if (error) throw new Error(error.message);
    return [...new Set((data ?? []).map(row => row.category as string))].map(name => ({ id: name, name }));
  },
  async addCategory(data: Omit<FirestoreCategory, 'id'>): Promise<void> { void data; throw new Error('Las categorías se gestionan dentro de cada producto.'); },
  async updateCategory(id: string, data: Partial<FirestoreCategory>): Promise<void> { void id; void data; throw new Error('Las categorías se gestionan dentro de cada producto.'); },
  async deleteCategory(id: string): Promise<void> { void id; throw new Error('Las categorías se gestionan dentro de cada producto.'); },
};
