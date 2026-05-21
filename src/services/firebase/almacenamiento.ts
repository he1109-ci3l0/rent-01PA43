import {
  doc, setDoc, updateDoc, getDocs, onSnapshot,
  query, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db, collections } from './firestore';
import type {
  EspacioAlmacenamiento, TipoEspacio, ModalidadEspacio, Inquilino,
} from '@/types/firestore';

// ─── Tarifas ──────────────────────────────────────────────────

export const PRECIO_SEMANA         = 78;
export const PRECIO_MES            = 240;
export const IVA                   = 0.16;
export const TOTAL_ESPACIOS        = 15;
export const FACTURADOR            = 'Servicios Kadamees Integrales';
export const HRS_AVISO_VENCIMIENTO = 24;

export function montoConIva(modalidad: ModalidadEspacio): number {
  return Math.round((modalidad === 'semanal' ? PRECIO_SEMANA : PRECIO_MES) * (1 + IVA));
}

export function calcFechaVencimiento(modalidad: ModalidadEspacio, desde = new Date()): Date {
  const d = new Date(desde);
  if (modalidad === 'semanal') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export function espacioDocId(tipo: TipoEspacio, numero: number): string {
  return `${tipo}_${numero.toString().padStart(2, '0')}`;
}

export function numerosLibres(
  espacios: EspacioAlmacenamiento[],
  tipo: TipoEspacio,
): number[] {
  const ocupados = new Set(
    espacios.filter(e => e.tipo === tipo && e.estado === 'ocupado').map(e => e.numero),
  );
  return Array.from({ length: TOTAL_ESPACIOS }, (_, i) => i + 1).filter(n => !ocupados.has(n));
}

export function espaciosProximosVencer(
  espacios: EspacioAlmacenamiento[],
): EspacioAlmacenamiento[] {
  const limite = Date.now() + HRS_AVISO_VENCIMIENTO * 3_600_000;
  return espacios.filter(
    e =>
      e.estado === 'ocupado' &&
      e.fechaVencimiento != null &&
      e.fechaVencimiento.toMillis() <= limite,
  );
}

// ─── Seed (solo admin) ────────────────────────────────────────

export async function seedEspacios(): Promise<void> {
  const snap = await getDocs(collections.espaciosAlmacenamiento);
  if (!snap.empty) return;

  const tipos: TipoEspacio[] = ['locker', 'refrigerador'];
  const base = {
    estado: 'libre' as const,
    inquilinoId: null,
    inquilinoNombre: null,
    habitacionNumero: null,
    modalidad: null,
    fechaInicio: null,
    fechaVencimiento: null,
    monto: 0,
    avisoEnviado: false,
    creadoEn: Timestamp.now(),
    actualizadoEn: Timestamp.now(),
  };

  for (const tipo of tipos) {
    for (let n = 1; n <= TOTAL_ESPACIOS; n++) {
      await setDoc(
        doc(db, 'espacios_almacenamiento', espacioDocId(tipo, n)),
        { ...base, tipo, numero: n },
      );
    }
  }
}

// ─── Listeners ────────────────────────────────────────────────

export function listenEspacios(
  cb: (espacios: EspacioAlmacenamiento[]) => void,
): () => void {
  return onSnapshot(
    collections.espaciosAlmacenamiento,
    snap => {
      const all = snap.docs.map(d => ({
        ...(d.data() as Omit<EspacioAlmacenamiento, 'id'>),
        id: d.id,
      }));
      all.sort((a, b) =>
        a.tipo !== b.tipo ? a.tipo.localeCompare(b.tipo) : a.numero - b.numero,
      );
      cb(all);
    },
    err => console.warn('[almacenamiento] listen error:', err.code),
  );
}

// ─── CRUD ─────────────────────────────────────────────────────

export async function asignarEspacio(params: {
  espacioId: string;
  inquilinoId: string;
  inquilinoNombre: string;
  habitacionNumero?: string;
  modalidad: ModalidadEspacio;
}): Promise<void> {
  await updateDoc(doc(db, 'espacios_almacenamiento', params.espacioId), {
    estado: 'ocupado',
    inquilinoId: params.inquilinoId,
    inquilinoNombre: params.inquilinoNombre,
    habitacionNumero: params.habitacionNumero ?? null,
    modalidad: params.modalidad,
    fechaInicio: serverTimestamp(),
    fechaVencimiento: Timestamp.fromDate(calcFechaVencimiento(params.modalidad)),
    monto: montoConIva(params.modalidad),
    avisoEnviado: false,
    actualizadoEn: serverTimestamp(),
  });
}

export async function liberarEspacio(espacioId: string): Promise<void> {
  await updateDoc(doc(db, 'espacios_almacenamiento', espacioId), {
    estado: 'libre',
    inquilinoId: null,
    inquilinoNombre: null,
    habitacionNumero: null,
    modalidad: null,
    fechaInicio: null,
    fechaVencimiento: null,
    monto: 0,
    avisoEnviado: false,
    actualizadoEn: serverTimestamp(),
  });
}

export async function renovarEspacio(
  espacioId: string,
  modalidad: ModalidadEspacio,
): Promise<void> {
  await updateDoc(doc(db, 'espacios_almacenamiento', espacioId), {
    modalidad,
    fechaVencimiento: Timestamp.fromDate(calcFechaVencimiento(modalidad)),
    monto: montoConIva(modalidad),
    avisoEnviado: false,
    actualizadoEn: serverTimestamp(),
  });
}

export async function getInquilinos(): Promise<Inquilino[]> {
  const q = query(collections.inquilinos, where('estado', '==', 'activo'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    ...(d.data() as Omit<Inquilino, 'id'>),
    id: d.id,
  }));
}
