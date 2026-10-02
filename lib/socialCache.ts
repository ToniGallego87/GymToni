import AsyncStorage from '@react-native-async-storage/async-storage';

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

interface Envelope<T> {
  savedAt: number;
  value: T;
}

/** Lee una copia; `null` si no hay, no se puede leer o ya caducó. */
export async function readSocialCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (
      !parsed ||
      typeof parsed.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > MAX_AGE_MS
    ) {
      return null;
    }
    return parsed.value;
  } catch {
    // Copia ilegible, de otra versión o storage no disponible: como si no hubiera.
    return null;
  }
}

/** Guarda una copia. Sin `await`: no debe retrasar el pintado. */
export function writeSocialCache<T>(key: string, value: T): void {
  const envelope: Envelope<T> = { savedAt: Date.now(), value };
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
