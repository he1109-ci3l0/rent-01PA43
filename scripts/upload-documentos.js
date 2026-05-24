/**
 * Sube los 6 documentos legales a Firebase Storage y registra las URLs
 * en Firestore (colección documentosPlantillas/{tipo}).
 *
 * REQUISITOS:
 *   1. Descarga tu Service Account desde Firebase Console →
 *      Configuración del proyecto → Cuentas de servicio → Generar clave privada
 *   2. Guárdalo como: scripts/service-account.json  (está en .gitignore)
 *   3. Ejecuta: node scripts/upload-documentos.js
 *
 * DEPENDENCIAS (instalar una sola vez):
 *   npm install firebase-admin --save-dev
 */

const admin  = require('firebase-admin');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

// ── Configuración ─────────────────────────────────────────────

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account.json');
const STORAGE_BUCKET        = 'rent-01pa43.firebasestorage.app'; // ajusta si tu bucket tiene otro nombre
const ASSETS_DIR            = path.join(__dirname, '..', 'assets', 'documentos');

const PLANTILLAS = [
  { archivo: 'contrato_final_v5.docx',      tipo: 'contrato',            nombre: 'Contrato de hospedaje',  requiereFirma: true,  version: 'v5' },
  { archivo: 'reglamento_interno_v4.docx',   tipo: 'reglamento',          nombre: 'Reglamento interno',     requiereFirma: true,  version: 'v4' },
  { archivo: 'aviso_privacidad.docx',        tipo: 'aviso_privacidad',    nombre: 'Aviso de privacidad',    requiereFirma: true,  version: 'v1' },
  { archivo: 'addendum_servicios_v2.docx',   tipo: 'addendum_servicios',  nombre: 'Addendum de servicios',  requiereFirma: false, version: 'v2' },
  { archivo: 'contrato_mobiliario_v2.docx',  tipo: 'contrato_mobiliario', nombre: 'Contrato de mobiliario', requiereFirma: false, version: 'v2' },
  { archivo: 'clausula_cupones.docx',        tipo: 'clausula_cupones',    nombre: 'Cláusula de cupones',    requiereFirma: false, version: 'v1' },
];

// ── Inicialización ────────────────────────────────────────────

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌ No se encontró scripts/service-account.json');
  console.error('   Descárgalo desde Firebase Console → Configuración → Cuentas de servicio');
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential:    admin.credential.cert(serviceAccount),
  storageBucket: STORAGE_BUCKET,
});

const db      = admin.firestore();
const bucket  = admin.storage().bucket();

// ── Subida ────────────────────────────────────────────────────

async function subirArchivo(plantilla) {
  const localPath  = path.join(ASSETS_DIR, plantilla.archivo);
  const remotePath = `documentos/plantillas/${plantilla.archivo}`;

  if (!fs.existsSync(localPath)) {
    console.error(`❌ Archivo no encontrado: ${localPath}`);
    return null;
  }

  // Generar token de descarga (permite URL pública con token)
  const token = crypto.randomUUID();

  console.log(`⬆️  Subiendo ${plantilla.archivo}…`);
  await bucket.upload(localPath, {
    destination: remotePath,
    metadata: {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      metadata:    { firebaseStorageDownloadTokens: token },
    },
  });

  const url = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(remotePath)}?alt=media&token=${token}`;
  console.log(`   ✓ URL: ${url.slice(0, 80)}…`);
  return url;
}

async function main() {
  console.log('\n🗂  Subida de plantillas legales — Antioquia 43\n');

  for (const plantilla of PLANTILLAS) {
    const url = await subirArchivo(plantilla);
    if (!url) continue;

    // Guardar en Firestore
    await db.collection('documentosPlantillas').doc(plantilla.tipo).set({
      tipo:          plantilla.tipo,
      nombre:        plantilla.nombre,
      nombreArchivo: plantilla.archivo,
      storageRuta:   `documentos/plantillas/${plantilla.archivo}`,
      url,
      requiereFirma: plantilla.requiereFirma,
      version:       plantilla.version,
      subidoEn:      admin.firestore.FieldValue.serverTimestamp(),
      subidoPor:     'script',
    });

    console.log(`   ✓ Firestore: documentosPlantillas/${plantilla.tipo}\n`);
  }

  console.log('✅ Listo. Todos los documentos están en Storage y en Firestore.\n');
  console.log('   Los nuevos inquilinos tendrán los 6 documentos pre-cargados en su expediente.');
  console.log('   Para actualizar la URL de un documento ya existente, usa la pestaña');
  console.log('   "Plantillas legales" en el panel web de administración.\n');

  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
