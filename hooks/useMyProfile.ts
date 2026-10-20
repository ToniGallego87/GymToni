import { useEffect, useReducer } from 'react';
import { unstable_batchedUpdates } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '@lib/cloud/auth';
import {
  getProfile,
  isLegacyAvatarUrl,
  migrateLegacyAvatar,
  Profile,
} from '@lib/cloud/social';

// Perfil público del usuario que ha iniciado sesión, en un store de módulo con
// suscriptores (mismo patrón que `themeStore`) en vez de un `useState` por
// pantalla. Lo piden dos sitios a la vez —la barra de navegación, que pinta la
// foto en lugar del icono de Perfil, y la propia pantalla de Perfil—, y si cada
// uno lo cargara por su cuenta habría dos peticiones y dos verdades: al guardar
// desde el editor, una de las dos se quedaría con la foto vieja.
//
// El perfil vive SOLO en la nube, así que además se guarda una copia local (una
// clave por usuario en AsyncStorage, como el cursor de sync): es lo que se pinta
// mientras baja el de verdad y lo que queda si no hay red. Sin esa copia, abrir
// Perfil sin cobertura decía "Sin perfil" y ofrecía "Completar perfil" a alguien
// que ya lo tenía, y la barra perdía la foto.

type MyProfileState = {
  userId: string | null;
  profile: Profile | null;
  loading: boolean;
};

let state: MyProfileState = { userId: null, profile: null, loading: false };
const listeners = new Set<() => void>();

// Solo avisa si algo cambia, y a todos en UN pase de render: los avisos llegan
// desde promesas y, con la arquitectura antigua, sin agrupar cada suscriptor
// repintaba por separado.
function setState(next: MyProfileState): void {
  if (
    next.userId === state.userId &&
    next.profile === state.profile &&
    next.loading === state.loading
  ) {
    return;
  }
  state = next;
  unstable_batchedUpdates(() => listeners.forEach((l) => l()));
}

// Carga en vuelo: la barra, Perfil, Comunidad y el registro del nivel montan a
// la vez y cada uno pedía el mismo perfil por su cuenta.
let inFlight: { userId: string; promise: Promise<void> } | null = null;

const cacheKey = (userId: string) => `gymbro_profile_${userId}`;

async function readCachedProfile(userId: string): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    // Copia ilegible o storage no disponible: como si no hubiera caché.
    return null;
  }
}

function writeCachedProfile(userId: string, profile: Profile): void {
  // Sin await: guardar la copia no debe retrasar el pintado.
  void AsyncStorage.setItem(cacheKey(userId), JSON.stringify(profile)).catch(
    () => {}
  );
}

/**
 * Carga (o recarga con `force`) el perfil del usuario y avisa a los suscriptores.
 * El editor la llama con `force` tras guardar, para que la foto nueva llegue al
 * instante a la barra y a Perfil.
 *
 * Orden: lo que ya hay en memoria → la copia local → la nube. Cada paso solo
 * pisa al anterior si trae algo, así que un fallo de red NUNCA vacía el perfil.
 */
export async function loadMyProfile(
  userId: string | null,
  force = false
): Promise<void> {
  if (!userId) {
    setState({ userId: null, profile: null, loading: false });
    return;
  }
  if (!force && state.userId === userId && state.profile) return;
  if (!force && inFlight?.userId === userId) return inFlight.promise;
  const promise = fetchMyProfile(userId);
  inFlight = { userId, promise };
  try {
    await promise;
  } finally {
    if (inFlight?.promise === promise) inFlight = null;
  }
}

async function fetchMyProfile(userId: string): Promise<void> {
  const known = state.userId === userId ? state.profile : null;
  setState({ userId, profile: known, loading: true });

  // Arranque en frío: el store de módulo nace vacío, así que la copia local es
  // lo único que hay hasta que conteste la nube.
  if (!known) {
    const cached = await readCachedProfile(userId);
    if (cached && state.userId === userId && !state.profile) {
      setState({ userId, profile: cached, loading: true });
    }
  }

  try {
    const fresh = await getProfile(userId);
    // Cambio de cuenta mientras tanto: no es el perfil de la cuenta abierta.
    if (state.userId !== userId) return;
    // Lo normal al arrancar es que la nube diga lo mismo que la copia local: se
    // conserva la referencia y quien lo pinta no tiene nada que repintar.
    const changed =
      !!fresh && JSON.stringify(fresh) !== JSON.stringify(state.profile);
    if (changed) writeCachedProfile(userId, fresh);
    // `fresh` puede ser null si la fila aún no existe; en ese caso se conserva
    // lo que ya se estuviera enseñando en vez de vaciarlo.
    setState({
      userId,
      profile: changed ? fresh : state.profile,
      loading: false,
    });
    migrateAvatarOnce(userId, fresh?.avatar_url);
  } catch {
    // Sin red: se queda la copia local (o lo que hubiera en memoria). Antes
    // aquí se ponía `null` y Perfil pasaba a decir "Sin perfil".
    if (state.userId !== userId) return;
    setState({ userId, profile: state.profile, loading: false });
  }
}

// Foto en la ruta fija de las versiones viejas (`{uid}/avatar.jpg`): se pasa a
// un nombre aleatorio en segundo plano (lib/cloud/social.ts →
// migrateLegacyAvatar) y se recarga el perfil para pintar la URL nueva. Un
// intento por cuenta y sesión: si falla (sin red), en el próximo arranque.
const avatarMigrationTried = new Set<string>();

function migrateAvatarOnce(
  userId: string,
  avatarUrl: string | null | undefined
): void {
  if (!isLegacyAvatarUrl(userId, avatarUrl)) return;
  if (avatarMigrationTried.has(userId)) return;
  avatarMigrationTried.add(userId);
  void migrateLegacyAvatar(userId, avatarUrl)
    .then((url) => (url ? loadMyProfile(userId, true) : undefined))
    .catch(() => {});
}

export function useMyProfile(): { profile: Profile | null; loading: boolean } {
  const { user } = useSession();
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    listeners.add(rerender);
    void loadMyProfile(user?.id ?? null);
    return () => {
      listeners.delete(rerender);
    };
  }, [user?.id]);

  // Mientras el store aún apunta al usuario anterior (cambio de cuenta), nada:
  // más vale el marcador que la foto de otro.
  const mine = state.userId === (user?.id ?? null);
  return {
    profile: mine ? state.profile : null,
    loading: mine ? state.loading : !!user,
  };
}

/** ¿Tiene el usuario perfil público relleno? Lo define el nombre visible. */
export function hasProfileFilled(profile: Profile | null): boolean {
  return !!profile?.display_name?.trim();
}
