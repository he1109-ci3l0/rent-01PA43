import { useEffect, useRef, useCallback, useState } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/services/firebase/firestore';
import {
  SESSION_KEY, actualizarUltimaActividad, reportarRobo,
} from '@/services/firebase/sesiones';
import { useAuth } from '@/hooks/useAuth';

const ACTIVITY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

export function useSessionManager() {
  const { user, signOut } = useAuth();
  const [sesionId, setSesionId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Leer sesionId del AsyncStorage al montar
  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY).then(id => setSesionId(id ?? null));
  }, [user?.uid]);

  // Listener en tiempo real: si activa=false → cerrar sesión automáticamente
  useEffect(() => {
    if (!sesionId) return;
    const unsub = onSnapshot(
      doc(db, 'sesiones', sesionId),
      snap => {
        if (snap.exists() && !snap.data().activa) {
          signOut().catch(() => {});
        }
      },
    );
    return unsub;
  }, [sesionId]);

  // Actualizar actividad periódicamente
  useEffect(() => {
    if (!sesionId) return;
    intervalRef.current = setInterval(() => {
      actualizarUltimaActividad(sesionId);
    }, ACTIVITY_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sesionId]);

  // Protocolo robo/extravío — nombre neutro, no menciona cierre de sesiones
  const reportarDispositivoPerdido = useCallback(async () => {
    if (!user?.uid) return;
    try {
      await reportarRobo(user.uid);
    } finally {
      await signOut().catch(() => {});
    }
  }, [user?.uid]);

  return { sesionId, reportarDispositivoPerdido };
}
