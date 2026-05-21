import {
  query, where, onSnapshot,
  doc, addDoc, updateDoc, getDocs, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db, collections } from './firestore';
import type { ReservaLavanderia, EstadoReserva } from '@/types/firestore';

// ─── Tarifas y reglas ─────────────────────────────────────────

export const PRECIO_MENSUAL        = 370;
export const PRECIO_CARGA_EXTRA    = 150;
export const IVA                   = 0.16;
export const HORA_INICIO           = 8;
export const HORA_FIN              = 23;
export const MAX_CARGAS_SEMANA     = 2;
export const CARGAS_INCLUIDAS_MES  = 3;
export const DURACION_MIN          = 60;
export const MIN_ENTRE_CARGAS      = 30;
export const HRS_CONFIRMACION_AUTO = 6;
export const HRS_RECORDATORIO      = 4;

// ─── Helpers de tiempo ────────────────────────────────────────

export function inicioSemanaISO(d: Date): Date {
  const dia = new Date(d);
  dia.setHours(0, 0, 0, 0);
  const dow = dia.getDay();                    // 0=dom
  dia.setDate(dia.getDate() - ((dow + 6) % 7)); // retrocede al lunes
  return dia;
}

export function finSemanaISO(d: Date): Date {
  const inicio = inicioSemanaISO(d);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);
  fin.setHours(23, 59, 59, 999);
  return fin;
}

export function generarSlots(dia: Date): Date[] {
  const slots: Date[] = [];
  for (let h = HORA_INICIO; h < HORA_FIN; h++) {
    const slot = new Date(dia);
    slot.setHours(h, 0, 0, 0);
    slots.push(slot);
    if (h < HORA_FIN - 1) {
      const slotMedio = new Date(dia);
      slotMedio.setHours(h, 30, 0, 0);
      slots.push(slotMedio);
    }
  }
  return slots;
}

// ─── Validaciones ─────────────────────────────────────────────

export function validarHorario(fecha: Date): { valido: boolean; error?: string } {
  const hora = fecha.getHours();
  const min  = fecha.getMinutes();
  const totalMin = hora * 60 + min;
  const inicioMin = HORA_INICIO * 60;
  const finMin    = HORA_FIN * 60 - DURACION_MIN; // último inicio válido
  if (totalMin < inicioMin || totalMin > finMin) {
    return { valido: false, error: `Horario: ${HORA_INICIO}:00–${HORA_FIN}:00 hrs` };
  }
  if (fecha < new Date()) {
    return { valido: false, error: 'No se pueden hacer reservas en el pasado' };
  }
  return { valido: true };
}

export async function validarFrecuenciaSemana(
  inquilinoId: string,
  fecha: Date,
): Promise<{ valido: boolean; cargasSemana: number }> {
  const inicio = Timestamp.fromDate(inicioSemanaISO(fecha));
  const fin    = Timestamp.fromDate(finSemanaISO(fecha));
  const q = query(
    collections.reservasLavanderia,
    where('inquilinoId', '==', inquilinoId),
    where('fechaReserva', '>=', inicio),
    where('fechaReserva', '<=', fin),
    where('estado', 'in', ['pendiente', 'confirmada', 'pendiente_auth']),
  );
  const snap = await getDocs(q);
  return { valido: snap.size < MAX_CARGAS_SEMANA, cargasSemana: snap.size };
}

export async function contarCargasMes(
  inquilinoId: string,
  mes: number,
  anio: number,
): Promise<number> {
  const inicio = Timestamp.fromDate(new Date(anio, mes - 1, 1, 0, 0, 0));
  const fin    = Timestamp.fromDate(new Date(anio, mes, 0, 23, 59, 59));
  const q = query(
    collections.reservasLavanderia,
    where('inquilinoId', '==', inquilinoId),
    where('fechaReserva', '>=', inicio),
    where('fechaReserva', '<=', fin),
    where('estado', 'in', ['pendiente', 'confirmada', 'pendiente_auth', 'completada']),
  );
  const snap = await getDocs(q);
  return snap.size;
}

export async function getSlotsTomados(fecha: Date): Promise<Date[]> {
  const inicio = new Date(fecha);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(fecha);
  fin.setHours(23, 59, 59, 999);
  const q = query(
    collections.reservasLavanderia,
    where('fechaReserva', '>=', Timestamp.fromDate(inicio)),
    where('fechaReserva', '<=', Timestamp.fromDate(fin)),
    where('estado', 'in', ['pendiente', 'confirmada', 'pendiente_auth']),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => (d.data() as ReservaLavanderia).fechaReserva.toDate());
}

export function slotBloqueado(slot: Date, tomados: Date[]): boolean {
  const slotMs = slot.getTime();
  return tomados.some(t => {
    const diff = Math.abs(t.getTime() - slotMs);
    return diff < (DURACION_MIN + MIN_ENTRE_CARGAS) * 60_000;
  });
}

// ─── CRUD ─────────────────────────────────────────────────────

export async function crearReserva(data: {
  inquilinoId: string;
  habitacionId: string;
  habitacionNumero?: string;
  inquilinoNombre?: string;
  fechaReserva: Date;
  tieneAdeudo?: boolean;
  notas?: string;
}): Promise<{ id: string; estado: EstadoReserva; esCargaExtra: boolean }> {
  const val = validarHorario(data.fechaReserva);
  if (!val.valido) throw new Error(val.error);

  const freq = await validarFrecuenciaSemana(data.inquilinoId, data.fechaReserva);
  if (!freq.valido) throw new Error(`Máximo ${MAX_CARGAS_SEMANA} cargas por semana`);

  const mes  = data.fechaReserva.getMonth() + 1;
  const anio = data.fechaReserva.getFullYear();
  const cargasMes = await contarCargasMes(data.inquilinoId, mes, anio);
  const esCargaExtra = cargasMes >= CARGAS_INCLUIDAS_MES;
  const monto = esCargaExtra ? Math.round(PRECIO_CARGA_EXTRA * (1 + IVA)) : 0;

  const tieneAdeudo = data.tieneAdeudo ?? false;
  const estado: EstadoReserva = tieneAdeudo ? 'pendiente_auth' : 'pendiente';

  const payload: Omit<ReservaLavanderia, 'id'> = {
    inquilinoId:     data.inquilinoId,
    habitacionId:    data.habitacionId,
    habitacionNumero: data.habitacionNumero,
    inquilinoNombre: data.inquilinoNombre,
    fechaReserva:    Timestamp.fromDate(data.fechaReserva),
    duracionMin:     DURACION_MIN,
    estado,
    esCargaExtra,
    monto,
    tieneAdeudo,
    recordatorioEnviado: false,
    notas: data.notas,
    creadoEn: serverTimestamp() as Timestamp,
  };

  const ref = await addDoc(collections.reservasLavanderia, payload);
  return { id: ref.id, estado, esCargaExtra };
}

export async function confirmarReserva(id: string): Promise<void> {
  await updateDoc(doc(db, 'reservas_lavanderia', id), { estado: 'confirmada' });
}

export async function autorizarReserva(id: string, adminUid: string): Promise<void> {
  await updateDoc(doc(db, 'reservas_lavanderia', id), {
    estado: 'confirmada',
    adminAuthorizadoPor: adminUid,
    adminAuthorizadoEn: serverTimestamp(),
  });
}

export async function cancelarReserva(id: string, notas?: string): Promise<void> {
  await updateDoc(doc(db, 'reservas_lavanderia', id), {
    estado: 'cancelada',
    ...(notas ? { notas } : {}),
  });
}

export async function completarReserva(id: string): Promise<void> {
  await updateDoc(doc(db, 'reservas_lavanderia', id), { estado: 'completada' });
}

// ─── Listeners ────────────────────────────────────────────────

export function listenMisReservas(
  inquilinoId: string,
  cb: (reservas: ReservaLavanderia[]) => void,
): () => void {
  const q = query(
    collections.reservasLavanderia,
    where('inquilinoId', '==', inquilinoId),
  );
  return onSnapshot(q, snap => {
    const all = snap.docs.map(d => ({ ...(d.data() as Omit<ReservaLavanderia, 'id'>), id: d.id }));
    all.sort((a, b) => (b.fechaReserva?.toMillis?.() ?? 0) - (a.fechaReserva?.toMillis?.() ?? 0));
    cb(all);
  });
}

export function listenReservasHoy(cb: (reservas: ReservaLavanderia[]) => void): () => void {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date();
  fin.setHours(23, 59, 59, 999);
  const q = query(
    collections.reservasLavanderia,
    where('fechaReserva', '>=', Timestamp.fromDate(hoy)),
    where('fechaReserva', '<=', Timestamp.fromDate(fin)),
  );
  return onSnapshot(q,
    snap => {
      const all = snap.docs.map(d => ({ ...(d.data() as Omit<ReservaLavanderia, 'id'>), id: d.id }));
      all.sort((a, b) => (a.fechaReserva?.toMillis?.() ?? 0) - (b.fechaReserva?.toMillis?.() ?? 0));
      cb(all);
    },
    err => console.warn('[lavanderia] listenHoy error:', err.code),
  );
}

export function listenReservasSemana(
  inicioSem: Date,
  cb: (reservas: ReservaLavanderia[]) => void,
): () => void {
  const fin = finSemanaISO(inicioSem);
  const q = query(
    collections.reservasLavanderia,
    where('fechaReserva', '>=', Timestamp.fromDate(inicioSem)),
    where('fechaReserva', '<=', Timestamp.fromDate(fin)),
  );
  return onSnapshot(q,
    snap => {
      const all = snap.docs.map(d => ({ ...(d.data() as Omit<ReservaLavanderia, 'id'>), id: d.id }));
      all.sort((a, b) => (a.fechaReserva?.toMillis?.() ?? 0) - (b.fechaReserva?.toMillis?.() ?? 0));
      cb(all);
    },
    err => console.warn('[lavanderia] listenSemana error:', err.code),
  );
}

// ─── Seed ─────────────────────────────────────────────────────

export async function seedReservas(): Promise<void> {
  const q = query(
    collections.reservasLavanderia,
    where('inquilinoId', '==', 'demo-inquilino-seed'),
  );
  const snap = await getDocs(q);
  if (!snap.empty) return;

  const ahora = new Date();
  const demos: Omit<ReservaLavanderia, 'id'>[] = [
    {
      inquilinoId:     'demo-inquilino-1',
      habitacionId:    '05',
      habitacionNumero: '05',
      inquilinoNombre: 'Carlos Mendoza',
      fechaReserva:    Timestamp.fromDate(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 10, 0)),
      duracionMin:     60,
      estado:          'confirmada',
      esCargaExtra:    false,
      monto:           0,
      tieneAdeudo:     false,
      recordatorioEnviado: false,
      creadoEn:        Timestamp.now(),
    },
    {
      inquilinoId:     'demo-inquilino-2',
      habitacionId:    '07',
      habitacionNumero: '07',
      inquilinoNombre: 'Ana Rojas',
      fechaReserva:    Timestamp.fromDate(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 14, 0)),
      duracionMin:     60,
      estado:          'pendiente_auth',
      esCargaExtra:    false,
      monto:           0,
      tieneAdeudo:     true,
      recordatorioEnviado: false,
      creadoEn:        Timestamp.now(),
    },
    {
      inquilinoId:     'demo-inquilino-3',
      habitacionId:    '09',
      habitacionNumero: '09',
      inquilinoNombre: 'Luis Torres',
      fechaReserva:    Timestamp.fromDate(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 18, 30)),
      duracionMin:     60,
      estado:          'pendiente',
      esCargaExtra:    true,
      monto:           Math.round(PRECIO_CARGA_EXTRA * (1 + IVA)),
      tieneAdeudo:     false,
      recordatorioEnviado: false,
      creadoEn:        Timestamp.now(),
    },
    // Guard doc
    {
      inquilinoId:     'demo-inquilino-seed',
      habitacionId:    '00',
      fechaReserva:    Timestamp.now(),
      duracionMin:     0,
      estado:          'cancelada',
      esCargaExtra:    false,
      monto:           0,
      tieneAdeudo:     false,
      recordatorioEnviado: false,
      creadoEn:        Timestamp.now(),
    },
  ];

  for (const r of demos) {
    try { await addDoc(collections.reservasLavanderia, r); }
    catch (e: any) { console.error('[lavanderia] seed error:', e.code); }
  }
}
