import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
const line = fs.readFileSync(new URL('../supabase/.env.database.local', import.meta.url), 'utf8').split(/\r?\n/).find(x => x.startsWith('SUPABASE_DB_URL='));
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL || line?.slice('SUPABASE_DB_URL='.length).trim(), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
const one = async (sql, params = []) => (await client.query(sql, params)).rows[0];
try {
  await client.connect(); await client.query('begin');
  const admin = await one('select id,email from auth.users where lower(email) in (select lower(email) from public.admin_emails) limit 1');
  assert.ok(admin);
  await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: admin.id, email: admin.email, role: 'authenticated' })]);
  await client.query('set local role authenticated');
  const marker = crypto.randomUUID();
  const food = await one("insert into public.catalog_items(name,category,item_type,price,available) values($1,'Prueba','carta',20000,true) returning id", [`Plato prueba ${marker}`]);
  const drink = await one("insert into public.catalog_items(name,category,item_type,price,available) values($1,'Prueba','bebida',7000,true) returning id", [`Bebida prueba ${marker}`]);
  const menu = await one("insert into public.daily_menus(scheduled_date,title,price,active,specials) values((now() at time zone 'America/Bogota')::date,'Menú prueba',15000,true,'[]') on conflict(scheduled_date) do update set title='Menú prueba',price=15000,active=true,specials='[]' returning id");
  const entry = product => ({ id: crypto.randomUUID(), product, qty: 1, version: null, size: null, toppingIds: [], extrasQty: {}, extraSelections: {} });
  const payload = { requestId: crypto.randomUUID(), numeroOrden: `LT-mixed-${marker}`, trackingToken: crypto.randomUUID(),
    items: [entry({id: food.id}), entry({id: drink.id}), entry({id: menu.id,dailyMenuId:menu.id,menuChoices:{}})],
    cliente: {nombres:'Prueba venta mixta',celular:`8${String(Date.now()).slice(-9)}`,direccion:''}, formaPago:'Efectivo', servicio:'local',estado:'no_pagado',tipoVenta:'mixto',canal:'admin' };
  const quote = (await one('select public.quote_order($1) quote', [payload])).quote;
  assert.equal(quote.subtotal,42000);
  const first = await one('select * from public.create_public_order($1)', [{...payload,...quote}]);
  const second = await one('select * from public.create_public_order($1)', [{...payload,...quote}]);
  assert.equal(first.id, second.id);
  const order = await one('select customer_id,items,total,paid_total,status,sale_type from public.orders where id=$1',[first.id]);
  assert.equal(order.items.length,3); assert.equal(order.sale_type,'mixto'); assert.equal(order.total,quote.total); assert.equal(order.paid_total,0); assert.equal(order.status,'no_pagado'); assert.ok(order.customer_id);
  await one("select public.record_order_payment($1,$2,'Efectivo',$3,'Prueba')", [first.id,order.total,crypto.randomUUID()]);
  assert.equal((await one('select paid_total from public.orders where id=$1',[first.id])).paid_total,order.total);
  const zone = await one('select id,name,price from public.delivery_zones where active and price is not null order by id limit 1');
  assert.ok(zone, 'No hay barrios con tarifa para probar domicilio');
  for (const service of ['local','llevar','domicilio']) {
    const customer = { nombres:'Prueba servicio', celular:`8${String(Date.now()).slice(-9)}`, direccion:service === 'domicilio' ? 'Dirección de prueba' : '', ...(service === 'local' ? { mesa: 4 } : {}), ...(service === 'domicilio' ? { barrio: zone.name, referencia:'Referencia de prueba' } : {}) };
    const next = { ...payload, requestId:crypto.randomUUID(), numeroOrden:`LT-service-${crypto.randomUUID()}`, cliente:customer, servicio:service };
    const price = (await one('select public.quote_order($1) quote',[next])).quote;
    assert.equal(price.delivery, service === 'domicilio' ? zone.price : 0);
    const created = await one('select * from public.create_public_order($1)',[{...next,...price}]);
    const saved = await one('select service,customer,delivery,total,customer_id from public.orders where id=$1',[created.id]);
    assert.equal(saved.service,service); assert.equal(saved.delivery,price.delivery); assert.equal(saved.total,price.total); assert.ok(saved.customer_id);
    if (service === 'local') assert.equal(saved.customer.mesa,4);
    if (service === 'domicilio') { assert.equal(saved.customer.barrio,zone.name); assert.equal(saved.customer.direccion,'Dirección de prueba'); assert.equal(saved.customer.referencia,'Referencia de prueba'); }
  }
  console.log('PASS: venta mixta y servicios mesa, para llevar y domicilio; cliente, tarifas, cotización y cobro posterior.');
} finally { await client.query('rollback').catch(()=>{}); await client.end().catch(()=>{}); console.log('Datos de prueba revertidos.'); }
