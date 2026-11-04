import { useSyncExternalStore } from 'react';
import { unstable_batchedUpdates } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { t } from '../i18n';

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

// Recuperar la contraseña, con el MISMO patrón de código de 6 dígitos que el
// registro: la plantilla "Reset Password" de Supabase envía {{ .Token }} en vez
// del enlace (que además abriría el navegador, no la app). El primer aviso es
// igual exista o no la cuenta; ojo, el límite de reenvío por usuario sí puede
// delatarla (como ya hace el registro): eso solo lo cierra un captcha.
export function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email.trim());
}

// El código de recuperación abre sesión; con ella ya se puede fijar la nueva.
export function verifyRecoveryCode(email: string, code: string) {
  return supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'recovery',
  });
}

export function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}

// Tras cambiar la contraseña se cierran las DEMÁS sesiones de la cuenta (no la
// de este móvil): si se cambia porque alguien entró, que no siga dentro.
// `signOut()` a secas es `global` y echaría también a este dispositivo.
export function signOutOtherDevices() {
  return supabase.auth.signOut({ scope: 'others' });
}

/**
 * Borra la cuenta y TODO lo suyo en la nube (Edge Function `delete-account`,
 * supabase/functions/: es la única con `service_role`). Después cierra la
 * sesión solo en este móvil: el usuario ya no existe, así que la de los demás
 * dispositivos caduca sola, y `signOut` global fallaría.
 *
 * Lo que hay en el móvil (rutinas, entrenos) no se toca: la app funciona sin
 * cuenta, y eso lo borra "Borrar todos los datos" si se quiere.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
}

// Errores de Supabase Auth que el usuario ve a menudo, traducidos por su
// código estable. El mensaje de Supabase va en inglés y quien lo lee, en el
// login o recuperando la contraseña, suele estar ya atascado. Si el código no
// está aquí, se enseña el mensaje original.
const AUTH_ERROR_KEYS: Record<string, string> = {
  over_email_send_rate_limit:
    'Hemos enviado demasiados correos. Espera un poco y vuelve a intentarlo.',
  over_request_rate_limit:
    'Demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.',
  otp_expired: 'El código ha caducado o no es correcto. Pide otro.',
  same_password: 'La contraseña nueva tiene que ser distinta de la anterior.',
  weak_password:
    'Esa contraseña es demasiado débil. Prueba con otra más larga.',
  validation_failed: 'Revisa el email: no parece válido.',
  email_address_invalid: 'Revisa el email: no parece válido.',
  invalid_credentials: 'Email o contraseña incorrectos.',
  email_not_confirmed: 'Confirma la cuenta con el código que te enviamos.',
  user_already_exists: 'Ese email ya tiene cuenta. Inicia sesión.',
};

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  const key = typeof code === 'string' ? AUTH_ERROR_KEYS[code] : undefined;
  if (key) return t(key);
  return error instanceof Error ? error.message : String(error);
}
