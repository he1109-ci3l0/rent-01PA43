import {
  query, where, onSnapshot,
  doc, addDoc, updateDoc, getDocs, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db, collections } from './firestore';
import type { Visita, EstadoEstacionaria, TipoDocumento } from '@/types/firestore';

// ─── Constantes ───────────────────────────────────────────────

export const HORAS_ESTACIONARIA = {
  ALERTA_1:  40,
  ALERTA_2:  50,
  CARGO:     72,
  DEPOSITO: 102,
} as const;

export const MONTO_CARGO_ESTACIONARIA = 200;

// ─── Helpers ──────────────────────────────────────────────────

export function calcularHorasActiva(fechaEntrada: Timestamp): number {
  const ms = Date.now() - fechaEntrada.toDate().getTime();
  return ms / (1000 * 60 * 60);
}

export function calcularEstadoEstacionaria(horas: number): EstadoEstacionaria {
  if (horas >= HORAS_ESTACIONARIA.DEPOSITO) return 'deposito_102h';
  if (horas >= HORAS_ESTACIONARIA.CARGO)    return 'cargo_72h';
  if (horas >= HORAS_ESTACIONARIA.ALERTA_2) return 'alerta_50h';
  if (horas >= HORAS_ESTACIONARIA.ALERTA_1) return 'alerta_40h';
  return 'normal';
}

export async function checkEsRecurrente(
  inquilinoId: string,
  documentoNumero: string,
): Promise<boolean> {
  const q = query(
    collections.visitas,
    where('inquilinoId', '==', inquilinoId),
    where('documentoNumero', '==', documentoNumero),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ─── CRUD ─────────────────────────────────────────────────────

export async function registrarEntrada(data: {
  inquilinoId: string;
  habitacionId: string;
  habitacionNumero?: string;
  inquilinoNombre?: string;
  nombreVisitante?: string;
  documentoTipo: TipoDocumento;
  documentoNumero: string;
  telefono?: string;
  motivo?: string;
}): Promise<string> {
  const esRecurrente = await checkEsRecurrente(data.inquilinoId, data.documentoNumero);

  const payload: Omit<Visita, 'id'> = {
    inquilinoId: data.inquilinoId,
    habitacionId: data.habitacionId,
    habitacionNumero: data.habitacionNumero,
    inquilinoNombre: data.inquilinoNombre,
    nombreVisitante: data.nombreVisitante,
    documentoTipo: data.documentoTipo,
    documentoNumero: data.documentoNumero,
    telefono: data.telefono,
    motivo: data.motivo,
    fechaEntrada: serverTimestamp() as Timestamp,
    fechaSalida: null,
    registradoPor: data.inquilinoId,
    esRecurrente,
    estadoEstacionaria: 'normal',
    cargoEstacionaria: null,
    cargoEstacionariaPagado: false,
    rutaElegida: null,
    perfilTemporalCreado: false,
    creadoEn: serverTimestamp() as Timestamp,
  };

  const ref = await addDoc(collections.visitas, payload);
  return ref.id;
}

export async function registrarSalida(visitaId: string): Promise<void> {
  await updateDoc(doc(db, 'visitas', visitaId), {
    fechaSalida: serverTimestamp(),
    estadoEstacionaria: 'normal',
  });
}

export async function elegirRuta(visitaId: string, ruta: 'A' | 'B'): Promise<void> {
  await updateDoc(doc(db, 'visitas', visitaId), {
    rutaElegida: ruta,
  });
}

export async function marcarCargo72h(visitaId: string): Promise<void> {
  await updateDoc(doc(db, 'visitas', visitaId), {
    estadoEstacionaria: 'cargo_72h',
    cargoEstacionaria: MONTO_CARGO_ESTACIONARIA,
    perfilTemporalCreado: true,
  });
}

// ─── Listeners ────────────────────────────────────────────────

export function listenMisVisitas(
  inquilinoId: string,
  cb: (visitas: Visita[]) => void,
): () => void {
  const q = query(
    collections.visitas,
    where('inquilinoId', '==', inquilinoId),
  );
  return onSnapshot(q, snap => {
    const ahora = Date.now();
    const limite72h = ahora - 72 * 60 * 60 * 1000;
    const todas = snap.docs.map(d => ({ ...(d.data() as Omit<Visita, 'id'>), id: d.id }));
    const filtradas = todas.filter(v => {
      if (!v.fechaSalida) return true;
      return v.fechaSalida.toDate().getTime() >= limite72h;
    });
    const ordenadas = filtradas.sort((a, b) => {
      const ta = a.fechaEntrada?.toDate?.()?.getTime() ?? 0;
      const tb = b.fechaEntrada?.toDate?.()?.getTime() ?? 0;
      return tb - ta;
    });
    cb(ordenadas);
  });
}

export function listenTodasVisitasActivas(
  cb: (visitas: Visita[]) => void,
): () => void {
  const q = query(
    collections.visitas,
    where('fechaSalida', '==', null),
  );
  return onSnapshot(q,
    snap => {
      const visitas = snap.docs.map(d => ({ ...(d.data() as Omit<Visita, 'id'>), id: d.id }));
      visitas.sort((a, b) => {
        const ta = a.fechaEntrada?.toMillis?.() ?? 0;
        const tb = b.fechaEntrada?.toMillis?.() ?? 0;
        return ta - tb; // más antiguas primero (más críticas)
      });
      cb(visitas);
    },
    err => console.warn('[visitas] listenTodasVisitasActivas error:', err.code),
  );
}

// ─── Seed ─────────────────────────────────────────────────────

export async function seedVisitas(): Promise<void> {
  const q = query(
    collections.visitas,
    where('documentoNumero', '==', 'SEED-003'),
  );
  const snap = await getDocs(q);
  if (!snap.empty) return;

  const ahora = Date.now();

  const demos: Omit<Visita, 'id'>[] = [
    {
      inquilinoId: 'demo-inquilino-1',
      habitacionId: '05',
      habitacionNumero: '05',
      inquilinoNombre: 'Carlos Mendoza',
      nombreVisitante: 'Juan García',
      documentoTipo: 'CC',
      documentoNumero: 'SEED-001',
      motivo: 'Visita familiar',
      fechaEntrada: Timestamp.fromDate(new Date(ahora - 2 * 60 * 60 * 1000)),
      fechaSalida: null,
      registradoPor: 'demo-inquilino-1',
      esRecurrente: false,
      estadoEstacionaria: 'normal',
      cargoEstacionaria: null,
      cargoEstacionariaPagado: false,
      rutaElegida: null,
      perfilTemporalCreado: false,
      creadoEn: Timestamp.fromDate(new Date(ahora - 2 * 60 * 60 * 1000)),
    },
    {
      inquilinoId: 'demo-inquilino-2',
      habitacionId: '07',
      habitacionNumero: '07',
      inquilinoNombre: 'Ana Rojas',
      nombreVisitante: 'María López',
      documentoTipo: 'CC',
      documentoNumero: 'SEED-002',
      motivo: 'Recurrente',
      fechaEntrada: Timestamp.fromDate(new Date(ahora - 42 * 60 * 60 * 1000)),
      fechaSalida: null,
      registradoPor: 'demo-inquilino-2',
      esRecurrente: true,
      estadoEstacionaria: 'alerta_40h',
      cargoEstacionaria: null,
      cargoEstacionariaPagado: false,
      rutaElegida: null,
      perfilTemporalCreado: false,
      creadoEn: Timestamp.fromDate(new Date(ahora - 42 * 60 * 60 * 1000)),
    },
    {
      inquilinoId: 'demo-inquilino-3',
      habitacionId: '09',
      habitacionNumero: '09',
      inquilinoNombre: 'Luis Torres',
      documentoTipo: 'CC',
      documentoNumero: 'SEED-003',
      fechaEntrada: Timestamp.fromDate(new Date(ahora - 75 * 60 * 60 * 1000)),
      fechaSalida: null,
      registradoPor: 'demo-inquilino-3',
      esRecurrente: false,
      estadoEstacionaria: 'cargo_72h',
      cargoEstacionaria: MONTO_CARGO_ESTACIONARIA,
      cargoEstacionariaPagado: false,
      rutaElegida: null,
      perfilTemporalCreado: true,
      creadoEn: Timestamp.fromDate(new Date(ahora - 75 * 60 * 60 * 1000)),
    },
  ];

  for (const v of demos) {
    try {
      await addDoc(collections.visitas, v);
    } catch (e: any) {
      console.error('[visitas] seed addDoc failed:', e.code, e.message);
    }
  }
}
