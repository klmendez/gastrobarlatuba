import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AdminAuthProps {
  children: React.ReactNode;
}

export default function AdminAuth({ children }: AdminAuthProps) {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setError('Supabase no está configurado.');
      setLoading(false);
      return;
    }

    let active = true;
    let requestId = 0;
    const validate = async (current: User | null) => {
      const id = ++requestId;
      if (!current) { if (active) { setUser(null); setLoading(false); } return; }
      if (active) setLoading(true);
      const { data: allowed, error: checkError } = await supabase!.rpc('is_la_tuba_admin');
      if (!active || id !== requestId) return;
      if (checkError || !allowed) { setUser(null); setError('Esta cuenta no está habilitada para administrar La Tuba.'); }
      else { setUser(current); setError(''); }
      setLoading(false);
    };
    void supabase.auth.getSession().then(({ data }) => validate(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { window.setTimeout(() => { if (active) void validate(session?.user ?? null); }, 0); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!supabase) {
      setError('Supabase no está disponible.');
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const { data: allowed, error: checkError } = await supabase.rpc('is_la_tuba_admin');
      if (checkError || !allowed) {
        await supabase.auth.signOut();
        setError('Esta cuenta no está habilitada para administrar La Tuba.');
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
      const detail = err instanceof Error ? err.message : 'Desconocido';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setError('Correo o contraseña incorrectos');
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Inténtalo más tarde.');
      } else {
        setError('Error al iniciar sesión: ' + detail);
      }
      setPassword('');
    }
  };

  const sendAccessLink = async () => {
    if (!supabase || sendingLink) return;
    if (!email.trim()) { setError('Escribe tu correo de administrador.'); return; }
    setSendingLink(true); setError(''); setNotice('');
    const { error: linkError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/admin` } });
    if (linkError) setError('No se pudo enviar el enlace. Comprueba el correo o consulta al administrador de Supabase.');
    else setNotice('Si el correo tiene una cuenta en Supabase, revisa tu bandeja de entrada para iniciar sesión.');
    setSendingLink(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7eddc] flex items-center justify-center">
        <div className="text-[#542006]">Preparando el acceso a La Tuba…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7eddc] px-4 py-10 text-[#321506]">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full border-[22px] border-[#6b2c0e]/10" />
        <div className="pointer-events-none absolute -bottom-36 -right-20 h-96 w-96 rounded-full border-[28px] border-[#6b2c0e]/10" />
        <div className="relative w-full max-w-md overflow-hidden border border-[#6b2c0e]/20 bg-[#fffaf0] shadow-[0_24px_80px_rgba(84,32,6,.16)]">
          <div className="bg-[#542006] px-8 pb-8 pt-9 text-center text-[#fff4dc]">
            <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#e4c89c] bg-[#fff4dc] p-3 shadow-lg">
              <img src="/la-tuba-logo.png" alt="La Tuba Gastrobar" className="max-h-full w-auto object-contain" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[.35em] text-[#e4c89c]">La Tuba Gastrobar</p>
            <h1 className="mt-2 font-serif text-3xl">Panel de administración</h1>
            <p className="mt-2 text-sm text-[#f3dfbd]">Tu cocina, tus pedidos y tu carta en un solo lugar.</p>
          </div>
          <div className="p-7 sm:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-[#6b2c0e]/15 pb-4 text-sm text-[#806958]"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#6b2c0e] text-white"><Lock size={17} /></span><span>Acceso privado para el equipo de La Tuba</span></div>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#6c5548] mb-2">
                  Correo del administrador
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-[#6b2c0e]/25 bg-white px-4 py-3 text-[#321506] placeholder-[#a88e76] focus:border-[#793713] focus:outline-none focus:ring-2 focus:ring-[#793713]/15"
                    placeholder="Correo de administrador"
                    required
                  />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                </div>
              </div>

              <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#6c5548] mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-[#6b2c0e]/25 bg-white px-4 py-3 text-[#321506] placeholder-[#a88e76] focus:border-[#793713] focus:outline-none focus:ring-2 focus:ring-[#793713]/15"
                    placeholder="Ingresa la contraseña"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#806958] hover:text-[#542006]"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              {notice && <p role="status" className="text-sm text-[#542006]">{notice}</p>}

              <button
                type="submit"
                className="w-full bg-[#6b2c0e] py-3 font-semibold text-white transition-colors hover:bg-[#542006]"
              >
                Acceder al Panel
              </button>
              <button type="button" disabled={sendingLink} onClick={() => void sendAccessLink()} className="w-full border border-[#6b2c0e]/30 py-3 text-sm font-semibold text-[#542006] disabled:opacity-50">{sendingLink ? 'Enviando enlace...' : 'Enviar enlace de acceso al correo'}</button>
            </form>

            <div className="mt-6 border-t border-[#6b2c0e]/15 pt-5 text-center">
              <p className="text-xs text-[#9a806b]">
                Solo personal autorizado puede acceder a este panel
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {children}
    </div>
  );
}
