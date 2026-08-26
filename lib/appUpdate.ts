// Comparación de versiones de la app y enlaces a su ficha de Google Play.
//
// Módulo PURO a propósito (sin react-native, sin supabase): así se puede probar
// en jest (entorno node) y lo usan tanto el aviso de actualización del arranque
// (app/App.tsx) como quien resuelva el enlace a la tienda. La consulta de red
// vive aparte, en lib/cloud/release.ts.

/**
 * Trocea "0.7.2" en [0, 7, 2]. Tolera sufijos ("0.7.2-beta" → [0, 7, 2]) y
 * devuelve null si la cadena no es una versión reconocible: ante la duda no se
 * avisa de nada (ver `isNewerVersion`).
 */
export function parseVersion(version: string): number[] | null {
  const core = (version ?? '').trim().split(/[-+]/)[0];
  // Solo números separados por puntos: cualquier otra cosa ("v0.7.2", "0.7.x",
  // "0..2", "próximamente") no es una versión y se rechaza entera.
  if (!/^\d+(\.\d+)*$/.test(core)) return null;
  return core.split('.').map((part) => Number(part));
}

/**
 * true si `latest` (la publicada en la tienda) es posterior a `current` (la
 * instalada). Compara número a número, no como texto: "0.10.0" es mayor que
 * "0.9.0" aunque alfabéticamente sea al revés. Las partes que falten cuentan
 * como 0, así que "0.8" y "0.8.0" son la misma versión.
 *
 * Si alguna de las dos no se puede interpretar devuelve false: el aviso de
 * actualización nunca debe dispararse por un dato corrupto en la nube.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(latest);
  if (!a || !b) return false;

  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const currentPart = a[i] ?? 0;
    const latestPart = b[i] ?? 0;
    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }
  return false;
}

/**
 * Los dos enlaces a la ficha de la app en Google Play: `app` abre la app de
 * Play directamente (esquema market://) y `web` es el respaldo por navegador
 * para los dispositivos sin Play instalado.
 */
export function playStoreUrls(packageName: string): {
  app: string;
  web: string;
} {
  const id = encodeURIComponent(packageName);
  return {
    app: `market://details?id=${id}`,
    web: `https://play.google.com/store/apps/details?id=${id}`,
  };
}
