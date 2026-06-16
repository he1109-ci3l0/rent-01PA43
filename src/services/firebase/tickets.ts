import {
  collection, addDoc, doc, updateDoc,
  query, where, orderBy, onSnapshot,
  getDocs, Timestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from './firestore';
import { subirImagenCloudinary } from '@/services/cloudinary';
import type {
  Ticket, CategoriaTicket, SubcategoriaTicket, EstadoTicket, EtiquetaTicket,
} from '@/types/firestore';

// ─── Labels ───────────────────────────────────────────────────

export const CATEGORIA_LABELS: Record<CategoriaTicket, string> = {
  internet:           'Problemas con el internet',
  pago:               'Problemas con un pago',
  reporte_limpieza:   'Reporte de limpieza',
  reporte_inquilino:  'Reporte sobre otro inquilino',
  lavadora:           'Problemas con la lavadora',
  almacenamiento:     'Problemas con el almacenamiento',
  mantenimiento:      'Mantenimiento / Reparaciones',
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
  no_registrado: 'No aparece registrado', paso_fecha: 'Se pasó la fecha',
  comprobante_diferente: 'El comprobante es diferente', otro: 'Otro',
  // limpieza
  bano_1_pb: 'Baño 1 PB', bano_2_pb: 'Baño 2 PB',
  bano_gris: 'Baño Gris', bano_marron: 'Baño Marrón', bano_terraza: 'Baño Terraza',
  cocina_pb: 'CocinaPB', cocina_tp: 'CocinaTP', area_comun: 'Área común', pasillo: 'Pasillo',
  // inquilino
  ruido: 'Ruido', basura: 'Basura', mal_uso_areas: 'Mal uso de áreas',
  agresion: 'Agresión', acoso: 'Acoso', sustancias: 'Sustancias',
  visitas_no_registradas: 'Visitas no registradas',
  // lavadora
  se_paro: 'Se paró', faltan_prendas: 'Faltan prendas',
  // almacenamiento
  lugar_ocupado: 'Lugar ocupado por error', intentaron_abrir: 'Intentaron abrir mi espacio',
  se_tomaron_cosas: 'Se tomaron mis cosas', no_puedo_abrir: 'No puedo abrir',
  // mantenimiento
  sucia_rota_entrega: 'Hab sucia al entregarse',
  retoque_pared: 'Retoque de pared', humedad: 'Humedad', agua_turbia: 'Agua turbia',
  chapa_no_sirve: 'Chapa no sirve', ventana_rota: 'Ventana rota',
  puerta_no_cierra: 'Puerta no cierra', escusado: 'Escusado', closet: 'Closet',
};

// ─── Subcategorías por categoría ──────────────────────────────

export const SUBCATEGORIAS: Record<CategoriaTicket, SubcategoriaTicket[]> = {
  internet:          ['senal_lenta', 'sin_senal', 'modem_roto'],
  pago:              ['no_registrado', 'paso_fecha', 'comprobante_diferente', 'otro'],
  reporte_limpieza:  ['bano_1_pb', 'bano_2_pb', 'bano_gris', 'bano_marron', 'bano_terraza', 'cocina_pb', 'cocina_tp', 'area_comun', 'pasillo'],
  reporte_inquilino: ['ruido', 'basura', 'mal_uso_areas', 'agresion', 'acoso', 'sustancias', 'visitas_no_registradas', 'otro'],
  lavadora:          ['se_paro', 'faltan_prendas'],
  almacenamiento:    ['lugar_ocupado', 'intentaron_abrir', 'se_tomaron_cosas', 'no_puedo_abrir'],
  mantenimiento:     ['sucia_rota_entrega', 'retoque_pared', 'humedad', 'agua_turbia', 'chapa_no_sirve', 'ventana_rota', 'puerta_no_cierra', 'escusado', 'closet', 'otro'],
} as any;

// foto obligatoria para estas categorías
export const FOTO_OBLIGATORIA: CategoriaTicket[] = [
  'reporte_limpieza', 'almacenamiento', 'mantenimiento',
];

// ─── Responsabilidad automática ───────────────────────────────

export const RESPONSABILIDAD_LABELS: Record<EtiquetaTicket | 'sin_definir', string> = {
  admin_cubre:        'Admin cubre',
  mal_uso:            'Mal uso del inquilino',
  sin_culpa:          'Sin culpa',
  reportar_proveedor: 'Reportar proveedor',
  sin_definir:        'Sin definir',
};

function calcularEtiquetaResponsabilidad(
  categoria: CategoriaTicket,
  subcategoria: SubcategoriaTicket,
): EtiquetaTicket | null {
  if (categoria !== 'mantenimiento') return null;
  const adminCubre = ['sucia_rota_entrega', 'retoque_pared', 'humedad', 'agua_turbia'];
  const malUso     = ['chapa_no_sirve', 'ventana_rota', 'puerta_no_cierra', 'escusado', 'closet'];
  if (adminCubre.includes(subcategoria as string)) return 'admin_cubre';
  if (malUso.includes(subcategoria as string))     return 'mal_uso';
  return null;
}

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
    fotoUrl = await subirImagenCloudinary(payload.fotoUri, 'tickets');
  }

  const etiquetaResp = calcularEtiquetaResponsabilidad(payload.categoria, payload.subcategoria);

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
    etiquetas:        etiquetaResp ? [etiquetaResp] : [],
    afectaScore:      false,
    afectaExpediente: false,
    notasAdmin:       '',
    creadoEn:         now,
    actualizadoEn:    now,
    resueltoEn:       null,
  };

  await addDoc(collection(db, 'tickets'), data);
  return folio;
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
