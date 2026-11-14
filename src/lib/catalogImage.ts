import { supabase } from './supabase';

const bucket = 'la-tuba-catalog-images';
const accepted = ['image/jpeg', 'image/png', 'image/webp'];

export function validateCatalogImage(file: File) {
  if (!accepted.includes(file.type)) throw new Error('Selecciona una imagen JPG, PNG o WebP. Si tu teléfono usa HEIC, conviértela a JPG.');
  if (file.size > 20 * 1024 * 1024) throw new Error('La imagen debe pesar máximo 20 MB.');
}

export async function uploadCatalogImage(file: File): Promise<string> {
  if (!supabase) throw new Error('No se pudo conectar con Supabase.');
  validateCatalogImage(file);
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('No se pudo abrir la imagen. Prueba con otro archivo JPG, PNG o WebP.'); }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo preparar la imagen.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (!blob || blob.type !== 'image/webp' || blob.size > 5 * 1024 * 1024) throw new Error('No se pudo preparar la imagen. Prueba con otra foto.');
    const path = `catalogo/${crypto.randomUUID()}.webp`;
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/webp', upsert: false });
    if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  } finally { bitmap.close(); }
}
