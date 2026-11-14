import fs from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { collection, getDocs, getFirestore, terminate } from 'firebase/firestore';
import pg from 'pg';

const vars = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#') && line.includes('=')).map(line => { const pos = line.indexOf('='); return [line.slice(0, pos), line.slice(pos + 1).trim()]; }));
const app = initializeApp({ apiKey: vars.VITE_FIREBASE_API_KEY, authDomain: vars.VITE_FIREBASE_AUTH_DOMAIN, projectId: vars.VITE_FIREBASE_PROJECT_ID, appId: vars.VITE_FIREBASE_APP_ID });
const db = getFirestore(app);
const line = fs.readFileSync('supabase/.env.database.local', 'utf8').split(/\r?\n/).find(value => value.startsWith('SUPABASE_DB_URL='));
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL || line?.slice('SUPABASE_DB_URL='.length).trim(), ssl: { rejectUnauthorized: false } });
try {
  await signInAnonymously(getAuth(app));
  const snapshot = await getDocs(collection(db, 'clientes'));
  await client.connect();
  await client.query('begin');
  let inserted = 0, skipped = 0;
  for (const doc of snapshot.docs) {
    const item = doc.data();
    const phone = String(item.celular || doc.id).replace(/\D/g, '');
    if (phone.length < 7) { skipped++; continue; }
    const addresses = (Array.isArray(item.direcciones) ? item.direcciones : []).filter(a => a?.direccion).map(a => ({ direccion: a.direccion, barrio: a.barrio || null, referencia: a.referencia || null, lastUsed: a.lastUsed?.toDate?.()?.toISOString() || null }));
    const result = await client.query(`insert into public.contacts(phone,name,email,birthday,addresses) values ($1,$2,$3,$4,$5::jsonb) on conflict (phone) do nothing`, [phone, String(item.nombres || 'Contacto').trim(), item.correo || null, item.fechaNacimiento || null, JSON.stringify(addresses)]);
    if (result.rowCount) inserted++; else skipped++;
  }
  await client.query('commit');
  console.log(`Contactos importados: ${inserted}; omitidos por duplicación o teléfono inválido: ${skipped}. Compras anteriores importadas: 0.`);
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error(`No se pudo completar la importación: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
  await terminate(db).catch(() => {});
  await deleteApp(app).catch(() => {});
}
