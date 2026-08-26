import { useEffect, useReducer } from 'react';
import { useSession } from '@lib/cloud/auth';
import { getProfile, Profile } from '@lib/cloud/social';

// Perfil público del usuario que ha iniciado sesión, en un store de módulo con
// suscriptores (mismo patrón que `themeStore`) en vez de un `useState` por
// pantalla. Lo piden dos sitios a la vez —la barra de navegación, que pinta la
// foto en lugar del icono de Perfil, y la propia pantalla de Perfil—, y si cada
// uno lo cargara por su cuenta habría dos peticiones y dos verdades: al guardar
// desde el editor, una de las dos se quedaría con la foto vieja.

type MyProfileState = {
  userId: string | null;
  profile: Profile | null;
  loading: boolean;
};

let state: MyProfileState = { userId: null, profile: null, loading: false };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/**
 * Carga (o recarga con `force`) el perfil del usuario y avisa a los suscriptores.
 * El editor la llama con `force` tras guardar, para que la foto nueva llegue al
 * instante a la barra y a Perfil.
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
  state = { userId, profile: state.profile, loading: true };
  notify();
  try {
    state = { userId, profile: await getProfile(userId), loading: false };
  } catch {
    // Sin red o sin fila todavía: Perfil enseña "Completar perfil" y la barra,
    // su icono de siempre. No es un error que interrumpa nada.
    state = { userId, profile: null, loading: false };
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
