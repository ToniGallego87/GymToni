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
