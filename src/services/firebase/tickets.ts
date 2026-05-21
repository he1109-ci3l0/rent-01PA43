import {
  collection, addDoc, doc, updateDoc,
  query, where, orderBy, onSnapshot,
  getDocs, Timestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from './firestore';
import type {
  Ticket, CategoriaTicket, SubcategoriaTicket, EstadoTicket, EtiquetaTicket,
} from '@/types/firestore';

// ─── Labels ───────────────────────────────────────────────────

export const CATEGORIA_LABELS: Record<CategoriaTicket, string> = {
  internet:           'Internet',
  pago:               'Problema con pago',
  reporte_limpieza:   'Reporte de limpieza',
  reporte_inquilino:  'Reporte de inquilino',
  lavadora:           'Lavadora',
  almacenamiento:     'Almacenamiento',
  mantenimiento:      'Mantenimiento',
};

export const CATEGORIA_ICONS: Record<CategoriaTicket, string> = {
  internet:           'wifi-outline',
  pago:               'card-outline',
  reporte_limpieza:   'brush-outline',
  reporte_inquilino:  'person-outline',
  lavadora:           'shirt-outline',
  almacenamiento:     'archive-outline',
  mantenimiento:      'construct-outline',
};

export const ESTADO_LABELS: Record<EstadoTicket, string> = {
  en_revision: 'En revisión',
  en_proceso:  'En proceso',
  resuelto:    'Resuelto',
};

export const ETIQUETA_LABELS: Record<EtiquetaTicket, string> = {
  mal_uso:            'Mal uso',
  admin_cubre:        'Admin cubre',
  sin_culpa:          'Sin culpa',
  reportar_proveedor: 'Reportar proveedor',
};

export const SUBCATEGORIA_LABELS: Record<string, string> = {
  // internet
  senal_lenta: 'Señal lenta', sin_senal: 'Sin señal', modem_roto: 'Módem roto',
  // pago
  no_registrado: 'No registrado', paso_fecha: 'Se pasó la fecha',
  comprobante_diferente: 'Comprobante diferente', otro: 'Otro',
  // limpieza areas
  bano_gris: 'Baño gris', bano_marron: 'Baño marrón', bano_terraza: 'Baño terraza',
  cocina_pb: 'Cocina PB', cocina_tp: 'Cocina TP', pasillo: 'Pasillo',
  escalera: 'Escalera', patio: 'Patio', tendedero: 'Tendedero',
  // inquilino
  ruido: 'Ruido', basura: 'Basura', malos_olores: 'Malos olores',
  dano_propiedad: 'Daño a propiedad', agresion_verbal: 'Agresión verbal',
  robo_hurto: 'Robo / Hurto', mascota_no_autorizada: 'Mascota no autorizada',
  // lavadora
  se_paro: 'Se paró', faltan_prendas: 'Faltan prendas',
  // almacenamiento
  lugar_ocupado: 'Lugar ocupado', intentaron_abrir: 'Intentaron abrir',
  se_comieron_cosas: 'Se comieron cosas', no_puedo_abrir: 'No puedo abrir',
  // mantenimiento
  electrico: 'Eléctrico', plomeria: 'Plomería', gas: 'Gas', muebles: 'Muebles',
  cerradura: 'Cerradura', ventana_puerta: 'Ventana / Puerta',
  sucia_rota_entrega: 'Sucia/Rota al entregarse',
};

// ─── Subcategorías por categoría ──────────────────────────────

export const SUBCATEGORIAS: Record<CategoriaTicket, SubcategoriaTicket[]> = {
  internet:          ['senal_lenta', 'sin_senal', 'modem_roto'],
  pago:              ['no_registrado', 'paso_fecha', 'comprobante_diferente', 'otro'],
  reporte_limpieza:  ['bano_gris', 'bano_marron', 'bano_terraza', 'cocina_pb', 'cocina_tp', 'pasillo', 'escalera', 'patio', 'tendedero'],
  reporte_inquilino: ['ruido', 'basura', 'malos_olores', 'dano_propiedad', 'agresion_verbal', 'robo_hurto', 'mascota_no_autorizada', 'otro'],
  lavadora:          ['se_paro', 'faltan_prendas'],
  almacenamiento:    ['lugar_ocupado', 'intentaron_abrir', 'se_comieron_cosas', 'no_puedo_abrir'],
  mantenimiento:     ['electrico', 'plomeria', 'gas', 'muebles', 'cerradura', 'ventana_puerta', 'sucia_rota_entrega', 'otro'],
} as any;

// foto obligatoria para estas categorías
export const FOTO_OBLIGATORIA: CategoriaTicket[] = [
  'internet', 'reporte_limpieza', 'almacenamiento', 'mantenimiento',
];

// ─── Folio ────────────────────────────────────────────────────

async function generarFolio(inquilinoId: string, habitacionNumero: string): Promise<string> {
  const hoy = new Date();
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  const fecha = `${hoy.getFullYear()}${pad(hoy.getMonth() + 1)}${pad(hoy.getDate())}`;
  const uid6  = inquilinoId.slice(0, 6).toUpperCase();

  const q = query(
    collection(db, 'tickets'),
    where('inquilinoId', '==', inquilinoId),
  );
  const snap = await getDocs(q);
  const seq  = String(snap.size + 1).padStart(9, '0');
  return `${uid6}_${habitacionNumero}_${fecha}_${seq}`;
}

// ─── Crear ticket ─────────────────────────────────────────────

export async function crearTicket(payload: {
  inquilinoId: string;
  habitacionId: string;
  habitacionNumero: string;
  inquilinoNombre: string;
  categoria: CategoriaTicket;
  subcategoria: SubcategoriaTicket;
  descripcion: string;
  sacasteRopa: boolean | null;
  fotoUri: string | null;
}): Promise<string> {
  const folio = await generarFolio(payload.inquilinoId, payload.habitacionNumero);
  const now   = Timestamp.now();

  let fotoUrl: string | null = null;
  if (payload.fotoUri) {
    const storage2 = getStorage();
    const res  = await fetch(payload.fotoUri);
    const blob = await res.blob();
    const r    = ref(storage2, `tickets/${payload.inquilinoId}/${folio}.jpg`);
    await uploadBytes(r, blob);
    fotoUrl = await getDownloadURL(r);
  }

  const data: Omit<Ticket, 'id'> = {
    folio,
    inquilinoId:      payload.inquilinoId,
    habitacionId:     payload.habitacionId,
    habitacionNumero: payload.habitacionNumero,
    inquilinoNombre:  payload.inquilinoNombre,
    categoria:        payload.categoria,
    subcategoria:     payload.subcategoria,
    descripcion:      payload.descripcion,
    sacasteRopa:      payload.sacasteRopa,
    fotoUrl,
    estado:           'en_revision',
    etiquetas:        [],
    afectaScore:      false,
    afectaExpediente: false,
    notasAdmin:       '',
    creadoEn:         now,
    actualizadoEn:    now,
    resueltoEn:       null,
  };

  const ref2 = await addDoc(collection(db, 'tickets'), data);
  return ref2.id;
}

// ─── Admin mutations ──────────────────────────────────────────

export async function actualizarEstado(ticketId: string, estado: EstadoTicket) {
  const now = Timestamp.now();
  await updateDoc(doc(db, 'tickets', ticketId), {
    estado,
    actualizadoEn: now,
    ...(estado === 'resuelto' ? { resueltoEn: now } : {}),
  });
}

export async function agregarEtiqueta(ticketId: string, etiqueta: EtiquetaTicket) {
  await updateDoc(doc(db, 'tickets', ticketId), {
    etiquetas: arrayUnion(etiqueta),
    actualizadoEn: Timestamp.now(),
  });
}

export async function quitarEtiqueta(ticketId: string, etiqueta: EtiquetaTicket) {
  await updateDoc(doc(db, 'tickets', ticketId), {
    etiquetas: arrayRemove(etiqueta),
    actualizadoEn: Timestamp.now(),
  });
}

export async function actualizarDecisionAdmin(ticketId: string, campos: {
  afectaScore?: boolean;
  afectaExpediente?: boolean;
  notasAdmin?: string;
}) {
  await updateDoc(doc(db, 'tickets', ticketId), {
    ...campos,
    actualizadoEn: Timestamp.now(),
  });
}

// ─── Listeners ────────────────────────────────────────────────

export function listenMisTickets(
  uid: string,
  cb: (tickets: Ticket[]) => void,
): () => void {
  const q = query(
    collection(db, 'tickets'),
    where('inquilinoId', '==', uid),
    orderBy('creadoEn', 'desc'),
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ ...(d.data() as any), id: d.id }) as Ticket));
  }, () => cb([]));
}

export function listenTodosTickets(
  cb: (tickets: Ticket[]) => void,
  filtros?: { categoria?: CategoriaTicket; estado?: EstadoTicket },
): () => void {
  let q = query(collection(db, 'tickets'), orderBy('creadoEn', 'desc'));
  if (filtros?.categoria) q = query(q, where('categoria', '==', filtros.categoria));
  if (filtros?.estado)    q = query(q, where('estado', '==', filtros.estado));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ ...(d.data() as any), id: d.id }) as Ticket));
  }, () => cb([]));
}
