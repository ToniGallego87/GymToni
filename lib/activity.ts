import { Badge } from './badges';
import { Challenge } from './challenges';
import { ExerciseKeyResolver, exerciseKeyOf } from './exerciseIdentity';
import { exerciseLogKey } from './exerciseProgress';
import { isExtraExerciseLog } from './extraExercises';
import { isValidSet } from './progress';
import { getDisplayDayName } from './theme';
import { findDayInRoutines, getLogTimestamp, logDateKey } from './utils';
import { WorkoutLog, WorkoutRoutine } from '../types';
import { dateLocale, fmtNum, t } from './i18n';

/**
 * Un hito de la Actividad: lo que el perfil de una persona enseña de su
 * trayectoria. Cuatro tipos: una insignia desbloqueada, un reto superado, un
 * día entrenado o un récord personal (más peso que nunca en un ejercicio).
 *
 * Es la MISMA forma en los dos sentidos: la que se deriva de los datos locales
 * (`buildLocalActivity`) para el perfil propio y la que baja de la nube
 * (`lib/cloud/activity.ts`) para el de otra persona, así que la lista se pinta
 * con un solo componente.
 */
export interface ActivityItem {
  kind: 'badge' | 'challenge' | 'day' | 'record';
  /**
   * Identidad dentro de su tipo: id de insignia, `reto@periodo`, id del log o
   * `ejercicio@fecha` del récord.
   */
  ref: string;
  title: string;
  /** Icono de MaterialCommunityIcons (o de los de día, en los `day`). */
  icon?: string;
  /** Rutina de la que salió el día, para enlazarla si es pública. */
  routineId?: string;
  routineName?: string;
  /**
   * Solo en los récords LOCALES: la marca ("85 kg"). En la nube no hay
   * columna para ella y viaja dentro del título ("Press banca · 85 kg").
   */
  detail?: string;
  /** Solo en los récords locales: identidad del ejercicio, para su Progreso. */
  exerciseKey?: string;
  /** `YYYY-MM-DD`: por esto se ordena, no por cuándo se subió. */
  happenedOn: string;
}

/** Título de un reto viejo cuyo nombre ya no está en el catálogo. */
export const genericChallengeTitle = () => t('Reto semanal');

/** Clave de un hito: lo que decide si ya está publicado (ver appSettings). */
export const activityKey = (item: ActivityItem): string =>
  `${item.kind}:${item.ref}`;

/**
 * La semana de un reto (`periodKey` tipo "2026-W39") no es una fecha, y la
 * Actividad ordena por fecha. Se traduce al LUNES de esa semana ISO, que es la
 * aproximación honesta: el reto se superó en algún momento de esos siete días.
 * Un `periodKey` que sea un número de bloque de rutina no se puede fechar, así
 * que esos retos se quedan fuera de la lista (devuelve undefined).
 */
function weekKeyToDate(periodKey: string): string | undefined {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(periodKey);
  if (!match) return undefined;
  const year = Number(match[1]);
  const week = Number(match[2]);
  // Jueves de la semana 1 ISO: el 4 de enero cae siempre en ella.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1) + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

/**
 * Los hitos que hay en ESTE dispositivo, de más reciente a más antiguo. Todo
 * sale de lo que la app ya calcula: las insignias traen su `unlockedAt`, los
 * retos superados su ventana, y cada log de fuerza es un día entrenado con su
 * rutina. No consulta la nube ni la necesita.
 *
 * `wins` son las claves `id@periodo` de `lib/level.ts`; `challenges` el catálogo
 * vivo, del que se saca el nombre y el icono de cada reto superado.
 * `resolveExerciseKey` agrupa los ejercicios para los récords como Progreso
 * por ejercicio (mismo ejercicio en otra rutina o con otro nombre).
 */
export function buildLocalActivity({
  logs,
  routines,
  badges,
  challenges,
  wins,
  resolveExerciseKey = exerciseKeyOf,
}: {
  logs: WorkoutLog[];
  routines: WorkoutRoutine[];
  badges: Badge[];
  challenges: Challenge[];
  wins: string[];
  resolveExerciseKey?: ExerciseKeyResolver;
}): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const badge of badges) {
    if (!badge.unlocked || !badge.unlockedAt) continue;
    items.push({
      kind: 'badge',
      ref: badge.id,
      title: badge.name,
      icon: badge.icon,
      happenedOn: badge.unlockedAt,
    });
  }

  // El catálogo de retos solo tiene la ventana EN CURSO, así que de los retos
  // viejos no se puede recuperar el nombre: se nombran por su id de catálogo si
  // sigue existiendo y, si no, con un rótulo genérico (el hito pasó de verdad).
  const challengeById = new Map(challenges.map((c) => [c.id, c]));
  for (const win of wins) {
    const [id, periodKey] = win.split('@');
    const happenedOn = weekKeyToDate(periodKey ?? '');
    if (!happenedOn) continue;
    const known = challengeById.get(id as Challenge['id']);
    items.push({
      kind: 'challenge',
      ref: win,
      title: known?.name ?? genericChallengeTitle(),
      icon: known?.icon ?? 'trophy-variant',
      happenedOn,
    });
  }

  for (const log of logs) {
    // Las sesiones de solo cardio no son días de la rutina: no son un hito de
    // "he entrenado este día" (mismo criterio que Inicio).
    if (log.cardioOnly) continue;
    const day = findDayInRoutines(routines, log.dayId);
    const routine = routines.find((r) =>
      r.days.some((d) => d.id === log.dayId)
    );
    items.push({
      kind: 'day',
      ref: log.id,
      title: day ? getDisplayDayName(day.name) : t('Entreno'),
      icon: day?.emoji,
      routineId: routine?.id,
      routineName: routine?.name,
      happenedOn: logDateKey(log),
    });
  }

  items.push(...buildRecordItems(logs, resolveExerciseKey));

  return sortActivity(items);
}

/**
 * Récords personales: cada sesión en la que un ejercicio levantó más peso que
 * en todas las anteriores. La primera vez no cuenta (no había nada que batir),
 * y un récord en semana de descarga sube el listón pero no sale como hito (es
 * raro y no es lo que se buscaba esa semana). Mismo criterio de "más peso que
 * nunca" que la burbuja dorada del registro; los adicionales quedan fuera,
 * como en Progreso por ejercicio.
 */
function buildRecordItems(
  logs: WorkoutLog[],
  resolve: ExerciseKeyResolver
): ActivityItem[] {
  const records: ActivityItem[] = [];
  const best = new Map<string, number>();
  const chronological = logs
    .filter((log) => !log.cardioOnly)
    .sort((a, b) => getLogTimestamp(a) - getLogTimestamp(b));

  for (const log of chronological) {
    // Peso máximo de cada ejercicio en ESTA sesión (puede repetirse por id).
    const sessionMax = new Map<string, { weight: number; name: string }>();
    for (const exerciseLog of log.exercises) {
      if (isExtraExerciseLog(exerciseLog)) continue;
      const weight = (exerciseLog.parsedSets || [])
        .filter(isValidSet)
        .reduce((max, s) => Math.max(max, s.weight), 0);
      if (weight <= 0) continue;
      const key = exerciseLogKey(exerciseLog, resolve);
      if (weight > (sessionMax.get(key)?.weight ?? 0)) {
        sessionMax.set(key, { weight, name: exerciseLog.exerciseName.trim() });
      }
    }

    const date = logDateKey(log);
    sessionMax.forEach(({ weight, name }, key) => {
      const previous = best.get(key);
      if (previous === undefined || weight > previous) best.set(key, weight);
      if (previous === undefined || weight <= previous || log.isDeload) return;
      records.push({
        kind: 'record',
        ref: `${key}@${date}`,
        title: name,
        icon: 'trophy',
        detail: `${fmtNum(weight)} kg`,
        exerciseKey: key,
        happenedOn: date,
      });
    });
  }

  return records;
}

/** Un mes de la Actividad: su clave `YYYY-MM` y sus hitos, en orden. */
export interface ActivityMonth {
  month: string;
  items: ActivityItem[];
}

/**
 * Los hitos agrupados por mes, conservando el orden de la lista (de más
 * reciente a más antiguo). Es como se lee la Actividad: un diario por meses.
 */
export function groupActivityByMonth(items: ActivityItem[]): ActivityMonth[] {
  const months: ActivityMonth[] = [];
  for (const item of items) {
    const month = item.happenedOn.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.month === month) last.items.push(item);
    else months.push({ month, items: [item] });
  }
  return months;
}

/** "Octubre de 2026" a partir de una clave `YYYY-MM`. */
export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const label = new Date(year, monthNumber - 1, 1).toLocaleDateString(
    dateLocale,
    { month: 'long', year: 'numeric' }
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** De más reciente a más antiguo, con el tipo como desempate estable. */
export function sortActivity(items: ActivityItem[]): ActivityItem[] {
  return [...items].sort((a, b) =>
    a.happenedOn === b.happenedOn
      ? a.kind.localeCompare(b.kind) || a.ref.localeCompare(b.ref)
      : a.happenedOn < b.happenedOn
      ? 1
      : -1
  );
}

/**
 * Lo que rotula la cabecera de la Actividad: cuántos hitos de cada tipo. Los
 * cuenta el SERVIDOR (`getActivityCounts` en lib/cloud/activity.ts), no esta
 * capa: contar los que hay cargados daría el tamaño de la página.
 */
export interface ActivityCounts {
  badges: number;
  challenges: number;
  days: number;
  records: number;
  total: number;
}
