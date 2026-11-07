import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { SUPABASE_URL } from '../supabaseConfig';

// La sesión tal como la guarda supabase-js en el móvil. Aparte de lib/cloud/auth
// para que la lean también las copias sociales (lib/socialCache.ts) sin un
// import circular: la sesión les dice de quién son.

// Clave con la que supabase-js guarda la sesión (su valor por defecto).
const SESSION_STORAGE_KEY = `sb-${
  SUPABASE_URL.replace('https://', '').split('.')[0]
}-auth-token`;

/**
 * ¿Sigue la sesión guardada en el móvil? Distingue "no hay sesión" de "aún no se
 * ha podido recuperar": al arrancar sin red con el token caducado, supabase-js
 * da una sesión null pero conserva la guardada, y volverá en cuanto haya red.
 * Una salida de verdad siempre borra esta clave antes de avisar.
 */
export async function hasStoredSession(): Promise<boolean> {
  return (await AsyncStorage.getItem(SESSION_STORAGE_KEY)) !== null;
}

/**
 * La sesión guardada tal cual (sin `userStorage`, el usuario va dentro), o null
 * si no hay o no se entiende. No dice si sigue valiendo: su token puede haber
 * caducado y estar esperando a renovarse.
 */
export async function readStoredSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session | null;
    return typeof session?.user?.id === 'string' ? session : null;
  } catch {
    return null;
  }
}

/** Cuenta de la sesión guardada, o null. Solo de quién es (ver arriba). */
export async function storedSessionUserId(): Promise<string | null> {
  return (await readStoredSession())?.user.id ?? null;
}
