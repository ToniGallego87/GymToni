/**
 * Avisos pendientes de Comunidad, sin red ni disco (eso va en
 * hooks/useCommunityNews.ts).
 *
 * Un aviso sigue pendiente hasta que se atiende. Seguidores y me gusta se miden
 * contra lo ya visto en este móvil. Los comentarios, contra lo LEÍDO en cada
 * rutina, que vive en la nube (`comment_reads`) y vale en todos los dispositivos:
 * comparar totales incluía los tuyos (también el comentario automático de
 * cambios) y no veía uno nuevo si otro se había borrado.
 */

export interface RoutineNews {
  id: string;
  likes: number;
  comments: number;
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
  newComments: Map<string, number>
): CommunityNews {
  return {
    followers: Math.max(0, current.followers - seen.followers),
    routines: Object.keys(current.routineLikes)
      .map((id) => ({
        id,
        likes: Math.max(
          0,
          current.routineLikes[id] - (seen.routineLikes[id] ?? 0)
        ),
        comments: newComments.get(id) ?? 0,
      }))
      .filter((routine) => routine.likes > 0 || routine.comments > 0),
  };
}

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
 * Una rutina ajena sin marca se abre por primera vez y no tiene nada "nuevo": lo
 * sería el hilo entero. Sí queda marcada, para lo que venga después.
 */
export function readCommentThread<
  T extends { user_id: string; created_at: number },
>(
  comments: T[],
  userId: string,
  lastRead: number | undefined,
  isOwner: boolean,
  now: number
): { fresh: T[]; readAt: number | null } {
  const unseen = pickNewComments(comments, userId, lastRead ?? 0);
  const fresh =
    lastRead !== undefined
      ? unseen
      : isOwner
      ? pickNewComments(comments, userId, COMMENT_READS_EPOCH)
      : [];
  const readAt = unseen.length
    ? Math.max(...unseen.map((comment) => comment.created_at))
    : lastRead === undefined
    ? now
    : null;
  return { fresh, readAt };
}
