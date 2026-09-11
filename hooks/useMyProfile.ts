import { useEffect, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '@lib/cloud/auth';
import { getProfile, Profile } from '@lib/cloud/social';

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
const notify = () => listeners.forEach((l) => l());

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
    state = { userId: null, profile: null, loading: false };
    notify();
    return;
  }
  if (!force && state.userId === userId && state.profile) return;
  const known = state.userId === userId ? state.profile : null;
  state = { userId, profile: known, loading: true };
  notify();

  // Arranque en frío: el store de módulo nace vacío, así que la copia local es
  // lo único que hay hasta que conteste la nube.
  if (!known) {
    const cached = await readCachedProfile(userId);
    if (cached && state.userId === userId && !state.profile) {
      state = { userId, profile: cached, loading: true };
      notify();
    }
  }

  try {
    const fresh = await getProfile(userId);
    // `fresh` puede ser null si la fila aún no existe; en ese caso se conserva
    // lo que ya se estuviera enseñando en vez de vaciarlo.
    state = { userId, profile: fresh ?? state.profile, loading: false };
    if (fresh) writeCachedProfile(userId, fresh);
  } catch {
    // Sin red: se queda la copia local (o lo que hubiera en memoria). Antes
    // aquí se ponía `null` y Perfil pasaba a decir "Sin perfil".
    state = { userId, profile: state.profile, loading: false };
  }
  notify();
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
