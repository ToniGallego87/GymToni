import { useEffect, useSyncExternalStore } from 'react';
import { useSession } from '@lib/cloud/auth';
import { blockUser, getBlockedIds, unblockUser } from '@lib/cloud/social';
import {
  isSocialCacheOwner,
  readSocialCache,
  registerSocialMemoryCache,
  writeSocialCache,
} from '@lib/socialCache';

// Cuentas bloqueadas por la persona con sesión, en un store de módulo con
// suscriptores (mismo patrón que useMyProfile): lo leen el tablón, la ficha
// pública y el perfil ajeno, y bloquear desde el perfil tiene que verse al
// instante en los tres. La verdad está en la nube (tabla `blocks`); en disco
// queda una copia por cuenta (lib/socialCache.ts) para pintar sin red.
//
// Los comentarios y la actividad del bloqueado ya los filtra la RLS; las
// rutinas, las pantallas con este conjunto.

const CACHE_KEY = 'blocked';
const EMPTY: ReadonlySet<string> = new Set();

type BlockedState = { userId: string | null; ids: ReadonlySet<string> };

let state: BlockedState = { userId: null, ids: EMPTY };
// Cuenta cuya lista ya ha contestado la nube en esta sesión de la app.
let loadedFor: string | null = null;
// Sube con cada cambio de la lista (bloquear, desbloquear, cambio de cuenta):
// una carga pedida antes ya no vale y no debe pisar lo nuevo.
let version = 0;
const listeners = new Set<() => void>();

function setState(next: BlockedState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Al cambiar de cuenta, la lista de la anterior no vale ni un instante.
registerSocialMemoryCache(() => {
  version += 1;
  loadedFor = null;
  setState({ userId: null, ids: EMPTY });
});

/**
 * Carga los bloqueos de `userId`: primero la copia del disco (si aún no hay
 * nada en memoria) y después la nube. Sin red se queda con la copia y lo
 * reintenta la próxima pantalla que lo pida.
 */
export async function loadBlockedUsers(userId: string): Promise<void> {
  if (loadedFor === userId) return;
  const startedAt = version;
  // Lo que llega después de bloquear o de cambiar de cuenta es viejo.
  const current = () => version === startedAt && isSocialCacheOwner(userId);
  if (state.userId !== userId) {
    const cached = await readSocialCache<string[]>(CACHE_KEY);
    if (cached && state.userId !== userId && current()) {
      setState({ userId, ids: new Set(cached) });
    }
  }
  try {
    const ids = await getBlockedIds(userId);
    if (!current()) return;
    loadedFor = userId;
    setState({ userId, ids: new Set(ids) });
    writeSocialCache(CACHE_KEY, ids, userId);
  } catch {
    // Sin red: vale la copia (o nada) hasta el próximo intento.
  }
}

/** Bloquea o desbloquea a `targetId`. Lanza si la nube no lo acepta. */
export async function setUserBlocked(
  userId: string,
  targetId: string,
  blocked: boolean
): Promise<void> {
  if (blocked) await blockUser(userId, targetId);
  else await unblockUser(userId, targetId);
  version += 1;
  const ids = new Set(state.userId === userId ? state.ids : EMPTY);
  if (blocked) ids.add(targetId);
  else ids.delete(targetId);
  setState({ userId, ids });
  writeSocialCache(CACHE_KEY, [...ids], userId);
}

/** Ids de las cuentas bloqueadas por quien tiene sesión (vacío sin sesión). */
export function useBlockedUsers(): ReadonlySet<string> {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const snapshot = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (userId) void loadBlockedUsers(userId);
  }, [userId]);
  return snapshot.userId === userId && userId ? snapshot.ids : EMPTY;
}
