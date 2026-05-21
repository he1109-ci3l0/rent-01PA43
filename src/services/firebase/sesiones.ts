import {
  doc, getDoc, addDoc, updateDoc, getDocs,
  query, where, orderBy, onSnapshot, Timestamp, collection,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { db, collections } from './firestore';
import type { Sesion, AlertaSeguridad, TipoAlerta } from '@/types/firestore';

// ─── Constantes ───────────────────────────────────────────────

export const SESSION_KEY       = '@a43/session_id';
const DEVICE_ID_KEY            = '@a43/device_id';
const MAX_TENANT_SESSIONS      = 3;

// ─── Device ───────────────────────────────────────────────────

export async function getOrCreateDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceName(): string {
  if (Platform.OS === 'ios')     return `iPhone (iOS ${Platform.Version})`;
  if (Platform.OS === 'android') return `Android ${Platform.Version}`;
  return 'Web browser';
}

// ─── Ubicación ────────────────────────────────────────────────

export interface LocationData {
  ciudad: string; alcaldia: string; colonia: string;
  calle: string;  cp: string;       pais: string;
  lat: number;    lng: number;
}

export async function getLocation(): Promise<LocationData | null> {
  // Intentar GPS
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude:  pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (geo) {
        return {
          ciudad:   geo.city      ?? geo.region       ?? '',
          alcaldia: geo.subregion ?? geo.district      ?? '',
          colonia:  (geo as any).subLocality ?? (geo as any).neighborhood ?? '',
          calle:    geo.street    ?? '',
          cp:       geo.postalCode ?? '',
          pais:     geo.country   ?? '',
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
        };
      }
    }
  } catch {}

  // Fallback IP
  try {
    const res  = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    return {
      ciudad:   data.city          ?? '',
      alcaldia: data.region        ?? '',
      colonia:  '',
      calle:    '',
      cp:       data.postal        ?? '',
      pais:     data.country_name  ?? '',
      lat:      data.latitude      ?? 0,
      lng:      data.longitude     ?? 0,
    };
  } catch {}

  return null;
}

// ─── Alertas seguridad ────────────────────────────────────────

async function crearAlerta(params: {
  tipo: TipoAlerta;
  inquilinoId: string;
  inquilinoNombre: string;
  sesionId: string;
  dispositivo: string;
  dispositivoId: string;
  ubicacion: string;
}): Promise<void> {
  await addDoc(collections.alertasSeguridad, {
    ...params,
    adminVio: false,
    creadoEn: Timestamp.now(),
  } as any);
}

// ─── Sesiones — escritura ─────────────────────────────────────

export async function crearSesion(
  uid: string,
  role: 'admin' | 'inquilino',
): Promise<string> {
  const deviceId   = await getOrCreateDeviceId();
  const deviceName = getDeviceName();
  const location   = await getLocation().catch(() => null);

  // Tenants: verificar dispositivo nuevo ANTES de crear sesión
  let isNewDevice = false;
  if (role === 'inquilino') {
    const prevSnap = await getDocs(
      query(collections.sesiones,
        where('usuarioId',    '==', uid),
        where('dispositivoId','==', deviceId),
      ),
    );
    isNewDevice = prevSnap.empty;

    // Aplicar límite de 3 sesiones: cerrar la más antigua si se excede
    const actSnap = await getDocs(
      query(collections.sesiones,
        where('usuarioId', '==', uid),
        where('activa',    '==', true),
        orderBy('fechaInicio', 'asc'),
      ),
    );
    if (actSnap.size >= MAX_TENANT_SESSIONS) {
      await updateDoc(doc(db, 'sesiones', actSnap.docs[0].id), {
        activa: false,
        fechaUltimaActividad: Timestamp.now(),
      });
    }
  }

  // Crear documento de sesión
  const sesionData = {
    usuarioId:            uid,
    dispositivo:          deviceName,
    dispositivoId:        deviceId,
    plataforma:           Platform.OS as 'ios' | 'android' | 'web',
    token:                '',
    activa:               true,
    reporteRobo:          false,
    requiresAdminAuth:    false,
    fechaInicio:          Timestamp.now(),
    fechaUltimaActividad: Timestamp.now(),
    creadoEn:             Timestamp.now(),
    ...(location && {
      ciudad:   location.ciudad,
      alcaldia: location.alcaldia,
      colonia:  location.colonia,
      calle:    location.calle,
      cp:       location.cp,
      pais:     location.pais,
      lat:      location.lat,
      lng:      location.lng,
    }),
  };

  const ref = await addDoc(collections.sesiones, sesionData as any);
  await AsyncStorage.setItem(SESSION_KEY, ref.id);

  // Alerta: dispositivo nuevo
  if (isNewDevice && role === 'inquilino') {
    const inqSnap = await getDoc(doc(db, 'inquilinos', uid));
    const nombre = inqSnap.exists()
      ? `${inqSnap.data().nombre} ${inqSnap.data().apellido}`
      : uid;
    await crearAlerta({
      tipo:             'dispositivo_nuevo',
      inquilinoId:      uid,
      inquilinoNombre:  nombre,
      sesionId:         ref.id,
      dispositivo:      deviceName,
      dispositivoId:    deviceId,
      ubicacion:        location ? [location.ciudad, location.alcaldia].filter(Boolean).join(', ') : 'Desconocida',
    });
  }

  return ref.id;
}

export async function cerrarSesion(sesionId: string): Promise<void> {
  await updateDoc(doc(db, 'sesiones', sesionId), {
    activa: false,
    fechaUltimaActividad: Timestamp.now(),
  });
  const currentId = await AsyncStorage.getItem(SESSION_KEY);
  if (currentId === sesionId) await AsyncStorage.removeItem(SESSION_KEY);
}

export async function cerrarTodasSesiones(uid: string): Promise<void> {
  const snap = await getDocs(
    query(collections.sesiones, where('usuarioId', '==', uid), where('activa', '==', true)),
  );
  await Promise.all(snap.docs.map(d =>
    updateDoc(doc(db, 'sesiones', d.id), { activa: false, fechaUltimaActividad: Timestamp.now() }),
  ));
}

export async function actualizarUltimaActividad(sesionId: string): Promise<void> {
  await updateDoc(doc(db, 'sesiones', sesionId), {
    fechaUltimaActividad: Timestamp.now(),
  }).catch(() => {});
}

// ─── Protocolo robo/extravío ──────────────────────────────────

export async function reportarRobo(uid: string): Promise<void> {
  const snap = await getDocs(
    query(collections.sesiones, where('usuarioId', '==', uid), where('activa', '==', true)),
  );

  const inqSnap = await getDoc(doc(db, 'inquilinos', uid));
  const nombre = inqSnap.exists()
    ? `${inqSnap.data().nombre} ${inqSnap.data().apellido}`
    : uid;

  await Promise.all(snap.docs.map(async d => {
    const data = d.data() as Sesion;
    await updateDoc(doc(db, 'sesiones', d.id), {
      activa:            false,
      reporteRobo:       true,
      requiresAdminAuth: true,
      fechaUltimaActividad: Timestamp.now(),
    });
    await crearAlerta({
      tipo:            'reporte_robo',
      inquilinoId:     uid,
      inquilinoNombre: nombre,
      sesionId:        d.id,
      dispositivo:     data.dispositivo,
      dispositivoId:   data.dispositivoId,
      ubicacion:       [data.ciudad, data.alcaldia].filter(Boolean).join(', ') || 'Desconocida',
    });
  }));

  // Marcar cuenta para requerir autorización admin en próximo login
  await updateDoc(doc(db, 'inquilinos', uid), {
    requiresAdminAuth: true,
    actualizadoEn:     Timestamp.now(),
  });
}

export async function liberarCuentaRobo(uid: string): Promise<void> {
  await updateDoc(doc(db, 'inquilinos', uid), {
    requiresAdminAuth: false,
    actualizadoEn:     Timestamp.now(),
  });
}

// ─── Listeners ────────────────────────────────────────────────

export function listenMisSesiones(
  uid: string,
  cb: (sesiones: Sesion[]) => void,
): () => void {
  return onSnapshot(
    query(collections.sesiones,
      where('usuarioId', '==', uid),
      orderBy('fechaInicio', 'desc'),
    ),
    snap => cb(snap.docs.map(d => ({ ...d.data(), id: d.id } as Sesion))),
    () => cb([]),
  );
}

export function listenTodasSesionesActivas(
  cb: (sesiones: Sesion[]) => void,
): () => void {
  // Sin filtro activa==true para evitar índice compuesto; filtrar cliente
  return onSnapshot(
    query(collections.sesiones, orderBy('fechaInicio', 'desc')),
    snap => {
      const todas = snap.docs.map(d => ({ ...d.data(), id: d.id } as Sesion));
      cb(todas.filter(s => s.activa));
    },
    () => cb([]),
  );
}

export function listenAlertasSeguridad(
  cb: (alertas: AlertaSeguridad[]) => void,
): () => void {
  return onSnapshot(
    query(collections.alertasSeguridad, orderBy('creadoEn', 'desc')),
    snap => cb(snap.docs.map(d => ({ ...d.data(), id: d.id } as AlertaSeguridad))),
    () => cb([]),
  );
}

export async function marcarAlertaVista(alertaId: string): Promise<void> {
  await updateDoc(doc(db, 'alertas_seguridad', alertaId), { adminVio: true });
}
