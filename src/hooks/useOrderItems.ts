import { useCallback, useEffect, useMemo, useReducer } from "react";

import type { Product } from "../data/products";
import type { OrderItem } from "../lib/whatsapp";
import { defaultSize } from "../components/armar-pedido/utils";

type OrderItemsAction =
  | { type: "add"; item: OrderItem }
  | { type: "remove"; itemId: string }
  | { type: "removeLastOfProduct"; productId: string }
  | { type: "duplicate"; itemId: string }
  | { type: "update"; itemId: string; patch: Partial<OrderItem> };

type State = OrderItem[];

function createOrderItemId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createItem(product: Product): OrderItem {
  return {
    id: createOrderItemId(),
    product,
    qty: 1,
    version: product.category === "gomitas" ? "ahogada" : null,
    size: defaultSize(product),
    toppingIds: [],
    extrasQty: {},
    extraSelections: {},
    note: "",
  };
}

function reducer(state: State, action: OrderItemsAction): State {
  switch (action.type) {
    case "add": {
      const match = state.find(item => item.product.id === action.item.product.id && !item.note?.trim() && !item.product.dailyMenuId && !Object.keys(item.extrasQty).length && !item.toppingIds.length);
      if (match) return state.map(item => item.id === match.id ? { ...item, qty: item.qty + 1 } : item);
      return [...state, action.item];
    }
    case "remove": {
      return state.filter((it) => it.id !== action.itemId);
    }
    case "removeLastOfProduct": {
      const lastIdx = state.map((it) => it.product.id).lastIndexOf(action.productId);
      if (lastIdx === -1) return state;
      if (state[lastIdx].qty > 1) return state.map((item, index) => index === lastIdx ? { ...item, qty: item.qty - 1 } : item);
      return [...state.slice(0, lastIdx), ...state.slice(lastIdx + 1)];
    }
    case "duplicate": {
      const idx = state.findIndex((it) => it.id === action.itemId);
      if (idx === -1) return state;
      const source = state[idx];
      const duplicated: OrderItem = {
        ...source,
        id: createOrderItemId(),
        qty: 1,
        toppingIds: [...source.toppingIds],
        extrasQty: { ...source.extrasQty },
        extraSelections: Object.fromEntries(
          Object.entries(source.extraSelections).map(([key, value]) => [key, [...value]]),
        ),
      };
      const next = [...state];
      next.splice(idx + 1, 0, duplicated);
      return next;
    }
    case "update": {
      return state.map((it) => (it.id === action.itemId ? { ...it, ...action.patch } : it));
    }
    default:
      return state;
  }
}

export function useOrderItems(initialItems: OrderItem[] = []) {
  const [items, dispatch] = useReducer(reducer, initialItems, (fallback) => {
    if (fallback.length || typeof window === "undefined") return fallback;
    try {
      const saved = window.localStorage.getItem("la-tuba-cart");
      const parsed: unknown = saved ? JSON.parse(saved) : fallback;
      return Array.isArray(parsed) ? (parsed as OrderItem[])
        .filter((item) => item?.product?.prices && (item.product.dailyMenuId || /^[0-9a-f-]{36}$/i.test(item.product.id)))
        .map(item => ({ ...item, id: item.id || createOrderItemId(), qty: Number.isInteger(item.qty) && item.qty > 0 ? item.qty : 1,
          toppingIds: Array.isArray(item.toppingIds) ? item.toppingIds : [],
          extrasQty: item.extrasQty && typeof item.extrasQty === 'object' ? item.extrasQty : {},
          extraSelections: item.extraSelections && typeof item.extraSelections === 'object' ? item.extraSelections : {},
          note: typeof item.note === 'string' ? item.note : '' })) : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try { window.localStorage.setItem("la-tuba-cart", JSON.stringify(items)); } catch { /* Keep the current order usable when storage is full or blocked. */ }
    window.dispatchEvent(new CustomEvent("la-tuba-cart-updated", { detail: items.reduce((sum, item) => sum + item.qty, 0) }));
  }, [items]);

  const addProduct = useCallback((product: Product) => {
    const item = createItem(product);
    dispatch({ type: "add", item });
    return item.id;
  }, []);

  const updateItem = useCallback((itemId: string, patch: Partial<OrderItem>) => {
    dispatch({ type: "update", itemId, patch });
  }, []);

  const duplicateItem = useCallback((itemId: string) => {
    dispatch({ type: "duplicate", itemId });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    dispatch({ type: "remove", itemId });
  }, []);

  const removeLastOfProduct = useCallback((productId: string) => {
    dispatch({ type: "removeLastOfProduct", productId });
  }, []);

  const selectedIds = useMemo(() => [...new Set(items.map((it) => it.product.id))], [items]);
  const selectedCountByProduct = useMemo(
    () =>
      items.reduce<Record<string, number>>((acc, item) => {
        acc[item.product.id] = (acc[item.product.id] ?? 0) + item.qty;
        return acc;
      }, {}),
    [items],
  );

  return {
    items,
    selectedIds,
    selectedCountByProduct,
    addProduct,
    updateItem,
    duplicateItem,
    removeItem,
    removeLastOfProduct,
  };
}
