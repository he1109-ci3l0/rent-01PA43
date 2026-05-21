import {
  query, where, orderBy, onSnapshot,
  doc, addDoc, updateDoc, getDocs, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db, collections } from './firestore';
import type {
  SolicitudFactura, ConceptoFacturaCFDI,
  EmisorFacturaCFDI, DatosFiscalesInquilino,
} from '@/types/firestore';

// ─── Helpers ──────────────────────────────────────────────────

export function emisorPorConcepto(concepto: ConceptoFacturaCFDI): EmisorFacturaCFDI {
  // Renta → persona física (RESICO, exento IVA)
  // Servicios → empresa (IVA 16%)
  // Todo → emite dos CFDI, aquí se marca como empresa para la solicitud
  return concepto === 'renta' ? 'fisica' : 'empresa';
}

export const CONCEPTOS_LABEL: Record<ConceptoFacturaCFDI, string> = {
  renta:          'Renta de habitación',
  lavanderia:     'Servicio de lavandería',
  almacenamiento: 'Servicio de almacenamiento',
  todo:           'Todos los conceptos',
};

function descripcionCFDI(
  concepto: ConceptoFacturaCFDI,
  habitacionNumero: string,
  mes: number,
  anio: number,
): string {
  const mesStr = new Date(anio, mes - 1).toLocaleString('es-MX', { month: 'long', year: 'numeric' });
  switch (concepto) {
    case 'renta':
      return `Renta de habitación número ${habitacionNumero} — ${mesStr}`;
    case 'lavanderia':
      return `Servicio de lavandería — ${mesStr} — Hab. ${habitacionNumero}`;
    case 'almacenamiento':
      return `Servicio de almacenamiento — ${mesStr} — Hab. ${habitacionNumero}`;
    case 'todo':
      return `Renta y servicios — ${mesStr} — Hab. ${habitacionNumero}`;
  }
}

// ─── CRUD Solicitudes ─────────────────────────────────────────

export async function crearSolicitud(data: {
  inquilinoId: string;
  habitacionId: string;
  habitacionNumero?: string;
  inquilinoNombre?: string;
  concepto: ConceptoFacturaCFDI;
  mes: number;
  anio: number;
  datosFiscales: DatosFiscalesInquilino;
}): Promise<string> {
  const emisor = emisorPorConcepto(data.concepto);
  const payload: Omit<SolicitudFactura, 'id'> = {
    inquilinoId: data.inquilinoId,
    habitacionId: data.habitacionId,
    habitacionNumero: data.habitacionNumero,
    inquilinoNombre: data.inquilinoNombre,
    concepto: data.concepto,
    emisor,
    mes: data.mes,
    anio: data.anio,
    estado: 'pendiente',
    datosFiscales: data.datosFiscales,
    descargasRestantes: 3,
    creadoEn: serverTimestamp() as Timestamp,
  };
  const ref = await addDoc(collections.solicitudesFactura, payload);
  return ref.id;
}

export async function subirFactura(
  solicitudId: string,
  pdfUrl: string,
  adminUid: string,
): Promise<void> {
  await updateDoc(doc(db, 'solicitudes_factura', solicitudId), {
    estado: 'emitida',
    pdfUrl,
    adminSubidoPor: adminUid,
    adminSubidoEn: serverTimestamp(),
  });
}

export async function rechazarSolicitud(
  solicitudId: string,
  adminUid: string,
  notas: string,
): Promise<void> {
  await updateDoc(doc(db, 'solicitudes_factura', solicitudId), {
    estado: 'rechazada',
    notas,
    adminSubidoPor: adminUid,
    adminSubidoEn: serverTimestamp(),
  });
}

export async function marcarDescarga(solicitudId: string): Promise<void> {
  const ref = doc(db, 'solicitudes_factura', solicitudId);
  const snap = await getDocs(
    query(collections.solicitudesFactura, where('__name__', '==', solicitudId)),
  );
  if (snap.empty) return;
  const actual = (snap.docs[0].data() as SolicitudFactura).descargasRestantes;
  if (actual > 0) {
    await updateDoc(ref, { descargasRestantes: actual - 1 });
  }
}

export async function eliminarSolicitud(solicitudId: string): Promise<void> {
  await updateDoc(doc(db, 'solicitudes_factura', solicitudId), {
    estado: 'eliminada',
    eliminadaEn: serverTimestamp(),
  });
}

export async function vaciarPapelera(adminUid: string): Promise<void> {
  const q = query(
    collections.solicitudesFactura,
    where('estado', '==', 'eliminada'),
  );
  const snap = await getDocs(q);
  await Promise.all(
    snap.docs.map(d =>
      updateDoc(doc(db, 'solicitudes_factura', d.id), {
        estado: 'eliminada',
        adminSubidoPor: adminUid,
      }),
    ),
  );
}

// ─── Listeners ────────────────────────────────────────────────

export function listenMisSolicitudes(
  inquilinoId: string,
  cb: (solicitudes: SolicitudFactura[]) => void,
): () => void {
  const q = query(
    collections.solicitudesFactura,
    where('inquilinoId', '==', inquilinoId),
    orderBy('creadoEn', 'desc'),
  );
  return onSnapshot(q, snap =>
    cb(snap.docs.map(d => ({ ...(d.data() as Omit<SolicitudFactura, 'id'>), id: d.id }))),
  );
}

export function listenSolicitudesPendientes(
  cb: (solicitudes: SolicitudFactura[]) => void,
): () => void {
  const q = query(
    collections.solicitudesFactura,
    where('estado', '==', 'pendiente'),
  );
  return onSnapshot(q,
    snap => cb(snap.docs.map(d => ({ ...(d.data() as Omit<SolicitudFactura, 'id'>), id: d.id }))),
    err => console.warn('[facturas] listenPendientes error:', err.code),
  );
}

export function listenTodasSolicitudes(
  cb: (solicitudes: SolicitudFactura[]) => void,
): () => void {
  const q = query(collections.solicitudesFactura);
  return onSnapshot(q,
    snap => {
      const all = snap.docs.map(d => ({ ...(d.data() as Omit<SolicitudFactura, 'id'>), id: d.id }));
      all.sort((a, b) => (b.creadoEn?.toMillis?.() ?? 0) - (a.creadoEn?.toMillis?.() ?? 0));
      cb(all);
    },
    err => console.warn('[facturas] listenTodas error:', err.code),
  );
}

export { descripcionCFDI };
