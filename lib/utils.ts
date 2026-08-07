import { WorkoutLog, WorkoutDay, WorkoutRoutine } from '../types';
import { dateLocale, localizeDecimals } from './i18n';
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

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
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

export type ImprovementKind = 'up' | 'down' | 'neutral';

export interface ImprovementDisplay {
  symbol: string;
  display: string | number;
  kind: ImprovementKind;
}

/**
 * Normaliza una mejora ({ isImproved, percent }) a símbolo + texto + tipo,
 * para que cada pantalla solo tenga que mapear el tipo a su estilo/color.
 */
export function getImprovementDisplay(imp: {
  isImproved: boolean;
  percent: number;
}): ImprovementDisplay {
  // El decimal se pinta con el separador del idioma ("9,1%" en español).
  const roundedPercent =
    imp.percent % 1 === 0
      ? Math.round(imp.percent)
      : localizeDecimals(imp.percent.toFixed(1));

  if (imp.percent === 0) {
    return { symbol: '=', display: roundedPercent, kind: 'neutral' };
  }

  return {
    symbol: imp.isImproved ? '↑' : '↓',
    display: roundedPercent,
    kind: imp.isImproved ? 'up' : 'down',
  };
}

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
