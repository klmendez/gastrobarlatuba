import fs from 'node:fs';
import pg from 'pg';

// Transcripción de la carta entregada por La Tuba. Cada presentación tiene su propio precio.
const own = [];
for (const name of ['Viche', 'Curao', 'Tomaseca', 'Crema de viche', 'Crema de naidí', 'Arrechón']) {
  const prices = name === 'Viche' ? [50000, 55000, 30000, 35000] : [75000, 80000, 40000, 45000];
  [['Grande 750 ml plástico', prices[0]], ['Grande 750 ml vidrio', prices[1]], ['Pequeña 375 ml plástico', prices[2]], ['Pequeña 375 ml vidrio', prices[3]]].forEach(([presentation, price]) => own.push({ name: `${name} · ${presentation}`, description: `Bebida tradicional · ${presentation}`, category: 'Productos tradicionales', type: 'otro', price }));
}
const groups = {
  Aguardiente: [ ['Aguardiente amarillo · 750 ml',90000], ['Aguardiente amarillo · 375 ml',55000], ['Aguardiente caucano tradicional · 750 ml',80000], ['Aguardiente caucano tradicional · 375 ml',50000], ['Aguardiente antioqueño · 750 ml',80000], ['Aguardiente antioqueño · 375 ml',50000] ],
  Whisky: [ ["Buchanan's Deluxe · 750 ml",220000], ["Buchanan's Deluxe · 375 ml",150000], ["Buchanan's Master · 750 ml",240000], ['Old Parr · 750 ml',190000], ['Old Parr · 375 ml',130000], ['Jimador · 750 ml',160000], ['Jimador · 375 ml',120000] ],
  Ron: [ ['Ron viejo de Caldas tradicional · 750 ml',95000], ['Ron viejo de Caldas tradicional · 375 ml',60000], ['Ron esencial · 750 ml',90000], ['Ron esencial · 375 ml',50000], ['Ron 8 años · 750 ml',130000], ['Ron 15 años · 750 ml',160000] ],
  Otros: [ ['Crema de whisky Baileys · 375 ml',65000], ['Vino de mesa Los Monjes · 750 ml',40000], ['Smirnoff · 750 ml',70000] ],
  Cervezas: [ ['Club',7000], ['Poker',7000], ['Costeña',7000], ['Águila original',7000], ['Águila light',7000], ['Budweiser',7000], ["Red’s",7000], ['Heineken',10000], ['Stella Artois',10000], ['Corona',12000] ],
  Bebidas: [ ['Bretaña',7000], ['Gatorade',8000], ['Electrolit',12000], ['Gaseosa',7000], ['Jugo Hit',7000], ['Jugo de naidí',15000], ['Jugo de chontaduro',15000], ['Jugos naturales',8000], ['Limonada natural',8000], ['Limonada de coco',10000], ['Bebidas calientes',8000] ],
};
const products = [...own, ...Object.entries(groups).flatMap(([group, list]) => list.map(([name, price]) => ({ name, price, description: group, category: 'Licores', type: 'bebida' })))];
const envFile = new URL('../supabase/.env.database.local', import.meta.url);
const line = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find(value => value.startsWith('SUPABASE_DB_URL=')) : null;
const connectionString = process.env.SUPABASE_DB_URL || line?.slice('SUPABASE_DB_URL='.length).trim();
if (!connectionString) throw new Error('Falta la conexión a Supabase.');
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
try {
  await client.connect(); await client.query('begin');
  let inserted = 0; const existing = [];
  for (const item of products) {
    const result = await client.query(`insert into public.catalog_items(name,description,category,item_type,price,available,business)
      values($1,$2,$3,$4,$5,true,'la_tuba') on conflict (business,lower(name)) do nothing returning id`, [item.name,item.description,item.category,item.type,item.price]);
    if (result.rowCount) inserted++; else existing.push(item.name);
  }
  await client.query('commit');
  console.log(`Carta cargada: ${inserted} presentaciones nuevas; ${existing.length} ya existían y no se modificaron.`);
  if (existing.length) console.log(`Revisar existentes: ${existing.join(', ')}`);
} catch (error) { await client.query('rollback').catch(() => {}); throw error; }
finally { await client.end().catch(() => {}); }
