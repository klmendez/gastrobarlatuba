import { CARTA } from "./carta";

export type Category = "gomitas" | "frutafresh";
export type Size = "pequeno" | "mediano" | "grande";
export type Version = "ahogada" | "picosa";

type BaseProduct = {
  id: string;
  dailyMenuId?: string;
  menuChoices?: { soup?: string; side?: string; protein?: string; special?: string };
  category: Category;
  categoryId?: string;
  name: string;
  description: string;
  badge?: string;
  image?: string;
  disponible?: boolean;
};

type VersionedProduct = BaseProduct & {
  category: "gomitas";
  toppingsIncludedMax: number;
  sizes: Size[];
  prices: Record<Version, Record<Size, number>>;
};

export type FixedPriceMap = {
  fijo?: number;
  porSize?: Partial<Record<Size, number>>;
};

type MenuProduct = BaseProduct & {
  category: "frutafresh";
  toppingsIncludedMax?: number;
  sizes?: Size[];
  prices: FixedPriceMap;
};

export type Product = VersionedProduct | MenuProduct;

export function isFixedPrice(prices: FixedPriceMap): prices is { fijo: number } {
  return typeof prices.fijo === "number";
}

function numericPrice(value: string) {
  const match = value.match(/[\d.]+/);
  return match ? Number(match[0].replace(/\./g, "")) : 0;
}

let productNumber = 0;
export const PRODUCTS: Product[] = CARTA.flatMap((category) => category.products.map((item) => {
  productNumber += 1;
  return {
    id: `carta-${productNumber}`,
    category: "frutafresh" as const,
    categoryId: category.id,
    name: item.name,
    description: item.description,
    image: item.image,
    toppingsIncludedMax: 0,
    prices: { fijo: numericPrice(item.price) },
  };
}));
