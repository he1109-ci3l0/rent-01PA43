import {
  query, where, onSnapshot,
  doc, addDoc, updateDoc, getDocs, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db, collections } from './firestore';
import type { Cupon, CuponUso, ConceptoCupon, ErrorCupon, TipoCupon } from '@/types/firestore';

// ─── Validación ───────────────────────────────────────────────

export type ResultadoValidacion =
  | { valido: true; cupon: Cupon; descuento: number }
  | { valido: false; error: ErrorCupon; mensaje: string };

const ERROR_MSGS: Record<ErrorCupon, string> = {
  invalido:       'Código no encontrado.',
  no_disponible:  'Este cupón no está disponible en este momento.',
  vencido:        'Este cupón ya venció.',
  agotado:        'Este cupón agotó su límite de usos.',
  no_aplica:      'Este cupón no aplica para tu habitación o concepto.',
};

export async function validarCupon(
  codigo: string,
  habitacionId: string,
  concepto: ConceptoCupon,
  montoBruto: number,
): Promise<ResultadoValidacion> {
  const snap = await getDocs(
    query(collections.cupones, where('codigo', '==', codigo.toUpperCase())),
  );

  if (snap.empty) return { valido: false, error: 'invalido', mensaje: ERROR_MSGS.invalido };

  const cupon = { ...(snap.docs[0].data() as Omit<Cupon, 'id'>), id: snap.docs[0].id };

  if (!cupon.disponible)
    return { valido: false, error: 'no_disponible', mensaje: ERROR_MSGS.no_disponible };

  const ahora = Date.now();
  if (cupon.vigenciaFin.toDate().getTime() < ahora)
    return { valido: false, error: 'vencido', mensaje: ERROR_MSGS.vencido };

  if (cupon.limiteUsos !== null && cupon.usosActuales >= cupon.limiteUsos)
    return { valido: false, error: 'agotado', mensaje: ERROR_MSGS.agotado };

  // Eligibilidad por habitación
  if (cupon.eligibilidad !== 'todos') {
    const ids = cupon.eligibilidad as string[];
    if (!ids.includes(habitacionId))
      return { valido: false, error: 'no_aplica', mensaje: ERROR_MSGS.no_aplica };
  }

  // Concepto
  if (cupon.concepto !== 'total' && cupon.concepto !== concepto)
    return { valido: false, error: 'no_aplica', mensaje: ERROR_MSGS.no_aplica };

  const descuento = cupon.tipo === 'monto'
    ? Math.min(cupon.valor, montoBruto)
    : Math.round(montoBruto * (cupon.valor / 100));

  return { valido: true, cupon, descuento };
}

// ─── Registrar uso ────────────────────────────────────────────

export async function registrarUsoCupon(data: {
  cuponId: string;
  cuponCodigo: string;
  inquilinoId: string;
  habitacionId: string;
  pagoId?: string;
  montoDescuento: number;
  conceptoAplicado: ConceptoCupon;
}): Promise<void> {
  const uso: Omit<CuponUso, 'id'> = {
    cuponId: data.cuponId,
    cuponCodigo: data.cuponCodigo,
    inquilinoId: data.inquilinoId,
    habitacionId: data.habitacionId,
    pagoId: data.pagoId,
    montoDescuento: data.montoDescuento,
    conceptoAplicado: data.conceptoAplicado,
    usadoEn: serverTimestamp() as Timestamp,
  };
  await addDoc(collections.cuponesUsos, uso);
  // Incrementar usosActuales
  await updateDoc(doc(db, 'cupones', data.cuponId), {
    usosActuales: (await getDocs(
      query(collections.cuponesUsos, where('cuponId', '==', data.cuponId)),
    )).size,
  });
}

// ─── CRUD Admin ───────────────────────────────────────────────

export async function crearCupon(data: Omit<Cupon, 'id' | 'usosActuales' | 'creadoEn'>): Promise<string> {
  const payload = {
    ...data,
    codigo: data.codigo.toUpperCase(),
    usosActuales: 0,
    creadoEn: serverTimestamp() as Timestamp,
  };
  const ref = await addDoc(collections.cupones, payload);
  return ref.id;
}

export async function actualizarCupon(
  id: string,
  campos: Partial<Omit<Cupon, 'id' | 'creadoEn' | 'usosActuales'>>,
): Promise<void> {
  const payload: Record<string, unknown> = { ...campos };
  if (campos.codigo) payload.codigo = campos.codigo.toUpperCase();
  await updateDoc(doc(db, 'cupones', id), payload);
}

export async function toggleDisponible(id: string, disponible: boolean): Promise<void> {
  await updateDoc(doc(db, 'cupones', id), { disponible });
}

// ─── Listeners ────────────────────────────────────────────────

export function listenCupones(cb: (cupones: Cupon[]) => void): () => void {
  return onSnapshot(
    query(collections.cupones),
    snap => {
      const all = snap.docs.map(d => ({ ...(d.data() as Omit<Cupon, 'id'>), id: d.id }));
      all.sort((a, b) => (b.creadoEn?.toMillis?.() ?? 0) - (a.creadoEn?.toMillis?.() ?? 0));
      cb(all);
    },
    err => console.warn('[cupones] listen error:', err.code),
  );
}

// ─── Seed ─────────────────────────────────────────────────────

export async function seedCupones(): Promise<void> {
  const q = query(collections.cupones, where('codigo', '==', 'BIENVENIDO10'));
  const snap = await getDocs(q);
  if (!snap.empty) return;

  const ahora = Timestamp.now();
  const fin = Timestamp.fromDate(new Date(ahora.toDate().getFullYear() + 1, 11, 31));

  const demos: Omit<Cupon, 'id'>[] = [
    {
      nombre: 'Bienvenida 10%',
      codigo: 'BIENVENIDO10',
      tipo: 'porcentaje',
      valor: 10,
      concepto: 'total',
      disponible: true,
      reutilizable: false,
      limiteUsos: 1,
      usosActuales: 0,
      vigenciaInicio: ahora,
      vigenciaFin: fin,
      eligibilidad: 'todos',
      apilable: false,
      creadoEn: ahora,
    },
    {
      nombre: 'Descuento fijo $200',
      codigo: 'DESC200',
      tipo: 'monto',
      valor: 200,
      concepto: 'renta',
      disponible: true,
      reutilizable: true,
      limiteUsos: null,
      usosActuales: 0,
      vigenciaInicio: ahora,
      vigenciaFin: fin,
      eligibilidad: 'todos',
      apilable: true,
      creadoEn: ahora,
    },
  ];

  for (const c of demos) {
    try { await addDoc(collections.cupones, c); }
    catch (e: any) { console.error('[cupones] seed error:', e.code); }
  }
}
