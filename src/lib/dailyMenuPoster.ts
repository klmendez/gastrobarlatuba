import type { DailyMenuConfig } from '../services/dailyMenuService';
import { WHATSAPP_PHONE } from '../data/constants';

const WIDTH = 1080;
const DARK = '#542409';
const BODY_FONT = '500 42px Poppins, sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) { line = candidate; continue; }
    if (line) { lines.push(line); line = ''; }
    for (const char of word) {
      if (line && ctx.measureText(line + char).width > maxWidth) { lines.push(line); line = ''; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function palm(ctx: CanvasRenderingContext2D, x: number, mirror: number) {
  ctx.save(); ctx.translate(x, 0); ctx.scale(mirror, 1); ctx.strokeStyle = DARK; ctx.lineWidth = 7;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.quadraticCurveTo(45 + i * 12, 90, 145 + i * 12, 135 + i * 22); ctx.stroke();
  }
  ctx.restore();
}

async function loadLogo(): Promise<HTMLImageElement> {
  const image = new Image(); image.src = '/la-tuba-logo.png';
  try { await image.decode(); return image; }
  catch { throw new Error('No se pudo cargar el logo para la imagen.'); }
}

export async function generateDailyMenuPoster(menu: DailyMenuConfig): Promise<Blob> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(menu.scheduledDate)) throw new Error('El menú necesita una fecha válida.');
  const date = new Date(`${menu.scheduledDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== menu.scheduledDate) throw new Error('El menú necesita una fecha válida.');
  const logo = await loadLogo();
  if (document.fonts) await document.fonts.ready;
  const canvas = document.createElement('canvas'); canvas.width = WIDTH;
  let ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear la imagen en este navegador.');
  ctx.font = BODY_FONT;
  const groups = [
    { title: 'SOPAS', values: menu.soups },
    { title: 'PRINCIPIOS', values: menu.sides },
    { title: 'PROTEÍNAS', values: menu.proteins },
    { title: 'ESPECIALES', values: menu.specials.map(item => item.name) },
  ].map(group => ({ ...group, lines: group.values.map(value => value.trim()).filter(Boolean).flatMap(value => wrap(ctx!, value, 790)) })).filter(group => group.lines.length);
  if (!groups.length) throw new Error('Agrega al menos una opción al menú antes de generar la imagen.');
  const contentHeight = groups.reduce((sum, group) => sum + 75 + group.lines.length * 57 + 28, 0);
  const height = Math.max(1920, 510 + contentHeight + 340);
  if (height > 12000) throw new Error('El menú es demasiado largo para una sola imagen. Reduce las opciones y vuelve a intentarlo.');
  canvas.height = height;
  ctx = canvas.getContext('2d')!;
  const background = ctx.createLinearGradient(0, 0, WIDTH, height); background.addColorStop(0, '#fff2d0'); background.addColorStop(1, '#f6dba0');
  ctx.fillStyle = background; ctx.fillRect(0, 0, WIDTH, height);
  ctx.strokeStyle = '#d4a364'; ctx.lineWidth = 3; ctx.strokeRect(32, 32, WIDTH - 64, height - 64);
  palm(ctx, 38, 1); palm(ctx, WIDTH - 38, -1);
  const logoWidth = 550; const logoHeight = logoWidth * logo.naturalHeight / logo.naturalWidth;
  ctx.drawImage(logo, (WIDTH - logoWidth) / 2, 100, logoWidth, logoHeight);
  const weekday = new Intl.DateTimeFormat('es-CO', { weekday: 'long', timeZone: 'UTC' }).format(date).toLocaleUpperCase('es-CO');
  const dateLabel = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  ctx.textAlign = 'center'; ctx.fillStyle = DARK;
  ctx.font = '600 66px Poppins, sans-serif'; ctx.fillText(`MENÚ DEL ${weekday}`, WIDTH / 2, 355, 870);
  ctx.font = '400 32px Poppins, sans-serif'; ctx.fillText(dateLabel, WIDTH / 2, 415);
  ctx.strokeStyle = '#b77b42'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(180, 453); ctx.lineTo(900, 453); ctx.stroke();
  let y = 510;
  for (const group of groups) {
    ctx.fillStyle = DARK; ctx.beginPath(); ctx.roundRect(340, y - 38, 400, 58, 29); ctx.fill();
    ctx.fillStyle = '#fff6df'; ctx.font = '600 32px Poppins, sans-serif'; ctx.fillText(group.title, WIDTH / 2, y + 3);
    y += 75; ctx.fillStyle = DARK; ctx.font = BODY_FONT;
    for (const line of group.lines) { ctx.fillText(line, WIDTH / 2, y); y += 57; }
    ctx.strokeStyle = '#c49863'; ctx.beginPath(); ctx.moveTo(180, y - 15); ctx.lineTo(900, y - 15); ctx.stroke(); y += 28;
  }
  const footerY = Math.max(y + 75, height - 260);
  ctx.fillStyle = DARK; ctx.font = '600 32px Poppins, sans-serif'; ctx.fillText('SERVICIO A DOMICILIO', WIDTH / 2, footerY);
  ctx.font = '500 46px Poppins, sans-serif'; ctx.fillText(WHATSAPP_PHONE, WIDTH / 2, footerY + 58);
  ctx.font = '400 30px Poppins, sans-serif'; ctx.fillText('Cra. 7 # 2-38 · Centro, Popayán', WIDTH / 2, footerY + 120, 920);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No se pudo exportar la imagen. Inténtalo de nuevo.');
  return blob;
}
