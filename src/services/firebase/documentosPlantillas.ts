import {
  doc, setDoc, onSnapshot, collection, Timestamp,
} from 'firebase/firestore';
import { db } from './firestore';
import type { DocumentoPlantilla } from '@/types/firestore';

// ─── Metadata de las 6 plantillas legales ─────────────────────

export const PLANTILLAS_META: Array<{
  tipo: string;
  nombre: string;
  nombreArchivo: string;
  requiereFirma: boolean;
  version: string;
}> = [
  { tipo: 'contrato',            nombre: 'Contrato de hospedaje',  nombreArchivo: 'contrato_final_v5.docx',      requiereFirma: true,  version: 'v5' },
  { tipo: 'reglamento',          nombre: 'Reglamento interno',     nombreArchivo: 'reglamento_interno_v4.docx',  requiereFirma: true,  version: 'v4' },
  { tipo: 'aviso_privacidad',    nombre: 'Aviso de privacidad',    nombreArchivo: 'aviso_privacidad.docx',       requiereFirma: true,  version: 'v1' },
  { tipo: 'addendum_servicios',  nombre: 'Addendum de servicios',  nombreArchivo: 'addendum_servicios_v2.docx',  requiereFirma: false, version: 'v2' },
  { tipo: 'contrato_mobiliario', nombre: 'Contrato de mobiliario', nombreArchivo: 'contrato_mobiliario_v2.docx', requiereFirma: false, version: 'v2' },
  { tipo: 'clausula_cupones',    nombre: 'Cláusula de cupones',    nombreArchivo: 'clausula_cupones.docx',       requiereFirma: false, version: 'v1' },
];

// ─── Listeners ────────────────────────────────────────────────

export function listenDocumentosPlantillas(
  cb: (plantillas: DocumentoPlantilla[]) => void,
): () => void {
  return onSnapshot(
    collection(db, 'documentosPlantillas'),
    snap => {
      const ordered = PLANTILLAS_META.map(m => m.tipo);
      const items = snap.docs.map(d => ({ ...d.data(), tipo: d.id } as DocumentoPlantilla));
      items.sort((a, b) => ordered.indexOf(a.tipo) - ordered.indexOf(b.tipo));
      cb(items);
    },
    () => cb([]),
  );
}

// ─── Escritura (admin) ────────────────────────────────────────

export async function actualizarPlantillaUrl(
  tipo: string,
  url: string,
  storageRuta: string,
  version: string,
  adminUid: string,
): Promise<void> {
  const meta = PLANTILLAS_META.find(p => p.tipo === tipo);
  if (!meta) throw new Error(`Tipo de plantilla desconocido: ${tipo}`);
  await setDoc(doc(db, 'documentosPlantillas', tipo), {
    tipo,
    nombre:        meta.nombre,
    nombreArchivo: meta.nombreArchivo,
    storageRuta,
    url,
    requiereFirma: meta.requiereFirma,
    version,
    subidoEn:  Timestamp.now(),
    subidoPor: adminUid,
  } satisfies Omit<DocumentoPlantilla, never>);
}
