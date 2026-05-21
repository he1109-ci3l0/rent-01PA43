import {
  getFirestore,
  collection,
  doc,
  CollectionReference,
  DocumentReference,
} from 'firebase/firestore';
import app from './config';
import type {
  Inquilino,
  Habitacion,
  Pago,
  HuespedExtra,
  Visita,
  Ticket,
  Limpieza,
  Lavanderia,
  ReservaLavanderia,
  Almacenamiento,
  EspacioAlmacenamiento,
  Noticia,
  Chat,
  Mensaje,
  Sesion,
  Factura,
  SolicitudFactura,
  Cupon,
  CuponUso,
  Configuracion,
  ScoreReputacion,
} from '@/types/firestore';

export const db = getFirestore(app);

// Helper con tipo genérico para colecciones
function col<T>(path: string): CollectionReference<T> {
  return collection(db, path) as CollectionReference<T>;
}

// ─── Colecciones raíz ─────────────────────────────────────────

export const collections = {
  inquilinos:       col<Inquilino>('inquilinos'),
  habitaciones:     col<Habitacion>('habitaciones'),
  pagos:            col<Pago>('pagos'),
  huespedesExtra:   col<HuespedExtra>('huespedes_extra'),
  visitas:          col<Visita>('visitas'),
  tickets:          col<Ticket>('tickets'),
  limpieza:         col<Limpieza>('limpieza'),
  lavanderia:       col<Lavanderia>('lavanderia'),
  almacenamiento:         col<Almacenamiento>('almacenamiento'),
  espaciosAlmacenamiento: col<EspacioAlmacenamiento>('espacios_almacenamiento'),
  noticias:         col<Noticia>('noticias'),
  chats:            col<Chat>('chats'),
  sesiones:         col<Sesion>('sesiones'),
  reservasLavanderia:  col<ReservaLavanderia>('reservas_lavanderia'),
  facturas:            col<Factura>('facturas'),
  solicitudesFactura:  col<SolicitudFactura>('solicitudes_factura'),
  cupones:             col<Cupon>('cupones'),
  cuponesUsos:         col<CuponUso>('cupones_usos'),
  configuracion:       col<Configuracion>('configuracion'),
  scores:              col<ScoreReputacion>('scores'),
} as const;

// ─── Sub-colecciones ──────────────────────────────────────────

export const mensajesDeChat = (chatId: string): CollectionReference<Mensaje> =>
  col<Mensaje>(`chats/${chatId}/mensajes`);

// ─── Referencias a documentos específicos ────────────────────

export const configGlobal = (): DocumentReference<Configuracion> =>
  doc(db, 'configuracion', 'global') as DocumentReference<Configuracion>;
