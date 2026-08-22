import { WorkoutLog } from '../types';
import {
  buildImprovementFromStrengthScores,
  getTotalSetsStrengthScore,
} from './progress';
import { improvementAgainstHistory } from './weeks';
import { getLogTimestamp } from './utils';
import { localizeDecimals, t } from './i18n';

/** Ejercicio con mayor mejora respecto a la misma semana anterior. */
export interface TopImprovement {
  exerciseName: string;
  percent: number;
}

/** Mayor peso movido en una serie válida de la semana. */
export interface MaxLift {
  exerciseName: string;
  weight: number;
  reps: number;
}

/** Punto de la serie de progreso semanal (para la mini-gráfica del póster). */
export interface WeekProgressDatum {
  week: number;
  improvement: number;
}

/**
 * Categoría de un logro candidato. El selector pinta como mucho un logro por
 * categoría (mientras haya opciones) para que el póster no repita mensajes.
 */
export type SlotCategory =
  | 'global'
  | 'exercise'
  | 'record'
  | 'consistency'
  | 'volume';

/** Color semántico del anillo; el póster lo mapea a la paleta del tema. */
export type SlotColor = 'success' | 'gold' | 'goldSoft';

/**
 * Logro ya resuelto y listo para pintar en un donut del póster. Solo strings y
 * números: el póster no calcula nada, únicamente renderiza.
 */
export interface AchievementSlot {
  id: string;
  category: SlotCategory;
  /** Mayor prioridad = más impresionante; ordena la selección y el layout. */
  priority: number;
  /** Fracción rellena del anillo (0-1). */
  fraction: number;
  color: SlotColor;
  centerMain: string;
  centerMainFont: number;
  centerSub?: string;
  label: string;
  subLabel?: string;
}

export interface WeekAchievements {
  weekNumber: number;
  daysTrained: number;
  /** Días entrenados consecutivos sin saltarse ningún entreno de la rutina. */
  streakDays: number;
  /** La racha cubre toda la rutina: nunca se ha faltado un solo día. */
  streakIsPerfect: boolean;
  /** Mejora global de la semana respecto a la anterior (signo incluido), o null. */
  weekImprovementPercent: number | null;
  topImprovement: TopImprovement | null;
  maxLift: MaxLift | null;
  /**
   * Hasta 4 logros elegidos para el póster, los más positivos primero. Nunca
   * incluye datos negativos: si la semana empeora, entran logros de constancia
   * o volumen en su lugar.
   */
  slots: AchievementSlot[];
  /** Mejora por semana hasta esta (para pintar la gráfica). */
  progressSeries: WeekProgressDatum[];
}

interface ExerciseAggregate {
  name: string;
  score: number;
}

// Quedarse con el log más reciente de cada día (una semana entrena cada día una vez).
function latestLogsByDay(weekLogs: WorkoutLog[]): WorkoutLog[] {
  const byDay: Record<string, WorkoutLog> = {};
  [...weekLogs]
    .sort((a, b) => getLogTimestamp(b) - getLogTimestamp(a))
    .forEach((log) => {
      if (!log.dayId) return;
      if (!byDay[log.dayId]) byDay[log.dayId] = log;
    });
  return Object.values(byDay);
}

// Puntuación de fuerza acumulada por ejercicio (clave: exerciseId).
function aggregateExerciseScores(
  logs: WorkoutLog[]
): Map<string, ExerciseAggregate> {
  const scores = new Map<string, ExerciseAggregate>();
  logs.forEach((log) => {
    log.exercises.forEach((exercise) => {
      const score = getTotalSetsStrengthScore(exercise.parsedSets || []);
      const previous = scores.get(exercise.exerciseId);
      scores.set(exercise.exerciseId, {
        name: exercise.exerciseName,
        score: (previous?.score || 0) + score,
      });
    });
  });
  return scores;
}

// Ejercicio con mayor mejora porcentual respecto a la semana anterior.
function findTopImprovement(
  currentLogs: WorkoutLog[],
  previousLogs: WorkoutLog[]
): TopImprovement | null {
  const current = aggregateExerciseScores(currentLogs);
  const previous = aggregateExerciseScores(previousLogs);

  let best: TopImprovement | null = null;
  current.forEach((aggregate, exerciseId) => {
    const previousScore = previous.get(exerciseId)?.score || 0;
    if (previousScore <= 0) return; // Sin referencia anterior no es una "mejora".

    const improvement = buildImprovementFromStrengthScores(
      aggregate.score,
      previousScore
    );
    if (!improvement || !improvement.isImproved) return;

    if (!best || improvement.percent > best.percent) {
      best = { exerciseName: aggregate.name, percent: improvement.percent };
    }
  });

  return best;
}

// Mayor peso movido en una serie válida de la semana (desempate por más reps).
function findMaxLift(logs: WorkoutLog[]): MaxLift | null {
  let best: MaxLift | null = null;

  logs.forEach((log) => {
    log.exercises.forEach((exercise) => {
      (exercise.parsedSets || []).forEach((set) => {
        if (set.weight <= 0 || set.reps <= 0) return; // Ignora vacíos (-1) y peso corporal (0).
        if (
          !best ||
          set.weight > best.weight ||
          (set.weight === best.weight && set.reps > best.reps)
        ) {
          best = {
            exerciseName: exercise.exerciseName,
            weight: set.weight,
            reps: set.reps,
          };
        }
      });
    });
  });

  return best;
}

// Peso máximo por ejercicio en series válidas con carga (clave: exerciseId).
function maxWeightByExercise(
  logs: WorkoutLog[]
): Map<string, { name: string; weight: number }> {
  const byExercise = new Map<string, { name: string; weight: number }>();
  logs.forEach((log) => {
    log.exercises.forEach((exercise) => {
      (exercise.parsedSets || []).forEach((set) => {
        if (set.weight <= 0 || set.reps <= 0) return;
        const previous = byExercise.get(exercise.exerciseId);
        if (!previous || set.weight > previous.weight) {
          byExercise.set(exercise.exerciseId, {
            name: exercise.exerciseName,
            weight: set.weight,
          });
        }
      });
    });
  });
  return byExercise;
}

interface PersonalRecord {
  exerciseName: string;
  weight: number;
}

// Récord personal: ejercicio cuyo peso de esta semana supera su máximo histórico.
// Con varios récords gana el de mayor margen relativo.
function findPersonalRecord(
  currentLogs: WorkoutLog[],
  historyLogs: WorkoutLog[]
): PersonalRecord | null {
  const historyMax = maxWeightByExercise(historyLogs);
  const currentMax = maxWeightByExercise(currentLogs);

  let best: PersonalRecord | null = null;
  let bestMargin = 0;
  currentMax.forEach((current, exerciseId) => {
    const previous = historyMax.get(exerciseId);
    if (!previous || previous.weight <= 0) return; // Sin histórico no hay récord que batir.
    if (current.weight <= previous.weight) return;

    const margin = (current.weight - previous.weight) / previous.weight;
    if (!best || margin > bestMargin) {
      best = { exerciseName: current.name, weight: current.weight };
      bestMargin = margin;
    }
  });

  return best;
}

// Volumen de carga de la semana: suma de peso × reps de las series con carga.
function getTotalVolume(logs: WorkoutLog[]): number {
  let volume = 0;
  logs.forEach((log) => {
    log.exercises.forEach((exercise) => {
      (exercise.parsedSets || []).forEach((set) => {
        if (set.weight <= 0 || set.reps <= 0) return;
        volume += set.weight * set.reps;
      });
    });
  });
  return volume;
}

// Series y repeticiones válidas de la semana (incluye peso corporal).
function countSetsAndReps(logs: WorkoutLog[]): { sets: number; reps: number } {
  let sets = 0;
  let reps = 0;
  logs.forEach((log) => {
    log.exercises.forEach((exercise) => {
      (exercise.parsedSets || []).forEach((set) => {
        if (set.reps <= 0 || set.weight < 0) return;
        sets += 1;
        reps += set.reps;
      });
    });
  });
  return { sets, reps };
}

// "12450" → "12.450" (separador de miles español, sin depender de toLocaleString).
function formatInt(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatWeightText(weight: number): string {
  return Number.isInteger(weight)
    ? String(weight)
    : localizeDecimals(String(Math.round(weight * 10) / 10));
}

// Tamaño del número central según su longitud, para que no desborde el anillo.
function centerFontFor(text: string): number {
  if (text.length <= 3) return 104;
  if (text.length <= 4) return 92;
  if (text.length <= 6) return 80;
  return 66;
}

/**
 * Elige hasta `max` logros: primero el mejor de cada categoría (para no repetir
 * mensajes), y si quedan huecos los rellena por prioridad. Determinista.
 */
function selectSlots(
  candidates: AchievementSlot[],
  max = 4
): AchievementSlot[] {
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority);
  const chosen: AchievementSlot[] = [];
  const usedCategories = new Set<SlotCategory>();

  sorted.forEach((candidate) => {
    if (chosen.length >= max || usedCategories.has(candidate.category)) return;
    usedCategories.add(candidate.category);
    chosen.push(candidate);
  });
  sorted.forEach((candidate) => {
    if (chosen.length >= max || chosen.includes(candidate)) return;
    chosen.push(candidate);
  });

  return chosen;
}

export interface WeekAchievementsInput {
  weekLogs: WorkoutLog[];
  previousWeekLogs: WorkoutLog[];
  weekNumber: number;
  streakDays: number;
  streakIsPerfect: boolean;
  /**
   * Logs de TODAS las semanas anteriores (para récords personales). Si no se
   * pasa, se usa previousWeekLogs como histórico.
   */
  historyLogs?: WorkoutLog[];
  /** Entrenos totales registrados incluyendo esta semana (contador histórico). */
  totalWorkouts?: number;
  progressSeries?: WeekProgressDatum[];
}

/**
 * Construye el resumen de logros de una semana completada, listo para pintar la
 * imagen para redes sociales. Lógica pura y testeable.
 *
 * El póster no pinta métricas fijas: se genera un catálogo de logros candidatos
 * (solo positivos) y `selectSlots` elige los 4 mejores, de forma que siempre hay
 * algo que celebrar aunque la semana haya empeorado o sea la primera.
 */
export function computeWeekAchievements({
  weekLogs,
  previousWeekLogs,
  weekNumber,
  streakDays,
  streakIsPerfect,
  historyLogs,
  totalWorkouts = 0,
  progressSeries = [],
}: WeekAchievementsInput): WeekAchievements {
  const currentLatest = latestLogsByDay(weekLogs);
  const previousLatest = latestLogsByDay(previousWeekLogs);
  const history =
    historyLogs && historyLogs.length > 0 ? historyLogs : previousWeekLogs;

  const currentDayIds = Array.from(
    new Set(currentLatest.map((log) => log.dayId).filter(Boolean))
  );

  // Mismo cálculo que la tarjeta de la semana en Inicio: cada día contra su
  // sesión anterior dentro del histórico (los días que faltaron en la semana
  // previa no cuentan como cero, se busca la última vez que se hicieron).
  let weekImprovementPercent: number | null = null;
  const improvement = improvementAgainstHistory(currentLatest, history);
  if (improvement) {
    weekImprovementPercent = improvement.isImproved
      ? improvement.percent
      : -improvement.percent;
  }

  const topImprovement = findTopImprovement(currentLatest, previousLatest);
  const maxLift = findMaxLift(currentLatest);
  const daysTrained = currentLatest.length;

  // --- Catálogo de logros candidatos (solo se generan los positivos) ---
  const candidates: AchievementSlot[] = [];

  if (
    weekImprovementPercent !== null &&
    Math.round(weekImprovementPercent) >= 1
  ) {
    const text = `+${Math.round(weekImprovementPercent)}%`;
    candidates.push({
      id: 'week-improvement',
      category: 'global',
      priority: 80,
      fraction: Math.min(1, weekImprovementPercent / 20),
      color: 'success',
      centerMain: text,
      centerMainFont: centerFontFor(text),
      label: t('MEJORA DE FUERZA'),
      subLabel: t('respecto a la semana anterior'),
    });
  }

  if (topImprovement && Math.round(topImprovement.percent) >= 1) {
    const text = `+${Math.round(topImprovement.percent)}%`;
    candidates.push({
      id: 'top-improvement',
      category: 'exercise',
      priority: 75,
      fraction: Math.min(1, topImprovement.percent / 40),
      color: 'success',
      centerMain: text,
      centerMainFont: centerFontFor(text),
      label: t('MAYOR PROGRESO'),
      subLabel: topImprovement.exerciseName,
    });
  }

  const personalRecord = findPersonalRecord(currentLatest, history);
  if (personalRecord) {
    const text = formatWeightText(personalRecord.weight);
    candidates.push({
      id: 'personal-record',
      category: 'record',
      priority: 90,
      fraction: 1,
      color: 'goldSoft',
      centerMain: text,
      centerMainFont: centerFontFor(text),
      centerSub: t('kg'),
      label: t('RÉCORD PERSONAL'),
      subLabel: personalRecord.exerciseName,
    });
  }

  // Peso máximo solo como "primera marca": sin histórico con carga no hay
  // récords que batir, y repetirlo cada semana no aporta (suele ser el mismo).
  const historyHasWeights = maxWeightByExercise(history).size > 0;
  if (maxLift && !historyHasWeights) {
    const text = formatWeightText(maxLift.weight);
    candidates.push({
      id: 'max-lift',
      category: 'record',
      priority: 45,
      fraction: 1,
      color: 'goldSoft',
      centerMain: text,
      centerMainFont: centerFontFor(text),
      centerSub: t('kg'),
      label: t('PESO MÁXIMO'),
      subLabel: maxLift.exerciseName,
    });
  }

  // Racha: con asistencia perfecta se celebra eso (no el número de días); el
  // contador de días solo entra cuando ya impresiona (≥ 2 semanas completas).
  const streakCoversTwoWeeks =
    daysTrained > 0 && streakDays >= Math.max(6, daysTrained * 2);
  if (streakIsPerfect && streakCoversTwoWeeks) {
    candidates.push({
      id: 'perfect-attendance',
      category: 'consistency',
      priority: 85,
      fraction: 1,
      color: 'gold',
      centerMain: '100%',
      centerMainFont: centerFontFor('100%'),
      label: t('ASISTENCIA'),
      subLabel: t('ni un día faltado'),
    });
  } else if (streakCoversTwoWeeks) {
    const text = String(streakDays);
    candidates.push({
      id: 'streak-days',
      category: 'consistency',
      priority: 60,
      fraction: Math.min(1, streakDays / 30),
      color: 'gold',
      centerMain: text,
      centerMainFont: centerFontFor(text),
      centerSub: t('días'),
      label: t('RACHA'),
      subLabel: t('sin fallar ningún entreno'),
    });
  }

  const totalVolume = getTotalVolume(currentLatest);
  if (totalVolume > 0) {
    const text = formatInt(totalVolume);
    candidates.push({
      id: 'total-volume',
      category: 'volume',
      priority: 50,
      fraction: 1,
      color: 'goldSoft',
      centerMain: text,
      centerMainFont: centerFontFor(text),
      centerSub: t('kg'),
      label: t('VOLUMEN MOVIDO'),
      subLabel: t('peso total esta semana'),
    });
  }

  if (totalWorkouts > 0) {
    const text = String(totalWorkouts);
    candidates.push({
      id: 'total-workouts',
      category: 'consistency',
      priority: 40,
      fraction: Math.min(1, totalWorkouts / 50),
      color: 'gold',
      centerMain: text,
      centerMainFont: centerFontFor(text),
      centerSub: t('entrenos'),
      label: t('DESDE EL INICIO'),
      subLabel: t('entrenos completados'),
    });
  }

  const { sets, reps } = countSetsAndReps(currentLatest);
  if (sets > 0) {
    const text = String(sets);
    candidates.push({
      id: 'total-sets',
      category: 'volume',
      priority: 35,
      fraction: 1,
      color: 'gold',
      centerMain: text,
      centerMainFont: centerFontFor(text),
      centerSub: t('series'),
      label: t('TRABAJO SEMANAL'),
      subLabel: t('series completadas'),
    });
  }
  if (reps > 0) {
    const text = formatInt(reps);
    candidates.push({
      id: 'total-reps',
      category: 'volume',
      priority: 30,
      fraction: 1,
      color: 'goldSoft',
      centerMain: text,
      centerMainFont: centerFontFor(text),
      centerSub: t('reps'),
      label: t('REPETICIONES'),
      subLabel: t('esta semana'),
    });
  }

  if (daysTrained > 0) {
    const text = String(daysTrained);
    candidates.push({
      id: 'days-trained',
      category: 'consistency',
      priority: 20,
      fraction: 1,
      color: 'gold',
      centerMain: text,
      centerMainFont: centerFontFor(text),
      centerSub: daysTrained === 1 ? t('día') : t('días'),
      label: t('ESTA SEMANA'),
      subLabel: t('entrenos completados'),
    });
  }

  return {
    weekNumber,
    daysTrained,
    streakDays,
    streakIsPerfect,
    weekImprovementPercent,
    topImprovement,
    maxLift,
    slots: selectSlots(candidates),
    progressSeries,
  };
}
