import {
  query, orderBy, onSnapshot, doc, setDoc, updateDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db, collections } from './firestore';
import type {
  Habitacion, EstadoHabitacion, TipoHabitacion,
} from '@/types/firestore';

// ─── Colores por estado ───────────────────────────────────────

import { cartasBosque } from '@/constants/colors';

export const ESTADO_COLOR: Record<EstadoHabitacion, string> = {
  disponible:    cartasBosque.pergamino,
  ocupada:       cartasBosque.bosque,
  mantenimiento: '#795548',
  reservada:     '#4A5E48',
};

export const ESTADO_LABEL: Record<EstadoHabitacion, string> = {
  disponible:    'Vacía',
  ocupada:       'Ocupada',
  mantenimiento: 'Construcción',
  reservada:     'Reservada',
};

// ─── Datos seed ───────────────────────────────────────────────

type SeedHabitacion = Omit<Habitacion, 'id' | 'creadoEn' | 'actualizadoEn'>;

export const HABITACIONES_SEED: Array<SeedHabitacion & { docId: string }> = [
  // ── Planta Baja ──────────────────────────────────────────────
  {
    docId: '01', numero: '01', piso: 0, pisoNombre: 'PB',
    tipo: 'simple' as TipoHabitacion, tamano: 'Pequeña',
    estado: 'disponible', precioMensual: 2700, precioDeposito: 2700,
    area: 12, bano: 'libre', cocina: 'CocinaPB',
    amenidades: ['WiFi', 'Ventilador'], fotos: [], habilitada: true,
    inquilinoId: null,
  },
  {
    docId: '02', numero: '02', piso: 0, pisoNombre: 'PB',
    tipo: 'simple', tamano: 'Pequeña',
    estado: 'disponible', precioMensual: 2700, precioDeposito: 2700,
    area: 12, bano: 'libre', cocina: 'CocinaPB',
    amenidades: ['WiFi', 'Ventilador'], fotos: [], habilitada: true,
    inquilinoId: null,
  },
  {
    docId: '03', numero: '03', piso: 0, pisoNombre: 'PB',
    tipo: 'simple', tamano: 'Pequeña',
    estado: 'disponible', precioMensual: 2700, precioDeposito: 2700,
    precioRemodelado: 3600,
    area: 12, bano: 'libre', cocina: 'CocinaPB',
    amenidades: ['WiFi', 'Ventilador'], fotos: [], habilitada: true,
    moduloRemodelacion: true, remodelacionActiva: false,
    inquilinoId: null,
  },
  {
    docId: '04', numero: '04', piso: 0, pisoNombre: 'PB',
    tipo: 'simple', tamano: 'Pequeña',
    estado: 'disponible', precioMensual: 2700, precioDeposito: 2700,
    area: 12, bano: 'libre', cocina: 'CocinaPB',
    amenidades: ['WiFi', 'Ventilador'], fotos: [], habilitada: true,
    inquilinoId: null,
  },
  {
    docId: '05', numero: '05', piso: 0, pisoNombre: 'PB',
    tipo: 'simple', tamano: 'Pequeña',
    estado: 'ocupada', precioMensual: 2700, precioDeposito: 2700,
    area: 12, bano: 'libre', cocina: 'CocinaPB',
    amenidades: ['WiFi', 'Ventilador'], fotos: [], habilitada: true,
    inquilinoId: 'demo-inquilino-1', inquilinoNombre: 'Carlos Mendoza',
  },
  {
    docId: '06', numero: '06', piso: 0, pisoNombre: 'PB',
    tipo: 'suite', tamano: 'Grande c/terraza',
    estado: 'disponible', precioMensual: 3700, precioDeposito: 3700,
    area: 18, bano: 'libre', cocina: 'CocinaPB',
    amenidades: ['WiFi', 'Ventilador', 'Terraza privada'], fotos: [], habilitada: true,
    inquilinoId: null,
  },

  // ── Primer Piso ───────────────────────────────────────────────
  {
    docId: '07', numero: '07', piso: 1, pisoNombre: 'P1',
    tipo: 'estudio', tamano: 'Mediana',
    estado: 'ocupada', precioMensual: 3300, precioDeposito: 3300,
    area: 14, bano: 'Baño gris', cocina: 'CocinaPB',
    amenidades: ['WiFi', 'Ventilador'], fotos: [], habilitada: true,
    inquilinoId: 'demo-inquilino-2', inquilinoNombre: 'Ana Rojas',
  },
  {
    docId: '08', numero: '08', piso: 1, pisoNombre: 'P1',
    tipo: 'doble', tamano: 'Grande',
    estado: 'disponible', precioMensual: 3400, precioDeposito: 3400,
    area: 16, bano: 'Baño gris', cocina: 'CocinaPB',
    amenidades: ['WiFi', 'Ventilador', 'Balcón'], fotos: [], habilitada: true,
    inquilinoId: null,
  },
  {
    docId: '09', numero: '09', piso: 1, pisoNombre: 'P1',
    tipo: 'doble', tamano: 'Grande',
    estado: 'ocupada', precioMensual: 3600, precioDeposito: 3600,
    area: 16, bano: 'Baño marrón', cocina: 'CocinaPB',
    amenidades: ['WiFi', 'Ventilador', 'Balcón'], fotos: [], habilitada: true,
    inquilinoId: 'demo-inquilino-3', inquilinoNombre: 'Luis Torres',
  },
  {
    docId: '10', numero: '10', piso: 1, pisoNombre: 'P1',
    tipo: 'estudio', tamano: 'Mediana',
    estado: 'disponible', precioMensual: 3000, precioDeposito: 3000,
    area: 14, bano: 'Baño marrón', cocina: 'CocinaPB',
    amenidades: ['WiFi', 'Ventilador'], fotos: [], habilitada: true,
    inquilinoId: null,
  },

  // ── Terraza Piso ──────────────────────────────────────────────
  {
    docId: '11', numero: '11', piso: 2, pisoNombre: 'TP',
    tipo: 'simple', tamano: 'Pequeña',
    estado: 'disponible', precioMensual: 2700, precioDeposito: 2700,
    area: 11, bano: 'Baño terraza', cocina: 'CocinaTP',
    amenidades: ['WiFi', 'Vista terraza'], fotos: [], habilitada: true,
    inquilinoId: null,
  },
  {
    docId: '12', numero: '12', piso: 2, pisoNombre: 'TP',
    tipo: 'simple', tamano: 'Pequeña',
    estado: 'disponible', precioMensual: 2700, precioDeposito: 2700,
    area: 11, bano: 'Baño terraza', cocina: 'CocinaTP',
    amenidades: ['WiFi', 'Vista terraza'], fotos: [], habilitada: true,
    inquilinoId: null,
  },
  {
    docId: '13', numero: '13', piso: 2, pisoNombre: 'TP',
    tipo: 'estudio', tamano: 'Mediana petit',
    estado: 'disponible', precioMensual: 2700, precioDeposito: 2700,
    precioAlSalir: 3000,
    area: 13, bano: 'Baño terraza', cocina: 'CocinaTP',
    amenidades: ['WiFi', 'Vista terraza'], fotos: [], habilitada: true,
    inquilinoId: null,
  },
  {
    docId: '14', numero: '14', piso: 2, pisoNombre: 'TP',
    tipo: 'estudio', tamano: 'Mediana',
    estado: 'ocupada', precioMensual: 3000, precioDeposito: 3000,
    area: 14, bano: 'Baño terraza', cocina: 'CocinaTP',
    amenidades: ['WiFi', 'Vista terraza'], fotos: [], habilitada: true,
    inquilinoId: 'demo-inquilino-4', inquilinoNombre: 'María García',
  },
];

// ─── Seed ─────────────────────────────────────────────────────

export async function seedHabitaciones(): Promise<void> {
  for (const { docId, ...data } of HABITACIONES_SEED) {
    await setDoc(doc(db, 'habitaciones', docId), {
      ...data,
      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    });
  }
}

// ─── Listener en tiempo real ──────────────────────────────────

export function listenHabitaciones(
  cb: (rooms: Habitacion[]) => void,
): () => void {
  const q = query(collections.habitaciones, orderBy('numero', 'asc'));
  return onSnapshot(q, snap =>
    cb(snap.docs.map(d => ({ ...(d.data() as Omit<Habitacion, 'id'>), id: d.id }))),
  );
}

// ─── CRUD ─────────────────────────────────────────────────────

export async function updateHabitacion(
  id: string,
  data: Partial<Omit<Habitacion, 'id' | 'creadoEn'>>,
): Promise<void> {
  await updateDoc(doc(db, 'habitaciones', id), {
    ...data,
    actualizadoEn: serverTimestamp(),
  });
}

export async function cambiarEstado(
  id: string,
  estado: EstadoHabitacion,
): Promise<void> {
  await updateHabitacion(id, { estado });
}

export async function toggleRemodelacion(
  id: string,
  activa: boolean,
): Promise<void> {
  const seed = HABITACIONES_SEED.find(h => h.docId === id);
  await updateHabitacion(id, {
    remodelacionActiva: activa,
    precioMensual: activa ? (seed?.precioRemodelado ?? 3600) : (seed?.precioMensual ?? 2700),
    tamano: activa ? 'Grande' : 'Pequeña',
  });
}
