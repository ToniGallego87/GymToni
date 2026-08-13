import { Dispatch, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { WorkoutAction } from '../types';
import { useSession } from '@lib/cloud/auth';
import { registerSyncUser, syncNow } from '@lib/cloud/sync';
import { loadAppData } from '@lib/storage';

// Sincronización de fondo (Fase 3). Mientras haya sesión, sincroniza al iniciar
// sesión, al volver la app a primer plano y deja el usuario registrado para el
// push automático tras cada escritura (lib/cloud/sync + lib/persistence).
//
// Si el pull trae cambios, recarga el estado desde el SQLite ya actualizado y lo
// vuelca en el reducer (SET_APP_DATA) para reflejar en la UI lo bajado de la nube.
export function useCloudSync(dispatch: Dispatch<WorkoutAction>): void {
  const { user } = useSession();
  const userId = user?.id ?? null;
  // Evita relanzar mientras uno está en vuelo (el motor ya tiene su mutex, pero
  // así no encolamos recargas de estado innecesarias).
  const inFlight = useRef(false);

  useEffect(() => {
    registerSyncUser(userId);
    if (!userId) return;

    let cancelled = false;

    const run = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const { pulled } = await syncNow(userId);
        if (cancelled || pulled === 0) return;
        const data = await loadAppData();
        if (!cancelled && data) {
          dispatch({ type: 'SET_APP_DATA', payload: data });
        }
      } catch {
        // Sin red o error puntual: se reintenta en el próximo disparo.
      } finally {
        inFlight.current = false;
      }
    };

    run();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') run();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [userId, dispatch]);
}
