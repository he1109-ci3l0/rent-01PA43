import {
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
  setDoc,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, collections } from './firestore';
import type { Pago, NivelScore, ScoreReputacion, ModalidadPago } from '@/types/firestore';

// ─── Score config ─────────────────────────────────────────────

export const SCORE_CONFIG: Record<NivelScore, {
  label: string;
  color: string;
  bg: string;
  puntos: [number, number];
}> = {
  pesimo:    { label: 'Pésimo',    color: '#670010', bg: 'rgba(103,0,16,0.2)', puntos: [0,  20] },
  moroso:    { label: 'Moroso',    color: '#8A6A72', bg: 'rgba(205,178,157,0.15)', puntos: [20, 40] },
  regular:   { label: 'Regular',   color: '#CDB29D', bg: 'rgba(205,178,157,0.12)', puntos: [40, 60] },
  bueno:     { label: 'Bueno',     color: '#2E3C2C', bg: '#E8EBE0', puntos: [60, 80] },
  excelente: { label: 'Excelente', color: '#4A5E48', bg: '#E0F2F1', puntos: [80, 100] },
};

export const GRADIENT_COLORS = [
  '#670010', '#8A6A72', '#CDB29D', '#2E3C2C', '#4A5E48',
] as const;

// ─── Score calculation ────────────────────────────────────────

export function calcularScore(historial: Pago[]): { nivel: NivelScore; puntos: number } {
  if (historial.length === 0) return { nivel: 'regular', puntos: 50 };

  const pagados = historial.filter(p => p.estado === 'pagado');
  const vencidos = historial.filter(p => p.estado === 'vencido');
  const rechazados = historial.filter(p => p.estado === 'rechazado');

  const aTiempo = pagados.filter(p => {
    if (!p.fechaPago) return false;
    const diasDiff = (p.fechaPago.toMillis() - p.fechaVencimiento.toMillis()) / 86_400_000;
    return diasDiff <= 3; // dentro del período de gracia
  }).length;

  const total = historial.length;
  const pctTiempo = total > 0 ? aTiempo / total : 0;
  const penalizacion = (vencidos.length * 15) + (rechazados.length * 5);
  const puntos = Math.max(0, Math.min(100, Math.round(pctTiempo * 100 - penalizacion)));

  let nivel: NivelScore;
  if (puntos < 20)       nivel = 'pesimo';
  else if (puntos < 40)  nivel = 'moroso';
  else if (puntos < 60)  nivel = 'regular';
  else if (puntos < 80)  nivel = 'bueno';
  else                   nivel = 'excelente';

  return { nivel, puntos };
}

// ─── Listeners en tiempo real ─────────────────────────────────

export function listenMisPagos(
  inquilinoId: string,
  cb: (pagos: Pago[]) => void,
): () => void {
  const q = query(
    collections.pagos,
    where('inquilinoId', '==', inquilinoId),
    orderBy('fechaVencimiento', 'desc'),
  );
  return onSnapshot(
    q,
    snap => cb(snap.docs.map(d => ({ ...(d.data() as Omit<Pago, 'id'>), id: d.id }))),
    _err => cb([]),
  );
}

export function listenTodosLosPagos(cb: (pagos: Pago[]) => void): () => void {
  const q = query(collections.pagos, orderBy('fechaVencimiento', 'desc'));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ ...(d.data() as Omit<Pago, 'id'>), id: d.id }))));
}

export function listenScore(
  inquilinoId: string,
  cb: (score: ScoreReputacion | null) => void,
): () => void {
  const q = query(collections.scores, where('inquilinoId', '==', inquilinoId));
  return onSnapshot(
    q,
    snap => {
      if (snap.empty) { cb(null); return; }
      const d = snap.docs[0];
      cb({ ...(d.data() as Omit<ScoreReputacion, 'id'>), id: d.id });
    },
    _err => cb(null),
  );
}

// ─── Acciones del inquilino ───────────────────────────────────

export async function registrarComprobante(
  pagoId: string,
  imageUri: string,
): Promise<void> {
  const storage = getStorage();
  const storageRef = ref(storage, `comprobantes/${pagoId}_${Date.now()}.jpg`);

  const resp = await fetch(imageUri);
  const blob = await resp.blob();
  await uploadBytes(storageRef, blob);
  const url = await getDownloadURL(storageRef);

  await updateDoc(doc(db, 'pagos', pagoId), {
    comprobante: url,
    comprobanteSubidoEn: serverTimestamp(),
    estado: 'en_revision',
    actualizadoEn: serverTimestamp(),
  });
}

// ─── Acciones del admin ───────────────────────────────────────

export async function verificarPago(pagoId: string, adminId: string): Promise<void> {
  await updateDoc(doc(db, 'pagos', pagoId), {
    estado: 'pagado',
    fechaPago: serverTimestamp(),
    verificadoPor: adminId,
    verificadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  });
}

export async function rechazarPago(
  pagoId: string,
  adminId: string,
  razon: string,
): Promise<void> {
  await updateDoc(doc(db, 'pagos', pagoId), {
    estado: 'rechazado',
    rechazadoPor: adminId,
    rechazadoEn: serverTimestamp(),
    rechazadoRazon: razon,
    comprobante: null,
    comprobanteSubidoEn: null,
    actualizadoEn: serverTimestamp(),
  });
}

export async function setScoreManual(
  inquilinoId: string,
  nivel: NivelScore,
  adminId: string,
): Promise<void> {
  const puntos = SCORE_CONFIG[nivel].puntos[0] + 10;
  await setDoc(
    doc(db, 'scores', inquilinoId),
    {
      inquilinoId,
      nivel,
      puntos,
      ajusteManual: true,
      ajustadoPor: adminId,
      ajustadoEn: serverTimestamp(),
      ultimaActualizacion: serverTimestamp(),
    },
    { merge: true },
  );
}

// ─── Seed de datos demo ───────────────────────────────────────

export async function seedDemoPagos(adminUid: string): Promise<void> {
  const hoy = new Date();
  const hace = (dias: number) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() - dias);
    return Timestamp.fromDate(d);
  };

  const modalidad: ModalidadPago = 'mensual';

  const pagosDemo = [
    // Inquilino demo-1: pago del mes en revisión
    {
      inquilinoId: 'demo-inquilino-1',
      habitacionId: 'hab-A101',
      inquilinoNombre: 'Carlos Mendoza',
      habitacionNumero: 'A-101',
      facturaId: null, monto: 4500, montoPagado: 4500,
      concepto: 'arriendo' as const, modalidad,
      fechaVencimiento: hace(5),
      fechaPago: null, estado: 'en_revision' as const,
      metodoPago: 'transferencia' as const,
      comprobante: 'https://picsum.photos/seed/comp1/400/600',
      comprobanteSubidoEn: hace(1),
      creadoEn: hace(30), actualizadoEn: hace(1),
    },
    // Inquilino demo-2: pago pendiente, sin comprobante
    {
      inquilinoId: 'demo-inquilino-2',
      habitacionId: 'hab-B203',
      inquilinoNombre: 'Ana Rojas',
      habitacionNumero: 'B-203',
      facturaId: null, monto: 4500, montoPagado: 0,
      concepto: 'arriendo' as const, modalidad,
      fechaVencimiento: hace(2),
      fechaPago: null, estado: 'pendiente' as const,
      metodoPago: null,
      creadoEn: hace(30), actualizadoEn: hace(2),
    },
    // Inquilino demo-3: pago vencido (>3 días gracia)
    {
      inquilinoId: 'demo-inquilino-3',
      habitacionId: 'hab-C305',
      inquilinoNombre: 'Luis Torres',
      habitacionNumero: 'C-305',
      facturaId: null, monto: 4500, montoPagado: 0,
      concepto: 'arriendo' as const, modalidad,
      fechaVencimiento: hace(12),
      fechaPago: null, estado: 'vencido' as const,
      metodoPago: null,
      creadoEn: hace(30), actualizadoEn: hace(4),
    },
    // Histórico demo-1: pagado a tiempo (mes pasado)
    {
      inquilinoId: 'demo-inquilino-1',
      habitacionId: 'hab-A101',
      inquilinoNombre: 'Carlos Mendoza',
      habitacionNumero: 'A-101',
      facturaId: null, monto: 4500, montoPagado: 4500,
      concepto: 'arriendo' as const, modalidad,
      fechaVencimiento: hace(35),
      fechaPago: hace(33), estado: 'pagado' as const,
      metodoPago: 'transferencia' as const,
      comprobante: 'https://picsum.photos/seed/comp2/400/600',
      creadoEn: hace(60), actualizadoEn: hace(33),
    },
  ];

  for (const p of pagosDemo) {
    await addDoc(collections.pagos, p as any);
  }

  // Score demo para inquilino-1
  await setDoc(doc(db, 'scores', 'demo-inquilino-1'), {
    inquilinoId: 'demo-inquilino-1',
    nivel: 'bueno' as NivelScore,
    puntos: 72,
    ajusteManual: false,
    ultimaActualizacion: serverTimestamp(),
  });
}
