import { useSyncExternalStore } from 'react';
import { AppState, unstable_batchedUpdates } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { setSocialCacheOwner } from '../socialCache';
import { t } from '../i18n';
import { hasStoredSession, readStoredSession } from './storedSession';

export { hasStoredSession } from './storedSession';

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

// `restoring`: la sesión guardada en el móvil, con el token caducado y
// esperando a la red para renovarlo (ver `onAuthChange`).
type SessionState = {
  session: Session | null;
  loading: boolean;
  restoring: boolean;
};

let current: SessionState = { session: null, loading: true, restoring: false };
const listeners = new Set<() => void>();
let started = false;

// QUIÉN hay, no con qué token. Refrescar el token (TOKEN_REFRESHED: cada hora, y
// al arrancar si ha caducado) no cambia nada de lo que pinta la UI, así que no
// la repinta. Nadie lee los tokens de este objeto: el cliente usa los suyos.
const identity = (session: Session | null): string =>
  session ? JSON.stringify(session.user) : '';

function apply(session: Session | null, restoring: boolean): void {
  if (
    !current.loading &&
    restoring === current.restoring &&
    identity(session) === identity(current.session)
  ) {
    return;
  }
  current = { session, loading: false, restoring };
  // Antes de avisar: las copias sociales de otra cuenta se vacían aquí, y así
  // ninguna pantalla repinta con lo de la anterior (ver lib/socialCache.ts).
  setSocialCacheOwner(session?.user.id ?? null);
  // Un solo pase de render para todos los suscriptores (ver arriba).
  unstable_batchedUpdates(() => {
    for (const listener of Array.from(listeners)) listener();
  });
}

// Orden de los avisos: el de una sesión null se resuelve tras leer el disco, y
// si entretanto llega otro, manda el último.
let changeSeq = 0;

/**
 * Sin sesión no siempre es sin cuenta. Al arrancar con el token caducado sin
 * poder renovarlo (sin red, el servidor de Auth fallando o un portal cautivo:
 * todo lo que supabase-js cuenta como reintentable), da la sesión por null
 * aunque la conserve guardada, y la app se pintaba como si no hubiera cuenta.
 * Entonces se usa la guardada, como si hubiera sesión y no hubiera red, que la
 * app ya sabe llevar: lo que se pida a la nube falla (lib/supabase.ts corta lo
 * que saldría como anónimo) y se reintenta, y las copias del móvil siguen
 * valiendo. supabase-js reintenta solo (su ticker va cada 30 s, pero tras un
 * fallo espera un minuto), y al conseguirlo avisa con la sesión buena: suele
 * tardar uno o dos minutos desde que vuelve la red. Si el servidor la rechaza
 * (revocada, cuenta borrada), la borra él mismo y entonces sí queda sin
 * cuenta. Una salida de verdad siempre borra la guardada antes de avisar.
 */
function onAuthChange(next: Session | null): void {
  const seq = ++changeSeq;
  if (next) {
    apply(next, false);
    return;
  }
  void readStoredSession().then((stored) => {
    if (seq === changeSeq) apply(stored, !!stored);
  });
}

function start(): void {
  if (started) return;
  started = true;
  // INITIAL_SESSION trae la sesión guardada (o null) en cuanto el cliente se
  // inicializa, así que basta con suscribirse: no hace falta `getSession()`.
  supabase.auth.onAuthStateChange((_event, next) => onAuthChange(next));
  // Esperando a la red, al volver a la app se intenta renovar ya, sin esperar
  // al ticker de supabase-js (si falló hace menos de un minuto no lo intenta
  // aún). Si lo consigue, avisa él.
  AppState.addEventListener('change', (state) => {
    if (state === 'active' && current.restoring) {
      void supabase.auth.getSession().catch(() => {});
    }
  });
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
  /** La sesión es la guardada y espera a la red para renovarse. */
  restoring: boolean;
} {
  const { session, loading, restoring } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );
  return { session, user: session?.user ?? null, loading, restoring };
}

export function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email: email.trim(), password });
}

export function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email: email.trim(), password });
}

/**
 * Cierra la sesión en todos los dispositivos y, pase lo que pase, en este.
 *
 * supabase-js no siempre la borra del móvil: sin red y con el token caducado
 * intenta renovarlo antes de nada, falla y devuelve el error sin tocar la
 * sesión guardada (`scope: 'local'` pasa por el mismo sitio). Quien pulsa
 * "Cerrar sesión" da por hecho que ha salido, así que entonces se borra a mano.
 * En ese caso solo sale ESTE móvil: no se ha podido avisar al servidor, y los
 * demás dispositivos siguen dentro hasta que se cierre desde ellos.
 *
 * Lanza solo si no ha podido salir ni de este móvil.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (!error) return;
  if (!(await hasStoredSession())) return;
  // `_removeSession` es privado en los tipos, pero es lo mismo que hace
  // `signOut` cuando funciona: borra la sesión guardada y avisa SIGNED_OUT a los
  // suscriptores (`useSession` y la limpieza de `useForgetSignedOutAccount`).
  // Un test comprueba que el cliente instalado lo sigue teniendo.
  const auth = supabase.auth as unknown as {
    _removeSession?: () => Promise<void>;
  };
  if (typeof auth._removeSession !== 'function') throw error;
  await auth._removeSession();
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

/**
 * ¿Es esta la contraseña de la cuenta? Para confirmar lo delicado (cambiarla,
 * borrar la cuenta) con el móvil desbloqueado en otras manos. Comprueba
 * iniciando sesión otra vez: si acierta renueva la sesión, con el mismo usuario.
 */
export async function verifyCurrentPassword(
  email: string,
  password: string
): Promise<boolean> {
  const { error } = await signIn(email, password);
  if (!error) return true;
  if (error.code === 'invalid_credentials') return false;
  throw error;
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
 * Pide borrar la cuenta: no borra nada aún. La marca (con la hora del servidor)
 * y la oculta; pasados `ACCOUNT_DELETION_GRACE_DAYS` días la borra de verdad la
 * Edge Function `purge-deleted-accounts`, y hasta entonces se recupera
 * iniciando sesión (`AccountDeletionPrompt`). Diseño en
 * supabase/social-schema.sql, sección "Borrado de cuenta".
 *
 * Cierra la sesión en todos los dispositivos: la cuenta deja de usarse ya. Lo
 * que hay en el móvil (rutinas, entrenos) no se toca: la app funciona sin
 * cuenta, y eso lo borra "Borrar todos los datos" si se quiere.
 */
export async function requestAccountDeletion(): Promise<void> {
  const { data, error } = await supabase.rpc('request_account_deletion');
  if (error) throw error;
  // Sin perfil no hay nada que marcar: la purga nunca encontraría la cuenta.
  if (!data) throw new Error('profile_not_found');
  await signOut();
}

/** Recupera la cuenta. false: el plazo ya ha terminado y no se puede. */
export async function cancelAccountDeletion(): Promise<boolean> {
  const { data, error } = await supabase.rpc('cancel_account_deletion');
  if (error) throw error;
  return !!data;
}

/**
 * Cuándo se pidió borrar esta cuenta, o null si no. Aparte de `getProfile` a
 * propósito: si la columna aún no existe en la nube o falla la red, no debe
 * tumbar la carga del perfil; simplemente no se avisa.
 */
export async function getAccountDeletionRequest(
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('deletion_requested_at')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { deletion_requested_at: string | null })
    .deletion_requested_at;
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

/**
 * Texto para enseñar un error de Auth. Sin traducción conocida usa `fallback`
 * o, si no se pasa, el mensaje original.
 */
export function authErrorMessage(error: unknown, fallback?: string): string {
  const { code, name } = (error ?? {}) as { code?: unknown; name?: unknown };
  const key = typeof code === 'string' ? AUTH_ERROR_KEYS[code] : undefined;
  if (key) return t(key);
  if (name === 'AuthRetryableFetchError') {
    return t('Sin conexión. Compruébala e inténtalo de nuevo.');
  }
  if (fallback) return fallback;
  return error instanceof Error ? error.message : String(error);
}
