import { useEffect, useMemo, useRef } from 'react';
import { useWorkout } from './useWorkout';
import { useBodyWeight } from '@lib/bodyWeight';
import { Badge, computeBadges } from '@lib/badges';
import { Challenge, computeChallenges } from '@lib/challenges';
import { WorkoutLog, WorkoutRoutine } from '../types';
import { WeightSegment } from '@lib/cardio';
import {
  LevelSummary,
  recordChallengeWins,
  summarizeLevel,
  totalXp,
  useChallengeWins,
  XP_PER_BADGE,
  XP_PER_CHALLENGE,
} from '@lib/level';
import { Award, pushAwards } from '@lib/awards';
import { getStoredSeenBadges, setStoredSeenBadges } from '@lib/appSettings';
import { useSession } from '@lib/cloud/auth';
import { updateProfile } from '@lib/cloud/social';
import { loadMyProfile, useMyProfile } from './useMyProfile';

// Caché de UNA entrada para los dos cálculos pesados. El hook está montado a
// la vez en seis sitios (la barra superior de todas las pantallas, Inicio,
// Cardio, Perfil, Logros y la raíz) y todos reciben las MISMAS referencias de
// estado, así que con un `useMemo` por instancia cada cambio de logs recorría
// el historial entero seis veces. Con la caché lo recorre la primera instancia
// y las demás reutilizan el resultado (misma identidad, así sus `useEffect`
// tampoco se disparan de más).
let challengesCache: {
  logs: WorkoutLog[];
  routines: WorkoutRoutine[];
  activeRoutineId: string | undefined;
  weight: WeightSegment[];
  result: Challenge[];
} | null = null;

function sharedChallenges(
  logs: WorkoutLog[],
  routines: WorkoutRoutine[],
  activeRoutineId: string | undefined,
  weight: WeightSegment[]
): Challenge[] {
  const c = challengesCache;
  if (
    c &&
    c.logs === logs &&
    c.routines === routines &&
    c.activeRoutineId === activeRoutineId &&
    c.weight === weight
  ) {
    return c.result;
  }
  const result = computeChallenges({ logs, routines, activeRoutineId, weight });
  challengesCache = { logs, routines, activeRoutineId, weight, result };
  return result;
}

let badgesCache: {
  logs: WorkoutLog[];
  routines: WorkoutRoutine[];
  all: Badge[];
  unlocked: Badge[];
} | null = null;

function sharedBadges(
  logs: WorkoutLog[],
  routines: WorkoutRoutine[]
): { all: Badge[]; unlocked: Badge[] } {
  const c = badgesCache;
  if (c && c.logs === logs && c.routines === routines) return c;
  const all = computeBadges(logs, routines);
  const unlocked = all.filter((b) => b.unlocked);
  badgesCache = { logs, routines, all, unlocked };
  return badgesCache;
}

/**
 * Retos vigentes + nivel de la cuenta, a partir del estado de la app.
 *
 * Lo usan Perfil, Logros y las hero cards. Solo el que pasa `record` (la raíz
 * de la app) apunta los retos superados, avisa de lo nuevo (retos, logros y
 * nivel, vía `lib/awards`) y sube el nivel al perfil público: así se cuenta
 * una vez y no cada pantalla por su cuenta.
 */
export function useAccountLevel(options: { record?: boolean } = {}): {
  challenges: Challenge[];
  /** El catálogo entero de insignias (Logros lo pinta; el resto usa `level`). */
  badges: Badge[];
  level: LevelSummary;
} {
  const { state } = useWorkout();
  const weight = useBodyWeight();
  const wins = useChallengeWins();

  const challenges = sharedChallenges(
    state.logs,
    state.routines,
    state.activeRoutineId,
    weight
  );
  const { all: badges, unlocked: unlockedBadges } = sharedBadges(
    state.logs,
    state.routines
  );

  const level = useMemo(
    () => summarizeLevel(totalXp(wins.length, unlockedBadges.length)),
    [wins.length, unlockedBadges.length]
  );

  // Apuntar los retos superados (permanente) y avisar de los nuevos.
  useEffect(() => {
    if (!options.record) return;
    const fresh = recordChallengeWins(challenges);
    pushAwards(
      fresh.map<Award>((c) => ({
        kind: 'challenge',
        name: c.name,
        icon: c.icon,
        description: c.description,
        xp: XP_PER_CHALLENGE,
      }))
    );
  }, [options.record, challenges]);

  // Avisar de los logros nuevos. Los ya avisados se recuerdan por id; la
  // primera vez (sin nada guardado) se siembran los ya desbloqueados en
  // silencio para no soltar un popup por cada logro viejo al actualizar.
  useEffect(() => {
    if (!options.record) return;
    const seen = getStoredSeenBadges();
    const unlockedIds = unlockedBadges.map((b) => b.id);
    if (seen === null) {
      setStoredSeenBadges(unlockedIds);
      return;
    }
    const fresh = unlockedBadges.filter((b) => !seen.includes(b.id));
    if (fresh.length === 0) return;
    setStoredSeenBadges([...seen, ...fresh.map((b) => b.id)]);
    pushAwards(
      fresh.map<Award>((b) => ({
        kind: 'badge',
        name: b.name,
        icon: b.icon,
        description: b.description,
        xp: XP_PER_BADGE,
      }))
    );
  }, [options.record, unlockedBadges]);

  // Avisar de la subida de nivel (después de los premios que la provocan, que
  // van en los efectos de arriba). El primer render solo fija la referencia.
  const lastLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!options.record) return;
    if (lastLevel.current !== null && level.level > lastLevel.current) {
      pushAwards([{ kind: 'level', level: level.level }]);
    }
    lastLevel.current = level.level;
  }, [options.record, level.level]);

  // Con sesión, subir el nivel a la nube cuando cambie. Si la nube tiene más
  // puntos (otro dispositivo), no se pisa.
  const { user } = useSession();
  const { profile } = useMyProfile();
  const pushedXp = useRef<number | null>(null);
  useEffect(() => {
    if (!options.record || !user) return;
    const remoteXp = profile?.xp ?? 0;
    if (level.xp <= remoteXp || pushedXp.current === level.xp) return;
    pushedXp.current = level.xp;
    updateProfile(user.id, { level: level.level, xp: level.xp })
      .then(() => loadMyProfile(user.id, true))
      .catch(() => {
        // Sin red: se reintenta en el próximo cambio de nivel.
        pushedXp.current = null;
      });
  }, [options.record, user, profile?.xp, level]);

  return { challenges, badges, level };
}
