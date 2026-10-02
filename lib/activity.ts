import { Badge } from './badges';
import { Challenge } from './challenges';
import { getDisplayDayName } from './theme';
import { findDayInRoutines } from './utils';
import { WorkoutLog, WorkoutRoutine } from '../types';
import { t } from './i18n';

/**
 * Un hito de la Actividad: lo que el perfil de una persona enseña de su
 * trayectoria. Tres tipos, y los tres se pintan igual (icono + título + fecha):
 * una insignia desbloqueada, un reto superado o un día entrenado.
 *
 * Es la MISMA forma en los dos sentidos: la que se deriva de los datos locales
 * (`buildLocalActivity`) para el perfil propio y la que baja de la nube
 * (`lib/cloud/activity.ts`) para el de otra persona, así que la lista se pinta
 * con un solo componente.
 */
export interface ActivityItem {
  kind: 'badge' | 'challenge' | 'day';
  /** Identidad dentro de su tipo: id de insignia, `reto@periodo` o id del log. */
  ref: string;
  title: string;
  /** Icono de MaterialCommunityIcons (o de los de día, en los `day`). */
  icon?: string;
  /** Rutina de la que salió el día, para enlazarla si es pública. */
  routineId?: string;
  routineName?: string;
  /** `YYYY-MM-DD`: por esto se ordena, no por cuándo se subió. */
  happenedOn: string;
}

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
 */
export function buildLocalActivity({
  logs,
  routines,
  badges,
  challenges,
  wins,
}: {
  logs: WorkoutLog[];
  routines: WorkoutRoutine[];
  badges: Badge[];
  challenges: Challenge[];
  wins: string[];
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
      title: known?.name ?? t('Reto superado'),
      icon: known?.icon ?? 'trophy-variant',
      happenedOn,
    });
  }

  for (const log of logs) {
    // Las sesiones de solo cardio no son días de la rutina: no son un hito de
    // "he entrenado este día" (mismo criterio que Inicio).
    if (log.cardioOnly) continue;
    const day = findDayInRoutines(routines, log.dayId);
    const routine = routines.find((r) => r.days.some((d) => d.id === log.dayId));
    items.push({
      kind: 'day',
      ref: log.id,
      title: day ? getDisplayDayName(day.name) : t('Entreno'),
      icon: day?.emoji,
      routineId: routine?.id,
      routineName: routine?.name,
      happenedOn: log.date || new Date(log.createdAt).toISOString().slice(0, 10),
    });
  }

  return sortActivity(items);
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
  total: number;
}
