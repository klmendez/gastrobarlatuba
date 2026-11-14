import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';

const line = fs.readFileSync(new URL('../supabase/.env.database.local', import.meta.url), 'utf8').split(/\r?\n/).find(value => value.startsWith('SUPABASE_DB_URL='));
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL || line?.slice('SUPABASE_DB_URL='.length).trim(), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
const one = async (sql, args = []) => (await client.query(sql, args)).rows[0];
const newLine = product => ({ id: crypto.randomUUID(), product, qty: 1, version: null, size: null, toppingIds: [], extrasQty: {}, extraSelections: {}, note: '' });

try {
  await client.connect(); await client.query('begin');
  const admin = await one("select id,email from auth.users where lower(email) in (select lower(email) from public.admin_emails) limit 1");
  assert.ok(admin, 'No existe un administrador real');
  await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: admin.id, email: admin.email, role: 'authenticated' })]);
  await client.query('set local role authenticated');

  const marker = crypto.randomUUID();
  const phone = `3${String(Date.now()).slice(-9)}`;
  const starter = await one("insert into public.catalog_items(name,category,item_type,price) values($1,'Prueba edición','carta',12500) returning id", [`Plato ${marker}`]);
  const second = await one("insert into public.catalog_items(name,category,item_type,price) values($1,'Prueba edición','bebida',7000) returning id", [`Bebida ${marker}`]);
  const base = { requestId: crypto.randomUUID(), numeroOrden: `LT-edit-${marker}`, trackingToken: crypto.randomUUID(),
    items: [newLine({ id: starter.id })], cliente: { nombres: 'Cliente edición prueba', celular: phone, direccion: '' },
    formaPago: 'Efectivo', servicio: 'local', estado: 'no_pagado', comentarios: '', promociones: [], descuentoTotal: 0,
    tipoVenta: 'carta', canal: 'admin', subtotal: 12500, delivery: 0, total: 12500 };
  const created = await one('select * from public.create_public_order($1)', [base]);
  const before = await one('select items from public.orders where id=$1', [created.id]);
  let menu = await one("select id,title,price from public.daily_menus where active and scheduled_date=(now() at time zone 'America/Bogota')::date limit 1");
  if (!menu) menu = await one("insert into public.daily_menus(scheduled_date,title,price,active) values((now() at time zone 'America/Bogota')::date,$1,16000,true) returning id,title,price", [`Menú ${marker}`]);
  assert.ok(menu.price > 0);
  const manualAmount = 3000;
  const items = [...before.items,
    newLine({ id: second.id, name: `Bebida ${marker}`, description: '', category: 'frutafresh', categoryId: 'bebida-Prueba edición', prices: { fijo: 7000 }, toppingsIncludedMax: 0 }),
    newLine({ id: menu.id, dailyMenuId: menu.id, menuChoices: {}, name: menu.title, description: 'Menú del día', category: 'frutafresh', categoryId: 'menu-del-dia', prices: { fijo: menu.price }, toppingsIncludedMax: 0 }),
    newLine({ id: crypto.randomUUID(), name: 'Porción adicional de arroz', description: 'Cargo adicional fuera de carta', category: 'frutafresh', categoryId: 'ajuste-manual', prices: { fijo: manualAmount }, toppingsIncludedMax: 0 }),
  ];
  const editedTotal = 12500 + 7000 + menu.price + manualAmount;
  await client.query('update public.orders set items=$2,subtotal=$3,total=$3 where id=$1', [created.id, JSON.stringify(items), editedTotal]);
  const edited = await one('select items,subtotal,total,paid_total,status,customer_id from public.orders where id=$1', [created.id]);
  assert.equal(edited.items.length, 4);
  assert.equal(edited.total, editedTotal);
  assert.equal(edited.paid_total, 0);
  assert.equal(edited.status, 'no_pagado');
  assert.equal((await one('select order_count from public.contacts where id=$1', [edited.customer_id])).order_count, 1);

  await one("select public.record_order_payment($1,$2,'Efectivo',$3,'Prueba')", [created.id, editedTotal, crypto.randomUUID()]);
  assert.equal((await one('select status from public.orders where id=$1', [created.id])).status, 'pagado');
  await client.query('savepoint invalid_edit');
  await assert.rejects(client.query('update public.orders set total=$2 where id=$1', [created.id, editedTotal - 1]), /orders_paid_total_within_total/);
  await client.query('rollback to savepoint invalid_edit');
  await client.query('update public.orders set total=$2,subtotal=$2,status=$3 where id=$1', [created.id, editedTotal + 2000, 'no_pagado']);
  assert.deepEqual(await one('select total,paid_total,status from public.orders where id=$1', [created.id]), { total: editedTotal + 2000, paid_total: editedTotal, status: 'no_pagado' });
  console.log('PASS: editar pedido admite producto, menú y cargo manual; mantiene cliente, cobro y saldo sin permitir total inferior a lo pagado.');
} finally {
  await client.query('rollback').catch(() => {}); await client.end().catch(() => {});
  console.log('Datos de edición de prueba revertidos.');
}
