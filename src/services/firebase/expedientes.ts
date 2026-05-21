import {
  doc, getDoc, setDoc, updateDoc, addDoc, onSnapshot, increment,
  collection, Timestamp,
} from 'firebase/firestore';
import { db } from './firestore';
import type {
  Expediente, DocumentoExpediente, TipoDocExpediente,
  ContactoEmergencia, Mascota,
} from '@/types/firestore';

// ─── Documentos iniciales ─────────────────────────────────────

const DOCS_BASE: Array<Omit<DocumentoExpediente, 'id'>> = [
  { tipo: 'INE_FRENTE',          nombre: 'INE — Frente',            url: null, estado: 'pendiente', descargas: 0, maxDescargas: 3, subidoEn: null, subidoPor: null },
  { tipo: 'INE_REVERSO',         nombre: 'INE — Reverso',           url: null, estado: 'pendiente', descargas: 0, maxDescargas: 3, subidoEn: null, subidoPor: null },
  { tipo: 'CURP',                nombre: 'CURP',                    url: null, estado: 'pendiente', descargas: 0, maxDescargas: 3, subidoEn: null, subidoPor: null },
  { tipo: 'COMPROBANTE_DOMICILIO', nombre: 'Comprobante de domicilio', url: null, estado: 'pendiente', descargas: 0, maxDescargas: 3, subidoEn: null, subidoPor: null },
  { tipo: 'PRENDA_1_1',          nombre: 'Prenda garantía 1/2',     url: null, estado: 'pendiente', descargas: 0, maxDescargas: 3, subidoEn: null, subidoPor: null },
  { tipo: 'PRENDA_1_2',          nombre: 'Prenda garantía 2/2',     url: null, estado: 'pendiente', descargas: 0, maxDescargas: 3, subidoEn: null, subidoPor: null },
  { tipo: 'CONTRATO',            nombre: 'Contrato de hospedaje',   url: null, estado: 'pendiente', descargas: 0, maxDescargas: 3, subidoEn: null, subidoPor: null },
  { tipo: 'REGLAMENTO',          nombre: 'Reglamento interno',      url: null, estado: 'pendiente', descargas: 0, maxDescargas: 3, subidoEn: null, subidoPor: null },
  { tipo: 'AVISO_PRIVACIDAD',    nombre: 'Aviso de privacidad',     url: null, estado: 'pendiente', descargas: 0, maxDescargas: 3, subidoEn: null, subidoPor: null },
  { tipo: 'ADDENDUM_SERVICIOS',  nombre: 'Addendum de servicios',   url: null, estado: 'pendiente', descargas: 0, maxDescargas: 3, subidoEn: null, subidoPor: null },
  { tipo: 'CLAUSULA_CUPONES',    nombre: 'Cláusula de cupones',     url: null, estado: 'pendiente', descargas: 0, maxDescargas: 3, subidoEn: null, subidoPor: null },
];

// ─── Inicialización ───────────────────────────────────────────

export async function inicializarExpediente(uid: string, params: {
  habitacionId: string | null;
  habitacionNumero: string | null;
}): Promise<void> {
  const ref = doc(db, 'expedientes', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const now = Timestamp.now();
    await setDoc(ref, {
      inquilinoId:         uid,
      habitacionId:        params.habitacionId,
      habitacionNumero:    params.habitacionNumero,
      firmaDigital:        null,
      firmadoEn:           null,
      notasAdmin:          '',
      congelado:           false,
      contactosEmergencia: [],
      mascotas:            [],
      creadoEn:            now,
      actualizadoEn:       now,
    } satisfies Omit<Expediente, 'id'>);
  }

  const docsRef = collection(db, `inquilinos/${uid}/documentos`);
  const existingSnap = await getDoc(doc(db, `inquilinos/${uid}/documentos`, '__check__')).catch(() => null);
  // Only seed docs if none exist (check by counting)
  const existingDocs = await getDoc(ref); // re-use ref just to check; actual check below
  void existingDocs; // suppress lint
  // Seed docs unconditionally when creating a fresh expediente (idempotent via estado check)
  // We'll check in the listener whether docs exist
  const docsSnap = await import('firebase/firestore').then(({ getDocs }) => getDocs(docsRef));
  if (docsSnap.empty) {
    await Promise.all(DOCS_BASE.map(d => addDoc(docsRef, d)));
  }
}

// ─── Listeners ────────────────────────────────────────────────

export function listenExpediente(uid: string, cb: (e: Expediente | null) => void): () => void {
  return onSnapshot(doc(db, 'expedientes', uid), snap => {
    cb(snap.exists() ? ({ ...snap.data(), id: snap.id } as Expediente) : null);
  }, () => cb(null));
}

export function listenDocumentos(uid: string, cb: (docs: DocumentoExpediente[]) => void): () => void {
  return onSnapshot(collection(db, `inquilinos/${uid}/documentos`), snap => {
    const ordered: TipoDocExpediente[] = [
      'INE_FRENTE','INE_REVERSO','CURP','COMPROBANTE_DOMICILIO',
      'PRENDA_1_1','PRENDA_1_2','CONTRATO','REGLAMENTO',
      'AVISO_PRIVACIDAD','ADDENDUM_SERVICIOS','CLAUSULA_CUPONES',
    ];
    const docs = snap.docs.map(d => ({ ...d.data(), id: d.id } as DocumentoExpediente));
    docs.sort((a, b) => ordered.indexOf(a.tipo) - ordered.indexOf(b.tipo));
    cb(docs);
  }, () => cb([]));
}

// ─── Documentos ───────────────────────────────────────────────

export async function registrarDescarga(uid: string, docId: string): Promise<void> {
  await updateDoc(doc(db, `inquilinos/${uid}/documentos`, docId), {
    descargas: increment(1),
  });
}

export async function resetearContador(uid: string, docId: string): Promise<void> {
  await updateDoc(doc(db, `inquilinos/${uid}/documentos`, docId), { descargas: 0 });
}

export async function subirDocumento(
  uid: string, docId: string, url: string, adminUid: string,
): Promise<void> {
  await updateDoc(doc(db, `inquilinos/${uid}/documentos`, docId), {
    url, estado: 'subido', subidoEn: Timestamp.now(), subidoPor: adminUid,
  });
}

// ─── Firma digital ────────────────────────────────────────────

export async function guardarFirma(uid: string, firmaJson: string): Promise<void> {
  await updateDoc(doc(db, 'expedientes', uid), {
    firmaDigital: firmaJson,
    firmadoEn:    Timestamp.now(),
    actualizadoEn: Timestamp.now(),
  });
}

// ─── Contactos de emergencia ──────────────────────────────────

export async function agregarContactoEmergencia(
  uid: string,
  contacto: Omit<ContactoEmergencia, 'id'>,
): Promise<void> {
  const snap = await getDoc(doc(db, 'expedientes', uid));
  const existentes: ContactoEmergencia[] = snap.data()?.contactosEmergencia ?? [];
  if (existentes.length >= 2) throw new Error('Máximo 2 contactos de emergencia');
  await updateDoc(doc(db, 'expedientes', uid), {
    contactosEmergencia: [...existentes, { ...contacto, id: `${Date.now()}` }],
    actualizadoEn: Timestamp.now(),
  });
}

export async function eliminarContactoEmergencia(uid: string, contactoId: string): Promise<void> {
  const snap = await getDoc(doc(db, 'expedientes', uid));
  const existentes: ContactoEmergencia[] = snap.data()?.contactosEmergencia ?? [];
  await updateDoc(doc(db, 'expedientes', uid), {
    contactosEmergencia: existentes.filter(c => c.id !== contactoId),
    actualizadoEn: Timestamp.now(),
  });
}

// ─── Mascotas ─────────────────────────────────────────────────

export async function agregarMascota(uid: string, mascota: Omit<Mascota, 'id'>): Promise<void> {
  const snap = await getDoc(doc(db, 'expedientes', uid));
  const existentes: Mascota[] = snap.data()?.mascotas ?? [];
  if (existentes.length >= 6) throw new Error('Máximo 6 mascotas');
  await updateDoc(doc(db, 'expedientes', uid), {
    mascotas: [...existentes, { ...mascota, id: `${Date.now()}` }],
    actualizadoEn: Timestamp.now(),
  });
}

export async function eliminarMascota(uid: string, mascotaId: string): Promise<void> {
  const snap = await getDoc(doc(db, 'expedientes', uid));
  const existentes: Mascota[] = snap.data()?.mascotas ?? [];
  await updateDoc(doc(db, 'expedientes', uid), {
    mascotas: existentes.filter(m => m.id !== mascotaId),
    actualizadoEn: Timestamp.now(),
  });
}

// ─── Admin: notas, congelar, cambiar hab ─────────────────────

export async function actualizarNotasAdmin(uid: string, notas: string): Promise<void> {
  await updateDoc(doc(db, 'expedientes', uid), {
    notasAdmin: notas, actualizadoEn: Timestamp.now(),
  });
}

export async function congelarCuenta(uid: string, congelado: boolean): Promise<void> {
  await updateDoc(doc(db, 'expedientes', uid), {
    congelado, actualizadoEn: Timestamp.now(),
  });
}

export async function cambiarHabitacion(
  uid: string, habitacionId: string, habitacionNumero: string,
): Promise<void> {
  await updateDoc(doc(db, 'expedientes', uid), {
    habitacionId, habitacionNumero, actualizadoEn: Timestamp.now(),
  });
}
