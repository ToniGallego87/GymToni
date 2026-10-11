import { Platform } from 'react-native';
import { WorkoutLog, WorkoutRoutine } from '../types';
import { isCardioOnlyLog } from './cardio';
import { dateKey, getLogTimestamp, logDateKey } from './utils';
import {
  getWorkoutRemindersEnabled,
  setWorkoutRemindersEnabled,
} from './appSettings';
import { theme } from './theme';
import { t } from './i18n';

// expo-notifications no existe en web: se carga solo en nativo.
const Notifications: typeof import('expo-notifications') | null =
  Platform.OS !== 'web' ? require('expo-notifications') : null;

// Recordatorio de entreno que sigue el ritmo del propio usuario, sin nada que
// configurar salvo apagarlo:
//
//  - Solo avisa si la rutina activa tiene al menos un entreno de fuerza: a quien
//    no ha empezado no se le insiste.
//  - Cada entreno de fuerza de los últimos 7 días programa un aviso a la semana
//    siguiente, UNA HORA ANTES de la hora a la que se hizo.
//  - Si pasan 14 días desde el último entreno, un aviso para animar a volver.
//
// El texto NO nombra el día: con la app cerrada no se puede saber qué toca (un
// aviso ignorado cambia la sugerencia), así que se decide al TOCARLO, con
// `currentWeekDayState`, y nunca contradice lo que la app propone.
//
// Con la app cerrada no se calcula nada: los avisos se rehacen desde cero cada
// vez que cambian los entrenos o la rutina activa (y al abrir la app). Guardar
// el entreno de hoy cancela así el aviso de hoy.

export const WORKOUT_REMINDER_SOURCE = 'workout-reminder';
const CHANNEL_ID = 'workout-reminders';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const WEEK_MS = 7 * DAY_MS;
/** Antelación del aviso respecto a la hora del entreno de la semana pasada. */
const LEAD_MS = 60 * MINUTE_MS;
/** Días sin entrenar tras los que se anima a volver. */
export const COMEBACK_DAYS = 14;

export interface PlannedReminder {
  /** Cuándo salta (epoch ms). */
  at: number;
  /** `weekly`: a la semana de un entreno; `comeback`: tras 14 días sin entrenar. */
  kind: 'weekly' | 'comeback';
}

/**
 * Avisos que tocan a partir de `now`, ordenados. Función pura (la usa el test):
 * no sabe nada de notificaciones.
 */
export function planWorkoutReminders(
  logs: WorkoutLog[],
  activeRoutine: WorkoutRoutine | undefined,
  now: number = Date.now()
): PlannedReminder[] {
  if (!activeRoutine) return [];
  const strengthLogs = logs.filter((log) => !isCardioOnlyLog(log));
  if (!strengthLogs.some((log) => log.routineId === activeRoutine.id)) {
    return [];
  }

  const trainedDates = new Set(strengthLogs.map(logDateKey));
  const plan: PlannedReminder[] = [];
  const plannedDates = new Set<string>();

  strengthLogs.forEach((log) => {
    const trainedAt = getLogTimestamp(log);
    const sameTimeNextWeek = trainedAt + WEEK_MS;
    const at = sameTimeNextWeek - LEAD_MS;
    if (at <= now) return;
    // Un aviso por fecha, y ninguno el día que ya se ha entrenado.
    const targetDate = dateKey(new Date(sameTimeNextWeek));
    if (trainedDates.has(targetDate) || plannedDates.has(targetDate)) return;
    plannedDates.add(targetDate);
    plan.push({ at, kind: 'weekly' });
  });

  const lastTrainedAt = Math.max(...strengthLogs.map(getLogTimestamp));
  const comebackAt = lastTrainedAt + COMEBACK_DAYS * DAY_MS - LEAD_MS;
  if (comebackAt > now) plan.push({ at: comebackAt, kind: 'comeback' });

  return plan.sort((a, b) => a.at - b.at);
}

let channelReady = false;

async function ensureChannel(): Promise<void> {
  if (!Notifications || channelReady || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: t('Recordatorios de entreno'),
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: theme.colors.primary,
    sound: 'default',
  });
  channelReady = true;
}

async function cancelWorkoutReminders(): Promise<void> {
  if (!Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(
        (request) =>
          (request.content.data as Record<string, unknown> | undefined)
            ?.source === WORKOUT_REMINDER_SOURCE
      )
      .map((request) =>
        Notifications!.cancelScheduledNotificationAsync(request.identifier)
      )
  );
}

// Últimos datos con los que se programó: al encender el ajuste se reprograma
// sin que la pantalla de Configuración tenga que conocer los entrenos.
let lastInputs: {
  logs: WorkoutLog[];
  activeRoutine: WorkoutRoutine | undefined;
} | null = null;

// Las reprogramaciones van en fila: dos a la vez (guardar serie a serie dispara
// varias) podrían cancelar y duplicar avisos entre sí.
let queue: Promise<void> = Promise.resolve();

async function reschedule(
  logs: WorkoutLog[],
  activeRoutine: WorkoutRoutine | undefined
): Promise<void> {
  if (!Notifications) return;
  await cancelWorkoutReminders();
  if (!getWorkoutRemindersEnabled()) return;
  // Nunca se pide permiso desde aquí: lo pide el ajuste al encenderse (o el
  // temporizador de descanso). Sin permiso, simplemente no se programa.
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted') return;

  const plan = planWorkoutReminders(logs, activeRoutine);
  if (plan.length === 0) return;
  await ensureChannel();

  for (const reminder of plan) {
    const weekly = reminder.kind === 'weekly';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: weekly
          ? t('¿Listo para tu siguiente entrenamiento?')
          : t('¿Volvemos al gym?'),
        body: weekly
          ? t('Pulsa cuando quieras comenzar.')
          : t('Llevas dos semanas sin entrenar. Toca para retomarlo donde lo dejaste.'),
        icon: 'notification_icon',
        color: theme.colors.primary,
        data: { source: WORKOUT_REMINDER_SOURCE },
      } as any,
      trigger: {
        date: new Date(reminder.at),
        allowWhileIdle: true,
        channelId: CHANNEL_ID,
      } as any,
    });
  }
}

/** Rehace los avisos con los entrenos y la rutina activa actuales. */
export function rescheduleWorkoutReminders(
  logs: WorkoutLog[],
  activeRoutine: WorkoutRoutine | undefined
): Promise<void> {
  lastInputs = { logs, activeRoutine };
  queue = queue
    .then(() => reschedule(logs, activeRoutine))
    .catch((error) =>
      console.error('Error programando los recordatorios de entreno:', error)
    );
  return queue;
}

/**
 * Enciende o apaga los recordatorios. Al encender se pide el permiso de
 * notificaciones si aún no está concedido. Devuelve si quedan activos de verdad
 * (sin permiso, el ajuste vuelve a apagado para no prometer algo que no pasa).
 */
export async function setWorkoutReminders(enabled: boolean): Promise<boolean> {
  if (enabled && Notifications) {
    try {
      let { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        ({ status } = await Notifications.requestPermissionsAsync());
      }
      if (status !== 'granted') {
        setWorkoutRemindersEnabled(false);
        return false;
      }
    } catch (error) {
      console.error('Error pidiendo permiso de notificaciones:', error);
    }
  }
  setWorkoutRemindersEnabled(enabled);
  if (lastInputs) {
    await rescheduleWorkoutReminders(lastInputs.logs, lastInputs.activeRoutine);
  } else if (!enabled) {
    queue = queue.then(cancelWorkoutReminders).catch(() => undefined);
    await queue;
  }
  return enabled;
}
