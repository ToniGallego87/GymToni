// Lo que acompañó a una semana de rutina completada, para su póster: los retos
// que se superaron y los logros que cayeron en ella, y el nivel con que se
// cerró. Lógica pura: lo pinta `WeekAchievementScreen`.
//
// El nivel es el de ENTONCES, no el de ahora: se suman solo los retos cuyo
// periodo ya había terminado al cerrar la semana y los logros conseguidos hasta
// ese día. Los retos superados se guardan como `id@periodo` (lib/level.ts): el
// periodo es la semana ISO ("2026-W39", los de cardio) o `rutina:bloque` (los
// de fuerza), que aquí se traduce a la fecha del último entreno del bloque.
import { WorkoutLog, WorkoutRoutine } from '../types';
import { Badge } from './badges';
import { isoWeekKey } from './cardio';
import { challengeMeta } from './challenges';
import { levelForXp, totalXp } from './level';
import { logDateKey } from './utils';
import { groupLogsIntoWeekBlocks } from './weeks';

export interface WeekExtraChallenge {
  id: string;
  name: string;
  icon: string;
}

export interface WeekExtras {
  /** Retos superados en la semana (los de la rutina y los de cardio). */
  challenges: WeekExtraChallenge[];
  /** Logros desbloqueados entre el primer y el último día de la semana. */
  badges: Badge[];
  /** Nivel de la cuenta al cerrar la semana. */
  level: number;
}

const ISO_WEEK = /^\d{4}-W\d{2}$/;

export function computeWeekExtras({
  routineId,
  block,
  weekLogs,
  logs,
  routines,
  wins,
  badges,
}: {
  routineId: string;
  /** Número de semana (bloque) de la rutina. */
  block: number;
  weekLogs: WorkoutLog[];
  logs: WorkoutLog[];
  routines: WorkoutRoutine[];
  /** Retos superados, `id@periodo` (lib/level.ts). */
  wins: string[];
  badges: Badge[];
}): WeekExtras {
  const dates = weekLogs.map(logDateKey).sort();
  const weekStart = dates[0] ?? '';
  const weekEnd = dates[dates.length - 1] ?? '';

  // Último día de cada bloque de cada rutina: hasta cuándo duró su periodo.
  const blockEnd = new Map<string, string>();
  for (const routine of routines) {
    const routineLogs = logs.filter(
      (log) => log.routineId === routine.id && !log.cardioOnly
    );
    const blocks = groupLogsIntoWeekBlocks(routineLogs, (log) => log.dayId);
    for (const [number, blockLogs] of Object.entries(blocks)) {
      const last = blockLogs.map(logDateKey).sort().pop();
      if (last) blockEnd.set(`${routine.id}:${number}`, last);
    }
  }

  const thisBlock = `${routineId}:${block}`;
  // Semanas ISO que toca la semana de rutina (puede cruzar un lunes).
  const isoWeeks = new Set(dates.map(isoWeekKey));
  const endIsoWeek = weekEnd ? isoWeekKey(weekEnd) : '';

  const challenges: WeekExtraChallenge[] = [];
  let winsByThen = 0;
  for (const key of wins) {
    const at = key.lastIndexOf('@');
    if (at < 0) continue;
    const id = key.slice(0, at);
    const period = key.slice(at + 1);
    const isCalendar = ISO_WEEK.test(period);

    const inThisWeek = isCalendar ? isoWeeks.has(period) : period === thisBlock;
    if (inThisWeek) challenges.push({ id, ...challengeMeta(id) });

    const end = isCalendar ? null : blockEnd.get(period);
    const doneByThen = isCalendar
      ? period <= endIsoWeek
      : !!end && end <= weekEnd;
    if (doneByThen) winsByThen += 1;
  }

  const weekBadges = badges.filter(
    (b) =>
      b.unlocked &&
      !!b.unlockedAt &&
      b.unlockedAt >= weekStart &&
      b.unlockedAt <= weekEnd
  );
  const badgesByThen = badges.filter(
    (b) => b.unlocked && !!b.unlockedAt && b.unlockedAt <= weekEnd
  ).length;

  return {
    challenges,
    badges: weekBadges,
    level: levelForXp(totalXp(winsByThen, badgesByThen)),
  };
}
