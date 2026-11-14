import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function SupabaseAdminAccess({ onConnected }: { onConnected: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError('');
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) { setError('No se pudo iniciar sesión en Supabase. Revisa el correo y la contraseña del usuario administrador.'); return; }
    setPassword(''); onConnected();
  }

  return <form onSubmit={signIn} className="mb-5 border border-[#6b2c0e]/20 bg-[#fff8e8] p-4">
    <p className="font-semibold text-[#542006]">Conectar la cuenta de administración de Supabase</p>
    <p className="mt-1 text-sm text-[#6c5548]">Usa un usuario creado en Authentication de este proyecto para acceder a los datos privados.</p>
    <div className="mt-3 flex flex-wrap gap-2"><input type="email" required placeholder="Correo" value={email} onChange={event => setEmail(event.target.value)} className="min-w-0 flex-1 border px-3 py-2 text-sm" /><input type="password" required placeholder="Contraseña" value={password} onChange={event => setPassword(event.target.value)} className="min-w-0 flex-1 border px-3 py-2 text-sm" /><button disabled={busy} className="bg-[#793713] px-4 py-2 text-sm font-semibold text-[#fff4dc] disabled:opacity-50">{busy ? 'Conectando…' : 'Conectar'}</button></div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </form>;
}
