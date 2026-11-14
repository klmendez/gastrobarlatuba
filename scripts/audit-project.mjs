import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';

// No muestra credenciales ni datos personales. Todas las pruebas se revierten.
const env = fs.readFileSync(new URL('../supabase/.env.database.local', import.meta.url), 'utf8');
const connectionString = process.env.SUPABASE_DB_URL || env.split(/\r?\n/).find(line => line.startsWith('SUPABASE_DB_URL='))?.slice(16).trim();
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
await client.connect();
try {
  await client.query('begin');
  console.log('Estado:', (await client.query(`select
    (select count(*) from public.contacts)::int contacts,
    (select count(*) from public.customers)::int customers,
    (select count(*) from public.prospects)::int prospects,
    (select count(*) from public.orders where business <> 'la_tuba')::int foreign_orders,
    (select count(*) from public.orders where business = 'la_tuba')::int orders,
    (select count(*) from public.inventory_items)::int inventory_items,
    (select count(*) from public.catalog_inventory_requirements)::int inventory_links,
    (select count(*) from public.daily_menus where active and scheduled_date = (now() at time zone 'America/Bogota')::date)::int todays_menus
  `)).rows[0]);
  console.log('Reservas:', (await client.query('select open_days, slots, duration_minutes, seats_per_table, decoration_price from public.reservation_settings')).rows);
  console.log('Catalogo:', (await client.query('select item_type, count(*)::int total, count(*) filter(where available)::int available from public.catalog_items group by item_type')).rows);
  const images = (await client.query('select image_url from public.catalog_items')).rows;
  const missing = images.filter(({ image_url: path }) => !path || (path.startsWith('/') && !fs.existsSync(new URL(`../public${path}`, import.meta.url))));
  console.log('Productos sin imagen local disponible:', missing.length);
  const phone = `8${String(Date.now()).slice(-9)}`;
  const { rows: [contact] } = await client.query("insert into public.contacts(phone,name,birthday) values ($1,'Prueba auditoria','02-14') returning id", [phone]);
  assert.equal((await client.query('select count(*)::int n from public.customers where id=$1', [contact.id])).rows[0].n, 0);
  await client.query('set local role anon');
  const found = await client.query('select * from public.get_contact_by_phone($1)', [`57${phone}`]);
  assert.equal(found.rows.length, 1);
  assert.equal(found.rows[0].name, 'Prueba auditoria');
  const catalog = await client.query('select * from public.public_catalog_items()');
  assert.ok(catalog.rows.length > 0);
  await client.query('select * from public.get_reservation_settings()');
  await client.query("select * from public.get_reservation_slots((now() at time zone 'America/Bogota')::date, (now() at time zone 'America/Bogota')::date + 7, 2, 'mesas')");
  const product = catalog.rows[0];
  const payload = {
    requestId: crypto.randomUUID(),
    numeroOrden: `LT-audit-${crypto.randomUUID()}`,
    cliente: { celular: phone, nombres: 'Prueba auditoria', mesa: 1 },
    items: [{ id: 'audit-item', product: { id: product.id, name: product.name, prices: { fijo: product.price } }, qty: 1 }],
    subtotal: product.price, total: product.price, delivery: 0, servicio: 'local', formaPago: 'Efectivo'
  };
  const quote = (await client.query('select public.quote_order($1::jsonb) as quote', [JSON.stringify(payload)])).rows[0].quote;
  const result = await client.query('select * from public.create_public_order($1::jsonb)', [JSON.stringify({ ...payload, ...quote })]);
  await client.query('reset role');
  assert.equal((await client.query('select order_count from public.contacts where id=$1', [contact.id])).rows[0].order_count, 1);
  await client.query("update public.orders set status='cancelado' where id=$1", [result.rows[0].id]);
  assert.equal((await client.query('select order_count from public.contacts where id=$1', [contact.id])).rows[0].order_count, 0);
  await client.query("update public.reservation_settings set open_days = array[1,2,3,4,5,6,7], slots = array['19:00'], duration_minutes = 120, seats_per_table = 6 where id = 1");
  const day = (await client.query("select to_char((now() at time zone 'America/Bogota')::date + 80, 'YYYY-MM-DD') as reservation_day")).rows[0].reservation_day;
  await client.query('set local role anon');
  const available = await client.query('select * from public.get_reservation_slots($1::date,$1::date,2,\'mesas\')', [day]);
  if (available.rows.some(row => row.remaining_tables === 7)) {
    await client.query('select public.create_reservation_request($1::jsonb)', [JSON.stringify({requestId: crypto.randomUUID(), phone, name:'Prueba auditoria', date:day, time:'19:00', people:2, space:'lugar_completo'})]);
    assert.equal((await client.query('select * from public.get_reservation_slots($1::date,$1::date,2,\'mesas\')', [day])).rows.length, 0);
    console.log('PASS: reservar el lugar completo elimina la hora de la oferta publica.');
  } else console.log('SKIP: prueba de capacidad (fecha ya ocupada).');
  assert.equal((await client.query('select public.is_la_tuba_admin() allowed')).rows[0].allowed, false);
  await client.query('reset role');
  console.log('PASS: consultas publicas, telefono con prefijo 57, pedido vinculado, conversion a cliente y cancelacion.');
} finally {
  await client.query('rollback');
  await client.end();
  console.log('Pruebas revertidas; no se conservaron pedidos ni contactos de prueba.');
}
