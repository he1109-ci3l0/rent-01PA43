import {
  collection, doc, addDoc, updateDoc, setDoc, getDoc, getDocs,
  query, where, orderBy, limit, onSnapshot,
  Timestamp, increment, arrayUnion, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firestore';
import type {
  Chat, Mensaje, ReplyRef, Restriccion, Apelacion, EstadoApelacion,
} from '@/types/firestore';

// ─── Constantes ───────────────────────────────────────────────

export const CHAT_GENERAL_ID = 'general';

const STRIKE_TEXTOS: Record<1 | 2 | 3, string> = {
  1: '⚠️ El sistema ha detectado contenido que no cumple con las normas. Strike 1 de 3.',
  2: '⚠️ Strike 2 de 3. Al recibir un tercer strike el chat será congelado permanentemente.',
  3: '🔒 Strike 3 de 3. Este chat ha sido congelado. Puedes presentar una apelación.',
};

// ─── Chat general ─────────────────────────────────────────────

export async function inicializarChatGeneral(): Promise<void> {
  const ref = doc(db, 'chats', CHAT_GENERAL_ID);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    tipo: 'grupal',
    nombre: 'General',
    participantes: [],
    ultimoMensaje: null,
    ultimoMensajeEn: null,
    ultimoMensajePor: null,
    noLeidosPor: {},
    estado: 'activo',
    strikeCount: 0,
    congelado: false,
    restringidos: [],
    creadoEn: Timestamp.now(),
    actualizadoEn: Timestamp.now(),
  } satisfies Omit<Chat, 'id'>);
}

// ─── Mensajes ─────────────────────────────────────────────────

export function listenMensajes(
  chatId: string,
  cb: (msgs: Mensaje[]) => void,
): () => void {
  const q = query(
    collection(db, `chats/${chatId}/mensajes`),
    orderBy('creadoEn', 'asc'),
    limit(120),
  );
  return onSnapshot(q, snap => {
    cb(snap.docs
      .map(d => ({ ...(d.data() as any), id: d.id }) as Mensaje)
      .filter(m => !m.archivadoEn)
    );
  }, () => cb([]));
}

export async function enviarMensaje(params: {
  chatId: string;
  uid: string;
  nombre: string;
  texto: string;
  replyTo?: ReplyRef;
  mencionados?: string[];
}): Promise<void> {
  const now = Timestamp.now();
  await addDoc(collection(db, `chats/${params.chatId}/mensajes`), {
    chatId:      params.chatId,
    autorId:     params.uid,
    tipo:        'texto',
    contenido:   params.texto.slice(0, 150),
    replyTo:     params.replyTo ?? null,
    mencionados: params.mencionados ?? [],
    reacciones:  {},
    leidoPor:    [params.uid],
    editado:     false,
    eliminado:   false,
    archivadoEn: null,
    creadoEn:    now,
  } satisfies Omit<Mensaje, 'id' | 'stickerUrl' | 'stickerId' | 'adjunto'>);

  await updateDoc(doc(db, 'chats', params.chatId), {
    ultimoMensaje:   params.texto.slice(0, 60),
    ultimoMensajeEn: now,
    ultimoMensajePor: params.uid,
    actualizadoEn:   now,
  });
}

export async function enviarSticker(params: {
  chatId: string;
  uid: string;
  nombre: string;
  stickerUrl: string;
  stickerId?: string;
}): Promise<void> {
  const now = Timestamp.now();
  await addDoc(collection(db, `chats/${params.chatId}/mensajes`), {
    chatId:      params.chatId,
    autorId:     params.uid,
    tipo:        'sticker',
    contenido:   'sticker',
    stickerUrl:  params.stickerUrl,
    stickerId:   params.stickerId ?? '',
    replyTo:     null,
    mencionados: [],
    reacciones:  {},
    leidoPor:    [params.uid],
    editado:     false,
    eliminado:   false,
    archivadoEn: null,
    creadoEn:    now,
  });
  await updateDoc(doc(db, 'chats', params.chatId), {
    ultimoMensaje: '🎭 Sticker', ultimoMensajeEn: now, ultimoMensajePor: params.uid, actualizadoEn: now,
  });
}

// ─── Reacciones (solo conteo, sin tracking de quién) ──────────

export async function reaccionar(chatId: string, msgId: string, emoji: string): Promise<void> {
  await updateDoc(doc(db, `chats/${chatId}/mensajes`, msgId), {
    [`reacciones.${emoji}`]: increment(1),
  });
}

// ─── Admin: borrar mensaje ────────────────────────────────────

export async function eliminarMensaje(chatId: string, msgId: string): Promise<void> {
  await updateDoc(doc(db, `chats/${chatId}/mensajes`, msgId), { eliminado: true });
}

// ─── Admin: strikes (mensaje de sistema sin firma) ────────────

async function mensajeSistema(chatId: string, texto: string): Promise<void> {
  const now = Timestamp.now();
  await addDoc(collection(db, `chats/${chatId}/mensajes`), {
    chatId, autorId: 'sistema', tipo: 'sistema', contenido: texto,
    replyTo: null, mencionados: [], reacciones: {},
    leidoPor: [], editado: false, eliminado: false, archivadoEn: null, creadoEn: now,
  });
  await updateDoc(doc(db, 'chats', chatId), {
    ultimoMensaje: texto.slice(0, 60), ultimoMensajeEn: now,
    ultimoMensajePor: 'sistema', actualizadoEn: now,
  });
}

export async function asignarStrike(chatId: string, numero: 1 | 2 | 3): Promise<void> {
  await updateDoc(doc(db, 'chats', chatId), {
    strikeCount: numero,
    congelado:   numero === 3,
    estado:      numero === 3 ? 'congelado' : 'activo',
    actualizadoEn: Timestamp.now(),
  });
  await mensajeSistema(chatId, STRIKE_TEXTOS[numero]);
}

// ─── Listeners de chats ───────────────────────────────────────

export function listenMisChats(
  uid: string,
  cb: (chats: Chat[]) => void,
): () => void {
  const q = query(
    collection(db, 'chats'),
    where('participantes', 'array-contains', uid),
    orderBy('ultimoMensajeEn', 'desc'),
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ ...(d.data() as any), id: d.id }) as Chat));
  }, () => cb([]));
}

export function listenTodosChats(cb: (chats: Chat[]) => void): () => void {
  const q = query(collection(db, 'chats'), orderBy('ultimoMensajeEn', 'desc'));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ ...(d.data() as any), id: d.id }) as Chat));
  }, () => cb([]));
}

// ─── Chat privado ─────────────────────────────────────────────

export async function crearChatPrivado(
  uid1: string, nombre1: string,
  uid2: string, nombre2: string,
): Promise<string> {
  // Check existing
  const q = query(
    collection(db, 'chats'),
    where('tipo', '==', 'directo'),
    where('participantes', 'array-contains', uid1),
  );
  const snap = await getDocs(q);
  const existente = snap.docs.find(d => {
    const p: string[] = d.data().participantes ?? [];
    return p.includes(uid2);
  });
  if (existente) return existente.id;

  const now = Timestamp.now();
  const ref = await addDoc(collection(db, 'chats'), {
    tipo: 'directo',
    nombre: `${nombre1} · ${nombre2}`,
    participantes: [uid1, uid2],
    ultimoMensaje: null, ultimoMensajeEn: null, ultimoMensajePor: null,
    noLeidosPor: { [uid1]: 0, [uid2]: 0 },
    estado: 'solicitado',
    solicitadoPor: uid1,
    strikeCount: 0, congelado: false, restringidos: [],
    creadoEn: now, actualizadoEn: now,
  });
  return ref.id;
}

export async function aceptarChatPrivado(chatId: string): Promise<void> {
  await updateDoc(doc(db, 'chats', chatId), {
    estado: 'activo', actualizadoEn: Timestamp.now(),
  });
}

export async function rechazarChatPrivado(chatId: string): Promise<void> {
  await updateDoc(doc(db, 'chats', chatId), {
    estado: 'rechazado', actualizadoEn: Timestamp.now(),
  });
}

// ─── Restricción silenciosa ───────────────────────────────────

export async function restringirUsuario(chatId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'chats', chatId), {
    restringidos: arrayUnion(uid),
    actualizadoEn: Timestamp.now(),
  });
}

export async function quitarRestriccion(chatId: string, uid: string): Promise<void> {
  const { arrayRemove } = await import('firebase/firestore');
  await updateDoc(doc(db, 'chats', chatId), {
    restringidos: arrayRemove(uid),
    actualizadoEn: Timestamp.now(),
  });
}

// ─── Apelaciones ──────────────────────────────────────────────

export async function crearApelacion(params: {
  chatId: string;
  solicitanteId: string;
  solicitanteNombre: string;
  motivo: string;
}): Promise<void> {
  await addDoc(collection(db, 'apelaciones'), {
    ...params,
    estado: 'pendiente',
    adminVio: false,
    resueltoEn: null,
    creadoEn: Timestamp.now(),
  });
}

export async function resolverApelacion(
  apelacionId: string,
  chatId: string,
  decision: 'aceptada' | 'rechazada' | 'ignorada',
): Promise<void> {
  const now = Timestamp.now();
  await updateDoc(doc(db, 'apelaciones', apelacionId), {
    estado: decision, adminVio: true, resueltoEn: now,
  });
  if (decision === 'aceptada') {
    await updateDoc(doc(db, 'chats', chatId), {
      congelado: false, estado: 'activo', strikeCount: 0, actualizadoEn: now,
    });
    await mensajeSistema(chatId, '✅ La apelación fue aceptada. El chat ha sido reactivado.');
  }
}

export function listenApelacionesPendientes(cb: (items: Apelacion[]) => void): () => void {
  const q = query(
    collection(db, 'apelaciones'),
    where('estado', '==', 'pendiente'),
    orderBy('creadoEn', 'desc'),
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ ...(d.data() as any), id: d.id }) as Apelacion));
  }, () => cb([]));
}

// ─── Votar encuesta ───────────────────────────────────────────

export async function votarEncuesta(noticiaId: string, opcionId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'noticias', noticiaId), {
    [`encuesta.votos.${opcionId}`]: increment(1),
    'encuesta.votosPor': arrayUnion(uid),
    actualizadoEn: Timestamp.now(),
  });
}

// ─── Chat general helper ──────────────────────────────────────

export function listenChatGeneral(cb: (chat: Chat | null) => void): () => void {
  return onSnapshot(doc(db, 'chats', CHAT_GENERAL_ID), snap => {
    cb(snap.exists() ? ({ ...(snap.data() as any), id: snap.id }) as Chat : null);
  });
}
