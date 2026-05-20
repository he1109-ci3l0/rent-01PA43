// @ts-ignore — Metro resuelve firebase/auth al build RN que sí exporta initializeAuth + getReactNativePersistence
import { initializeAuth, getAuth, getReactNativePersistence, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged as firebaseOnAuthStateChanged, User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import app from './config';
import { db, collections } from './firestore';
import type { Sesion } from '@/types/firestore';

// initializeAuth con AsyncStorage v2 — persiste la sesión entre cierres de app
let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // En hot-reload ya está inicializado
  auth = getAuth(app);
}
export { auth };

// ─── Constantes ────────────────────────────────────────────────

const MAX_ATTEMPTS = 6;
const LOCKOUT_MS = 24 * 60 * 1000;   // 24 minutos
const MAX_TENANT_SESSIONS = 3;

const LOCKOUT_KEY = (u: string) => `@a43/lockout_${u}`;
const SESSION_KEY = '@a43/session_id';

// ─── Lockout (AsyncStorage local) ────────────────────────────

interface LockoutData { count: number; lockedUntil: number | null }

async function getLockout(username: string): Promise<LockoutData> {
  const raw = await AsyncStorage.getItem(LOCKOUT_KEY(username));
  return raw ? JSON.parse(raw) : { count: 0, lockedUntil: null };
}

async function setLockout(username: string, data: LockoutData) {
  await AsyncStorage.setItem(LOCKOUT_KEY(username), JSON.stringify(data));
}

async function clearLockout(username: string) {
  await AsyncStorage.removeItem(LOCKOUT_KEY(username));
}

export async function checkLockout(username: string): Promise<{ locked: boolean; minutesLeft: number }> {
  const data = await getLockout(username);
  if (!data.lockedUntil) return { locked: false, minutesLeft: 0 };
  const remaining = data.lockedUntil - Date.now();
  if (remaining <= 0) { await clearLockout(username); return { locked: false, minutesLeft: 0 }; }
  return { locked: true, minutesLeft: Math.ceil(remaining / 60_000) };
}

async function recordFailed(username: string): Promise<{ locked: boolean; attemptsLeft: number }> {
  const data = await getLockout(username);
  data.count = (data.count ?? 0) + 1;
  if (data.count >= MAX_ATTEMPTS) {
    data.lockedUntil = Date.now() + LOCKOUT_MS;
    await setLockout(username, data);
    return { locked: true, attemptsLeft: 0 };
  }
  await setLockout(username, data);
  return { locked: false, attemptsLeft: MAX_ATTEMPTS - data.count };
}

// ─── Sesiones (Firestore) ─────────────────────────────────────

type SesionInput = Omit<Sesion, 'id'>;

async function registerSession(uid: string, role: 'admin' | 'inquilino'): Promise<void> {
  if (role === 'inquilino') {
    const snap = await getDocs(
      query(
        collections.sesiones,
        where('usuarioId', '==', uid),
        where('activa', '==', true),
        orderBy('fechaInicio', 'asc'),
      ),
    );
    if (snap.size >= MAX_TENANT_SESSIONS) {
      await deleteDoc(doc(db, 'sesiones', snap.docs[0].id));
    }
  }

  const data: SesionInput = {
    usuarioId: uid,
    dispositivo: 'Mobile',
    plataforma: Platform.OS as 'ios' | 'android' | 'web',
    token: '',
    activa: true,
    fechaInicio: serverTimestamp() as unknown as import('firebase/firestore').Timestamp,
    fechaUltimaActividad: serverTimestamp() as unknown as import('firebase/firestore').Timestamp,
    creadoEn: serverTimestamp() as unknown as import('firebase/firestore').Timestamp,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = await addDoc(collections.sesiones, data as any);
  await AsyncStorage.setItem(SESSION_KEY, ref.id);
}

async function removeSession(): Promise<void> {
  const id = await AsyncStorage.getItem(SESSION_KEY);
  if (!id) return;
  try { await deleteDoc(doc(db, 'sesiones', id)); } catch { /* ya eliminada */ }
  await AsyncStorage.removeItem(SESSION_KEY);
}

// ─── API pública ──────────────────────────────────────────────

export async function signIn(username: string, curp: string): Promise<void> {
  const u = username.trim().toLowerCase();

  const { locked, minutesLeft } = await checkLockout(u);
  if (locked) throw Object.assign(new Error('Cuenta bloqueada'), { code: 'LOCKED', minutesLeft });

  try {
    const email = `${u}@antioquia43.app`;
    const { user } = await signInWithEmailAndPassword(auth, email, curp.trim().toUpperCase());
    await clearLockout(u);
    const role = u.startsWith('bailleur') ? 'admin' : 'inquilino';
    await registerSession(user.uid, role);
  } catch (err: unknown) {
    const e = err as { code?: string; minutesLeft?: number };
    if (e.code === 'LOCKED') throw err;
    if (e.code === 'auth/network-request-failed') {
      throw Object.assign(new Error('Sin conexión'), { code: 'NETWORK_ERROR' });
    }
    const { locked: nowLocked, attemptsLeft } = await recordFailed(u);
    if (nowLocked) {
      throw Object.assign(new Error('Cuenta bloqueada'), { code: 'LOCKED', minutesLeft: 24 });
    }
    throw Object.assign(new Error('Credenciales incorrectas'), { code: 'WRONG_CREDENTIALS', attemptsLeft });
  }
}

export async function signOut(): Promise<void> {
  await removeSession();
  await firebaseSignOut(auth);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function onAuthStateChanged(callback: (user: User | null) => void): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}
