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
import { buildLocalActivity } from '@lib/activity';
import { publishActivity } from '@lib/cloud/activity';
import { getStoredSeenBadges, setStoredSeenBadges } from '@lib/appSettings';
import { useSession } from '@lib/cloud/auth';
import { updateProfile } from '@lib/cloud/social';
import { loadMyProfile, useMyProfile } from './useMyProfile';
import { logsForAwards, useOpenWorkoutLog } from '@lib/openWorkout';

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

function useLevelData() {
  const { state } = useWorkout();
  const weight = useBodyWeight();
  const wins = useChallengeWins();
  // El entreno que se está registrando, o el de hoy a medias, no cuenta hasta
  // terminarlo o acabar el día (ver `lib/openWorkout`): retos e insignias se
  // calculan sin él.
  const logs = logsForAwards(state.logs, useOpenWorkoutLog(), state.routines);

  const challenges = sharedChallenges(
    logs,
    state.routines,
    state.activeRoutineId,
    weight
  );
  const { all: badges, unlocked: unlockedBadges } = sharedBadges(
    logs,
    state.routines
  );

  const level = useMemo(
    () => summarizeLevel(totalXp(wins.length, unlockedBadges.length)),
    [wins.length, unlockedBadges.length]
  );

  return {
    challenges,
    badges,
    unlockedBadges,
    level,
    logs,
    wins,
    routines: state.routines,
  };
}

/**
 * Retos vigentes + nivel de la cuenta, a partir del estado de la app.
 *
 * Lo usan Perfil, Logros, las hero cards y la barra superior de cada pantalla.
 * Solo calcula: apuntar lo superado, avisar y subir a la nube es cosa de
 * `useRecordAccountLevel`, que va una sola vez en la raíz. Por eso este no se
 * suscribe a la sesión ni al perfil: con una docena de instancias montadas, cada
 * cambio de sesión o de perfil repintaba todas las pantallas que lo llevan.
 */
export function useAccountLevel(): {
  challenges: Challenge[];
  /** El catálogo entero de insignias (Logros lo pinta; el resto usa `level`). */
  badges: Badge[];
  level: LevelSummary;
} {
  const { challenges, badges, level } = useLevelData();
  return { challenges, badges, level };
}

/**
 * La parte de la cuenta que debe correr UNA vez y no en cada pantalla: apunta
 * los retos superados, avisa de lo nuevo (retos, logros y nivel, vía
 * `lib/awards`), sube el nivel al perfil público y publica la Actividad. La
 * monta la raíz de la app, y solo con los datos reales (`enabled`): con los de
 * antes de hidratar, todo parecería "nuevo".
 */
export function useRecordAccountLevel(enabled: boolean): void {
  const { challenges, badges, unlockedBadges, level, logs, wins, routines } =
    useLevelData();

  // Apuntar los retos superados (permanente) y avisar de los nuevos.
  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled, challenges]);

  // Avisar de los logros nuevos. Los ya avisados se recuerdan por id; la
  // primera vez (sin nada guardado) se siembran los ya desbloqueados en
  // silencio para no soltar un popup por cada logro viejo al actualizar.
  useEffect(() => {
    if (!enabled) return;
    // La insignia "Récord personal" pasó a llamarse `improved-1` (mide semanas
    // mejoradas): a quien ya la tenía vista no se le vuelve a avisar.
    const seen = getStoredSeenBadges()?.map((id) =>
      id === 'personal-record' ? 'improved-1' : id
    );
    const unlockedIds = unlockedBadges.map((b) => b.id);
    if (seen === undefined) {
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
  }, [enabled, unlockedBadges]);

  // Avisar de la subida de nivel (después de los premios que la provocan, que
  // van en los efectos de arriba). El primer render solo fija la referencia.
  // Se guarda el MÁXIMO visto: al continuar el entreno de hoy, apartarlo (ver
  // `lib/openWorkout`) puede bajar el nivel un momento, y al soltarlo no debe
  // volver a anunciarse uno que ya se tenía.
  const lastLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (lastLevel.current !== null && level.level > lastLevel.current) {
      pushAwards([{ kind: 'level', level: level.level }]);
    }
    lastLevel.current = Math.max(lastLevel.current ?? 0, level.level);
  }, [enabled, level.level]);

  // Con sesión, subir el nivel a la nube cuando cambie. Si la nube tiene más
  // puntos (otro dispositivo), no se pisa. Con los mismos puntos pero otro nivel
  // (cambió la curva de niveles) también se sube, para corregir el público.
  const { user } = useSession();
  const { profile } = useMyProfile();
  const pushedXp = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !user) return;
    const remoteXp = profile?.xp ?? 0;
    const pushKey = `${level.xp}:${level.level}`;
    const stale =
      level.xp > remoteXp ||
      (level.xp === remoteXp && profile?.level !== level.level);
    if (!stale || pushedXp.current === pushKey) return;
    pushedXp.current = pushKey;
    updateProfile(user.id, { level: level.level, xp: level.xp })
      .then(() => loadMyProfile(user.id, true))
      .catch(() => {
        // Sin red: se reintenta en el próximo cambio de nivel.
        pushedXp.current = null;
      });
  }, [enabled, user, profile?.xp, level]);

  // Publicar la Actividad (insignias, retos y días entrenados) para que la vean
  // en tu perfil. Se hace aquí por lo mismo que el nivel: este es el único sitio
  // que ya tiene el catálogo entero calculado y corre una sola vez (la raíz).
  // Solo sube lo que falte (`publishActivity` es idempotente) y únicamente si el
  // interruptor está encendido; apagarlo borra lo subido desde Editar perfil.
  const publishing = useRef(false);
  useEffect(() => {
    if (!enabled || !user) return;
    // Hasta que el perfil no ha llegado no se sabe si lo comparte, y publicar
    // "por si acaso" sería publicar lo de quien lo tiene apagado.
    if (!profile || profile.share_activity === false) return;
    if (publishing.current) return;
    publishing.current = true;
    const items = buildLocalActivity({
      logs,
      routines,
      badges,
      challenges,
      wins,
    });
    publishActivity(user.id, items)
      .catch(() => {
        // Sin red o sin la tabla creada: se reintenta en el próximo arranque.
      })
      .finally(() => {
        publishing.current = false;
      });
    // A propósito solo cuando cambia lo publicable, no en cada repintado: los
    // hitos nuevos llegan con un reto ganado, una insignia o un entreno más.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    user,
    profile?.share_activity,
    wins.length,
    unlockedBadges.length,
    logs.length,
  ]);
}
