import {
  query, where, orderBy, onSnapshot,
  doc, addDoc, updateDoc, getDocs, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db, collections } from './firestore';
import type { HuespedExtra, SemanaIngreso } from '@/types/firestore';

// ─── Tabla de cobros ──────────────────────────────────────────

export const TABLA_COBROS: Record<SemanaIngreso, {
  semana: number;
  mensual: number;
  requiereAuth: boolean;
  label: string;
  diasRango: string;
}> = {
  1: { semana: 700, mensual: 500, requiereAuth: false, label: 'Semana 1', diasRango: 'días 1–7' },
  2: { semana: 700, mensual: 500, requiereAuth: true,  label: 'Semana 2', diasRango: 'días 8–14' },
  3: { semana: 700, mensual: 500, requiereAuth: true,  label: 'Semana 3', diasRango: 'días 15–21' },
  4: { semana: 0,   mensual: 500, requiereAuth: false, label: 'Semana 4', diasRango: 'días 22–31' },
};

// ─── Helpers ──────────────────────────────────────────────────

export function calcularSemanaIngreso(fecha: Date): SemanaIngreso {
  const day = fecha.getDate();
  if (day <= 7)  return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

// ─── CRUD ─────────────────────────────────────────────────────

export async function registrarHuespedExtra(
  data: Pick<HuespedExtra,
    'inquilinoId' | 'habitacionId' | 'nombre' | 'apellido' |
    'documentoTipo' | 'documentoNumero' | 'fechaEntrada'
  > & {
    habitacionNumero?: string;
    inquilinoNombre?: string;
    parentesco?: string;
  },
): Promise<{ id: string; semana: SemanaIngreso; requiereAuth: boolean }> {
  const fechaDate = (data.fechaEntrada as Timestamp).toDate();
  const semana = calcularSemanaIngreso(fechaDate);
  const cobros = TABLA_COBROS[semana];

  const payload: Omit<HuespedExtra, 'id'> = {
    inquilinoId: data.inquilinoId,
    habitacionId: data.habitacionId,
    habitacionNumero: data.habitacionNumero,
    inquilinoNombre: data.inquilinoNombre,
    nombre: data.nombre,
    apellido: data.apellido,
    documentoTipo: data.documentoTipo,
    documentoNumero: data.documentoNumero,
    parentesco: data.parentesco,
    fechaEntrada: data.fechaEntrada,
    fechaSalida: null,
    activo: true,
    semanaIngreso: semana,
    modalidad: semana === 4 ? 'mensual' : 'temporal',
    estado: cobros.requiereAuth ? 'pendiente_auth' : 'activo',
    montoSemana: cobros.semana,
    montoMensual: cobros.mensual,
    promoOfrecida: false,
    promoAceptada: null,
    promoTimestamp: null,
    requiereAuth: cobros.requiereAuth,
    adminAuthorizadoPor: null,
    adminAuthorizadoEn: null,
    incorporadoExpediente: semana === 4,
    creadoEn: serverTimestamp() as Timestamp,
  };

  const ref = await addDoc(collections.huespedesExtra, payload);
  return { id: ref.id, semana, requiereAuth: cobros.requiereAuth };
}

export async function ofrecerPromo(id: string): Promise<void> {
  await updateDoc(doc(db, 'huespedes_extra', id), {
    promoOfrecida: true,
    promoTimestamp: serverTimestamp(),
  });
}

export async function responderPromo(id: string, aceptada: boolean): Promise<void> {
  await updateDoc(doc(db, 'huespedes_extra', id), {
    promoAceptada: aceptada,
    promoTimestamp: serverTimestamp(),
    ...(aceptada ? {
      modalidad: 'mensual',
      estado: 'incorporado',
      incorporadoExpediente: true,
    } : {}),
  });
}

export async function autorizarHuesped(id: string, adminUid: string): Promise<void> {
  await updateDoc(doc(db, 'huespedes_extra', id), {
    estado: 'activo',
    adminAuthorizadoPor: adminUid,
    adminAuthorizadoEn: serverTimestamp(),
  });
}

export async function rechazarHuesped(
  id: string,
  adminUid: string,
  notas: string,
): Promise<void> {
  await updateDoc(doc(db, 'huespedes_extra', id), {
    estado: 'inactivo',
    activo: false,
    adminAuthorizadoPor: adminUid,
    adminAuthorizadoEn: serverTimestamp(),
    adminNotas: notas,
  });
}

export async function incorporarAMensual(id: string): Promise<void> {
  await updateDoc(doc(db, 'huespedes_extra', id), {
    modalidad: 'mensual',
    estado: 'incorporado',
    incorporadoExpediente: true,
  });
}

// ─── Listeners ────────────────────────────────────────────────

export function listenMisHuespedes(
  inquilinoId: string,
  cb: (huespedes: HuespedExtra[]) => void,
): () => void {
  const q = query(
    collections.huespedesExtra,
    where('inquilinoId', '==', inquilinoId),
    orderBy('creadoEn', 'desc'),
  );
  return onSnapshot(q, snap =>
    cb(snap.docs.map(d => ({ ...(d.data() as Omit<HuespedExtra, 'id'>), id: d.id }))),
  );
}

export function listenTodosHuespedes(
  cb: (huespedes: HuespedExtra[]) => void,
): () => void {
  // No orderBy to avoid index requirement on a fresh collection
  const q = query(collections.huespedesExtra);
  return onSnapshot(q,
    snap => cb(snap.docs.map(d => ({ ...(d.data() as Omit<HuespedExtra, 'id'>), id: d.id }))),
    err => console.warn('[huespedes] listenTodosHuespedes error:', err.code),
  );
}

// ─── Seed ─────────────────────────────────────────────────────

export async function seedHuespedes(): Promise<void> {
  const q = query(
    collections.huespedesExtra,
    where('habitacionId', '==', '05'),
  );
  const snap = await getDocs(q);
  if (!snap.empty) return;

  const ahora = Timestamp.now();

  const demos: Omit<HuespedExtra, 'id'>[] = [
    {
      inquilinoId: 'demo-inquilino-1',
      habitacionId: '05',
      habitacionNumero: '05',
      inquilinoNombre: 'Carlos Mendoza',
      nombre: 'Sofía',
      apellido: 'Mendoza',
      documentoTipo: 'CC',
      documentoNumero: '1234567890',
      parentesco: 'Hermana',
      fechaEntrada: ahora,
      fechaSalida: null,
      activo: true,
      semanaIngreso: 1,
      modalidad: 'temporal',
      estado: 'activo',
      montoSemana: 700,
      montoMensual: 500,
      promoOfrecida: true,
      promoAceptada: null,
      promoTimestamp: ahora,
      requiereAuth: false,
      adminAuthorizadoPor: null,
      adminAuthorizadoEn: null,
      incorporadoExpediente: false,
      creadoEn: ahora,
    },
    {
      inquilinoId: 'demo-inquilino-2',
      habitacionId: '07',
      habitacionNumero: '07',
      inquilinoNombre: 'Ana Rojas',
      nombre: 'Pedro',
      apellido: 'Rojas',
      documentoTipo: 'CC',
      documentoNumero: '9876543210',
      parentesco: 'Hermano',
      fechaEntrada: ahora,
      fechaSalida: null,
      activo: true,
      semanaIngreso: 2,
      modalidad: 'temporal',
      estado: 'pendiente_auth',
      montoSemana: 700,
      montoMensual: 500,
      promoOfrecida: false,
      promoAceptada: null,
      promoTimestamp: null,
      requiereAuth: true,
      adminAuthorizadoPor: null,
      adminAuthorizadoEn: null,
      incorporadoExpediente: false,
      creadoEn: ahora,
    },
    {
      inquilinoId: 'demo-inquilino-3',
      habitacionId: '09',
      habitacionNumero: '09',
      inquilinoNombre: 'Luis Torres',
      nombre: 'Camila',
      apellido: 'Torres',
      documentoTipo: 'CC',
      documentoNumero: '5551234567',
      parentesco: 'Pareja',
      fechaEntrada: ahora,
      fechaSalida: null,
      activo: true,
      semanaIngreso: 3,
      modalidad: 'temporal',
      estado: 'pendiente_auth',
      montoSemana: 700,
      montoMensual: 500,
      promoOfrecida: false,
      promoAceptada: null,
      promoTimestamp: null,
      requiereAuth: true,
      adminAuthorizadoPor: null,
      adminAuthorizadoEn: null,
      incorporadoExpediente: false,
      creadoEn: ahora,
    },
  ];

  for (const h of demos) {
    try {
      await addDoc(collections.huespedesExtra, h);
    } catch (e: any) {
      console.error('[huespedes] seed addDoc failed:', e.code, e.message);
    }
  }
}
