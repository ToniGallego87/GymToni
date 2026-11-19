/**
 * Avisos pendientes de Comunidad, sin red ni disco (eso va en
 * hooks/useCommunityNews.ts).
 *
 * Un aviso sigue pendiente hasta que se atiende. Seguidores y me gusta se miden
 * contra lo ya visto en este móvil. Los comentarios, contra lo LEÍDO en cada
 * rutina, que vive en la nube (`comment_reads`) y vale en todos los dispositivos:
 * comparar totales incluía los tuyos (también el comentario automático de
 * cambios) y no veía uno nuevo si otro se había borrado.
 *
 * Los comentarios avisan en tus rutinas publicadas y también en la de otra
 * persona que tengas ENLAZADA y ACTIVA (`followsRoutineComments`): es la que
 * entrenas y sigue a su autor, así que sus cambios y lo que se cuente en ella
 * te importan. Una copia (ya no cambia con el autor) o una enlazada que no
 * usas no avisan. De esas no se cuentan los "me gusta": son cosa de su dueño.
 */

import type { WorkoutRoutine } from '../types';
import { communitySourceOf, isLinkedRoutine } from './routines';

/**
 * ¿Avisan los comentarios de esta rutina ajena? Solo si está enlazada (sigue
 * al autor) y es la activa. Fuente única: la usan el aviso y el resalte del
 * hilo, que tienen que contar lo mismo.
 */
export const followsRoutineComments = (routine: WorkoutRoutine): boolean =>
  isLinkedRoutine(routine) && routine.isActive;

export interface RoutineNews {
  id: string;
  likes: number;
  comments: number;
  // Rutina ajena agregada a las tuyas: lo que hace falta para abrir su ficha.
  saved?: { ownerId: string; author: string; name: string };
}

/** Rutina pública ajena que tienes agregada, por el id de la PÚBLICA. */
export interface SavedRoutineSource {
  id: string;
  ownerId: string;
  author: string;
  name: string;
  // Sin marca de leído, desde cuándo cuentan sus comentarios.
  since: number;
}

export interface CommunityNews {
  followers: number;
  routines: RoutineNews[];
}

export const NO_COMMUNITY_NEWS: CommunityNews = { followers: 0, routines: [] };

export const hasCommunityNews = (news: CommunityNews) =>
  news.followers > 0 || news.routines.length > 0;

/** Lo que hay ahora; también, guardado, lo ya visto. */
export interface CommunityCounts {
  followers: number;
  routineLikes: Record<string, number>;
}

export function buildCommunityNews(
  current: CommunityCounts,
  seen: CommunityCounts,
  newComments: Map<string, number>,
  saved: SavedRoutineSource[] = []
): CommunityNews {
  const own: RoutineNews[] = Object.keys(current.routineLikes)
    .map((id) => ({
      id,
      likes: Math.max(
        0,
        current.routineLikes[id] - (seen.routineLikes[id] ?? 0)
      ),
      comments: newComments.get(id) ?? 0,
    }))
    .filter((routine) => routine.likes > 0 || routine.comments > 0);
  const others: RoutineNews[] = saved
    .filter(
      (source) =>
        !(source.id in current.routineLikes) &&
        (newComments.get(source.id) ?? 0) > 0
    )
    .map(({ id, ownerId, author, name }) => ({
      id,
      likes: 0,
      comments: newComments.get(id) ?? 0,
      saved: { ownerId, author, name },
    }));
  return {
    followers: Math.max(0, current.followers - seen.followers),
    routines: [...own, ...others],
  };
}

/**
 * Las rutinas públicas ajenas cuyos comentarios avisan (enlazadas y activas,
 * `followsRoutineComments`), una vez cada una. Desde cuándo cuentan sus
 * comentarios lo dice `commentsSince`.
 */
export function savedRoutineSources(
  routines: WorkoutRoutine[],
  userId: string,
  now: number = Date.now()
): SavedRoutineSource[] {
  const byId = new Map<string, SavedRoutineSource>();
  for (const routine of routines) {
    if (!followsRoutineComments(routine)) continue;
    const source = communitySourceOf(routine, userId);
    if (!source || byId.has(source.id)) continue;
    byId.set(source.id, {
      ...source,
      author: routine.sourceAuthor ?? '',
      name: routine.name,
      since: commentsSince(routine.createdAt, now),
    });
  }
  return [...byId.values()];
}

/**
 * Lo más atrás que se anuncia de una enlazada sin marca de lectura. Avisa solo
 * mientras es la activa, y no se sabe desde cuándo lo es: una enlazada en enero
 * y activada en noviembre anunciaba como nuevos los comentarios de diez meses.
 */
export const LINKED_COMMENTS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Desde cuándo cuentan los comentarios de una enlazada cuyo hilo aún no tiene
 * marca: desde que la enlazaste, pero nunca más de una semana atrás ni antes
 * del inicio de la cuenta (lo anterior no es nuevo). Fuente única del aviso y
 * del resalte del hilo.
 */
export const commentsSince = (
  addedAt: number | undefined,
  now: number
): number =>
  Math.max(COMMENT_READS_EPOCH, addedAt ?? 0, now - LINKED_COMMENTS_WINDOW_MS);

/**
 * Junta dos versiones de lo visto (la de la nube y la que espera en el móvil a
 * subir): de cada dato, la más alta, porque lo visto solo avanza al atender un
 * aviso y quedarse con la baja haría volver un aviso ya atendido. null si no
 * hay ninguna.
 */
export function mergeSeenCounts(
  a: CommunityCounts | null,
  b: CommunityCounts | null
): CommunityCounts | null {
  if (!a || !b) return a ?? b;
  const routineLikes: Record<string, number> = { ...a.routineLikes };
  for (const [id, likes] of Object.entries(b.routineLikes)) {
    routineLikes[id] = Math.max(routineLikes[id] ?? 0, likes);
  }
  return { followers: Math.max(a.followers, b.followers), routineLikes };
}

/**
 * Qué hacer con lo visto al volver a medir. `cloud` es lo de la nube (null: aún
 * nada; undefined: no se ha podido leer) y `pending`, lo que espera en el móvil.
 *
 * - Sin poder leer la nube no se avisa esta vez (`seen` null) ni se escribe
 *   nada. Subir a ciegas haría volver avisos que otro móvil ya atendió, y lo
 *   pendiente no sirve para medir: suele ser solo lo atendido (un dato), y
 *   contra él todo lo demás saldría como nuevo. Lo pendiente se queda como
 *   está, para la próxima vez que se lea la nube.
 * - Leída la nube, se funde con lo pendiente y se sube solo si cambia algo o
 *   había algo pendiente.
 */
export function planSeenRefresh(
  cloud: CommunityCounts | null | undefined,
  pending: CommunityCounts | null,
  measured: CommunityCounts
): { seen: CommunityCounts | null; write: 'cloud' | 'none' } {
  if (cloud === undefined) return { seen: null, write: 'none' };
  const base = mergeSeenCounts(cloud, pending);
  const seen = base ? capSeenCounts(base, measured) : measured;
  const write = pending || !sameSeenCounts(cloud, seen) ? 'cloud' : 'none';
  return { seen, write };
}

/** ¿Dicen lo mismo? Para no reescribir lo visto si no ha cambiado. */
export function sameSeenCounts(
  a: CommunityCounts | null,
  b: CommunityCounts | null
): boolean {
  if (!a || !b) return a === b;
  if (a.followers !== b.followers) return false;
  const ids = Object.keys(a.routineLikes);
  if (ids.length !== Object.keys(b.routineLikes).length) return false;
  return ids.every((id) => a.routineLikes[id] === b.routineLikes[id]);
}

/**
 * Lo visto, sin pasar de lo que hay: si alguien deja de seguirte, la baja no
 * puede tapar al siguiente seguidor nuevo.
 */
export function capSeenCounts(
  seen: CommunityCounts,
  current: CommunityCounts
): CommunityCounts {
  const routineLikes: Record<string, number> = {};
  for (const [id, likes] of Object.entries(current.routineLikes)) {
    routineLikes[id] = Math.min(seen.routineLikes[id] ?? 0, likes);
  }
  return {
    followers: Math.min(seen.followers, current.followers),
    routineLikes,
  };
}

/**
 * Inicio de la cuenta de comentarios sin leer en tus rutinas: lo anterior no se
 * anuncia como nuevo.
 */
export const COMMENT_READS_EPOCH = Date.UTC(2026, 10, 5);

/** Los comentarios de otras personas posteriores a `lastRead`. */
export function pickNewComments<
  T extends { user_id: string; created_at: number },
>(comments: T[], userId: string, lastRead: number): T[] {
  return comments.filter(
    (comment) => comment.user_id !== userId && comment.created_at > lastRead
  );
}

/**
 * Qué se resalta al abrir un hilo y hasta dónde queda leído (`null`: no cambia).
 * Sin marca, `since` dice desde cuándo es nuevo (el mismo criterio que el
 * aviso): tu rutina, desde el inicio de la cuenta; una enlazada y activa,
 * desde que la enlazaste (`commentsSince`). Cualquier otra ajena (`since`
 * undefined) se abre por primera vez y no tiene nada "nuevo": lo sería el hilo
 * entero. Sí queda marcada, para lo que venga después.
 */
export function readCommentThread<
  T extends { user_id: string; created_at: number },
>(
  comments: T[],
  userId: string,
  lastRead: number | undefined,
  since: number | undefined,
  now: number
): { fresh: T[]; readAt: number | null } {
  const unseen = pickNewComments(comments, userId, lastRead ?? 0);
  const fresh =
    lastRead !== undefined
      ? unseen
      : since !== undefined
      ? pickNewComments(comments, userId, since)
      : [];
  const readAt = unseen.length
    ? Math.max(...unseen.map((comment) => comment.created_at))
    : lastRead === undefined
    ? now
    : null;
  return { fresh, readAt };
}
