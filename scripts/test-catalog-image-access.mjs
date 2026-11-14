import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
const line = fs.readFileSync(new URL('../supabase/.env.database.local', import.meta.url), 'utf8').split(/\r?\n/).find(value => value.startsWith('SUPABASE_DB_URL='));
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL || line?.slice('SUPABASE_DB_URL='.length).trim(), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
try {
  await client.connect(); await client.query('begin');
  const bucket = (await client.query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='la-tuba-catalog-images'")).rows[0];
  assert.equal(bucket.public, true); assert.equal(Number(bucket.file_size_limit), 5242880);
  assert.deepEqual(bucket.allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
  const admin = (await client.query('select id,email from auth.users where lower(email) in (select lower(email) from public.admin_emails) limit 1')).rows[0];
  assert.ok(admin);
  const name = `catalogo/prueba-${crypto.randomUUID()}.webp`;
  await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: admin.id, email: admin.email, role: 'authenticated' })]);
  await client.query('set local role authenticated');
  await client.query("insert into storage.objects(bucket_id,name) values('la-tuba-catalog-images',$1)", [name]);
  await client.query('reset role');
  await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: 'anon' })]);
  await client.query('set local role anon'); await client.query('savepoint anon_test');
  await assert.rejects(client.query("insert into storage.objects(bucket_id,name) values('la-tuba-catalog-images',$1)", [`anon-${crypto.randomUUID()}.webp`]));
  await client.query('rollback to savepoint anon_test');
  console.log('PASS: contenedor público limitado a imágenes; administrador puede subir y anónimo no puede insertar.');
} finally { await client.query('rollback').catch(() => {}); await client.end().catch(() => {}); }
