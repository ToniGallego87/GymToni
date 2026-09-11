import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { WeightSegment } from './cardio';
import { getCardioWeightHistory, setCardioWeightHistory } from './storage';
import { REST_TIMER_CHANNEL_ID } from './restTimerStore';
import { theme } from './theme';
import { t } from './i18n';

// expo-notifications no existe en web: se carga solo en nativo.
const Notifications: typeof import('expo-notifications') | null =
  Platform.OS !== 'web' ? require('expo-notifications') : null;

// El peso corporal, como singleton. No es un dato de adorno: las kcal de TODO el
// cardio se estiman con el peso VIGENTE en el momento de cada sesión
// (`weightForTimestamp`), por eso se guarda por tramos y no como un número
// suelto — cambiar de peso hoy no debe reescribir las calorías de hace un mes.
//
// Vive aquí y no dentro de una pantalla porque ahora lo tocan dos: se edita en
// Perfil → Peso corporal y lo consume Cardio para sus cálculos. Con el estado
// dentro de Cardio, actualizarlo desde Perfil dejaba la pestaña con el peso
// viejo hasta reiniciar la app.

/** Un día en ms: el umbral con el que un peso nuevo abre tramo o corrige el actual. */
const DAY_MS = 24 * 3600 * 1000;

/** A partir de cuándo se considera que el peso se ha quedado viejo. */
export const STALE_WEIGHT_DAYS = 14;

/** Cada cuánto se puede repetir el aviso, para no insistir a diario. */
const NOTIFY_EVERY_DAYS = 7;

const NOTIFIED_AT_KEY = 'bodyWeightStaleNotifiedAt';
const NOTIFICATION_ID_KEY = 'bodyWeightStaleNotificationId';

// El aviso se programa unas horas por delante: saltar una notificación con la
// app abierta —que es cuando se comprueba— sería avisar de algo que el usuario
// ya tiene delante.
const NOTIFY_DELAY_MS = 4 * 3600 * 1000;

type Listener = () => void;

const listeners = new Set<Listener>();
let segments: WeightSegment[] = [];
let loadStarted = false;

export function getBodyWeightSegments(): WeightSegment[] {
  return segments;
}

function publish(next: WeightSegment[]): void {
  segments = next;
  for (const listener of Array.from(listeners)) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tramos de peso, del más antiguo al más reciente. */
export function useBodyWeight(): WeightSegment[] {
  return useSyncExternalStore(
    subscribe,
    getBodyWeightSegments,
    getBodyWeightSegments
  );
}

/** Peso vigente, o null si nunca se ha anotado ninguno. */
export function currentBodyWeight(
  list: WeightSegment[] = segments
): number | null {
  return list.length ? list[list.length - 1].weight : null;
}

/** Cuándo se anotó por última vez (epoch ms), o null si no hay ninguno. */
export function lastWeightSetAt(
  list: WeightSegment[] = segments
): number | null {
  return list.length ? list[list.length - 1].setAt : null;
}

/** Días desde la última vez que se anotó el peso (null si no hay ninguno). */
export function daysSinceWeightUpdate(
  list: WeightSegment[] = segments
): number | null {
  const at = lastWeightSetAt(list);
  if (at == null) return null;
  return Math.floor((Date.now() - at) / DAY_MS);
}

/** Carga el histórico una sola vez por arranque. */
export async function loadBodyWeight(): Promise<void> {
  if (loadStarted) return;
  loadStarted = true;
  try {
    const history = await getCardioWeightHistory();
    if (history.length) publish(history);
  } catch {
    // Sin histórico se sigue: la app funciona con el peso por defecto.
  }
}

/**
 * Anota un peso nuevo. Dentro del mismo día CORRIGE el tramo en curso (te has
 * pesado dos veces, no has cambiado de peso); pasado un día abre tramo nuevo,
 * que es lo que hace que los cardios ya registrados conserven el peso que
 * tenías entonces.
 */
export async function saveBodyWeight(weight: number): Promise<void> {
  if (!Number.isFinite(weight) || weight <= 0) return;

  const now = Date.now();
  let next: WeightSegment[];

  if (segments.length === 0) {
    // Primer peso: cubre también todo lo anterior (appliesFrom 0).
    next = [{ weight, appliesFrom: 0, setAt: now }];
  } else {
    const last = segments[segments.length - 1];
    next =
      now - last.setAt < DAY_MS
        ? [...segments.slice(0, -1), { ...last, weight, setAt: now }]
        : [...segments, { weight, appliesFrom: now, setAt: now }];
  }

  publish(next);
  // El aviso de "peso viejo" deja de tener sentido en cuanto se actualiza.
  await cancelStaleWeightNotification();
  try {
    await setCardioWeightHistory(next);
  } catch {
    // El valor ya está en memoria; el siguiente guardado reintenta.
  }
}

// ─────────────────────── Aviso de peso desactualizado ───────────────────────

async function cancelStaleWeightNotification(): Promise<void> {
  if (!Notifications) return;
  try {
    const pending = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
    if (pending) {
      await Notifications.cancelScheduledNotificationAsync(pending);
      await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
    }
  } catch {
    // Un aviso que no se puede cancelar no rompe nada: solo llega de más.
  }
}

/**
 * Programa el recordatorio si el peso lleva más de dos semanas sin tocarse.
 *
 * Solo avisa a quien YA usa el dato: si nunca se ha anotado un peso no hay nada
 * que refrescar, y perseguir a alguien por un dato que no le importa es ruido.
 * Se repite como mucho una vez por semana.
 */
export async function maybeNotifyStaleWeight(): Promise<void> {
  if (!Notifications) return;

  const days = daysSinceWeightUpdate();
  if (days == null || days < STALE_WEIGHT_DAYS) return;

  try {
    const lastNotified = Number(
      (await AsyncStorage.getItem(NOTIFIED_AT_KEY)) ?? 0
    );
    if (Date.now() - lastNotified < NOTIFY_EVERY_DAYS * DAY_MS) return;

    await cancelStaleWeightNotification();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: t('¿Sigues pesando lo mismo?'),
        body: t(
          'Hace {n} días que no actualizas tu peso, y con él se calculan las kcal de tu cardio.',
          { n: days }
        ),
        icon: 'notification_icon',
        color: theme.colors.primary,
        data: { source: 'body-weight' },
      } as any,
      trigger: {
        date: new Date(Date.now() + NOTIFY_DELAY_MS),
        allowWhileIdle: true,
        channelId: REST_TIMER_CHANNEL_ID,
      } as any,
    });

    await AsyncStorage.setItem(NOTIFICATION_ID_KEY, id);
    await AsyncStorage.setItem(NOTIFIED_AT_KEY, String(Date.now()));
  } catch (error) {
    console.error('Error programando el aviso de peso:', error);
  }
}
