import AsyncStorage from '@react-native-async-storage/async-storage';
import { storedSessionUserId } from './cloud/storedSession';

/**
 * Copia en disco de lo último que trajo cada pantalla social (listas de seguir,
 * perfil ajeno, tablón), para que al abrir la app no haya que esperar a la red
 * para ver algo. Las cachés de esas pantallas viven en variables de módulo, así
 * que se perdían al cerrar la app y cada arranque volvía a cargarlo todo.
 *
 * Mismo planteamiento que la copia del perfil propio (hooks/useMyProfile.ts):
 * se pinta mientras baja lo de verdad y es lo que queda si no hay red. Nunca es
 * la fuente de verdad —el refresco por detrás manda— así que un fallo al leer o
 * al escribir no es un error: se trata como "no hay copia".
 *
 * Lo que se guarda es contenido PÚBLICO ya visto (nombres, fotos y rutinas
 * públicas), no historiales de entrenos.
 */

const PREFIX = 'gymbro_social_';

/**
 * Las copias caducan: pintar de entrada algo de hace semanas sería peor que
 * esperar un segundo, sobre todo en datos que cambian solos (seguidores, likes).
 * Pasado el plazo se ignora y la pantalla carga como la primera vez.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ── De quién son las copias ─────────────────────────────────────────────────
// Lo que trae una pantalla social depende de quién mira: a quién sigue, qué le
// ha gustado, su feed. Cada copia (en disco y en memoria) es de la cuenta que
// la cargó, y la cuenta nueva no debe ver la de la anterior ni un instante.
// Borrarlas al cerrar sesión (`clearSocialCache`) no basta: va por detrás del
// cambio de sesión, y las copias en memoria de las pantallas no las tocaba.
//
// `undefined` = la sesión aún no se ha resuelto; `null` = sin cuenta. Lo fija
// la sesión (lib/cloud/auth.ts) ANTES de avisar a las pantallas del cambio, así
// que cuando estas repintan ya está vacío.
//
// Mientras no hay cuenta resuelta (`undefined` o `null`) se leen las copias de
// la cuenta cuya sesión sigue GUARDADA: al arrancar con el token caducado,
// supabase-js no resuelve la sesión hasta renovarlo por red, y sin red la da
// por null aunque siga guardada. Justo ahí (en el gimnasio sin cobertura) es
// cuando más falta hacen las copias. Una salida de verdad borra esa sesión.

let owner: string | null | undefined = undefined;
// Cuenta guardada de la que se han leído copias sin cuenta resuelta.
let provisional: string | null = null;
const memoryCaches = new Set<() => void>();

/**
 * Registra el vaciado de una copia en memoria (variable de módulo de una
 * pantalla). Se llama al cambiar de cuenta.
 */
export function registerSocialMemoryCache(clear: () => void): void {
  memoryCaches.add(clear);
}

/** La sesión cambia de cuenta (o se resuelve): vacía las copias en memoria. */
export function setSocialCacheOwner(userId: string | null): void {
  if (userId === owner) return;
  const previous = owner;
  owner = userId;
  // Al resolverse el arranque, en memoria solo hay copias de la cuenta guardada
  // (las cargas no guardan nada sin cuenta resuelta): si es esa, o se queda sin
  // resolver por falta de red (null), siguen valiendo y se evita el parpadeo.
  if (previous === undefined && (userId === null || userId === provisional)) {
    return;
  }
  memoryCaches.forEach((clear) => clear());
}

/**
 * ¿Sigue mirando la cuenta para la que se cargó esto? Una carga que termina
 * después de cambiar de cuenta no debe guardar nada: era de la anterior.
 */
export function isSocialCacheOwner(viewerId: string | null): boolean {
  return owner !== undefined && owner === viewerId;
}

interface Envelope<T> {
  savedAt: number;
  // Cuenta que la guardó (null = sin cuenta). Las copias de versiones sin este
  // campo se ignoran: no se sabe de quién son.
  owner?: string | null;
  value: T;
}

/**
 * Lee una copia; `null` si no hay, no se puede leer, ya caducó o es de otra
 * cuenta. Sin cuenta resuelta, vale la de la sesión guardada (ver arriba).
 */
export async function readSocialCache<T>(key: string): Promise<T | null> {
  try {
    const reader = owner;
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (
      !parsed ||
      typeof parsed.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > MAX_AGE_MS ||
      typeof parsed.owner === 'undefined'
    ) {
      return null;
    }
    if (parsed.owner !== reader) {
      if (reader) return null;
      const stored = await storedSessionUserId();
      if (!stored || parsed.owner !== stored) return null;
      provisional = stored;
    }
    // Cambio de cuenta mientras se leía.
    if (owner !== reader) return null;
    return parsed.value;
  } catch {
    // Copia ilegible, de otra versión o storage no disponible: como si no hubiera.
    return null;
  }
}

/**
 * Guarda una copia de lo cargado para `viewerId` (la cuenta que miraba al
 * pedirlo). Si ya no es la cuenta abierta, no guarda nada. Sin `await`: no
 * debe retrasar el pintado.
 */
export function writeSocialCache<T>(
  key: string,
  value: T,
  viewerId: string | null
): void {
  if (!isSocialCacheOwner(viewerId)) return;
  const envelope: Envelope<T> = { savedAt: Date.now(), owner: viewerId, value };
  void AsyncStorage.setItem(PREFIX + key, JSON.stringify(envelope)).catch(
    () => {}
  );
}

/**
 * Borra todas las copias. Se llama al cerrar sesión: lo guardado es lo que vio
 * esa cuenta (a quién sigue, qué perfiles visitó), y no tiene por qué seguir en
 * el dispositivo cuando se sale.
 */
export async function clearSocialCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((key) => key.startsWith(PREFIX));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch {
    // Sin storage no hay nada que borrar.
  }
}
