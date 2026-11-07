import { useEffect, useSyncExternalStore } from 'react';
import { AppState, InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '@lib/cloud/auth';
import {
  getCommentReads,
  getCommunitySeen,
  getFollowerCount,
  getLikeInfo,
  getNewCommentCounts,
  getPublicRoutineIds,
  saveCommunitySeen,
} from '@lib/cloud/social';
import {
  buildCommunityNews,
  capSeenCounts,
  COMMENT_READS_EPOCH,
  CommunityCounts,
  CommunityNews,
  mergeSeenCounts,
  NO_COMMUNITY_NEWS,
  planSeenRefresh,
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
// Lo atendido en esta sesión de la app. Un refresco que leyó lo visto ANTES de
// atender un aviso (la lectura va por red) lo volvería a pintar; con esto no.
let dismissed: CommunityCounts | null = null;
const listeners = new Set<() => void>();

function setNews(next: CommunityNews): void {
  news = next;
  listeners.forEach((listener) => listener());
}

// Lo visto vive en la nube (`community_seen`): sobrevive a cerrar sesión, que
// limpia el móvil, y un aviso atendido en un móvil no vuelve a salir en otro.
// En el móvil solo espera lo que aún no se ha podido subir (sin red, o sin la
// tabla porque falta ejecutar el SQL) y lo que guardaban las versiones
// anteriores: se funde con lo de la nube al leer y se borra al subirlo. La
// clave lleva el prefijo de las copias sociales a propósito: al cerrar sesión
// se va con ellas (`clearSocialCache`), y en el móvil no queda nada de la cuenta.
const pendingKey = (userId: string) => `gymbro_social_seen_${userId}`;

async function readPendingSeen(
  userId: string
): Promise<CommunityCounts | null> {
  try {
    const raw = await AsyncStorage.getItem(pendingKey(userId));
    if (!raw) return null;
    const seen = JSON.parse(raw) as Partial<CommunityCounts>;
    // Guardado por una versión sin recuento por rutina: no hay contra qué medir.
    return seen.routineLikes
      ? { followers: seen.followers ?? 0, routineLikes: seen.routineLikes }
      : null;
  } catch {
    return null;
  }
}

const savePending = (userId: string, seen: CommunityCounts) =>
  AsyncStorage.setItem(pendingKey(userId), JSON.stringify(seen)).catch(
    () => {}
  );

/** Lo de la nube (null: aún nada; undefined: no se ha podido leer) y lo pendiente. */
async function readSeen(userId: string): Promise<{
  cloud: CommunityCounts | null | undefined;
  pending: CommunityCounts | null;
}> {
  const [pending, cloud] = await Promise.all([
    readPendingSeen(userId),
    getCommunitySeen(userId).catch(() => undefined),
  ]);
  return { cloud, pending };
}

/**
 * Sube lo visto y, hecho, borra lo que esperaba en el móvil. Si no se puede,
 * espera en el móvil `fallback` (por defecto, lo mismo) para la próxima vez.
 */
async function uploadSeen(
  userId: string,
  seen: CommunityCounts,
  fallback: CommunityCounts = seen
): Promise<void> {
  try {
    await saveCommunitySeen(userId, seen);
  } catch {
    // Cerró sesión entretanto: en el móvil no queda nada de la cuenta.
    if (ownerId === userId) await savePending(userId, fallback);
    return;
  }
  await AsyncStorage.removeItem(pendingKey(userId)).catch(() => {});
}

// Leer, calcular y escribir lo visto, de uno en uno: con la lectura por red de
// por medio, un refresco y un aviso atendido a la vez (o dos avisos seguidos)
// se pisaban, y el aviso atendido volvía.
let seenQueue: Promise<unknown> = Promise.resolve();

function serialSeen<T>(operation: () => Promise<T>): Promise<T> {
  const run = seenQueue.then(operation, operation);
  seenQueue = run.catch(() => {});
  return run;
}

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
  await serialSeen(async () => {
    const { cloud, pending } = await readSeen(userId);
    if (ownerId !== userId) return;
    // Qué subir lo decide `planSeenRefresh` (lib/communityNews.ts). Medir ocurre
    // en cada vuelta a la app, y casi siempre no hay nada que escribir.
    const { seen, write } = planSeenRefresh(cloud, pending, measured);
    if (write === 'cloud' && seen) await uploadSeen(userId, seen);
    if (!seen || ownerId !== userId) return;
    current = measured;
    // Con lo atendido mientras tanto, que esta lectura pudo no ver aún.
    const shown = capSeenCounts(
      mergeSeenCounts(seen, dismissed) ?? seen,
      measured
    );
    setNews(buildCommunityNews(measured, shown, newComments));
  });
}

/**
 * Deja como visto SOLO lo atendido (`patch`): lo demás sigue como estaba. Se
 * funde por máximo con la nube y con lo pendiente; si la nube no se puede
 * leer, el patch espera en el móvil sin subir nada a ciegas, y antes se tomaba
 * todo lo medido como base, con lo que los otros avisos se daban por vistos.
 */
async function markSeen(userId: string, patch: CommunityCounts): Promise<void> {
  dismissed = mergeSeenCounts(dismissed, patch);
  // Al móvil ya, antes de esperar a la red (sin cobertura la lectura tarda en
  // fallar, y la app puede cerrarse antes): si la subida va bien, lo borra.
  const waitingNow = mergeSeenCounts(await readPendingSeen(userId), patch);
  if (waitingNow && ownerId === userId) await savePending(userId, waitingNow);
  return serialSeen(async () => {
    const { cloud, pending } = await readSeen(userId);
    if (ownerId !== userId) return;
    const waiting = mergeSeenCounts(pending, patch) ?? patch;
    if (cloud === undefined) {
      await savePending(userId, waiting);
      return;
    }
    const next = mergeSeenCounts(cloud, waiting) ?? waiting;
    await uploadSeen(userId, next, waiting);
  });
}

/** Aviso de seguidores atendido. */
export function dismissFollowersNews(userId: string): void {
  setNews({ ...news, followers: 0 });
  const patch = { followers: current.followers, routineLikes: {} };
  void markSeen(userId, patch).catch(() => {});
}

/** Aviso de una rutina atendido. Sus comentarios los marca leídos el hilo. */
export function dismissRoutineNews(userId: string, routineId: string): void {
  setNews({
    ...news,
    routines: news.routines.filter((routine) => routine.id !== routineId),
  });
  const patch = {
    followers: 0,
    routineLikes: { [routineId]: current.routineLikes[routineId] ?? 0 },
  };
  void markSeen(userId, patch).catch(() => {});
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
  const { user, restoring } = useSession();
  // Con la sesión guardada esperando a renovarse no se mide (la nube no
  // respondería como esta cuenta), y al renovarse se vuelve a medir.
  const userId = restoring ? null : user?.id ?? null;

  useEffect(() => {
    ownerId = userId;
    current = { followers: 0, routineLikes: {} };
    dismissed = null;
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
