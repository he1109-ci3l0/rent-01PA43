import {
  collection, query, where, orderBy, onSnapshot, addDoc,
  getDocs, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './firestore';

export type TipoGasto = 'servicio' | 'mantenimiento_regular' | 'mantenimiento_atipico';

export type CategoriaGasto =
  | 'luz' | 'agua' | 'gas' | 'internet'
  | 'material' | 'mano_obra' | 'tecnico'
  | 'personal' | 'adaptacion' | 'otro';

export interface Gasto {
  id: string;
  tipo: TipoGasto;
  categoria: CategoriaGasto;
  descripcion: string;
  monto: number;
  fecha: Timestamp;
  mes: number;
  anio: number;
  habitacionId?: string;
  ticketId?: string;
  comprobante?: string;
  adminId: string;
  creadoEn: Timestamp;
}

export const TIPO_LABELS: Record<TipoGasto, string> = {
  servicio:              'Servicios',
  mantenimiento_regular: 'Mantenimiento regular',
  mantenimiento_atipico: 'Mantenimiento atípico',
};

export const CATEGORIA_LABELS_GASTO: Record<CategoriaGasto, string> = {
  luz:        'Luz',
  agua:       'Agua',
  gas:        'Gas',
  internet:   'Internet',
  material:   'Material',
  mano_obra:  'Mano de obra',
  tecnico:    'Técnico especializado',
  personal:   'Personal',
  adaptacion: 'Adaptación',
  otro:       'Otro',
};

export const CATEGORIAS_POR_TIPO: Record<TipoGasto, CategoriaGasto[]> = {
  servicio:              ['luz', 'agua', 'gas', 'internet'],
  mantenimiento_regular: ['material', 'mano_obra', 'personal', 'otro'],
  mantenimiento_atipico: ['material', 'mano_obra', 'tecnico', 'personal', 'adaptacion', 'otro'],
};

export const TIPO_COLOR: Record<TipoGasto, string> = {
  servicio:              '#3B82F6',
  mantenimiento_regular: '#E8A838',
  mantenimiento_atipico: '#C0392B',
};

export async function registrarGasto(
  data: Omit<Gasto, 'id' | 'creadoEn'>,
): Promise<string> {
  const ref = await addDoc(
    collection(db, 'gastos'),
    { ...data, creadoEn: serverTimestamp() },
  );
  return ref.id;
}

export function listenGastosMes(
  mes: number,
  anio: number,
  cb: (gastos: Gasto[]) => void,
): () => void {
  const q = query(
    collection(db, 'gastos'),
    where('mes', '==', mes),
    where('anio', '==', anio),
    orderBy('creadoEn', 'desc'),
  );
  return onSnapshot(q, snap =>
    cb(snap.docs.map(d => ({ ...d.data(), id: d.id } as Gasto))),
  );
}

// Re-exported to prevent unused-import warnings if caller only needs getDocs
export { getDocs };
