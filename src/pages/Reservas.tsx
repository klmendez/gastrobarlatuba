import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { todayInBogota } from "../services/dailyMenuService";
import { cop } from "../lib/format";
import { useContactLookup } from "../hooks/useContactLookup";
import { completeSubmission, submissionIdentity } from '../lib/submission';

type Slot = { available_date: string; slot: string; remaining_tables: number };
const labels = ["Personas", "Fecha", "Hora", "Decoración", "Celular", "Tus datos"];
const monthDate = (month: string) => new Date(`${month}-01T12:00:00Z`);
const asMonth = (date: Date) => date.toISOString().slice(0, 7);

export default function Reservas() {
  const today = todayInBogota();
  const [step, setStep] = useState(1);
  const [people, setPeople] = useState(2);
  const [space, setSpace] = useState<"mesas" | "lugar_completo">("mesas");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<{ seats_per_table: number; decoration_price: number | null } | null>(null);
  const [wantsDecoration, setWantsDecoration] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [knownName, setKnownName] = useState(false);
  const [knownBirthday, setKnownBirthday] = useState(false);
  const [editKnown, setEditKnown] = useState(false);
  const [occasion, setOccasion] = useState("");
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const lookupLoading = useContactLookup(phone, contact => {
    if (contact.name && contact.name !== "Cliente") { if (!name.trim()) setName(contact.name); setKnownName(true); }
    if (contact.birthday) { if (!birthday) setBirthday(`2000-${contact.birthday}`); setKnownBirthday(true); }
  });
  const currentMonth = monthDate(month);
  const monthTitle = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(currentMonth);
  const dayCount = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const leading = (currentMonth.getUTCDay() + 6) % 7;
  const dates = useMemo(() => Array.from({ length: dayCount }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`), [month, dayCount]);
  const slotsByDate = useMemo(() => slots.reduce<Record<string, Slot[]>>((map, item) => { (map[item.available_date] ||= []).push(item); return map; }, {}), [slots]);
  const canDecorate = !!config?.decoration_price && !!date && !!time && new Date(`${date}T${time}:00-05:00`).getTime() - Date.now() >= 8 * 60 * 60 * 1000;
  const maxDate = useMemo(() => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 90); return d.toISOString().slice(0, 10); }, [today]);

  useEffect(() => { void (async () => { if (!supabase) return; const { data } = await supabase.rpc("get_reservation_settings"); if (data?.[0]) setConfig(data[0]); })(); }, []);
  useEffect(() => {
    if (step !== 2 || !supabase || !Number(people)) return;
    let active = true; setLoading(true); setError("");
    const from = dates[0] < today ? today : dates[0];
    const to = dates[dates.length - 1] > maxDate ? maxDate : dates[dates.length - 1];
    if (from > to) { setSlots([]); setLoading(false); return; }
    void supabase.rpc("get_reservation_slots", { p_from: from, p_to: to, p_people: Number(people), p_space: space }).then(({ data, error: requestError }) => {
      if (!active) return;
      setSlots((data ?? []) as Slot[]); if (requestError) setError("No pudimos consultar los horarios. Inténtalo de nuevo."); setLoading(false);
    });
    return () => { active = false; };
  }, [step, month, people, space, dates, today, maxDate]);

  const next = (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (step === 1 && (!config?.seats_per_table || Number(people) > config.seats_per_table * 7)) { setError(!config?.seats_per_table ? "Aún no hay horarios publicados. Contáctanos para reservar." : "Para este número de personas, contáctanos directamente."); return; }
    if (step === 2 && !date) { setError("Selecciona una fecha disponible."); return; }
    if (step === 3 && !time) { setError("Selecciona una hora."); return; }
    if (step === 4 && wantsDecoration && !canDecorate) { setError("La decoración no está disponible para este horario."); return; }
    if (step === 5 && lookupLoading) { setError("Estamos buscando tus datos, espera un momento."); return; }
    if (step === 5 && (phone.replace(/\D/g, "").length < 7 || phone.replace(/\D/g, "").length > 15)) { setError("Escribe un número de celular válido."); return; }
    if (step < 6) { setStep(step + 1); return; }
    void submit();
  };
  const submit = async () => {
    if (!supabase || saving) return;
    setSaving(true); setError("");
    const payload = { space, people, date, time, decoration: wantsDecoration ? "Decoración solicitada" : "", phone, name, birthday, occasion, allergies, notes };
    const identity = submissionIdentity('reservation', payload);
    const { error: requestError } = await supabase.rpc("create_reservation_request", { payload: { ...payload, requestId: identity.requestId } });
    if (requestError) setError(requestError.message.includes("no está disponible") || requestError.message.includes("8 horas") ? requestError.message : "No pudimos enviar la solicitud. Revisa tus datos e inténtalo de nuevo.");
    else { completeSubmission('reservation'); setSent(true); }
    setSaving(false);
  };
  const moveMonth = (delta: number) => { const d = monthDate(month); d.setUTCMonth(d.getUTCMonth() + delta); setMonth(asMonth(d)); setDate(""); setTime(""); };

  return <main className="reservation-page"><div className="reservation-wrap"><h1>Reservas</h1>{sent ? <div className="reservation-success"><h2>Recibimos tu solicitud</h2><p>Te contactaremos para confirmar los detalles. La reserva está pendiente de confirmación.</p><a href="/">Volver al inicio</a></div> : <><p className="reservation-lead reservation-intro">Encuentra un horario y cuéntanos cómo quieres vivir tu visita.</p><p className="reservation-step">Paso {step} de 6 · {labels[step - 1]}</p><form onSubmit={next} className="reservation-form">
    {step === 1 && <><div><p className="reservation-people-label">¿Para cuántas personas?</p><div className="reservation-people"><button type="button" aria-label="Quitar una persona" disabled={people <= 2} onClick={() => { setPeople(Math.max(2, people - 1)); setDate(""); setTime(""); }}>−</button><span aria-live="polite">{people} <small>personas</small></span><button type="button" aria-label="Agregar una persona" disabled={people >= 500} onClick={() => { setPeople(Math.min(500, people + 1)); setDate(""); setTime(""); }}>+</button></div></div><fieldset><legend>¿Qué deseas reservar?</legend><div className="reservation-choices"><label><input type="radio" checked={space === "mesas"} onChange={() => { setSpace("mesas"); setDate(""); setTime(""); }} /> Mesas</label><label><input type="radio" checked={space === "lugar_completo"} onChange={() => { setSpace("lugar_completo"); setDate(""); setTime(""); }} /> Todo el lugar</label></div></fieldset>{config?.seats_per_table ? <p className="reservation-lead">Calculamos las mesas necesarias según el número de personas.</p> : <p className="reservation-lead">Aún no hay horarios publicados.</p>}</>}
    {step === 2 && <><div className="reservation-month"><button type="button" onClick={() => moveMonth(-1)} disabled={month <= today.slice(0, 7)} aria-label="Mes anterior">←</button><strong>{monthTitle}</strong><button type="button" onClick={() => moveMonth(1)} disabled={month >= maxDate.slice(0, 7)} aria-label="Mes siguiente">→</button></div><div className="reservation-calendar">{["L", "M", "M", "J", "V", "S", "D"].map((label, i) => <span key={i}>{label}</span>)}{Array.from({ length: leading }, (_, i) => <span key={`empty-${i}`} />)}{dates.map(day => <button key={day} type="button" disabled={!slotsByDate[day]?.length} aria-pressed={date === day} className={date === day ? "selected" : ""} onClick={() => { setDate(day); setTime(""); }}><b>{Number(day.slice(-2))}</b>{slotsByDate[day]?.length ? <small>{slotsByDate[day].length} horas</small> : null}</button>)}</div><p className="reservation-lead">{loading ? "Consultando disponibilidad..." : "El número indica las horas disponibles. Las solicitudes pendientes ocupan capacidad."}</p></>}
    {step === 3 && <><p className="reservation-lead">Elige una hora para el {date}.</p><div className="reservation-time-list">{(slotsByDate[date] || []).map(item => <button key={item.slot} type="button" className={time === item.slot ? "selected" : ""} aria-pressed={time === item.slot} onClick={() => { setTime(item.slot); setWantsDecoration(false); }}>{item.slot}</button>)}</div></>}
    {step === 4 && <><fieldset><legend>¿Quieres decoración?</legend><div className="reservation-choices"><label><input type="radio" checked={!wantsDecoration} onChange={() => setWantsDecoration(false)} /> No</label><label><input type="radio" checked={wantsDecoration} disabled={!canDecorate} onChange={() => setWantsDecoration(true)} /> Sí{config?.decoration_price ? ` · ${cop(config.decoration_price)}` : ""}</label></div></fieldset><p className="reservation-lead">{!config?.decoration_price ? "La decoración no está disponible por ahora." : !canDecorate ? "La decoración requiere al menos 8 horas de antelación." : `La decoración tiene un costo adicional de ${cop(config.decoration_price)} y requiere 8 horas de antelación. Nuestro equipo te contará las opciones disponibles.`}</p></>}
    {step === 5 && <><label>Número de celular<input type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} value={phone} onChange={e => { if (knownName) setName(""); if (knownBirthday) setBirthday(""); setKnownName(false); setKnownBirthday(false); setEditKnown(false); setPhone(e.target.value); }} placeholder="Tu celular" /></label><p className="reservation-lead">{lookupLoading ? "Buscando tus datos…" : knownName || knownBirthday ? "Encontramos datos asociados a tu número." : "Usaremos tu número para asociar esta solicitud a tus datos en La Tuba y contactarte."}</p></>}
    {step === 6 && <>{(knownName || knownBirthday) && !editKnown && <div className="reservation-lead"><p>Datos encontrados{knownName ? `: ${name}` : ""}{knownBirthday ? ` · Cumpleaños ${birthday.slice(8, 10)}/${birthday.slice(5, 7)}` : ""}.</p><button type="button" className="underline" onClick={() => setEditKnown(true)}>Modificar datos</button></div>}{(!knownName || editKnown) && <label>Nombre<input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>}{(!knownBirthday || editKnown) && <label>Fecha de cumpleaños<input type="date" max={today} required value={birthday} onChange={e => setBirthday(e.target.value)} /></label>}<label>Ocasión de la reserva<input maxLength={200} value={occasion} onChange={e => setOccasion(e.target.value)} placeholder="Cumpleaños, reunión..." /></label><label>Alergias o restricciones<textarea rows={2} maxLength={500} value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="Indícanos si hay alguna" /></label><label>Otros<textarea rows={2} maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Algo más que debamos saber" /></label><p className="reservation-lead">Tu solicitud quedará pendiente hasta que La Tuba la confirme.</p></>}
    {error && <p role="alert" className="reservation-error">{error}</p>}<div className="reservation-actions">{step > 1 ? <button type="button" onClick={() => { setError(""); setStep(step - 1); }}>← Atrás</button> : <span /> }<button type="submit" className="reservation-submit" disabled={saving || (step === 2 && loading)}>{saving ? "Enviando..." : step === 6 ? "Solicitar reserva" : "Continuar →"}</button></div>
  </form></>}</div></main>;
}
