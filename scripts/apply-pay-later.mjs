import fs from 'node:fs';
import pg from 'pg';

const local = new URL('../supabase/.env.database.local', import.meta.url);
const line = fs.existsSync(local) ? fs.readFileSync(local, 'utf8').split(/\r?\n/).find(value => value.startsWith('SUPABASE_DB_URL=')) : null;
const connectionString = process.env.SUPABASE_DB_URL || line?.slice('SUPABASE_DB_URL='.length).trim();
if (!connectionString || connectionString.includes('[YOUR-PASSWORD]')) throw new Error('Falta una conexión PostgreSQL válida');

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query('begin');
  await client.query(fs.readFileSync(new URL('../supabase/migrations/20261111_pay_later.sql', import.meta.url), 'utf8'));
  await client.query(fs.readFileSync(new URL('../supabase/migrations/20261111_order_total_guard.sql', import.meta.url), 'utf8'));
  await client.query('commit');
  console.log('Migraciones de ventas aplicadas en Supabase.');
} catch (error) {
  await client.query('rollback').catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}
