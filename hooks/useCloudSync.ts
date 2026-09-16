import { Dispatch, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { WorkoutAction, WorkoutRoutine } from '../types';
import { useSession } from '@lib/cloud/auth';
import { refreshLinkedRoutines } from '@lib/cloud/social';
import { registerSyncUser, syncNow } from '@lib/cloud/sync';
import { loadAppData } from '@lib/storage';

// Sincronización de fondo (Fase 3). Mientras haya sesión, sincroniza al iniciar
// sesión, al volver la app a primer plano y deja el usuario registrado para el
// push automático tras cada escritura (lib/cloud/sync + lib/persistence).
//
// Si el pull trae cambios, recarga el estado desde el SQLite ya actualizado y lo
// vuelca en el reducer (SET_APP_DATA) para reflejar en la UI lo bajado de la nube.
//
// Después refresca las rutinas ENLAZADAS de la comunidad: son de otra persona,
// así que el pull (que solo baja lo tuyo) no las toca, y sin este paso eran una
// foto del día en que se añadieron. Cada una que haya cambiado entra por
// UPDATE_ROUTINE: la persistencia no encola al outbox las enlazadas, así que el
// refresco se queda en local y no choca con la RLS del autor.
export function useCloudSync(
  dispatch: Dispatch<WorkoutAction>,
  routines: WorkoutRoutine[]
): void {
  const { user } = useSession();
  const userId = user?.id ?? null;
  // Evita relanzar mientras uno está en vuelo (el motor ya tiene su mutex, pero
  // así no encolamos recargas de estado innecesarias).
  const inFlight = useRef(false);
  // Las rutinas en un ref: el sync las lee al arrancar, pero cambiarlas no
  // debe relanzarlo (se dispara por sesión y por primer plano, no por edición).
  const routinesRef = useRef(routines);
  routinesRef.current = routines;

  useEffect(() => {
    registerSyncUser(userId);
    if (!userId) return;

    let cancelled = false;

    const run = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const { pulled } = await syncNow(userId);
        if (cancelled) return;
        let current = routinesRef.current;
        if (pulled > 0) {
          const data = await loadAppData();
          if (cancelled) return;
          if (data) {
            dispatch({ type: 'SET_APP_DATA', payload: data });
            current = data.routines;
          }
        }
        const changed = await refreshLinkedRoutines(current);
        if (cancelled) return;
        for (const routine of changed) {
          dispatch({ type: 'UPDATE_ROUTINE', payload: routine });
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
