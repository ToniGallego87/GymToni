import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import { setPipAutoEnter } from './pipTimer';
import { theme } from './theme';
import { t } from './i18n';

// expo-notifications no existe en web: se carga solo en nativo.
const Notifications: typeof import('expo-notifications') | null =
  Platform.OS !== 'web' ? require('expo-notifications') : null;

// El temporizador de DESCANSO de la app, entero: la cuenta atrás, su
// notificación y la ventanita flotante.
//
// Vive AQUÍ y no en la pantalla de registro a propósito. Cuando era estado de
// esa pantalla, la navegación —montaje condicional por `screen.type`— lo
// desmontaba al salir, y con él se iban las tres cosas a la vez: la cuenta, el
// aviso programado y la ventanita. Resultado absurdo: minimizar la app entera
// conservaba el descanso (el PiP lo tenía resuelto) pero tocar "Calendario"
// para mirar algo entre serie y serie lo mataba. Como singleton, el descanso
// sobrevive a la navegación y solo muere cuando toca (ver `stopRestTimer`).
//
// Se guarda `endAt` (marca ABSOLUTA) y no los segundos que quedan: quien pinte
// resta contra el reloj, así que no puede haber dos cuentas desincronizadas y
// da igual cuánto tiempo estuviera el JS congelado en segundo plano.

export const REST_TIMER_CHANNEL_ID = 'rest-timer-v5';

/** Patrón de vibración del final del descanso (igual que el del canal). */
export const REST_TIMER_VIBRATION = [0, 300, 150, 300, 150, 300];

export interface RestTimerSnapshot {
  /** Momento (Date.now) en el que termina el descanso. */
  endAt: number;
  /** Ejercicio que lo lanzó: el registro lo usa para saber en qué tarjeta va. */
  exerciseId: string;
  exerciseName: string;
  /** Día de la rutina, para poder volver a su registro desde fuera. */
  dayId: string;
  dayName: string;
  routineId: string;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let current: RestTimerSnapshot | null = null;
let notificationId: string | null = null;
let expiry: ReturnType<typeof setTimeout> | null = null;

export function getRestTimer(): RestTimerSnapshot | null {
  return current;
}

function publish(next: RestTimerSnapshot | null): void {
  if (current === next) return;
  current = next;
  for (const listener of Array.from(listeners)) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Descanso en curso (null si no hay ninguno). */
export function useRestTimer(): RestTimerSnapshot | null {
  return useSyncExternalStore(subscribe, getRestTimer, getRestTimer);
}

/** Segundos que quedan de un descanso, contra el reloj. Nunca negativo. */
export function restSecondsLeft(snapshot: RestTimerSnapshot | null): number {
  if (!snapshot) return 0;
  return Math.max(0, Math.ceil((snapshot.endAt - Date.now()) / 1000));
}

/**
 * Cuenta atrás viva del descanso en curso. La comparten la tarjeta del registro
 * y la ventanita flotante: las dos restan contra el mismo `endAt`, así que no
 * pueden marcar segundos distintos.
 */
export function useRestSecondsLeft(): number {
  const timer = useRestTimer();
  const [seconds, setSeconds] = useState(() => restSecondsLeft(timer));

  useEffect(() => {
    if (!timer) {
      setSeconds(0);
      return;
    }
    const tick = () => setSeconds(restSecondsLeft(timer));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  return seconds;
}

// ─────────────────────────── Notificación del final ───────────────────────────

async function cancelNotification(): Promise<void> {
  const pending = notificationId;
  notificationId = null;
  if (!pending || !Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(pending);
  } catch (error) {
    console.error('Error canceling timer notification:', error);
  }
}

async function scheduleNotification(
  seconds: number,
  snapshot: RestTimerSnapshot
): Promise<void> {
  if (!Notifications || seconds <= 0) return;
  await cancelNotification();

  try {
    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: t('Descanso finalizado'),
        body: t('Es hora de tu siguiente serie'),
        icon: 'notification_icon',
        color: theme.colors.primary,
        sound: 'default',
        vibrate: REST_TIMER_VIBRATION,
        priority: Notifications.AndroidNotificationPriority.MAX,
        // Tocar el aviso abre el registro de ese día (ver App.tsx).
        data: {
          source: 'rest-timer',
          dayId: snapshot.dayId,
          routineId: snapshot.routineId,
        },
      } as any,
      trigger: {
        date: new Date(Date.now() + seconds * 1000),
        allowWhileIdle: true,
        channelId: REST_TIMER_CHANNEL_ID,
      } as any,
    });
  } catch (error) {
    console.error('Error scheduling timer notification:', error);
  }
}

// ───────────────────────────── Ciclo de vida ─────────────────────────────

function disarmExpiry(): void {
  if (expiry) {
    clearTimeout(expiry);
    expiry = null;
  }
}

// Cierra el descanso al llegar a cero y vibra. La notificación ya ha sonado
// sola en ese instante, así que aquí no hay nada que cancelar.
function armExpiry(endAt: number): void {
  disarmExpiry();
  expiry = setTimeout(
    () => {
      expiry = null;
      notificationId = null;
      Vibration.vibrate(REST_TIMER_VIBRATION);
      publish(null);
      setPipAutoEnter(false);
    },
    Math.max(0, endAt - Date.now())
  );
}

/**
 * Arranca (o reinicia) el descanso. Enciende de paso la entrada automática en
 * la ventanita flotante: minimizar la app solo la abre si hay cuenta atrás.
 */
export function startRestTimer(
  input: Omit<RestTimerSnapshot, 'endAt'> & { seconds: number }
): void {
  const { seconds, ...rest } = input;
  const safeSeconds = Math.max(1, Math.round(seconds));
  const snapshot: RestTimerSnapshot = {
    ...rest,
    endAt: Date.now() + safeSeconds * 1000,
  };

  publish(snapshot);
  setPipAutoEnter(true);
  armExpiry(snapshot.endAt);
  void scheduleNotification(safeSeconds, snapshot);
}

/** Alarga el descanso en curso (el "+30s"). Reprograma también el aviso. */
export function extendRestTimer(extraSeconds: number): void {
  if (!current) return;

  const snapshot: RestTimerSnapshot = {
    ...current,
    endAt: current.endAt + extraSeconds * 1000,
  };
  publish(snapshot);
  armExpiry(snapshot.endAt);
  void scheduleNotification(restSecondsLeft(snapshot), snapshot);
}

/**
 * Corta el descanso: lo que hace el "Saltar" de la tarjeta y el de la barra
 * flotante. Cancela el aviso, que si no sonaría con el descanso ya cerrado.
 *
 * NAVEGAR NO LLAMA A ESTO: salir del registro a mirar el calendario entre serie
 * y serie no es dar por terminado el descanso, que era justo el defecto.
 */
export function stopRestTimer(): void {
  disarmExpiry();
  publish(null);
  setPipAutoEnter(false);
  void cancelNotification();
}

/**
 * Descarta un descanso ya vencido. Hace falta porque los timers de JS se
 * congelan con la app en segundo plano: al volver, el `setTimeout` del final
 * puede seguir sin dispararse aunque la hora ya haya pasado (el usuario se
 * habrá enterado por la notificación, que sí corre en el sistema).
 */
export function syncRestTimer(): void {
  if (!current || restSecondsLeft(current) > 0) return;
  disarmExpiry();
  notificationId = null;
  publish(null);
  setPipAutoEnter(false);
}

// Reconciliación al volver a primer plano, por lo mismo de arriba. Suscripción
// de módulo (mismo patrón que `glassTokens`): el store es un singleton y vive
// tanto como la app.
AppState.addEventListener('change', (next) => {
  if (next === 'active') syncRestTimer();
});
