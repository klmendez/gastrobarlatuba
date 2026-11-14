export type AdminPeriod = 'dia' | 'semana' | 'mes';
export function bogotaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function periodDates(date: string, period: AdminPeriod): { from: string; until: string } {
  const anchor = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(anchor.getTime())) throw new Error('Fecha inválida');
  const start = new Date(anchor);
  if (period === 'semana') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  if (period === 'mes') start.setUTCDate(1);
  const end = new Date(start);
  if (period === 'dia') end.setUTCDate(end.getUTCDate() + 1);
  else if (period === 'semana') end.setUTCDate(end.getUTCDate() + 7);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return { from: start.toISOString().slice(0,10), until: end.toISOString().slice(0,10) };
}
export function bogotaStart(date: string): Date { return new Date(`${date}T00:00:00-05:00`); }
