// Subida de imágenes a Cloudinary (unsigned upload — sin exponer API secret)
// Migrar a Firebase Storage cuando se active Blaze (septiembre 2026)

const CLOUD_NAME = 'dqit74b2t';
const UPLOAD_PRESET = 'WCK_nZ1Nka0OPgXv90KLP6djRhI';

/**
 * Sube una imagen local (uri del ImagePicker) a Cloudinary.
 * Devuelve la URL segura (https) para guardar en Firestore.
 * @param uri     uri local de la imagen (file://...)
 * @param carpeta carpeta lógica en Cloudinary (ej. 'comprobantes', 'tickets', 'mascotas')
 */
export async function subirImagenCloudinary(
  uri: string,
  carpeta?: string,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: 'image/jpeg',
    name: `upload_${Date.now()}.jpg`,
  } as any);
  formData.append('upload_preset', UPLOAD_PRESET);
  if (carpeta) formData.append('folder', `antioquia43/${carpeta}`);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData },
  );

  if (!res.ok) {
    throw new Error('No se pudo subir la imagen. Verifica tu conexión.');
  }

  const data = await res.json();
  return data.secure_url as string;
}
