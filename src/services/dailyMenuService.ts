import { supabase } from "../lib/supabase";

export type DailyMenuSpecial = { name: string; price: number };

export function todayInBogota() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export type DailyMenuConfig = {
  id?: string;
  title: string;
  dateLabel: string;
  posterStyle: string;
  price: number;
  active: boolean;
  scheduledDate: string;
  soups: string[];
  sides: string[];
  proteins: string[];
  specials: DailyMenuSpecial[];
  updatedAt?: unknown;
};

export const EMPTY_DAILY_MENU: DailyMenuConfig = {
  title: "Menú del día", dateLabel: "Hoy", posterStyle: "clasico", price: 0, active: false,
  scheduledDate: todayInBogota(),
  soups: ["Sopa de carne", "Sancocho de bagre", "Sancocho de guineo"],
  sides: ["Frijoles", "Lentejas", "Arvejas"],
  proteins: ["Albóndiga frita", "Cerdo en BBQ", "Filete a la plancha"],
  specials: [{ name: "Encocado de piangua", price: 0 }, { name: "Lengua a la criolla", price: 0 }],
};

type DailyMenuRow = {
  id: string; title: string; date_label: string; poster_style?: string; price: number; active: boolean;
  scheduled_date: string; soups: string[]; sides: string[]; proteins: string[];
  specials: DailyMenuSpecial[]; updated_at: string;
};

const fromRow = (row: DailyMenuRow): DailyMenuConfig => ({
  id: row.id, title: row.title, dateLabel: row.date_label, posterStyle: row.poster_style ?? "clasico", price: row.price,
  active: row.active, scheduledDate: row.scheduled_date, soups: row.soups ?? [],
  sides: row.sides ?? [], proteins: row.proteins ?? [],
  specials: (row.specials ?? []).map((item) => typeof item === "string" ? { name: item, price: 0 } : item),
  updatedAt: row.updated_at,
});

export const DailyMenuService = {
  async get(): Promise<DailyMenuConfig> {
    if (!supabase) return EMPTY_DAILY_MENU;
    const { data, error } = await supabase.from("daily_menus").select("*")
      .eq("active", true).eq("scheduled_date", todayInBogota()).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data as DailyMenuRow) : EMPTY_DAILY_MENU;
  },
  async list(): Promise<DailyMenuConfig[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from("daily_menus").select("*").order("scheduled_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as DailyMenuRow[]).map(fromRow);
  },
  async save(menu: DailyMenuConfig): Promise<string> {
    if (!supabase) throw new Error("Supabase no está configurado");
    const row = {
      ...(menu.id ? { id: menu.id } : {}), title: menu.title, date_label: menu.dateLabel,
      poster_style: menu.posterStyle,
      price: menu.price, active: menu.active, scheduled_date: menu.scheduledDate,
      soups: menu.soups, sides: menu.sides, proteins: menu.proteins, specials: menu.specials,
      updated_at: new Date().toISOString(),
    };
    const query = menu.id
      ? supabase.from("daily_menus").update(row).eq("id", menu.id)
      : supabase.from("daily_menus").insert(row);
    const { data, error } = await query.select("id").single();
    if (error) throw new Error(error.message);
    return data.id;
  },
  async remove(id: string): Promise<void> {
    if (!supabase) throw new Error("Supabase no está configurado");
    const { error } = await supabase.from("daily_menus").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
