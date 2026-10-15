import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Copia exacta del splash nativo (android/app/src/main/res/drawable/
// splashscreen.xml): el mismo fondo (`splashscreen_background` en colors.xml y
// `splash.backgroundColor` en app.json) y el mismo titular centrado. Se usan los
// valores literales y no el tema a propósito: tiene que coincidir píxel a píxel
// con el nativo, sea cual sea el tema de la app.
const SPLASH_BACKGROUND = '#000000';
// El logo nativo vive en drawable-xxhdpi (densidad 3x): 757 x 158 px se pintan a
// un tercio en dp.
const LOGO_WIDTH = 757 / 3;
const LOGO_HEIGHT = 158 / 3;
// Suave al arrancar y al acabar: con una curva que arranca rápida, el primer
// fotograma ya descubría media app y se leía como un parpadeo.
const FADE_MS = 520;

/**
 * Salida suave del splash. El nativo se retiraba de golpe sobre la app (y en el
 * hueco asomaba el fondo blanco de la ventana): ahora, bajo él, se pinta esta
 * copia idéntica desde el primer render; al estar la app lista se retira el
 * nativo —el cambio no se ve— y la copia se desvanece descubriendo la app.
 */
export function SplashFade({
  ready,
  onLogoShown,
}: {
  ready: boolean;
  /** El logo ya está pintado: a partir de aquí se puede dibujar la app debajo. */
  onLogoShown: () => void;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [done, setDone] = useState(false);
  // Sin el logo pintado la copia es transparente (deja ver el splash de la
  // ventana, idéntico): su fondo negro sin logo era un parpadeo.
  const [logoShown, setLogoShown] = useState(false);
  const showLogo = () => {
    if (logoShown) return;
    setLogoShown(true);
    onLogoShown();
  };

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start(() => setDone(true));
      });
    return () => {
      cancelled = true;
    };
  }, [ready, opacity]);

  if (done) return null;
  return (
    <Animated.View
      pointerEvents={ready ? 'none' : 'auto'}
      style={[styles.overlay, logoShown && styles.opaque, { opacity }]}
    >
      <Image
        source={require('../assets/title.png')}
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
  opaque: {
    backgroundColor: SPLASH_BACKGROUND,
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
});
