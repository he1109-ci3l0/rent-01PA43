// @ts-ignore — Metro resuelve firebase/auth al build RN que sí exporta initializeAuth + getReactNativePersistence
import { initializeAuth, getAuth, getReactNativePersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged as firebaseOnAuthStateChanged, User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import app from './config';
import { db } from './firestore';
import { crearSesion, cerrarSesion, SESSION_KEY } from './sesiones';

// initializeAuth con AsyncStorage v2 — persiste la sesión entre cierres de app
let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}
export { auth };

// ─── Lockout (AsyncStorage local) ────────────────────────────

const MAX_ATTEMPTS = 6;
const LOCKOUT_MS   = 24 * 60 * 1000;
const LOCKOUT_KEY  = (u: string) => `@a43/lockout_${u}`;

interface LockoutData { count: number; lockedUntil: number | null }

async function getLockout(u: string): Promise<LockoutData> {
  const raw = await AsyncStorage.getItem(LOCKOUT_KEY(u));
  return raw ? JSON.parse(raw) : { count: 0, lockedUntil: null };
}

async function clearLockout(u: string) {
  await AsyncStorage.removeItem(LOCKOUT_KEY(u));
}

export async function checkLockout(username: string): Promise<{ locked: boolean; minutesLeft: number }> {
  const data = await getLockout(username);
  if (!data.lockedUntil) return { locked: false, minutesLeft: 0 };
  const remaining = data.lockedUntil - Date.now();
  if (remaining <= 0) { await clearLockout(username); return { locked: false, minutesLeft: 0 }; }
  return { locked: true, minutesLeft: Math.ceil(remaining / 60_000) };
}

async function recordFailed(username: string): Promise<{ locked: boolean; attemptsLeft: number }> {
  const raw  = await AsyncStorage.getItem(LOCKOUT_KEY(username));
  const data: LockoutData = raw ? JSON.parse(raw) : { count: 0, lockedUntil: null };
  data.count = (data.count ?? 0) + 1;
  if (data.count >= MAX_ATTEMPTS) {
    data.lockedUntil = Date.now() + LOCKOUT_MS;
    await AsyncStorage.setItem(LOCKOUT_KEY(username), JSON.stringify(data));
    return { locked: true, attemptsLeft: 0 };
  }
  await AsyncStorage.setItem(LOCKOUT_KEY(username), JSON.stringify(data));
  return { locked: false, attemptsLeft: MAX_ATTEMPTS - data.count };
}

// ─── API pública ──────────────────────────────────────────────

export async function signIn(username: string, password: string): Promise<void> {
  const u = username.trim().toLowerCase();

  const { locked, minutesLeft } = await checkLockout(u);
  if (locked) throw Object.assign(new Error('Cuenta bloqueada'), { code: 'LOCKED', minutesLeft });

  try {
    const email = `${u}@antioquia43.app`;
    const { user } = await signInWithEmailAndPassword(auth, email, password.trim());
    await clearLockout(u);

    const role = u.startsWith('bailleur') ? 'admin' : 'inquilino';

    // Verificar si la cuenta requiere autorización admin (protocolo robo)
    if (role === 'inquilino') {
      const inqSnap = await getDoc(doc(db, 'inquilinos', user.uid));
      if (inqSnap.exists() && inqSnap.data().requiresAdminAuth) {
        await firebaseSignOut(auth);
        throw Object.assign(
          new Error('Esta cuenta requiere autorización del administrador para iniciar sesión.'),
          { code: 'REQUIRES_ADMIN_AUTH' },
        );
      }
    }

    await crearSesion(user.uid, role);
  } catch (err: unknown) {
    const e = err as { code?: string; minutesLeft?: number };
    if (e.code === 'LOCKED' || e.code === 'REQUIRES_ADMIN_AUTH') throw err;
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
  const sesionId = await AsyncStorage.getItem(SESSION_KEY);
  if (sesionId) await cerrarSesion(sesionId).catch(() => {});
  await firebaseSignOut(auth);
}

export interface SignUpForm {
  nombre: string;
  apellido: string;
  curp: string;
  emailPersonal: string;
  telefono: string;
}

export async function signUp(form: SignUpForm): Promise<{ username: string }> {
  const shortId = Date.now().toString(36).slice(-5);
  const username = `tenant_${shortId}`;
  const email = `${username}@antioquia43.app`;
  const curpUpper = form.curp.trim().toUpperCase();

  const { user } = await createUserWithEmailAndPassword(auth, email, curpUpper);

  const ahora = Timestamp.now();
  await setDoc(doc(db, 'inquilinos', user.uid), {
    id: user.uid,
    uid: user.uid,
    nombre: form.nombre.trim(),
    apellido: form.apellido.trim(),
    email: form.emailPersonal.trim().toLowerCase(),
    telefono: form.telefono.trim(),
    documentoTipo: 'CC',
    documentoNumero: curpUpper,
    habitacionId: null,
    fechaIngreso: null,
    fechaSalida: null,
    estado: 'pendiente',
    rol: 'inquilino',
    requiresAdminAuth: true,
    creadoEn: ahora,
    actualizadoEn: ahora,
  });

  return { username };
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function onAuthStateChanged(callback: (user: User | null) => void): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}
