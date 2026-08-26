import { supabase } from '../supabase';

// Última versión publicada en la tienda, para el aviso de actualización del
// arranque (app/App.tsx). La app se distribuye por Google Play con expo-updates
// deshabilitado, así que no hay forma de enterarse desde el propio dispositivo:
// la versión disponible se publica a mano en una fila de `app_releases`
// (supabase/schema.sql) al cerrar cada versión.
//
// La comparación de versiones y el enlace a Play viven en lib/appUpdate.ts
// (puro y con tests); aquí solo está la consulta.

export interface AppRelease {
  /** Versión publicada, en el mismo formato que `app.json` → `expo.version`. */
  version: string;
  /** Enlace propio a la ficha de la tienda; si es null se construye desde el
   *  nombre de paquete (ver `playStoreUrls`). */
  storeUrl: string | null;
}

/**
 * Lee la versión publicada para una plataforma. Devuelve null ante cualquier
 * problema (sin red, tabla aún no creada, fila ausente, dato corrupto): un
 * chequeo de actualización no puede estropear el arranque ni llenar la consola,
 * simplemente no se avisa.
 */
export async function fetchLatestRelease(
  platform = 'android'
): Promise<AppRelease | null> {
  try {
    const { data, error } = await supabase
      .from('app_releases')
      .select('version, store_url')
      .eq('platform', platform)
      .maybeSingle();

    if (error || !data) return null;

    const version = typeof data.version === 'string' ? data.version.trim() : '';
    if (!version) return null;

    const storeUrl =
      typeof data.store_url === 'string' && data.store_url.trim()
        ? data.store_url.trim()
        : null;

    return { version, storeUrl };
  } catch {
    return null;
  }
}
