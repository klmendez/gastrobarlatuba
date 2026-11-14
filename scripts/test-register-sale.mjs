import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';

const line = fs.readFileSync(new URL('../supabase/.env.database.local', import.meta.url), 'utf8').split(/\r?\n/).find(value => value.startsWith('SUPABASE_DB_URL='));
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL || line?.slice('SUPABASE_DB_URL='.length).trim(), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
const one = async (sql, args = []) => (await client.query(sql, args)).rows[0];

try {
  await client.connect(); await client.query('begin');
  const admin = await one("select id,email from auth.users where lower(email) in (select lower(email) from public.admin_emails) limit 1");
  assert.ok(admin, 'No existe un administrador real');
  await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: admin.id, email: admin.email, role: 'authenticated' })]);
  await client.query('set local role authenticated');

  const marker = crypto.randomUUID();
  const phone = `3${String(Date.now()).slice(-9)}`;
  const product = await one("insert into public.catalog_items(name,category,item_type,price,available) values($1,'Prueba venta','carta',12500,true) returning id", [`Prueba ${marker}`]);
  const base = {
    trackingToken: crypto.randomUUID(), items: [{ id: crypto.randomUUID(), product: { id: product.id }, qty: 2, version: null, size: null, toppingIds: [], extrasQty: {}, extraSelections: {} }],
    cliente: { nombres: 'Cliente venta prueba', celular: phone, direccion: '' }, formaPago: 'Efectivo', servicio: 'local', estado: 'pagado', comentarios: 'Venta registrada desde administración', promociones: [], descuentoTotal: 0, tipoVenta: 'carta', canal: 'admin', subtotal: 25000, delivery: 0, total: 25000,
  };
  const first = await one('select * from public.create_public_order($1)', [{ ...base, requestId: crypto.randomUUID(), numeroOrden: `LT-sale-${crypto.randomUUID()}` }]);
  const second = await one('select * from public.create_public_order($1)', [{ ...base, requestId: crypto.randomUUID(), numeroOrden: `LT-sale-${crypto.randomUUID()}`, formaPago: 'Transferencia' }]);
  const pending = await one('select * from public.create_public_order($1)', [{ ...base, requestId: crypto.randomUUID(), numeroOrden: `LT-sale-${crypto.randomUUID()}`, estado: 'no_pagado' }]);
  const prospectPhone = `3${String(Date.now() + 1).slice(-9)}`;
  const prospect = await one('insert into public.contacts(phone,name) values($1,$2) returning id', [prospectPhone, `Prospecto ${marker}`]);
  assert.equal((await one('select order_count from public.contacts where id=$1 and name ilike $2', [prospect.id, `%${marker}%`])).order_count, 0);
  assert.equal((await one('select id from public.contacts where phone ilike $1', [`%${prospectPhone.slice(-6)}%`])).id, prospect.id);

  const contact = await one('select * from public.contacts where phone=$1', [phone]);
  assert.ok(contact);
  assert.equal((await one('select count(*)::int count from public.contacts where phone=$1', [phone])).count, 1);
  assert.equal(contact.order_count, 3);
  assert.equal(contact.total_spent, 75000);
  assert.equal((await one('select id from public.contacts where name ilike $1 and phone=$2 and order_count>0', ['%Cliente venta prueba%', phone])).id, contact.id);
  const orders = (await client.query('select id,customer_id,status,paid_total,total,sale_type,channel,payment_method from public.orders where id=any($1::uuid[]) order by created_at', [[first.id, second.id]])).rows;
  assert.equal(orders.length, 2);
  for (const order of orders) {
    assert.equal(order.customer_id, contact.id); assert.equal(order.status, 'pagado'); assert.equal(order.paid_total, order.total);
    assert.equal(order.sale_type, 'carta'); assert.equal(order.channel, 'admin');
  }
  assert.equal((await one('select count(*)::int count from public.order_payments where order_id=any($1::uuid[])', [[first.id, second.id]])).count, 2);
  assert.deepEqual(Object.fromEntries(orders.map(order => [order.id, order.payment_method])), { [first.id]: 'Efectivo', [second.id]: 'Transferencia' });
  const getPending = () => one('select customer_id,status,paid_total,total,payment_method from public.orders where id=$1', [pending.id]);
  assert.deepEqual(await getPending(), { customer_id: contact.id, status: 'no_pagado', paid_total: 0, total: 25000, payment_method: 'Efectivo' });
  assert.equal((await one('select count(*)::int count from public.order_payments where order_id=$1', [pending.id])).count, 0);
  const partialKey = crypto.randomUUID();
  const partial = await one("select public.record_order_payment($1,10000,'Transferencia',$2,'Abono en caja') id", [pending.id, partialKey]);
  const retry = await one("select public.record_order_payment($1,10000,'Transferencia',$2,'Abono en caja') id", [pending.id, partialKey]);
  assert.equal(retry.id, partial.id);
  assert.deepEqual(await getPending(), { customer_id: contact.id, status: 'no_pagado', paid_total: 10000, total: 25000, payment_method: 'Transferencia' });
  await one("select public.record_order_payment($1,15000,'Efectivo',$2,'Saldo en caja')", [pending.id, crypto.randomUUID()]);
  assert.deepEqual(await getPending(), { customer_id: contact.id, status: 'pagado', paid_total: 25000, total: 25000, payment_method: 'Efectivo' });
  await one("select public.record_order_payment($1,-5000,'Efectivo',$2,'Devolución en caja')", [pending.id, crypto.randomUUID()]);
  assert.equal((await getPending()).status, 'no_pagado');
  assert.equal((await getPending()).paid_total, 20000);
  assert.equal((await one('select count(*)::int count from public.order_payments where order_id=$1', [pending.id])).count, 3);
  console.log('PASS: búsqueda admin de cliente y prospecto; dos ventas cobradas y un pedido pendiente comparten cliente; abono, pago, devolución e idempotencia actualizan saldo y estado.');
} finally {
  await client.query('rollback').catch(() => {}); await client.end().catch(() => {});
  console.log('Datos de ventas de prueba revertidos.');
}
