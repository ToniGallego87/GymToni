// Reescribe los deep links entrantes ANTES de que expo-router intente enrutarlos
// por fichero. Ninguno de los enlaces de la app es una ruta de fichero
// (gymbro://import-routine?data=..., gymbro://public-routine?id=..., y los que
// vengan): si se dejan pasar, expo-router muestra "Unmatched Route". La única
// ruta es la raíz (index), que monta la app; el listener de Linking en App.tsx
// recibe la URL original (Linking.getInitialURL / evento 'url') y la procesa.
export function redirectSystemPath(_: {
  path: string;
  initial: boolean;
}): string {
  return '/';
}
