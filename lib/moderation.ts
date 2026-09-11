import AsyncStorage from '@react-native-async-storage/async-storage';

// Contenido que TÚ has reportado y no quieres volver a ver: rutinas públicas,
// perfiles y comentarios. Vive en el dispositivo (AsyncStorage), no en la nube:
// el parte de moderación lo revisa una persona más tarde, pero quitarse de
// delante lo que te ha molestado tiene que ser inmediato.
//
// Es una lista de ids sin más (los ids de rutina y de comentario no chocan entre
// sí: unos son ids de rutina y otros uuid de comentario).

const KEY = 'gymbro_hidden_content';

// Copia en memoria para no leer del disco en cada pintado. Se llena en la
// primera carga y se mantiene al ocultar.
let cached: Set<string> | null = null;

/** Ids ocultos. La primera llamada lee del disco; las siguientes, de memoria. */
export async function loadHiddenIds(): Promise<Set<string>> {
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cached = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    // Storage no disponible o copia ilegible: se empieza sin nada oculto.
    cached = new Set<string>();
  }
  return cached;
}

/** Oculta un id en este dispositivo y devuelve la lista actualizada. */
export async function hideId(id: string): Promise<Set<string>> {
  const set = await loadHiddenIds();
  set.add(id);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Si no se puede persistir, al menos queda oculto en esta sesión.
  }
  return new Set(set);
}
