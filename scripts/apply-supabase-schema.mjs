import fs from "node:fs";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const localEnvUrl = new URL("../supabase/.env.database.local", import.meta.url);
let connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString && fs.existsSync(localEnvUrl)) {
  const line = fs.readFileSync(localEnvUrl, "utf8").split(/\r?\n/).find((value) => value.startsWith("SUPABASE_DB_URL="));
  connectionString = line?.slice("SUPABASE_DB_URL=".length).trim();
}

if (!connectionString) {
  console.error("Falta SUPABASE_DB_URL. Define la conexión PostgreSQL solo para esta terminal.");
  process.exit(1);
}

if (connectionString.includes("[YOUR-PASSWORD]")) {
  console.error("SUPABASE_DB_URL todavía contiene [YOUR-PASSWORD].");
  process.exit(1);
}

const sql = fs.readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query("begin");
  await client.query(sql);
  await client.query(fs.readFileSync(new URL('../supabase/operations.sql', import.meta.url), 'utf8'));
  await client.query(fs.readFileSync(new URL('../supabase/migrations/20261111_pay_later.sql', import.meta.url), 'utf8'));
  await client.query(fs.readFileSync(new URL('../supabase/migrations/20261111_order_total_guard.sql', import.meta.url), 'utf8'));
  await client.query(fs.readFileSync(new URL('../supabase/migrations/20261114_catalog_images.sql', import.meta.url), 'utf8'));
  await client.query(fs.readFileSync(new URL('../supabase/migrations/20261114_admin_statistics.sql', import.meta.url), 'utf8'));
  await client.query(fs.readFileSync(new URL('../supabase/migrations/20261114_realtime_notifications.sql', import.meta.url), 'utf8'));
  const zonesSource = fs.readFileSync(new URL('../src/data/barrios.ts', import.meta.url), 'utf8');
  for (const match of zonesSource.matchAll(/\{ id: "([^"]+)", name: "([^"]+)", price: (\d+|null) \}/g)) {
    await client.query('insert into public.delivery_zones(id,name,price) values ($1,$2,$3) on conflict(id) do nothing', [match[1],match[2],match[3] === 'null' ? null : Number(match[3])]);
  }
  await client.query("commit");
  const result = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('app_settings', 'catalog_items', 'daily_menus', 'contacts', 'orders')
    order by table_name
  `);
  console.log(`Esquema aplicado. Tablas verificadas: ${result.rows.map((row) => row.table_name).join(", ")}`);
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(`No se pudo aplicar el esquema: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
