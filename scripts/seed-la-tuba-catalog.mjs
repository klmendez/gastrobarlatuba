import fs from "node:fs";
import pg from "pg";

const localEnvUrl = new URL("../supabase/.env.database.local", import.meta.url);
const line = fs.readFileSync(localEnvUrl, "utf8").split(/\r?\n/).find(value => value.startsWith("SUPABASE_DB_URL="));
const connectionString = process.env.SUPABASE_DB_URL || line?.slice("SUPABASE_DB_URL=".length).trim();
if (!connectionString) throw new Error("Falta SUPABASE_DB_URL");

const source = fs.readFileSync(new URL("../src/data/carta.ts", import.meta.url), "utf8");
const lines = source.split(/\r?\n/);
const products = [];
let category = "";
let imageNumber = 0;
for (const sourceLine of lines) {
  const categoryMatch = sourceLine.match(/\{ id: "[^"]+", name: "([^"]+)"/);
  if (categoryMatch) category = categoryMatch[1];
  const productMatch = sourceLine.match(/product\("([^"]+)", "\$([\d.]+)[^"]*", "([^"]+)"/);
  if (!productMatch || !category) continue;
  imageNumber += 1;
  const extension = imageNumber <= 10 || (imageNumber >= 21 && imageNumber <= 30) ? "png" : "jpg";
  products.push({ name: productMatch[1], price: Number(productMatch[2].replace(/\./g, "")), description: productMatch[3], category, image: `/carta/${String(imageNumber).padStart(2, "0")}.${extension}` });
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("begin");
  for (const item of products) {
    await client.query(`
      insert into public.catalog_items (name, description, category, item_type, price, image_url, available, business)
      values ($1, $2, $3, 'carta', $4, $5, true, 'la_tuba')
      on conflict (business, lower(name)) do update set
        description = excluded.description,
        category = excluded.category,
        price = excluded.price,
        image_url = excluded.image_url,
        available = true,
        updated_at = now()
    `, [item.name, item.description, item.category, item.price, item.image]);
  }
  await client.query("commit");
  console.log(`Carta de La Tuba cargada: ${products.length} productos.`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
