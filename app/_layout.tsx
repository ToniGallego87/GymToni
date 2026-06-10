import { Slot } from 'expo-router';

// Layout raíz mínimo: renderiza la ruta sin Stack/header ni safe-area wrapper, para
// que el contenido se dibuje edge-to-edge (la barra glass cubre el status bar).
export default function RootLayout() {
  return <Slot />;
}
