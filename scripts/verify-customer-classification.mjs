import fs from 'node:fs';
import pg from 'pg';

const line = fs.readFileSync(new URL('../supabase/.env.database.local', import.meta.url), 'utf8').split(/\r?\n/).find(value => value.startsWith('SUPABASE_DB_URL='));
const connectionString = process.env.SUPABASE_DB_URL || line?.slice('SUPABASE_DB_URL='.length).trim();
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query('begin');
  const { rows: [contact] } = await client.query("insert into public.contacts(phone, name) values ($1, $2) returning id", [`test-${crypto.randomUUID()}`, 'Prueba temporal']);
  const counts = async () => (await client.query('select (select count(*) from public.customers where id = $1)::int as customers, (select count(*) from public.prospects where id = $1)::int as prospects', [contact.id])).rows[0];
  let result = await counts();
  if (result.customers !== 0 || result.prospects !== 1) throw new Error('Un contacto nuevo debe ser prospecto');
  const { rows: [order] } = await client.query("insert into public.orders(order_number, customer_id, customer, items, subtotal, total, service, payment_method, status) values ($1, $2, '{}', '[]', 1000, 1000, 'local', 'Efectivo', 'pagado') returning id", [`test-${crypto.randomUUID()}`, contact.id]);
  result = await counts();
  if (result.customers !== 1 || result.prospects !== 0) throw new Error('Un pedido válido debe convertir el contacto en cliente');
  await client.query("update public.orders set status = 'cancelado' where id = $1", [order.id]);
  result = await counts();
  if (result.customers !== 0 || result.prospects !== 1) throw new Error('Un pedido cancelado no debe contar');
  const phone = String(Date.now());
  await client.query("insert into public.contacts(phone, name) values ($1, 'Contacto importado')", [phone]);
  await client.query('select * from public.create_public_order($1::jsonb)', [JSON.stringify({ numeroOrden: `LT-test-${crypto.randomUUID()}`, cliente: { celular: phone, nombres: 'Prueba', direccion: '' }, items: [], subtotal: 1000, total: 1000, servicio: 'local', formaPago: 'Efectivo' })]);
  const linked = await client.query('select order_count from public.contacts where phone = $1', [phone]);
  if (linked.rows[0].order_count !== 1) throw new Error('El pedido no se vinculó al contacto existente');
  console.log('Clasificación verificada: prospecto, cliente y cancelación. Datos de prueba revertidos.');
} finally {
  await client.query('rollback');
  await client.end();
}
