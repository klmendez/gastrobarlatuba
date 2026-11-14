import fs from 'node:fs';
import pg from 'pg';
const file = new URL('../supabase/.env.database.local', import.meta.url);
const line = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/).find(x => x.startsWith('SUPABASE_DB_URL=')) : null;
const connectionString = process.env.SUPABASE_DB_URL || line?.slice('SUPABASE_DB_URL='.length).trim();
if (!connectionString) throw new Error('Falta la conexión a Supabase.');
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
try {
  await client.connect(); await client.query('begin');
  await client.query(fs.readFileSync(new URL('../supabase/migrations/20261114_realtime_notifications.sql', import.meta.url), 'utf8'));
  const tables = (await client.query("select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('orders','reservations')")).rows.map(row => row.tablename);
  if (!tables.includes('orders') || !tables.includes('reservations')) throw new Error('No se pudo activar Realtime para las dos tablas.');
  await client.query('commit'); console.log('Realtime configurado para pedidos y reservas.');
} catch (error) { await client.query('rollback').catch(() => {}); throw error; }
finally { await client.end().catch(() => {}); }
