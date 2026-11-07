import { useEffect, useSyncExternalStore } from 'react';
import { AppState, InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '@lib/cloud/auth';
import {
  getCommentReads,
  getFollowerCount,
  getLikeInfo,
  getNewCommentCounts,
  getPublicRoutineIds,
} from '@lib/cloud/social';
import {
  buildCommunityNews,
  capSeenCounts,
  COMMENT_READS_EPOCH,
  CommunityCounts,
  CommunityNews,
  NO_COMMUNITY_NEWS,
} from '@lib/communityNews';

// Avisos pendientes de Comunidad, en un store de módulo (mismo patrón que
// `useMyProfile`): los pintan la pantalla de Comunidad y el punto de su pestaña,
// y el punto tiene que salir sin haber entrado nunca en ella. No es una
// notificación push (eso exigiría servidor): se mira al abrir la app, al volver
// a ella y al entrar en Comunidad.

let news: CommunityNews = NO_COMMUNITY_NEWS;
let ownerId: string | null = null;
// Lo último medido: lo que queda como visto al atender un aviso.
let current: CommunityCounts = { followers: 0, routineLikes: {} };
const listeners = new Set<() => void>();

function setNews(next: CommunityNews): void {
  news = next;
  listeners.forEach((listener) => listener());
}

const seenKey = (userId: string) => `gymbro_social_seen_${userId}`;

async function readSeen(userId: string): Promise<CommunityCounts | null> {
  const raw = await AsyncStorage.getItem(seenKey(userId));
  if (!raw) return null;
  const seen = JSON.parse(raw) as Partial<CommunityCounts>;
  // Guardado por una versión sin recuento por rutina: no hay contra qué medir.
  return seen.routineLikes
    ? { followers: seen.followers ?? 0, routineLikes: seen.routineLikes }
    : null;
}

const writeSeen = (userId: string, seen: CommunityCounts) =>
  AsyncStorage.setItem(seenKey(userId), JSON.stringify(seen));

/**
 * Vuelve a medir. Lanza sin red. La primera vez se siembra con lo que hay, para
 * no anunciar como "nuevo" todo el histórico.
 */
export async function refreshCommunityNews(userId: string): Promise<void> {
  const [followers, mine] = await Promise.all([
    getFollowerCount(userId),
    getPublicRoutineIds(userId),
  ]);
  const routineLikes: Record<string, number> = {};
  let newComments = new Map<string, number>();
  if (mine.length) {
    const [likeInfo, unread] = await Promise.all([
      getLikeInfo(mine, userId),
      // Sin esto los comentarios no avisan, pero el resto sí.
      getCommentReads(userId, mine)
        .then((reads) =>
          getNewCommentCounts(
            mine,
            userId,
            (id) => reads.get(id) ?? COMMENT_READS_EPOCH
          )
        )
        .catch(() => new Map<string, number>()),
    ]);
    newComments = unread;
    for (const id of mine) routineLikes[id] = likeInfo.get(id)?.likes ?? 0;
  }

  const measured = { followers, routineLikes };
  const stored = await readSeen(userId);
  const seen = stored ? capSeenCounts(stored, measured) : measured;
  await writeSeen(userId, seen);
  if (ownerId !== userId) return;
  current = measured;
  setNews(buildCommunityNews(measured, seen, newComments));
}

async function markSeen(
  userId: string,
  update: (seen: CommunityCounts) => CommunityCounts
): Promise<void> {
  await writeSeen(userId, update((await readSeen(userId)) ?? current));
}

/** Aviso de seguidores atendido. */
export function dismissFollowersNews(userId: string): void {
  setNews({ ...news, followers: 0 });
  const followers = current.followers;
  void markSeen(userId, (seen) => ({ ...seen, followers })).catch(() => {});
}

/** Aviso de una rutina atendido. Sus comentarios los marca leídos el hilo. */
export function dismissRoutineNews(userId: string, routineId: string): void {
  setNews({
    ...news,
    routines: news.routines.filter((routine) => routine.id !== routineId),
  });
  const likes = current.routineLikes[routineId] ?? 0;
  void markSeen(userId, (seen) => ({
    ...seen,
    routineLikes: { ...seen.routineLikes, [routineId]: likes },
  })).catch(() => {});
}

export function useCommunityNews(): CommunityNews {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => news
  );
}

/** Mantiene los avisos al día mientras la app está abierta. */
export function useCommunityNewsRefresh(enabled: boolean): void {
  const { user } = useSession();
  const userId = user?.id ?? null;

  useEffect(() => {
    ownerId = userId;
    current = { followers: 0, routineLikes: {} };
    setNews(NO_COMMUNITY_NEWS);
    if (!userId || !enabled) return;

    // Sin red no se avisa esta vez.
    const refresh = () => void refreshCommunityNews(userId).catch(() => {});
    const task = InteractionManager.runAfterInteractions(refresh);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => {
      task.cancel();
      subscription.remove();
    };
  }, [userId, enabled]);
}
