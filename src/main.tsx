import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')!;
let firstVisit = true;
try { firstVisit = sessionStorage.getItem('la-tuba-welcomed') !== '1'; } catch { /* Storage can be unavailable in private browsers. */ }
const started = Number(root.dataset.started || performance.now());
const remaining = firstVisit ? Math.max(0, 3000 - (performance.now() - started)) : 0;
window.setTimeout(() => {
  try { sessionStorage.setItem('la-tuba-welcomed', '1'); } catch { /* Rendering must not depend on storage. */ }
  createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
}, remaining);
