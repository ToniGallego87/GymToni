import { WorkoutLog, WorkoutDay, WorkoutRoutine } from '../types';
import { dateLocale } from './i18n';
import { theme } from './theme';

/**
 * Resuelve un día por su id recorriendo todas las rutinas. Fuente única del
 * bucle que Inicio, Detalle, el registro y el Calendario reimplementaban por
 * separado (getDay / getDayById / dayNumberForLog).
 */
export function findDayInRoutines(
  routines: WorkoutRoutine[],
  dayId: string
): WorkoutDay | undefined {
  for (const routine of routines) {
    const day = routine.days.find((d) => d.id === dayId);
    if (day) return day;
  }
  return undefined;
}

export function generateId(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }

  // UUID v4 manual: Hermes no expone crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function formatDate(timestamp: number): string {
  // Sigue el idioma activo (dateLocale, binding vivo de i18n), como el resto de
  // fechas de la app; antes fijaba 'es-ES' y en inglés salía el día en español.
  const date = new Date(timestamp);
  return date
    .toLocaleDateString(dateLocale, {
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

/**
 * Una clave `YYYY-MM-DD` leída como fecha LOCAL, al mediodía.
 *
 * Las claves de día no llevan hora, así que hay que ponerle una para construir
 * el `Date` con el que se pinta. Se usa el mediodía y no la medianoche porque
 * es el punto del día que ningún salto horario puede mover de fecha; lo que se
 * ve es lo mismo, pero no depende de que la medianoche exista en el huso de
 * quien entrena.
 */
function dateFromKey(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

/**
 * "12 jul" a partir de una clave `YYYY-MM-DD`.
 *
 * Fuente única del formato corto de fecha: lo escribían por su cuenta Cardio
 * (`dayMonth`, el rango de la semana) y Progreso por ejercicio (`shortDate`,
 * el eje de la gráfica y los récords) — la MISMA implementación letra por
 * letra bajo dos nombres distintos.
 */
export function shortDayMonth(dateStr: string): string {
  return dateFromKey(dateStr)
    .toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })
    .replace('.', '');
}

/**
 * "12 de julio de 2025" a partir de una clave `YYYY-MM-DD`. El hermano largo
 * de `shortDayMonth`, con los mismos dos consumidores que lo tenían repetido
 * (Progreso por ejercicio y Logros).
 */
export function longDate(dateStr: string): string {
  return dateFromKey(dateStr)
    .toLocaleDateString(dateLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    .replace('.', '');
}

/**
 * `formatDate` desde una clave `YYYY-MM-DD` en vez de un timestamp:
 * "Lunes, 12/07/2025". El Detalle lo escribía a mano con las mismas opciones y
 * la misma capitalización, en la otra rama de la misma expresión en la que ya
 * llamaba a `formatDate`.
 */
export function formatDateFromKey(dateStr: string): string {
  return formatDate(dateFromKey(dateStr).getTime());
}

/**
 * Día de una fecha como clave `YYYY-MM-DD` en la zona horaria DEL MÓVIL.
 *
 * Fuente única de "qué día es este instante" en toda la app. Antes se sacaba
 * con `toISOString()`, que es UTC: en husos con desfase, un entreno metido de
 * madrugada se guardaba con la fecha del día anterior y el calendario marcaba
 * "hoy" en la casilla equivocada. El día de la app es el del reloj de quien
 * entrena, no el de Greenwich.
 */
export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getToday(): string {
  return dateKey(new Date());
}

/**
 * Segundos de descanso en `m:ss` ("150" → "2:30"). Fuente única del formateo
 * que la ficha de la rutina y el registro tenían duplicado con dos nombres
 * (`formatTime` / `formatTimerLabel`) y el mismo cuerpo.
 *
 * La cuenta atrás EN CURSO usa su propio formato (`mm:ss`, con los minutos
 * rellenados) en `ExerciseInputField`: ahí el ancho fijo evita que el número
 * baile mientras corre.
 */
export function formatRestTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

/**
 * Combina una fecha (YYYY-MM-DD) con la hora de un timestamp de referencia.
 * Se usa al reasignar un entreno a otro día: cambia el día pero conserva la
 * hora, para que `createdAt` (con el que se ordenan y agrupan las semanas)
 * siga el nuevo día manteniendo el orden intradía frente a otras sesiones.
 */
export function combineDateWithTime(
  dateStr: string,
  baseTimestamp: number
): number {
  const base = new Date(baseTimestamp);
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(
    year,
    month - 1,
    day,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds()
  ).getTime();
}

/**
 * Devuelve un timestamp comparable para un log.
 * Prioriza createdAt; si falta, deriva de la fecha (YYYY-MM-DD); si no, 0.
 */
export function getLogTimestamp(log: WorkoutLog | null | undefined): number {
  if (!log) return 0;
  if (typeof log.createdAt === 'number' && Number.isFinite(log.createdAt)) {
    return log.createdAt;
  }
  if (log.date) {
    return new Date(`${log.date}T00:00:00`).getTime();
  }
  return 0;
}

/**
 * Día de un log como clave `YYYY-MM-DD`, comparable con `getToday()`. Usa la
 * fecha guardada y, si el log es antiguo (o viene de un backup) y no la trae,
 * la deriva de `createdAt` con el MISMO criterio que `getToday()` (día local):
 * es la ÚNICA forma de responder "¿es de hoy?" en la app. Hermana de
 * `getLogTimestamp`: la misma caída a `createdAt`, pero en día en vez de
 * instante.
 *
 * La caída es por valor vacío (`||`), no solo por `undefined`: un `date: ""`
 * de un backup manipulado tiene que resolverse igual que la ausencia del campo.
 */
export function logDateKey(log: WorkoutLog): string {
  return log.date || dateKey(new Date(log.createdAt));
}

export type ImprovementKind = 'up' | 'down' | 'neutral';

/**
 * Color del tema para un tipo de mejora (verde sube / rojo baja / ámbar igual).
 * Fuente única para que las pantallas no reimplementen el mapeo tipo→color.
 */
export function getImprovementColor(kind: ImprovementKind): string {
  return kind === 'up'
    ? theme.colors.success
    : kind === 'down'
    ? theme.colors.error
    : theme.colors.warning;
}
