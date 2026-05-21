import {
  doc, collection, addDoc, updateDoc, getDocs,
  onSnapshot, query, where, orderBy, Timestamp,
} from 'firebase/firestore';
import { db, collections } from './firestore';
import type {
  TurnoLimpieza, PermutaLimpieza, AreaLimpieza,
  TipoAreaLimpieza, Inquilino, Habitacion,
} from '@/types/firestore';

// ─── Constantes ───────────────────────────────────────────────

export const INTERVALO_BANO         = 3;   // días
export const INTERVALO_COCINA       = 3;   // días
export const INTERVALO_AREA_COMUN   = 14;  // días
export const MIN_SEMANAS_MISMO_INQ  = 3;   // semanas mínimas entre turnos área común
export const HORAS_LIMITE_FOTO      = 12;
export const MAX_INCUMPLIMIENTOS_MES = 3;

export const AREA_LABELS: Record<AreaLimpieza, string> = {
  bano_1_pb:    'Baño 1 PB',
  bano_2_pb:    'Baño 2 PB',
  bano_gris:    'Baño Gris',
  bano_marron:  'Baño Marrón',
  bano_terraza: 'Baño Terraza',
  cocina_pb:    'Cocina PB',
  cocina_tp:    'Cocina TP',
  pasillo:      'Pasillos',
  escalera:     'Escaleras',
  patio:        'Patio',
  tendedero:    'Tendedero',
};

export const AREA_ICONS: Record<AreaLimpieza, string> = {
  bano_1_pb:    'water-outline',
  bano_2_pb:    'water-outline',
  bano_gris:    'water-outline',
  bano_marron:  'water-outline',
  bano_terraza: 'water-outline',
  cocina_pb:    'flame-outline',
  cocina_tp:    'flame-outline',
  pasillo:      'footsteps-outline',
  escalera:     'arrow-up-outline',
  patio:        'leaf-outline',
  tendedero:    'shirt-outline',
};

export const TIPO_AREA: Record<AreaLimpieza, TipoAreaLimpieza> = {
  bano_1_pb:    'bano',
  bano_2_pb:    'bano',
  bano_gris:    'bano',
  bano_marron:  'bano',
  bano_terraza: 'bano',
  cocina_pb:    'cocina',
  cocina_tp:    'cocina',
  pasillo:      'area_comun',
  escalera:     'area_comun',
  patio:        'area_comun',
  tendedero:    'area_comun',
};

export const AREAS_COMUNES: AreaLimpieza[] = ['pasillo', 'escalera', 'patio', 'tendedero'];

// ─── Helpers ──────────────────────────────────────────────────

export function fotoVencida(turno: TurnoLimpieza): boolean {
  if (turno.estado !== 'pendiente') return false;
  const limite = turno.fechaProgramada.toMillis() + HORAS_LIMITE_FOTO * 3_600_000;
  return Date.now() > limite;
}

export function dentroVentanaFoto(turno: TurnoLimpieza): boolean {
  if (turno.estado !== 'pendiente') return false;
  const inicio = turno.fechaProgramada.toMillis();
  const fin    = inicio + HORAS_LIMITE_FOTO * 3_600_000;
  const ahora  = Date.now();
  return ahora >= inicio && ahora <= fin;
}

export function formatFechaTurno(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function turnoDocId(area: string, inquilinoId: string, fecha: Date): string {
  const d = fecha.toISOString().slice(0, 10).replace(/-/g, '');
  return `${area}_${inquilinoId.slice(0, 8)}_${d}`;
}

// ─── Seed calendario ──────────────────────────────────────────
// Genera 60 días hacia adelante para todas las áreas.
// Idempotente: doc IDs deterministas → re-run no duplica.

export async function seedTurnos(): Promise<void> {
  const snap = await getDocs(collections.turnosLimpieza);
  if (!snap.empty) return;

  const [inqSnap, habSnap] = await Promise.all([
    getDocs(query(collections.inquilinos, where('estado', '==', 'activo'))),
    getDocs(collections.habitaciones),
  ]);

  const inquilinos: Inquilino[] = inqSnap.docs.map(d => ({ ...(d.data() as any), id: d.id }));
  const habitaciones: Habitacion[] = habSnap.docs.map(d => ({ ...(d.data() as any), id: d.id }));

  if (inquilinos.length === 0) return;

  const habMap = new Map<string, Habitacion>();
  habitaciones.forEach(h => habMap.set(h.id, h));

  const base = {
    estado: 'pendiente' as const,
    fotoUrl: null,
    fotoSubidaEn: null,
    privacidad: false,
    creadoEn: Timestamp.now(),
    actualizadoEn: Timestamp.now(),
  };

  const hoy   = new Date(); hoy.setHours(0, 0, 0, 0);
  const fin60 = addDays(hoy, 60);
  const writes: Array<() => Promise<void>> = [];

  // ── Baños ──────────────────────────────────────────────────
  const banoGrupos: Record<string, Inquilino[]> = {
    bano_gris:    [],
    bano_marron:  [],
    bano_terraza: [],
  };

  for (const inq of inquilinos) {
    const hab = inq.habitacionId ? habMap.get(inq.habitacionId) : undefined;
    if (!hab) continue;
    if (hab.bano === 'Baño gris')    banoGrupos['bano_gris'].push(inq);
    if (hab.bano === 'Baño marrón')  banoGrupos['bano_marron'].push(inq);
    if (hab.bano === 'Baño terraza') banoGrupos['bano_terraza'].push(inq);
  }

  for (const [areaKey, grupo] of Object.entries(banoGrupos)) {
    if (grupo.length === 0) continue;
    const area = areaKey as AreaLimpieza;
    let cursor = new Date(hoy);
    let idx    = 0;
    while (cursor <= fin60) {
      const inq = grupo[idx % grupo.length];
      const hab = habMap.get(inq.habitacionId!)!;
      const id  = turnoDocId(area, inq.uid, cursor);
      const d   = new Date(cursor);
      writes.push(() => import('firebase/firestore').then(({ setDoc, doc: _doc }) =>
        setDoc(
          _doc(db, 'turnos_limpieza', id),
          {
            ...base,
            area,
            tipo: 'bano' as TipoAreaLimpieza,
            inquilinoId:      inq.uid,
            inquilinoNombre:  `${inq.nombre} ${inq.apellido}`.trim(),
            habitacionNumero: hab.numero,
            fechaProgramada:  Timestamp.fromDate(d),
            horaInicio:       '08:00',
          },
          { merge: true },
        )
      ));
      cursor = addDays(cursor, INTERVALO_BANO);
      idx++;
    }
  }

  // ── Cocinas ────────────────────────────────────────────────
  const cocinaGrupos: Record<string, Inquilino[]> = {
    cocina_pb: [],
    cocina_tp: [],
  };

  for (const inq of inquilinos) {
    const hab = inq.habitacionId ? habMap.get(inq.habitacionId) : undefined;
    if (!hab) continue;
    if (hab.cocina === 'CocinaPB') cocinaGrupos['cocina_pb'].push(inq);
    if (hab.cocina === 'CocinaTP') cocinaGrupos['cocina_tp'].push(inq);
  }

  for (const [areaKey, grupo] of Object.entries(cocinaGrupos)) {
    if (grupo.length === 0) continue;
    const area = areaKey as AreaLimpieza;
    let cursor = new Date(hoy);
    let idx    = 0;
    while (cursor <= fin60) {
      const inq = grupo[idx % grupo.length];
      const hab = habMap.get(inq.habitacionId!)!;
      const id  = turnoDocId(area, inq.uid, cursor);
      const d   = new Date(cursor);
      writes.push(() => import('firebase/firestore').then(({ setDoc, doc: _doc }) =>
        setDoc(
          _doc(db, 'turnos_limpieza', id),
          {
            ...base,
            area,
            tipo: 'cocina' as TipoAreaLimpieza,
            inquilinoId:      inq.uid,
            inquilinoNombre:  `${inq.nombre} ${inq.apellido}`.trim(),
            habitacionNumero: hab.numero,
            fechaProgramada:  Timestamp.fromDate(d),
            horaInicio:       '09:00',
          },
          { merge: true },
        )
      ));
      cursor = addDays(cursor, INTERVALO_COCINA);
      idx++;
    }
  }

  // ── Áreas comunes ──────────────────────────────────────────
  const shuffled = [...inquilinos].sort(() => Math.random() - 0.5);
  // Track last turn per (area, inquilino) to respect 3-week minimum gap
  const lastTurno: Map<string, Date> = new Map();

  for (const area of AREAS_COMUNES) {
    let cursor = new Date(hoy);
    let inqIdx = 0;
    while (cursor <= fin60) {
      // Find an eligible tenant: last turn in this area >= 3 weeks ago
      let assigned: Inquilino | null = null;
      for (let attempt = 0; attempt < shuffled.length; attempt++) {
        const candidate = shuffled[(inqIdx + attempt) % shuffled.length];
        if (!candidate.habitacionId) continue;
        const key = `${area}_${candidate.uid}`;
        const last = lastTurno.get(key);
        if (!last || (cursor.getTime() - last.getTime()) >= MIN_SEMANAS_MISMO_INQ * 7 * 86_400_000) {
          assigned = candidate;
          inqIdx   = (inqIdx + attempt + 1) % shuffled.length;
          break;
        }
      }
      if (!assigned) { cursor = addDays(cursor, INTERVALO_AREA_COMUN); continue; }

      const hab = habMap.get(assigned.habitacionId!)!;
      const id  = turnoDocId(area, assigned.uid, cursor);
      const d   = new Date(cursor);
      lastTurno.set(`${area}_${assigned.uid}`, d);
      writes.push(() => import('firebase/firestore').then(({ setDoc, doc: _doc }) =>
        setDoc(
          _doc(db, 'turnos_limpieza', id),
          {
            ...base,
            area,
            tipo: 'area_comun' as TipoAreaLimpieza,
            inquilinoId:      assigned!.uid,
            inquilinoNombre:  `${assigned!.nombre} ${assigned!.apellido}`.trim(),
            habitacionNumero: hab.numero,
            fechaProgramada:  Timestamp.fromDate(d),
            horaInicio:       '10:00',
          },
          { merge: true },
        )
      ));
      cursor = addDays(cursor, INTERVALO_AREA_COMUN);
    }
  }

  // Ejecutar en bloques de 5 para no saturar
  for (let i = 0; i < writes.length; i += 5) {
    await Promise.all(writes.slice(i, i + 5).map(fn => fn()));
  }
}

// ─── Listeners ────────────────────────────────────────────────

export function listenMisTurnos(
  inquilinoId: string,
  cb: (turnos: TurnoLimpieza[]) => void,
): () => void {
  const q = query(
    collections.turnosLimpieza,
    where('inquilinoId', '==', inquilinoId),
    orderBy('fechaProgramada', 'asc'),
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ ...(d.data() as Omit<TurnoLimpieza, 'id'>), id: d.id })));
  }, err => console.warn('[limpieza] listen mis turnos:', err.code));
}

export function listenTodosTurnos(
  cb: (turnos: TurnoLimpieza[]) => void,
): () => void {
  const q = query(
    collections.turnosLimpieza,
    orderBy('fechaProgramada', 'asc'),
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ ...(d.data() as Omit<TurnoLimpieza, 'id'>), id: d.id })));
  }, err => console.warn('[limpieza] listen todos:', err.code));
}

export function listenPermutasPendientes(
  cb: (permutas: PermutaLimpieza[]) => void,
): () => void {
  const q = query(
    collections.permutasLimpieza,
    where('estado', '==', 'pendiente'),
    orderBy('creadoEn', 'desc'),
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ ...(d.data() as Omit<PermutaLimpieza, 'id'>), id: d.id })));
  }, err => console.warn('[limpieza] listen permutas:', err.code));
}

// ─── Mutaciones inquilino ─────────────────────────────────────

export async function subirFotoTurno(
  turnoId: string,
  fotoUrl: string,
): Promise<void> {
  await updateDoc(doc(db, 'turnos_limpieza', turnoId), {
    fotoUrl,
    fotoSubidaEn: Timestamp.now(),
    estado: 'completado',
    actualizadoEn: Timestamp.now(),
  });
}

export async function togglePrivacidad(
  turnoId: string,
  privacidad: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'turnos_limpieza', turnoId), {
    privacidad,
    actualizadoEn: Timestamp.now(),
  });
}

export async function actualizarHora(
  turnoId: string,
  horaInicio: string,
): Promise<void> {
  await updateDoc(doc(db, 'turnos_limpieza', turnoId), {
    horaInicio,
    actualizadoEn: Timestamp.now(),
  });
}

export async function solicitarPermuta(params: {
  solicitanteId: string;
  solicitanteNombre: string;
  solicitanteHab: string;
  turnoOrigenId: string;
  turnoOrigenFecha: Timestamp;
  inquilinoDestinoId: string;
  inquilinoDestinoNombre: string;
  inquilinoDestinoHab: string;
  turnoDestinoId?: string;
}): Promise<void> {
  await addDoc(collection(db, 'permutas_limpieza'), {
    ...params,
    turnoDestinoId: params.turnoDestinoId ?? null,
    estado: 'pendiente',
    adminVio: false,
    creadoEn: Timestamp.now(),
    actualizadoEn: Timestamp.now(),
  });
}

// ─── Mutaciones admin ─────────────────────────────────────────

export async function moverTurno(
  turnoId: string,
  nuevaFecha: Date,
  nuevaHora: string,
): Promise<void> {
  await updateDoc(doc(db, 'turnos_limpieza', turnoId), {
    fechaProgramada: Timestamp.fromDate(nuevaFecha),
    horaInicio: nuevaHora,
    actualizadoEn: Timestamp.now(),
  });
}

export async function marcarIncumplimiento(turnoId: string): Promise<void> {
  await updateDoc(doc(db, 'turnos_limpieza', turnoId), {
    estado: 'incumplimiento',
    actualizadoEn: Timestamp.now(),
  });
}

export async function aprobarPermuta(permuta: PermutaLimpieza): Promise<void> {
  const ref = doc(db, 'permutas_limpieza', permuta.id);
  await updateDoc(ref, {
    estado: 'aprobada',
    adminVio: true,
    actualizadoEn: Timestamp.now(),
  });
  // Intercambiar fechas y horas de los turnos
  if (permuta.turnoDestinoId) {
    const [origSnap, destSnap] = await Promise.all([
      import('firebase/firestore').then(({ getDoc, doc: _doc }) =>
        getDoc(_doc(db, 'turnos_limpieza', permuta.turnoOrigenId))),
      import('firebase/firestore').then(({ getDoc, doc: _doc }) =>
        getDoc(_doc(db, 'turnos_limpieza', permuta.turnoDestinoId!))),
    ]);
    if (origSnap.exists() && destSnap.exists()) {
      const orig = origSnap.data() as TurnoLimpieza;
      const dest = destSnap.data() as TurnoLimpieza;
      await Promise.all([
        updateDoc(doc(db, 'turnos_limpieza', permuta.turnoOrigenId), {
          fechaProgramada: dest.fechaProgramada,
          horaInicio: dest.horaInicio,
          actualizadoEn: Timestamp.now(),
        }),
        updateDoc(doc(db, 'turnos_limpieza', permuta.turnoDestinoId!), {
          fechaProgramada: orig.fechaProgramada,
          horaInicio: orig.horaInicio,
          actualizadoEn: Timestamp.now(),
        }),
      ]);
    }
  }
}

export async function bloquearPermuta(permuta: PermutaLimpieza): Promise<void> {
  // Bloqueo silencioso: estado = bloqueada, no se notifica al inquilino
  await updateDoc(doc(db, 'permutas_limpieza', permuta.id), {
    estado: 'bloqueada',
    adminVio: true,
    actualizadoEn: Timestamp.now(),
  });
}

// ─── Queries ──────────────────────────────────────────────────

export async function getIncumplimientosMes(
  inquilinoId: string,
  mes: number,
  anio: number,
): Promise<TurnoLimpieza[]> {
  const inicio = new Date(anio, mes - 1, 1);
  const fin    = new Date(anio, mes, 0, 23, 59, 59);
  const q = query(
    collections.turnosLimpieza,
    where('inquilinoId', '==', inquilinoId),
    where('estado', '==', 'incumplimiento'),
    where('fechaProgramada', '>=', Timestamp.fromDate(inicio)),
    where('fechaProgramada', '<=', Timestamp.fromDate(fin)),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...(d.data() as Omit<TurnoLimpieza, 'id'>), id: d.id }));
}

export function listenIncumplimientos(
  cb: (turnos: TurnoLimpieza[]) => void,
): () => void {
  const q = query(
    collections.turnosLimpieza,
    where('estado', '==', 'incumplimiento'),
    orderBy('fechaProgramada', 'desc'),
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ ...(d.data() as Omit<TurnoLimpieza, 'id'>), id: d.id })));
  }, err => console.warn('[limpieza] listen incumplimientos:', err.code));
}
