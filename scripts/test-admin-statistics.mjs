import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
const line = fs.readFileSync(new URL('../supabase/.env.database.local', import.meta.url), 'utf8').split(/\r?\n/).find(x => x.startsWith('SUPABASE_DB_URL='));
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL || line?.slice('SUPABASE_DB_URL='.length).trim(), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
const one = async (query, args=[]) => (await client.query(query,args)).rows[0];
try {
  await client.connect(); await client.query('begin');
  const admin = await one('select id,email from auth.users where lower(email) in (select lower(email) from public.admin_emails) limit 1');
  assert.ok(admin);
  const marker = crypto.randomUUID();
  const items = [{ id: marker, product: { id: marker, name: `Prueba estadísticas ${marker}` }, qty: 2 }];
  const order = await one("insert into public.orders(order_number,customer,items,subtotal,total,service,payment_method,status,business,created_at) values($1,'{}',$2,20000,20000,'local','Efectivo','no_pagado','la_tuba','2040-01-02 05:00:00+00') returning id", [`LT-test-${marker}`, JSON.stringify(items)]);
  await client.query("insert into public.order_payments(order_id,amount,method,request_id,created_at) values($1,10000,'Efectivo',$2,'2040-01-03 05:00:00+00'),($1,-2000,'Efectivo',$3,'2040-01-03 06:00:00+00')", [order.id,crypto.randomUUID(),crypto.randomUUID()]);
  await client.query('update public.orders set paid_total=8000 where id=$1',[order.id]);
  await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({ sub: admin.id,email: admin.email,role:'authenticated' })]);
  await client.query('set local role authenticated');
  const first = (await one("select public.la_tuba_statistics('2040-01-02','2040-01-03') data")).data;
  assert.equal(first.orders,1); assert.equal(first.order_total,20000); assert.equal(first.outstanding,12000); assert.equal(first.collected,0); assert.equal(first.products[0].quantity,2);
  const next = (await one("select public.la_tuba_statistics('2040-01-03','2040-01-04') data")).data;
  assert.equal(next.orders,0); assert.equal(next.collected,10000); assert.equal(next.refunded,2000); assert.equal(next.cash,8000);
  await client.query('reset role'); await client.query('set local role anon'); await client.query('savepoint anon_test');
  await assert.rejects(client.query("select public.la_tuba_statistics('2040-01-02','2040-01-03')"));
  await client.query('rollback to savepoint anon_test');
  console.log('PASS: pedidos por fecha Colombia, cobros/devoluciones por fecha del movimiento, saldo, productos y acceso restringido.');
} finally { await client.query('rollback').catch(()=>{}); await client.end().catch(()=>{}); console.log('Datos de estadísticas revertidos.'); }
