import { useSyncExternalStore } from 'react';
import { unstable_batchedUpdates } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

// Sesión de Supabase reactiva, en un store de módulo con UNA sola suscripción al
// cliente (mismo patrón que `themeStore`). Persiste en AsyncStorage (ver
// lib/supabase.ts), así que el login sobrevive a reinicios. `loading` es true
// hasta la primera resolución para no parpadear la UI de cuenta.
//
// Antes cada `useSession()` hacía su propio `getSession()` y su propio
// `onAuthStateChange`, y hay más de veinte montados a la vez (la barra superior
// de cada pestaña, entre otros). Cada uno leía y parseaba la sesión de
// AsyncStorage dos veces y, como cada lectura da un objeto nuevo, repintaba su
// pantalla dos o tres veces. Con la arquitectura antigua los `setState` que
// llegan desde una promesa no se agrupan: los primeros segundos eran una ristra
// de repintados sueltos, la raíz de la app incluida.

type SessionState = { session: Session | null; loading: boolean };

let current: SessionState = { session: null, loading: true };
const listeners = new Set<() => void>();
let started = false;

// QUIÉN hay, no con qué token. Refrescar el token (TOKEN_REFRESHED: cada hora, y
// al arrancar si ha caducado) no cambia nada de lo que pinta la UI, así que no
// la repinta. Nadie lee los tokens de este objeto: el cliente usa los suyos.
const identity = (session: Session | null): string =>
  session ? JSON.stringify(session.user) : '';

function apply(session: Session | null): void {
  if (!current.loading && identity(session) === identity(current.session)) {
    return;
  }
  current = { session, loading: false };
  // Un solo pase de render para todos los suscriptores (ver arriba).
  unstable_batchedUpdates(() => {
    for (const listener of Array.from(listeners)) listener();
  });
}

function start(): void {
  if (started) return;
  started = true;
  // INITIAL_SESSION trae la sesión guardada (o null) en cuanto el cliente se
  // inicializa, así que basta con suscribirse: no hace falta `getSession()`.
  supabase.auth.onAuthStateChange((_event, next) => apply(next));
}

/**
 * Empieza a escuchar la sesión sin esperar a que la pida una pantalla. La raíz
 * lo llama al empezar a hidratar: cargar supabase-js y leer la sesión guardada
 * ocurre así bajo el splash, a la vez que la lectura de SQLite, y la primera
 * pantalla nace sabiendo quién hay en vez de repintarse al saberlo.
 */
export function startSession(): void {
  start();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): SessionState => current;

export function useSession(): {
  session: Session | null;
  user: User | null;
  loading: boolean;
} {
  const { session, loading } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );
  return { session, user: session?.user ?? null, loading };
}

export function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email: email.trim(), password });
}

export function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email: email.trim(), password });
}

export function signOut() {
  return supabase.auth.signOut();
}

// Confirmación de registro por código de 6 dígitos (la plantilla "Confirm
// signup" de Supabase envía {{ .Token }} en vez de un enlace). Un enlace de un
// solo uso lo "quemaban" los escáneres de correo corporativos antes de que el
// usuario lo pulsara; el código no tiene ese problema y no sale de la app.
export function verifySignUpCode(email: string, code: string) {
  return supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'signup',
  });
}

export function resendSignUpCode(email: string) {
  return supabase.auth.resend({ type: 'signup', email: email.trim() });
}
