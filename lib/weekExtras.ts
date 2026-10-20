// Lo que acompañó a una semana de rutina completada, para su póster: los retos
// que se superaron y los logros que cayeron en ella, y el nivel con que se
// cerró. Lógica pura: lo pinta `WeekAchievementScreen`.
//
// El nivel es el de ENTONCES, no el de ahora: se suman solo los retos cuyo
// periodo ya había terminado al cerrar la semana y los logros conseguidos hasta
// ese día. Los retos superados se guardan como `id@periodo` (lib/level.ts): el
// periodo es la semana ISO ("2026-W39", los de cardio) o `rutina:bloque` (los
// de fuerza), que aquí se traduce a la fecha del último entreno del bloque.
//
// Los números de bloque son posicionales: repetir un día, borrar un entreno o
// forzar semana nueva renumera los bloques, y un reto apuntado como `r:9` puede
// apuntar a un bloque que ya no existe. Ese reto se ganó, como muy tarde, en el
// último bloque de su rutina, y se data ahí. Si ni eso se puede (rutina sin
// entrenos), no hay fecha; pero si el póster es de la semana más reciente, todo
// lo ganado ya había pasado, y su nivel es el de ahora tal cual.
import { WorkoutLog } from '../types';
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
  wins,
  badges,
}: {
  routineId: string;
  /** Número de semana (bloque) de la rutina. */
  block: number;
  weekLogs: WorkoutLog[];
  logs: WorkoutLog[];
  /** Retos superados, `id@periodo` (lib/level.ts). */
  wins: string[];
  badges: Badge[];
}): WeekExtras {
  const dates = weekLogs.map(logDateKey).sort();
  const weekStart = dates[0] ?? '';
  const weekEnd = dates[dates.length - 1] ?? '';

  // Último día de cada bloque de cada rutina: hasta cuándo duró su periodo. Se
  // agrupa por el `routineId` de los logs, no por las rutinas que quedan: los
  // retos de una rutina borrada también cuentan para el nivel.
  const blockEnd = new Map<string, string>();
  const lastBlock = new Map<string, { number: number; end: string }>();
  const routineIds = new Set(
    logs.filter((log) => !log.cardioOnly).map((log) => log.routineId)
  );
  for (const routineId of routineIds) {
    const routineLogs = logs.filter(
      (log) => log.routineId === routineId && !log.cardioOnly
    );
    const blocks = groupLogsIntoWeekBlocks(routineLogs, (log) => log.dayId);
    for (const [key, blockLogs] of Object.entries(blocks)) {
      const last = blockLogs.map(logDateKey).sort().pop();
      if (!last) continue;
      const number = Number(key);
      blockEnd.set(`${routineId}:${number}`, last);
      const prev = lastBlock.get(routineId);
      if (!prev || number > prev.number) {
        lastBlock.set(routineId, { number, end: last });
      }
    }
  }
  // Fin del periodo de un reto de fuerza (`rutina:bloque`); un bloque que ya no
  // existe por renumeración se data en el último de su rutina.
  const periodEnd = (period: string): string | undefined => {
    const exact = blockEnd.get(period);
    if (exact) return exact;
    const sep = period.lastIndexOf(':');
    return sep < 0 ? undefined : lastBlock.get(period.slice(0, sep))?.end;
  };
  // Nada se entrenó después: es la semana más reciente.
  const isLatestWeek =
    !!weekEnd && logs.every((log) => logDateKey(log) <= weekEnd);

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

    const end = isCalendar ? null : periodEnd(period);
    const doneByThen =
      isLatestWeek ||
      (isCalendar ? period <= endIsoWeek : !!end && end <= weekEnd);
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
    (b) =>
      b.unlocked && (isLatestWeek || (!!b.unlockedAt && b.unlockedAt <= weekEnd))
  ).length;

  return {
    challenges,
    badges: weekBadges,
    level: levelForXp(totalXp(winsByThen, badgesByThen)),
  };
}
