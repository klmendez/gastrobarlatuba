import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { collection, getDocs, getFirestore, terminate } from 'firebase/firestore';

const vars = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/)
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).trim()]; })
);
const app = initializeApp({
  apiKey: vars.VITE_FIREBASE_API_KEY,
  authDomain: vars.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: vars.VITE_FIREBASE_PROJECT_ID,
  appId: vars.VITE_FIREBASE_APP_ID,
});
await signInAnonymously(getAuth(app));
const db = getFirestore(app);
const esc = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const date = value => value?.toDate?.()?.toLocaleDateString('es-CO') ?? '';
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
mkdirSync('exports', { recursive: true });

const orders = await getDocs(collection(db, 'pedidos'));
const orderRows = [['Orden', 'Cliente', 'Telefono', 'Direccion', 'Estado', 'Total', 'Fecha', 'Pago']];
for (const snap of orders.docs) {
  const o = snap.data();
  orderRows.push([o.numeroOrden, o.cliente?.nombres, o.cliente?.celular,
    o.cliente?.direccion || 'Para llevar', o.estado, o.total,
    date(o.createdAt), o.formaPago]);
}
const ordersPath = `exports/pedidos-pecado-picoso-${today}.csv`;
writeFileSync(ordersPath, '\uFEFF' + orderRows.map(row => row.map(esc).join(',')).join('\r\n'), 'utf8');
console.log(`Pedidos: ${orders.size} -> ${ordersPath}`);

const clients = await getDocs(collection(db, 'clientes'));
const clientRows = [['Nombre', 'Teléfono', 'Correo', 'Cumpleaños', 'Pedidos', 'Total Gastado', 'Última Compra', 'Etiquetas', 'Nota']];
for (const snap of clients.docs) {
  const c = snap.data();
  clientRows.push([c.nombres, c.celular, c.correo, c.fechaNacimiento,
    c.totalPedidos, c.totalGastado, date(c.ultimoPedido),
    (c.etiquetas || []).join('; '), c.notaAdmin]);
}
const clientsPath = `exports/clientes-${today}.csv`;
writeFileSync(clientsPath, '\uFEFF' + clientRows.map(row => row.map(esc).join(',')).join('\r\n'), 'utf8');
console.log(`Clientes: ${clients.size} -> ${clientsPath}`);
await terminate(db);
await deleteApp(app);
