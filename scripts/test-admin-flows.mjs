import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';

const line = fs.readFileSync(new URL('../supabase/.env.database.local', import.meta.url), 'utf8').split(/\r?\n/).find(value => value.startsWith('SUPABASE_DB_URL='));
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL || line?.slice('SUPABASE_DB_URL='.length).trim(), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });

try {
  await client.connect();
  await client.query('begin');
  const admin = (await client.query("select id,email from auth.users where lower(email) in (select lower(email) from public.admin_emails) limit 1")).rows[0];
  assert.ok(admin, 'No existe un usuario real incluido en admin_emails');
  await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: admin.id, email: admin.email, role: 'authenticated' })]);
  await client.query('set local role authenticated');
  assert.equal((await client.query('select public.is_la_tuba_admin() allowed')).rows[0].allowed, true);

  for (const table of ['orders', 'contacts', 'inventory_items', 'reservations', 'catalog_items', 'daily_menus', 'events', 'reviews']) {
    await client.query(`select * from public.${table} limit 1`);
  }

  const marker = crypto.randomUUID();
  const event = (await client.query("insert into public.events(title,description,starts_at,published) values($1,'Prueba transaccional',now()+interval '1 day',false) returning id", [`Prueba ${marker}`])).rows[0];
  await client.query('update public.events set published=true where id=$1', [event.id]);
  assert.equal((await client.query('select published from public.events where id=$1', [event.id])).rows[0].published, true);

  const review = (await client.query("insert into public.reviews(name,rating,comment,request_id) values('Prueba admin',5,'Reseña de prueba transaccional',$1) returning id", [crypto.randomUUID()])).rows[0];
  await client.query('update public.reviews set approved=true where id=$1', [review.id]);
  assert.equal((await client.query('select approved from public.reviews where id=$1', [review.id])).rows[0].approved, true);

  const product = (await client.query("insert into public.catalog_items(name,category,item_type,price,available) values($1,'Prueba','bebida',1000,true) returning id", [`Prueba ${marker}`])).rows[0];
  const stockId = (await client.query("select public.create_inventory_item($1,'unidad',2,10) id", [`Prueba ${marker}`])).rows[0].id;
  await client.query('select public.set_inventory_links($1,$2)', [stockId, JSON.stringify([{ id: product.id, quantity: 1 }])]);
  await client.query("select public.adjust_inventory($1,-1,'Prueba transaccional')", [stockId]);
  assert.equal(Number((await client.query('select quantity from public.inventory_items where id=$1', [stockId])).rows[0].quantity), 9);
  assert.equal(Number((await client.query('select quantity_required from public.catalog_inventory_requirements where catalog_item_id=$1', [product.id])).rows[0].quantity_required), 1);

  console.log('PASS: identidad administradora real, permisos y flujos de pedidos, clientes, inventario, reservas, catálogo, menús, eventos y reseñas.');
} finally {
  await client.query('rollback').catch(() => {});
  await client.end().catch(() => {});
  console.log('Datos administrativos de prueba revertidos.');
}
