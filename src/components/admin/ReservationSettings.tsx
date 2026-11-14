import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";

const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export default function ReservationSettings() {
  const [daysOpen, setDaysOpen] = useState<number[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [newTime, setNewTime] = useState("");
  const [duration, setDuration] = useState("");
  const [seats, setSeats] = useState("");
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { void (async () => { if (!supabase) { setMessage("No se pudo conectar con Supabase."); return; } const { data, error } = await supabase.from("reservation_settings").select("*").eq("id", 1).single(); if (error) setMessage("No se pudo cargar la configuración. Revisa tu acceso de administrador."); else if (data) { setDaysOpen(data.open_days); setSlots(data.slots); setDuration(data.seats_per_table ? String(data.duration_minutes) : ""); setSeats(data.seats_per_table ? String(data.seats_per_table) : ""); setPrice(data.decoration_price ? String(data.decoration_price) : ""); } })(); }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!supabase || saving) return;
    const times = [...new Set(slots)].sort();
    if (!daysOpen.length || !times.length || times.some(t => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) { setMessage("Selecciona días e introduce horas en formato 24 h, por ejemplo 12:00, 14:30."); return; }
    if (!Number.isInteger(Number(seats)) || Number(seats) < 1 || Number(seats) > 100 || !Number.isInteger(Number(duration)) || Number(duration) < 15 || Number(duration) > 720 || (price && (!Number.isInteger(Number(price)) || Number(price) <= 0))) { setMessage("Revisa capacidad, duración y precio."); return; }
    setSaving(true); setMessage("");
    const { error } = await supabase.from("reservation_settings").update({ open_days: daysOpen, slots: times, duration_minutes: Number(duration), seats_per_table: Number(seats), decoration_price: price ? Number(price) : null }).eq("id", 1).select("id").single();
    setMessage(error ? error.message : "Configuración guardada."); setSaving(false);
  };
  return <section className="reservation-settings"><h2 className="text-base font-semibold">Horarios y decoración</h2><form onSubmit={save} className="reservation-settings-form"><p>Configura aquí los horarios que verán tus clientes. Se aplican a todos los días seleccionados.</p><fieldset><legend>Días en que recibes reservas</legend><div className="reservation-days">{days.map((day, index) => <label key={day}><input type="checkbox" checked={daysOpen.includes(index + 1)} onChange={e => setDaysOpen(e.target.checked ? [...daysOpen, index + 1] : daysOpen.filter(d => d !== index + 1))} /> {day}</label>)}</div></fieldset><div><label htmlFor="new-reservation-time">Agregar una hora</label><div className="reservation-time-editor"><input id="new-reservation-time" type="time" value={newTime} onChange={e => setNewTime(e.target.value)} /><button type="button" onClick={() => { if (newTime) { setSlots([...new Set([...slots, newTime])].sort()); setNewTime(""); } }}>+ Agregar hora</button></div><div className="reservation-time-chips">{slots.map(time => <button type="button" key={time} onClick={() => setSlots(slots.filter(t => t !== time))} aria-label={`Quitar hora ${time}`}>{time} ×</button>)}</div>{slots.length === 0 && <p>Agrega al menos una hora disponible.</p>}</div><div className="reservation-fields"><label>Duración por reserva (minutos)<input type="number" min="15" max="720" required value={duration} onChange={e => setDuration(e.target.value)} placeholder="Ej. 120" /></label><label>Personas por mesa<input type="number" min="1" max="100" required value={seats} onChange={e => setSeats(e.target.value)} placeholder="Ej. 4" /></label></div><p>Se usa la misma capacidad para las siete mesas al calcular las mesas necesarias.</p><label>Precio fijo de decoración en pesos<input type="number" min="1" step="1" value={price} onChange={e => setPrice(e.target.value)} placeholder="Sin configurar" /></label><p>Déjalo vacío si no deseas ofrecer decoración. Las solicitudes pendientes y confirmadas ocupan capacidad.</p><button disabled={saving} className="inventory-submit">{saving ? "Guardando..." : "Guardar horarios y decoración"}</button>{message && <p role="status">{message}</p>}</form></section>;
}
