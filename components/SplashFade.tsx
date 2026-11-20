import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet } from 'react-native';
import { theme } from '@lib/theme';

// Copia exacta del splash nativo (android/app/src/main/res/drawable/
// splashscreen.xml, o splashscreen_light.xml si la app arranca en modo claro):
// el mismo fondo (`splashscreen_background[_light]` en colors.xml) y el mismo
// titular centrado. Se usan los valores literales y no los colores del tema a
// propósito: tiene que coincidir píxel a píxel con el nativo. El modo es el
// inicial del tema, el mismo que lee MainActivity de la base de ajustes.
const SPLASH_BACKGROUND = { dark: '#000000', light: '#FFFFFF' } as const;
const SPLASH_LOGO = {
  dark: require('../assets/title.png'),
  light: require('../assets/title-day.png'),
} as const;
// El logo nativo vive en drawable-xxhdpi (densidad 3x): 757 x 158 px se pintan a
// un tercio en dp.
const LOGO_WIDTH = 757 / 3;
const LOGO_HEIGHT = 158 / 3;
// Suave al arrancar y al acabar: con una curva que arranca rápida, el primer
// fotograma ya descubría media app y se leía como un parpadeo.
const FADE_MS = 520;

/**
 * Salida suave del splash. El splash del sistema ya se ha soltado al arrancar
 * (MainActivity) y lo que se ve es el de la ventana (windowBackground): encima
 * se pinta esta copia idéntica —el cambio no se ve— que tapa la app mientras
 * hidrata y, al estar lista, se desvanece descubriéndola.
 */
export function SplashFade({
  ready,
  onLogoShown,
}: {
  ready: boolean;
  /** El logo ya está pintado: a partir de aquí se puede dibujar la app debajo. */
  onLogoShown: () => void;
}) {
  // El modo con el que arrancó la app (fijo: el splash no cambia a medias).
  const [mode] = useState(() => theme.mode);
  const opacity = useRef(new Animated.Value(1)).current;
  const [done, setDone] = useState(false);
  // Sin el logo pintado la copia es transparente (deja ver el splash de la
  // ventana, idéntico): su fondo sin logo era un parpadeo.
  const [logoShown, setLogoShown] = useState(false);
  const showLogo = () => {
    if (logoShown) return;
    setLogoShown(true);
    onLogoShown();
  };

  useEffect(() => {
    if (!ready) return;
    const fade = Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    fade.start(({ finished }) => {
      if (finished) setDone(true);
    });
    return () => fade.stop();
  }, [ready, opacity]);

  if (done) return null;
  return (
    <Animated.View
      pointerEvents={ready ? 'none' : 'auto'}
      style={[
        styles.overlay,
        logoShown && { backgroundColor: SPLASH_BACKGROUND[mode] },
        { opacity },
      ]}
    >
      <Image
        source={SPLASH_LOGO[mode]}
        style={styles.logo}
        resizeMode="contain"
        fadeDuration={0}
        onLoad={showLogo}
        // Sin logo, mejor el fondo a secas que quedarse sin app.
        onError={showLogo}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
});
