import { useCallback, useEffect, useState } from "react";
import { type Product } from "../data/products";
import { supabase } from "../lib/supabase";

export type StoreCategory = { id: string; name: string; description?: string; image?: string };
type CatalogRow = { id: string; name: string; description: string; category: string; item_type: "carta" | "bebida" | "otro"; price: number; image_url: string | null; available: boolean };

const normalize = (value: string) => value.trim().toLocaleLowerCase("es");
const slug = (value: string) => normalize(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function useStoreProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: requestError } = await supabase.rpc("public_catalog_items").order("category").order("name");
    if (requestError) { setError(requestError.message); setLoading(false); return; }
    const rows = (data ?? []) as CatalogRow[];
    const managed = rows.map((row): Product => ({
      id: row.id,
      category: "frutafresh",
      categoryId: `${row.item_type}-${slug(row.category)}`,
      name: row.name,
      description: row.description,
      image: row.image_url ?? undefined,
      disponible: row.available,
      toppingsIncludedMax: 0,
      prices: { fijo: row.price },
    }));
    setProducts(managed);
    const unique = new Map<string, StoreCategory>();
    rows.forEach(row => unique.set(`${row.item_type}-${slug(row.category)}`, { id: `${row.item_type}-${slug(row.category)}`, name: row.item_type === "bebida" ? `Bebidas · ${row.category}` : row.category }));
    setCategories([...unique.values()]);
    setError(null); setLoading(false);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  return { products, categories, loading, error, reload };
}
