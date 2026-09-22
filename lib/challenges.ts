import { WorkoutLog, WorkoutRoutine } from '../types';
import { countPersonalRecords } from './achievements';
import {
  buildCardioDays,
  buildCardioWeeks,
  cardioSessionFromLog,
  isoWeekKey,
  isoWeekRange,
  WeightSegment,
} from './cardio';
import { t } from './i18n';
import { hasScoringSets } from './progress';
import { getToday } from './utils';
import {
  countImprovedDays,
  groupLogsIntoWeekBlocks,
  logsBeforeBlock,
  orderedBlockNumbers,
} from './weeks';

/**
 * Retos semanales: objetivos cortos que se renuevan solos y se evalúan a partir
 * de los logs, como los logros (`badges.ts`). Nada se guarda: cada reto se
 * rederiva del historial cada vez, así que no puede desincronizarse.
 *
 * Dos relojes distintos, porque la app ya los tiene:
 * - Los retos de FUERZA viven en la "semana de la rutina" (el bloque en curso
 *   de la rutina activa, el mismo que pinta Inicio): completar todos los días,
 *   mejorar la semana anterior, batir un récord.
 * - Los de CARDIO viven en la semana natural (lunes-domingo) y en el día de
 *   hoy, que es como los cuenta la pestaña de Cardio.
 *
 * (Hubo un cuarto reto de fuerza, "Tres días", que ninguna pantalla pintaba:
 * se quitó del catálogo. Sus victorias ya apuntadas siguen contando para el
 * nivel, porque son claves guardadas, no recalculadas.)
 *
 * Lo que se guarda de forma permanente es cuántos retos se han superado
 * (`lib/level.ts`), que es lo que alimenta el nivel de la cuenta.
 */

export type ChallengeId =
  | 'full-week'
  | 'improve-3'
  | 'personal-record'
  | 'full-days'
  | 'first-marks'
  | 'kcal-day-100'
  | 'kcal-week-1000'
  | 'two-cardio';

export type ChallengeCategory = 'strength' | 'cardio';

/** En qué ventana se cuenta el reto (la pantalla lo dice junto al progreso). */
export type ChallengePeriod = 'routine-week' | 'calendar-week' | 'today';

export interface Challenge {
  id: ChallengeId;
  category: ChallengeCategory;
  /** Nombre de icono de MaterialCommunityIcons. */
  icon: string;
  name: string;
  /** La condición, en una línea. */
  description: string;
  period: ChallengePeriod;
  current: number;
  target: number;
  /** Unidad del progreso ("kcal", "días"...); vacío en los de sí/no. */
  unit: string;
  done: boolean;
  /**
   * Clave de la ventana en que se evalúa ("2026-W39" o el número de bloque de
   * la rutina): identifica el periodo para contar un reto superado una sola
   * vez por ventana (ver `lib/level.ts`).
   */
  periodKey: string;
}

/** Mejora mínima de un día sobre su sesión anterior para el reto "+3 %". */
export const IMPROVE_TARGET_PERCENT = 3;
/**
 * "+3 %" y "Récord personal" piden la mitad o más de los días / ejercicios que
 * la rutina PREVÉ para la semana (no de los hechos hasta ahora: con 4 días son
 * 2 días, se lleven 1 o 4). El objetivo es ese medio redondeado hacia arriba
 * (mínimo 1, para que sin rutina el reto se vea como 0/1 y no como 0/0).
 */
function halfOrMore(total: number): number {
  return Math.max(1, Math.ceil(total / 2));
}
export const KCAL_DAY_TARGET = 100;
export const KCAL_WEEK_TARGET = 1000;
export const TWO_CARDIO_TARGET = 2;

export interface ChallengesInput {
  logs: WorkoutLog[];
  routines: WorkoutRoutine[];
  activeRoutineId?: string;
  /** Peso corporal (tramos) para estimar kcal, como en Cardio. */
  weight?: number | WeightSegment[];
  /** Fecha `YYYY-MM-DD` que se toma como hoy (para tests). */
  today?: string;
}

function challenge(
  fields: Omit<Challenge, 'done' | 'current'> & { current: number }
): Challenge {
  return {
    ...fields,
    current: Math.min(fields.current, fields.target),
    done: fields.current >= fields.target,
  };
}

/** Los retos de fuerza de la semana en curso de la rutina activa. */
function strengthChallenges(
  logs: WorkoutLog[],
  routines: WorkoutRoutine[],
  activeRoutineId: string | undefined
): Challenge[] {
  const routine = routines.find((r) => r.id === activeRoutineId);
  const routineLogs = routine
    ? logs.filter((log) => log.routineId === routine.id && !log.cardioOnly)
    : [];
  const blocks = groupLogsIntoWeekBlocks(routineLogs, (log) => log.dayId);
  const ordered = orderedBlockNumbers(blocks);
  const block = ordered[ordered.length - 1];
  const weekLogs = block ? blocks[block] || [] : [];
  const history = block ? logsBeforeBlock(blocks, block) : [];
  const periodKey = routine ? `${routine.id}:${block ?? 0}` : 'none';

  const trainedDays = new Set(weekLogs.map((log) => log.dayId)).size;
  const routineDays = routine?.days.length ?? 0;
  // Ejercicios previstos en la semana según la rutina (todos sus días).
  const plannedExercises =
    routine?.days.reduce((sum, day) => sum + day.exercises.length, 0) ?? 0;

  const fullWeek = challenge({
    id: 'full-week',
    category: 'strength',
    icon: 'calendar-check',
    name: t('Semana completa'),
    description: t('Entrena todos los días de tu rutina.'),
    period: 'routine-week',
    current: routineDays > 0 ? trainedDays : 0,
    target: Math.max(1, routineDays),
    unit: t('días'),
    periodKey,
  });

  // Primera semana de la rutina (sin histórico): "+3 %" y "Récord" no se
  // pueden ganar porque no hay nada con lo que comparar, así que en su lugar
  // van dos retos de estreno que piden dejar la marca de salida bien anotada.
  if (history.length === 0) {
    return [fullWeek, ...firstWeekChallenges(weekLogs, routine, periodKey)];
  }

  const improvedDays = countImprovedDays(
    weekLogs,
    history,
    IMPROVE_TARGET_PERCENT
  );
  const records = countPersonalRecords(weekLogs, history);

  return [
    fullWeek,
    challenge({
      id: 'improve-3',
      category: 'strength',
      icon: 'trending-up',
      name: t('+3 %'),
      description: t('Mejora un 3 % en la mitad o más de los días.'),
      period: 'routine-week',
      current: improvedDays,
      target: halfOrMore(routineDays),
      unit: t('días'),
      periodKey,
    }),
    challenge({
      id: 'personal-record',
      category: 'strength',
      icon: 'medal-outline',
      name: t('Récord personal'),
      description: t(
        'Supera tu mejor sesión en la mitad o más de los ejercicios.'
      ),
      period: 'routine-week',
      current: records,
      target: halfOrMore(plannedExercises),
      unit: t('ejercicios'),
      periodKey,
    }),
  ];
}

/**
 * Retos de la primera semana de una rutina, en lugar de "+3 %" y "Récord":
 * - "Días completos": la mitad o más de los días con TODOS sus ejercicios
 *   anotados (series válidas), no a medias.
 * - "Primeras marcas": todos los ejercicios de la rutina con al menos una
 *   serie apuntada, para que la semana que viene haya con qué comparar.
 */
function firstWeekChallenges(
  weekLogs: WorkoutLog[],
  routine: WorkoutRoutine | undefined,
  periodKey: string
): Challenge[] {
  const routineDays = routine?.days.length ?? 0;
  const plannedExercises =
    routine?.days.reduce((sum, day) => sum + day.exercises.length, 0) ?? 0;

  // Ejercicios con alguna serie válida, por día de la rutina y en total.
  const doneByDay = new Map<string, Set<string>>();
  weekLogs.forEach((log) => {
    const done = doneByDay.get(log.dayId) ?? new Set<string>();
    log.exercises.forEach((exercise) => {
      if (hasScoringSets(exercise)) done.add(exercise.exerciseId);
    });
    doneByDay.set(log.dayId, done);
  });

  let fullDays = 0;
  let markedExercises = 0;
  routine?.days.forEach((day) => {
    const done = doneByDay.get(day.id);
    if (!done || day.exercises.length === 0) return;
    const marked = day.exercises.filter((ex) => done.has(ex.id)).length;
    markedExercises += marked;
    if (marked === day.exercises.length) fullDays += 1;
  });

  return [
    challenge({
      id: 'full-days',
      category: 'strength',
      icon: 'clipboard-check-outline',
      name: t('Días completos'),
      description: t(
        'Anota todos los ejercicios en la mitad o más de los días.'
      ),
      period: 'routine-week',
      current: fullDays,
      target: halfOrMore(routineDays),
      unit: t('días'),
      periodKey,
    }),
    challenge({
      id: 'first-marks',
      category: 'strength',
      icon: 'flag-outline',
      name: t('Primeras marcas'),
      description: t('Registra una serie en cada ejercicio de tu rutina.'),
      period: 'routine-week',
      current: markedExercises,
      target: Math.max(1, plannedExercises),
      unit: t('ejercicios'),
      periodKey,
    }),
  ];
}

/** Los retos de cardio de hoy y de la semana natural en curso. */
function cardioChallenges(
  logs: WorkoutLog[],
  weight: number | WeightSegment[] | undefined,
  today: string
): Challenge[] {
  const weekKey = isoWeekKey(today);
  const { start, end } = isoWeekRange(today);

  const days = buildCardioDays(logs, weight);
  const todayKcal = days.find((d) => d.date === today)?.totalKcal ?? 0;

  const week = buildCardioWeeks(logs, weight).find(
    (w) => w.weekKey === weekKey
  );
  const weekKcal = week?.totalKcal ?? 0;

  const cardioDays = new Set(
    logs
      .filter(
        (log) =>
          log.date >= start &&
          log.date <= end &&
          cardioSessionFromLog(log) != null
      )
      .map((log) => log.date)
  ).size;

  return [
    challenge({
      id: 'kcal-day-100',
      category: 'cardio',
      icon: 'fire',
      name: t('100 kcal hoy'),
      description: t('Quema 100 kcal de cardio en el día.'),
      period: 'today',
      current: Math.round(todayKcal),
      target: KCAL_DAY_TARGET,
      unit: 'kcal',
      periodKey: today,
    }),
    challenge({
      id: 'kcal-week-1000',
      category: 'cardio',
      icon: 'fire-circle',
      name: t('1000 kcal esta semana'),
      description: t('Quema 1000 kcal de cardio de lunes a domingo.'),
      period: 'calendar-week',
      current: Math.round(weekKcal),
      target: KCAL_WEEK_TARGET,
      unit: 'kcal',
      periodKey: weekKey,
    }),
    challenge({
      id: 'two-cardio',
      category: 'cardio',
      icon: 'run-fast',
      name: t('Dos cardios'),
      description: t('Haz cardio dos días distintos esta semana.'),
      period: 'calendar-week',
      current: cardioDays,
      target: TWO_CARDIO_TARGET,
      unit: t('días'),
      periodKey: weekKey,
    }),
  ];
}

/** El set de retos vigente, fuerza primero y cardio después. */
export function computeChallenges({
  logs,
  routines,
  activeRoutineId,
  weight,
  today = getToday(),
}: ChallengesInput): Challenge[] {
  return [
    ...strengthChallenges(logs, routines, activeRoutineId),
    ...cardioChallenges(logs, weight, today),
  ];
}

/** Días que quedan de la semana natural, contando hoy (domingo = 1). */
export function daysLeftInWeek(today: string = getToday()): number {
  const { end } = isoWeekRange(today);
  const ms =
    new Date(`${end}T00:00:00`).valueOf() -
    new Date(`${today}T00:00:00`).valueOf();
  return Math.max(1, Math.round(ms / (24 * 3600 * 1000)) + 1);
}

/**
 * "64 / 100 kcal", "3 / 4 días", "1,8 / 3 %" o "✓" según el reto. En
 * `compact` (hero cards, poco ancho) sin unidad ni espacios: "64/100".
 */
export function challengeProgressLabel(c: Challenge, compact = false): string {
  if (c.target === 1 && !c.unit) return c.done ? '✓' : '—';
  const current =
    c.unit === '%' ? String(c.current).replace('.', ',') : String(c.current);
  if (compact) return `${current}/${c.target}${c.unit === '%' ? ' %' : ''}`;
  return `${current} / ${c.target}${c.unit ? ` ${c.unit}` : ''}`;
}
