import { useSyncExternalStore } from 'react';
import { getStoredChallengeWins, setStoredChallengeWins } from './appSettings';
import { Challenge } from './challenges';

/**
 * Nivel de la cuenta: la recompensa PERMANENTE de los retos semanales.
 *
 * Los logros y los retos se rederivan del historial y por eso "se mueven" si
 * se borra; el nivel no puede: cada reto superado se apunta una vez (clave
 * `id@periodo`) en la BD de ajustes y ya no se quita. De ahí salen los puntos
 * y el nivel, que además se suben al perfil público (`profiles.level`) para
 * que los demás lo vean sin recalcular nada.
 *
 * Store de módulo con suscriptores (mismo patrón que `bodyWeight`): lo pintan
 * Perfil, Logros y las hero cards, y todos ven el mismo número.
 */

/** Puntos por reto superado. */
export const XP_PER_CHALLENGE = 10;
/** Puntos por logro desbloqueado (los de `badges.ts`). */
export const XP_PER_BADGE = 25;

export interface LevelSummary {
  level: number;
  xp: number;
  /** Puntos con los que empieza el nivel actual. */
  levelStart: number;
  /** Puntos que exige el siguiente nivel. */
  nextLevelAt: number;
  /** 0..1 dentro del nivel actual. */
  progress: number;
}

/** Lo que cuesta subir del nivel 1 al 2; cada salto siguiente pide esto más. */
const LEVEL_STEP_XP = 25;

/**
 * Puntos que exige el nivel `n` (1 → 0, 2 → 25, 3 → 75, 4 → 150, 5 → 250…):
 * subir de nivel cuesta 25 puntos más que el salto anterior (25, 50, 75…), así
 * que el total es cuadrático pero suave.
 */
export function xpForLevel(level: number): number {
  const n = Math.max(0, level - 1);
  return (LEVEL_STEP_XP * n * (n + 1)) / 2;
}

/** Nivel que dan `xp` puntos: el mayor cuyo umbral no supera `xp`. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  return level;
}

export function summarizeLevel(xp: number): LevelSummary {
  const level = levelForXp(xp);
  const levelStart = xpForLevel(level);
  const nextLevelAt = xpForLevel(level + 1);
  return {
    level,
    xp,
    levelStart,
    nextLevelAt,
    progress: (xp - levelStart) / (nextLevelAt - levelStart),
  };
}

export function totalXp(challengeWins: number, badgesUnlocked: number): number {
  return challengeWins * XP_PER_CHALLENGE + badgesUnlocked * XP_PER_BADGE;
}

// ── Store de retos superados ────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();
let wins: string[] = getStoredChallengeWins();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getChallengeWins(): string[] {
  return wins;
}

/** Retos superados (claves `id@periodo`), reactivo. */
export function useChallengeWins(): string[] {
  return useSyncExternalStore(subscribe, getChallengeWins, getChallengeWins);
}

export function challengeWinKey(c: Challenge): string {
  return `${c.id}@${c.periodKey}`;
}

/**
 * Apunta los retos que estén superados y aún no contados. Devuelve los nuevos
 * (ninguno casi siempre) para que quien llama pueda avisar de cada uno.
 */
export function recordChallengeWins(challenges: Challenge[]): Challenge[] {
  const fresh = challenges.filter(
    (c) => c.done && !wins.includes(challengeWinKey(c))
  );
  if (fresh.length === 0) return [];
  wins = [...wins, ...fresh.map(challengeWinKey)];
  setStoredChallengeWins(wins);
  for (const listener of Array.from(listeners)) listener();
  return fresh;
}
