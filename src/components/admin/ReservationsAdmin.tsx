import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import ReservationSettings from "./ReservationSettings";

type Reservation = { id: string; customer_name: string; phone: string; reservation_date: string; reservation_time: string; party_size: number; space_type: string; requested_tables: number | null; decoration: string | null; decoration_price: number | null; occasion: string | null; allergies: string | null; notes: string | null; status: "pendiente" | "confirmada" | "cancelada"; assigned_tables: number[] };

export default function ReservationsAdmin() {
  const [rows, setRows] = useState<Reservation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tables, setTables] = useState<number[]>([]);
  const [status, setStatus] = useState<Reservation["status"]>("pendiente");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const load = async () => { if (!supabase) return; const { data, error } = await supabase.from("reservations").select("*").order("reservation_date", { ascending: false }).order("reservation_time"); if (error) setMessage(error.message); else setRows(data as Reservation[]); };
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); const refresh = window.setInterval(() => { void load(); }, 15000); return () => { window.clearTimeout(timer); window.clearInterval(refresh); }; }, []);
  const current = rows.find(row => row.id === selected);
  const select = (row: Reservation) => { setSelected(row.id); setTables(row.assigned_tables || []); setStatus(row.status); setMessage(""); };
  const save = async () => {
    if (!supabase || !current || saving) return;
    if (status === "confirmada" && current.space_type === "mesas" && tables.length !== current.requested_tables) { setMessage(`Selecciona ${current.requested_tables} mesa(s) para confirmar.`); return; }
    setSaving(true); setMessage("");
    const { error } = await supabase.rpc("manage_reservation", { p_id: current.id, p_status: status, p_tables: current.space_type === "lugar_completo" ? [] : tables });
    if (error) setMessage(error.message); else { await load(); setMessage("Reserva actualizada. Contacta a la persona para comunicarle la decisión."); }
    setSaving(false);
  };
  if (configuring) return <div><button type="button" onClick={() => setConfiguring(false)} className="mb-4 text-sm font-semibold text-[#793713]">← Volver a solicitudes</button><ReservationSettings /></div>;
  return <><div className="reservation-admin-toolbar"><button type="button" onClick={() => setConfiguring(true)}>Configurar horarios y decoración →</button></div><div className="admin-reservations"><section><h2>Solicitudes</h2><p>Revisa disponibilidad y contacta a la persona antes de confirmar.</p>{rows.length === 0 && <p>No hay solicitudes todavía.</p>}<div className="reservation-list">{rows.map(row => <button key={row.id} type="button" onClick={() => select(row)} className={selected === row.id ? "selected" : ""}><span><b>{row.customer_name}</b><small>{row.reservation_date} · {row.reservation_time.slice(0,5)} · {row.party_size} personas</small></span><strong>{row.status}</strong></button>)}</div></section><section>{current ? <><h2>{current.customer_name}</h2><p>{current.phone} · {current.reservation_date} a las {current.reservation_time.slice(0,5)}</p><p>{current.party_size} personas · {current.space_type === "mesas" ? `${current.requested_tables} mesa(s)` : "Todo el lugar"}</p><p>Decoración: {current.decoration || "No solicitada"}{current.decoration_price ? ` · $${current.decoration_price.toLocaleString("es-CO")}` : ""}</p>{current.occasion && <p>Ocasión: {current.occasion}</p>}{current.allergies && <p>Alergias o restricciones: {current.allergies}</p>}{current.notes && <p>Otros: {current.notes}</p>}{current.space_type === "mesas" && <><h3>Asignar mesas</h3><p>Distribución de referencia; las mesas se pueden mover.</p><div className="reservation-map">{[1, 4, 5, 2, 7, 6, 3].map(n => <button key={n} type="button" aria-pressed={tables.includes(n)} className={tables.includes(n) ? "selected" : ""} onClick={() => setTables(tables.includes(n) ? tables.filter(t => t !== n) : [...tables, n])}>Mesa {n}</button>)}</div></>}<label className="reservation-admin-status">Estado<select value={status} onChange={e => setStatus(e.target.value as Reservation["status"])}><option value="pendiente">Pendiente</option><option value="confirmada">Confirmada</option><option value="cancelada">Cancelada</option></select></label><p>Revisa la asignación de mesas antes de confirmar.</p><button type="button" className="inventory-submit" disabled={saving} onClick={() => void save()}>{saving ? "Guardando..." : "Guardar cambios"}</button></> : <p>Selecciona una solicitud para ver sus detalles y asignar mesas.</p>}{message && <p role="status">{message}</p>}</section></div></>;
}
