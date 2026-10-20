import React, { ReactNode, useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import {
  EdgeInsets,
  Rect,
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

// Por debajo de esta fracción del ancho de la pantalla, la ventana no es la app
// a pantalla completa: es la ventanita flotante del descanso (PiP, 16:9 y muy
// estrecha). La app va bloqueada en vertical y el teclado solo cambia el alto,
// así que nada más estrecha la ventana.
const NARROW_RATIO = 0.9;

/**
 * Mientras la app está encogida en la ventanita del descanso, lo de debajo
 * conserva el tamaño y los márgenes de pantalla completa que tenía.
 *
 * El árbol sigue montado bajo la cuenta atrás (`PipRestTimer` lo tapa) y, sin
 * esto, React lo volvía a maquetar al tamaño de la ventanita: la ruleta del
 * registro medía otro ancho, la barra superior otro alto… Al volver a la app
 * cada pieza recuperaba su sitio en dos pasadas (primero con las medidas de la
 * ventanita, luego con las buenas) y se veía todo recolocarse. Congelado, no hay
 * nada que recolocar: la vuelta es la misma pantalla que se dejó.
 *
 * Se decide por el ancho que da el propio `SafeAreaProvider` (marco y márgenes
 * llegan juntos en el mismo aviso), no por el evento de entrada/salida del PiP,
 * que puede llegar antes o después del cambio de tamaño.
 */
export function FullSizeLayoutLock({ children }: { children: ReactNode }) {
  const frame = useSafeAreaFrame();
  const insets = useSafeAreaInsets();
  const narrow = frame.width < Dimensions.get('screen').width * NARROW_RATIO;
  // Último marco a tamaño completo (con el teclado abierto también lo es: el
  // alto cambia y se respeta).
  const fullRef = useRef<{ frame: Rect; insets: EdgeInsets } | null>(null);
  if (!narrow) fullRef.current = { frame, insets };
  const locked = narrow ? fullRef.current : null;

  // La forma del árbol es SIEMPRE la misma (proveedores + vista): cambiarla al
  // entrar en la ventanita volvería a montar la app entera.
  return (
    <SafeAreaFrameContext.Provider value={locked?.frame ?? frame}>
      <SafeAreaInsetsContext.Provider value={locked?.insets ?? insets}>
        <View
          style={
            locked
              ? { width: locked.frame.width, height: locked.frame.height }
              : styles.fill
          }
        >
          {children}
        </View>
      </SafeAreaInsetsContext.Provider>
    </SafeAreaFrameContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
