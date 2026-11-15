import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { submissionIdentity, completeSubmission } from '../lib/submission';

type EventRow = { id: string; title: string; description: string; starts_at: string; image_url: string | null };
type ReviewRow = { id: string; name: string; rating: number; comment: string; created_at: string };

export default function EventsExperience() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [form, setForm] = useState({ name: '', rating: 5, comment: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.location.hash !== '#dejar-resena') return;
    const timer = window.setTimeout(() => document.getElementById('dejar-resena')?.scrollIntoView({ block: 'start' }), 150);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase?.from('events').select('id,title,description,starts_at,image_url').eq('published', true).gte('starts_at', new Date().toISOString()).order('starts_at').limit(12),
      supabase?.from('reviews').select('id,name,rating,comment,created_at').eq('approved', true).order('created_at', { ascending: false }).limit(12),
    ]).then(([eventResult, reviewResult]) => {
      if (!active) return;
      if (eventResult?.data) setEvents(eventResult.data as EventRow[]);
      if (reviewResult?.data) setReviews(reviewResult.data as ReviewRow[]);
    });
    return () => { active = false; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true); setMessage('');
    const payload = { name: form.name.trim(), rating: form.rating, comment: form.comment.trim() };
    const identity = submissionIdentity('review', payload);
    const { error } = await supabase.rpc('submit_review', { p_name: payload.name, p_rating: payload.rating, p_comment: payload.comment, p_request_id: identity.requestId });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    completeSubmission('review'); setForm({ name: '', rating: 5, comment: '' });
    setMessage('Gracias. Tu reseña quedó pendiente de aprobación.');
  };

  return <div className="min-h-dvh overflow-x-hidden bg-crema px-5 pb-20 pt-24 text-stone-900">
    <main className="mx-auto max-w-6xl">
      <header className="min-w-0 border-b border-rojo/20 pb-8"><p className="text-xs font-semibold uppercase tracking-[.25em] text-rojo">Agenda y comunidad</p><h1 className="mt-2 break-words font-serif text-3xl leading-tight text-rojo-dark sm:text-4xl">Eventos y experiencia</h1><p className="mt-4 max-w-2xl leading-7 text-stone-600">Conoce los próximos encuentros de La Tuba y comparte cómo fue tu visita.</p></header>
      <section className="py-10"><h2 className="font-serif text-2xl sm:text-3xl text-rojo-dark">Próximos eventos</h2>{events.length ? <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{events.map(item => <article key={item.id} className="border-b border-rojo/15">{item.image_url && <img src={item.image_url} alt="" className="h-48 w-full object-cover" />}<div className="p-5"><p className="flex items-center gap-2 text-xs font-semibold uppercase text-rojo"><CalendarDays size={15} />{new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(item.starts_at))}</p><h3 className="mt-3 font-serif text-2xl">{item.title}</h3><p className="mt-2 text-sm leading-6 text-stone-600">{item.description}</p></div></article>)}</div> : <p className="mt-5 border-y border-rojo/15 py-8 text-stone-600">No hay eventos publicados por ahora.</p>}</section>
      <section className="grid gap-10 border-t border-rojo/20 py-10 lg:grid-cols-[1fr_24rem]"><div><h2 className="font-serif text-2xl sm:text-3xl text-rojo-dark">Lo que cuentan</h2>{reviews.length ? <div className="mt-6 space-y-4">{reviews.map(review => <blockquote key={review.id} className="border-b border-rojo/15 py-5"><div className="flex text-amber-600" aria-label={`${review.rating} de 5 estrellas`}>{Array.from({ length: review.rating }, (_, index) => <Star key={index} size={15} fill="currentColor" />)}</div><p className="mt-3 leading-7">“{review.comment}”</p><footer className="mt-2 text-sm font-semibold">{review.name}</footer></blockquote>)}</div> : <p className="mt-5 text-stone-600">Aún no hay reseñas publicadas.</p>}</div>
        <form id="dejar-resena" onSubmit={submit} className="min-w-0 h-fit scroll-mt-24 border-t border-rojo/25 py-5"><h2 className="font-serif text-2xl">Deja tu reseña</h2><label className="mt-5 block min-w-0 text-xs font-semibold uppercase">Nombre<input required minLength={2} maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-2 block min-w-0 max-w-full w-full border border-rojo/25 bg-white px-3 py-2.5 text-sm normal-case" /></label><label className="mt-4 block min-w-0 text-xs font-semibold uppercase">Calificación<select value={form.rating} onChange={e => setForm({ ...form, rating: Number(e.target.value) })} className="mt-2 block min-w-0 max-w-full w-full border border-rojo/25 bg-white px-3 py-2.5 text-sm normal-case">{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} estrellas</option>)}</select></label><label className="mt-4 block min-w-0 text-xs font-semibold uppercase">Comentario<textarea required minLength={5} maxLength={2000} rows={5} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} className="mt-2 block min-w-0 max-w-full w-full border border-rojo/25 bg-white px-3 py-2.5 text-sm normal-case" /></label><button disabled={busy} className="mt-5 w-full bg-rojo px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Enviando…' : 'Enviar para aprobación'}</button>{message && <p role="status" className="mt-3 text-sm text-rojo">{message}</p>}</form>
      </section>
    </main>
  </div>;
}
