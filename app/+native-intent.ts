// Reescribe los deep links entrantes ANTES de que expo-router intente enrutarlos
// por fichero. El enlace de importación de rutina
// (gymtrack://import-routine?data=...) no es una ruta de fichero: si lo dejamos
// pasar, expo-router muestra "Unmatched Route". Lo redirigimos a la raíz (index)
// para mantener montada la app; el listener de Linking en App.tsx recibe la URL
// original (Linking.getInitialURL / evento 'url') y procesa los datos.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (path.includes('import-routine')) {
      return '/';
    }
  } catch {
    return '/';
  }
  return path;
}
