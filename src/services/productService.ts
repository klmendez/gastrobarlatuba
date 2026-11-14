import { supabase } from '../lib/supabase';
import { newestProductsFirst } from '../lib/productOrder';

export type PriceType = 'fijo' | 'porSize' | 'porVersion';

export interface FirestoreProduct {
  id?: string;
  name: string;
  description: string;
  price?: number; // legacy / simple
  priceType?: PriceType;
  priceOptions?: {
    fijo?: number;
    porSize?: { pequeno?: number; mediano?: number; grande?: number };
    porVersion?: {
      ahogada?: { pequeno?: number; mediano?: number; grande?: number };
      picosa?: { pequeno?: number; mediano?: number; grande?: number };
    };
  };
  toppingsIncludedMax?: number;
  sizes?: string[];
  categoryId: string;
  itemType?: "carta" | "bebida" | "otro";
  image?: string;
  badge?: string;
  disponible?: boolean; // false = desactivado por el admin
  createdAt?: string;
}

export const ProductService = {
  async getProducts(): Promise<FirestoreProduct[]> {
    if (!supabase) throw new Error('Supabase no configurado');
    const { data, error } = await supabase.from('catalog_items').select('*').order('name');
    if (error) throw new Error(error.message);
    return newestProductsFirst((data ?? []).map(row => ({ id: row.id, itemType: row.item_type, name: row.name, description: row.description, categoryId: row.category, price: row.price, priceType: 'fijo' as const, priceOptions: { fijo: row.price }, image: row.image_url, disponible: row.available, createdAt: row.created_at })));
  },

  async addProduct(data: Omit<FirestoreProduct, 'id'>): Promise<void> {
    if (!supabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('catalog_items').insert({ name: data.name, description: data.description, category: data.categoryId, price: data.priceOptions?.fijo ?? data.price ?? 0, item_type: 'carta', image_url: data.image, available: data.disponible ?? true });
    if (error) throw new Error(error.message);
  },

  async updateProduct(id: string, data: Partial<FirestoreProduct>): Promise<void> {
    if (!supabase) throw new Error('Supabase no configurado');
    const row: Record<string, unknown> = {};
    if (data.name !== undefined) row.name = data.name;
    if (data.description !== undefined) row.description = data.description;
    if (data.categoryId !== undefined) row.category = data.categoryId;
    if (data.price !== undefined) row.price = data.price;
    if (data.image !== undefined) row.image_url = data.image;
    if (data.disponible !== undefined) row.available = data.disponible;
    const { error } = await supabase.from('catalog_items').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteProduct(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('catalog_items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
};
