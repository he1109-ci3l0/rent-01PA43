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
  Almacenamiento,
  Noticia,
  Chat,
  Mensaje,
  Sesion,
  Factura,
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
  almacenamiento:   col<Almacenamiento>('almacenamiento'),
  noticias:         col<Noticia>('noticias'),
  chats:            col<Chat>('chats'),
  sesiones:         col<Sesion>('sesiones'),
  facturas:         col<Factura>('facturas'),
  configuracion:    col<Configuracion>('configuracion'),
  scores:           col<ScoreReputacion>('scores'),
} as const;

// ─── Sub-colecciones ──────────────────────────────────────────

export const mensajesDeChat = (chatId: string): CollectionReference<Mensaje> =>
  col<Mensaje>(`chats/${chatId}/mensajes`);

// ─── Referencias a documentos específicos ────────────────────

export const configGlobal = (): DocumentReference<Configuracion> =>
  doc(db, 'configuracion', 'global') as DocumentReference<Configuracion>;
