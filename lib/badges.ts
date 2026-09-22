import { WorkoutLog, WorkoutRoutine } from '../types';
import { cardioSessionFromLog } from './cardio';
import { t } from './i18n';
import {
  computeStreak,
  groupLogsIntoWeekBlocks,
  improvementAgainstHistory,
  isWeekCompleted,
  logsBeforeBlock,
  orderedBlockNumbers,
} from './weeks';

/**
 * Logros (insignias) de la pantalla "Logros" de Perfil.
 *
 * Es un catálogo FIJO que se desbloquea con el histórico: todo se deriva de los
 * logs cada vez que se pide, así que no hay columna nueva, ni migración, ni
 * sync. Distinto de `lib/achievements.ts`, que es el póster de UNA semana (los
 * "hitos").
 *
 * `current`/`target` dan el progreso de los que aún no están ("37 / 50"); en
 * los de sí/no (semana completa, récord) el objetivo es 1. `unlockedAt` es la
 * fecha (`YYYY-MM-DD`) del entreno que cruzó el objetivo: también se deriva,
 * así que un logro puede "moverse" si se borra historial, que es lo honesto.
 */
export type BadgeId =
  | 'first-workout'
  | 'workouts-10'
  | 'workouts-50'
  | 'workouts-100'
  | 'workouts-200'
  | 'workouts-500'
  | 'first-cardio'
  | 'cardio-10'
  | 'cardio-50'
  | 'cardio-100'
  | 'full-week'
  | 'streak-4'
  | 'personal-record';

/** Tipo de logro: la pantalla los agrupa y ordena por esto. */
export type BadgeCategory = 'strength' | 'cardio' | 'weeks' | 'progress';

export const BADGE_CATEGORY_ORDER: BadgeCategory[] = [
  'strength',
  'cardio',
  'weeks',
  'progress',
];

export function badgeCategoryLabel(category: BadgeCategory): string {
  switch (category) {
    case 'strength':
      return t('Fuerza');
    case 'cardio':
      return t('Cardio');
    case 'weeks':
      return t('Semanas');
    case 'progress':
      return t('Progreso');
  }
}

export interface Badge {
  id: BadgeId;
  category: BadgeCategory;
  /** Nombre de icono de MaterialCommunityIcons. */
  icon: string;
  name: string;
  /** La condición, en una línea. */
  description: string;
  current: number;
  target: number;
  unlocked: boolean;
  /** Fecha `YYYY-MM-DD` en que se cruzó el objetivo; solo si `unlocked`. */
  unlockedAt?: string;
}

/** Cifras de las que salen los logros. Expuesto para el test. */
export interface BadgeStats {
  /** Sesiones de fuerza (las "solo cardio" no cuentan). */
  workouts: number;
  /** Sesiones con cardio, de cualquier tipo. */
  cardioSessions: number;
  /** Semanas completas (todos los días de su rutina entrenados). */
  fullWeeks: number;
  /** Mayor racha de semanas completas seguidas, en cualquier rutina. */
  bestStreak: number;
  /** Semanas que mejoraron respecto a la misma semana anterior. */
  improvedWeeks: number;
}

/**
 * Fechas ordenadas en que se alcanzó cada valor de cada cifra: `workouts[n-1]`
 * es la fecha del entreno número n, `bestStreak[n-1]` la de la primera vez que
 * una racha llegó a n semanas, etc. De aquí sale `unlockedAt`.
 */
export interface BadgeDates {
  workouts: string[];
  cardioSessions: string[];
  fullWeeks: string[];
  bestStreak: string[];
  improvedWeeks: string[];
}

function byDate(a: WorkoutLog, b: WorkoutLog): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt;
}

/** La fecha del último entreno de una semana: cuando la semana "se cerró". */
function lastDate(weekLogs: WorkoutLog[]): string {
  return [...weekLogs].sort(byDate)[weekLogs.length - 1]?.date ?? '';
}

export function computeBadgeStats(
  logs: WorkoutLog[],
  routines: WorkoutRoutine[]
): BadgeStats {
  return computeBadgeStatsWithDates(logs, routines).stats;
}

export function computeBadgeStatsWithDates(
  logs: WorkoutLog[],
  routines: WorkoutRoutine[]
): { stats: BadgeStats; dates: BadgeDates } {
  const sorted = [...logs].sort(byDate);
  const strengthLogs = sorted.filter((log) => !log.cardioOnly);
  const workoutDates = strengthLogs.map((log) => log.date);
  const cardioDates = sorted
    .filter((log) => cardioSessionFromLog(log) != null)
    .map((log) => log.date);

  const fullWeekDates: string[] = [];
  const improvedWeekDates: string[] = [];
  // Racha: fecha en que se alcanzó por primera vez cada longitud (índice n-1).
  const streakDates: string[] = [];

  // Las semanas se calculan rutina a rutina, con los mismos bloques que Inicio
  // (agrupado por dayId: no depende de que la rutina siga igual).
  routines.forEach((routine) => {
    const routineLogs = strengthLogs.filter(
      (log) => log.routineId === routine.id
    );
    if (!routineLogs.length || !routine.days.length) return;
    const blocks = groupLogsIntoWeekBlocks(routineLogs, (log) => log.dayId);
    const ordered = orderedBlockNumbers(blocks);

    ordered.forEach((block) => {
      const weekLogs = blocks[block] || [];
      const closedAt = lastDate(weekLogs);
      if (isWeekCompleted(weekLogs, routine.days)) fullWeekDates.push(closedAt);
      // La racha "hasta este bloque": el máximo de todas es la mejor racha.
      const streak = computeStreak(blocks, routine.days, block).weeks;
      for (let n = 1; n <= streak; n++) {
        if (!streakDates[n - 1] || closedAt < streakDates[n - 1]) {
          streakDates[n - 1] = closedAt;
        }
      }
      const improvement = improvementAgainstHistory(
        weekLogs,
        logsBeforeBlock(blocks, block)
      );
      if (improvement && improvement.isImproved && improvement.percent > 0) {
        improvedWeekDates.push(closedAt);
      }
    });
  });

  fullWeekDates.sort();
  improvedWeekDates.sort();

  return {
    stats: {
      workouts: workoutDates.length,
      cardioSessions: cardioDates.length,
      fullWeeks: fullWeekDates.length,
      bestStreak: streakDates.length,
      improvedWeeks: improvedWeekDates.length,
    },
    dates: {
      workouts: workoutDates,
      cardioSessions: cardioDates,
      fullWeeks: fullWeekDates,
      bestStreak: streakDates,
      improvedWeeks: improvedWeekDates,
    },
  };
}

function badge(
  id: BadgeId,
  category: BadgeCategory,
  icon: string,
  name: string,
  description: string,
  dates: string[],
  target: number
): Badge {
  const current = dates.length;
  const unlocked = current >= target;
  return {
    id,
    category,
    icon,
    name,
    description,
    current: Math.min(current, target),
    target,
    unlocked,
    unlockedAt: unlocked ? dates[target - 1] : undefined,
  };
}

/** El catálogo entero, agrupado por tipo y en orden de dificultad dentro de cada uno. */
export function computeBadges(
  logs: WorkoutLog[],
  routines: WorkoutRoutine[]
): Badge[] {
  const { dates } = computeBadgeStatsWithDates(logs, routines);
  return [
    // --- Fuerza ---
    badge(
      'first-workout',
      'strength',
      'dumbbell',
      t('Primer entreno'),
      t('Registra tu primera sesión de fuerza.'),
      dates.workouts,
      1
    ),
    badge(
      'workouts-10',
      'strength',
      'fire',
      t('En marcha'),
      t('Completa 10 sesiones de fuerza.'),
      dates.workouts,
      10
    ),
    badge(
      'workouts-50',
      'strength',
      'medal-outline',
      t('Medio centenar'),
      t('Completa 50 sesiones de fuerza.'),
      dates.workouts,
      50
    ),
    badge(
      'workouts-100',
      'strength',
      'trophy',
      t('Centurión'),
      t('Completa 100 sesiones de fuerza.'),
      dates.workouts,
      100
    ),
    badge(
      'workouts-200',
      'strength',
      'shield-star-outline',
      t('Veterano'),
      t('Completa 200 sesiones de fuerza.'),
      dates.workouts,
      200
    ),
    badge(
      'workouts-500',
      'strength',
      'crown-outline',
      t('Leyenda'),
      t('Completa 500 sesiones de fuerza.'),
      dates.workouts,
      500
    ),
    // --- Cardio ---
    badge(
      'first-cardio',
      'cardio',
      'run-fast',
      t('Primer cardio'),
      t('Registra tu primera sesión de cardio.'),
      dates.cardioSessions,
      1
    ),
    badge(
      'cardio-10',
      'cardio',
      'heart-pulse',
      t('Corazón en marcha'),
      t('Completa 10 sesiones de cardio.'),
      dates.cardioSessions,
      10
    ),
    badge(
      'cardio-50',
      'cardio',
      'shoe-sneaker',
      t('Fondista'),
      t('Completa 50 sesiones de cardio.'),
      dates.cardioSessions,
      50
    ),
    badge(
      'cardio-100',
      'cardio',
      'medal',
      t('Maratoniano'),
      t('Completa 100 sesiones de cardio.'),
      dates.cardioSessions,
      100
    ),
    // --- Semanas ---
    badge(
      'full-week',
      'weeks',
      'calendar-check-outline',
      t('Semana redonda'),
      t('Entrena todos los días de tu rutina en una misma semana.'),
      dates.fullWeeks,
      1
    ),
    badge(
      'streak-4',
      'weeks',
      'lightning-bolt',
      t('Un mes seguido'),
      t('Encadena 4 semanas completas sin faltar a un día.'),
      dates.bestStreak,
      4
    ),
    // --- Progreso ---
    badge(
      'personal-record',
      'progress',
      'trending-up',
      t('Récord personal'),
      t('Mejora una semana respecto a la anterior.'),
      dates.improvedWeeks,
      1
    ),
  ];
}
