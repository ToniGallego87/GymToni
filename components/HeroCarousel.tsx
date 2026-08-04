import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';

// Sombreado del "escalón" (`theme.gradients.heroStep`): tinta oscura translúcida
// más intensa en el borde exterior de la tarjeta y desvanecida a nada hacia el
// centro, para que el botón parezca un peldaño hundido en el lateral del dorado
// en vez de una pastilla flotante. Terminar en alpha 0 (y no en 0.04) es lo que
// borra el canto: el tramo plano inicial mantiene el cuerpo oscuro y el resto
// difumina la transición al dorado, en vez de cortarla en seco.
const STEP_SHADE_STOPS = [0, 0.35, 0.72, 1];

// Ancho del peldaño lateral.
export const HERO_ARROW_WIDTH = 34;

// Cuánto tiene que apartar de cada lado una tarjeta su contenido ancho (filas de
// datos, gráficas) para que no quede bajo las flechas: lo que el peldaño invade
// por dentro del padding horizontal de la tarjeta (20), más un poco de aire.
export const HERO_ARROW_INSET = HERO_ARROW_WIDTH - 20 + 4;

interface HeroCarouselProps {
  /** Cada estado de la hero card. Se muestra uno cada vez. */
  slides: React.ReactElement[];
  /** Color de flechas y puntos (por defecto oscuro, para gradientes dorados). */
  controlColor?: string;
}

// Punto indicador que anima (ancho + opacidad) al pasar a activo/inactivo.
function Dot({ active, color }: { active: boolean; color: string }) {
  const width = useSharedValue(active ? 18 : 6);
  const opacity = useSharedValue(active ? 0.95 : 0.4);
  useEffect(() => {
    width.value = withTiming(active ? 18 : 6, { duration: 240 });
    opacity.value = withTiming(active ? 0.95 : 0.4, { duration: 240 });
  }, [active]);
  const style = useAnimatedStyle(() => ({
    width: width.value,
    opacity: opacity.value,
  }));
  return (
    <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />
  );
}

/**
 * Envoltorio de la hero card que alterna entre varios "estados" (slides) con
 * flechas a izquierda/derecha. El FRAME de la tarjeta no se mueve: al cambiar
 * de estado solo el contenido (icono + texto) entra deslizándose desde el lado
 * de avance con un fundido (lo anima cada tarjeta según la prop `enterFrom`).
 * Los puntos indicadores animan su cambio. La navegación es cíclica.
 *
 * La escala de pulsación la lleva este envoltorio, no la tarjeta: flechas y
 * puntos son hermanos de la tarjeta y, si se escalara ella sola, se quedarían
 * quietos mientras el dorado encoge. Las tarjetas pulsables reciben el
 * `pressScale` y lo animan en vez de aplicarse su propia escala.
 */
export function HeroCarousel({ slides, controlColor }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const count = slides.length;

  if (count === 0) return null;
  if (count === 1) return <View>{slides[0]}</View>;

  const safeIndex = Math.min(index, count - 1);
  const color = controlColor ?? theme.colors.onGold;

  const go = (delta: 1 | -1) => {
    setDir(delta);
    setIndex((i) => (i + delta + count) % count);
  };

  // El contenido entra desde la derecha al avanzar y desde la izquierda al
  // retroceder. Se inyecta en la tarjeta activa; como cada estado es un
  // elemento distinto, React lo remonta y replica la animación de entrada.
  const activeSlide = React.cloneElement(slides[safeIndex], {
    enterFrom: dir === 1 ? 'right' : 'left',
    pressScale,
  } as { enterFrom: 'left' | 'right'; pressScale: SharedValue<number> });

  return (
    <Animated.View style={[styles.wrapper, pressStyle]}>
      {activeSlide}

      <Pressable
        style={[styles.arrow, styles.arrowLeft]}
        hitSlop={10}
        onPress={() => go(-1)}
      >
        <View style={[styles.arrowStep, styles.arrowStepLeft]}>
          <LinearGradient
            colors={theme.gradients.heroStep}
            locations={STEP_SHADE_STOPS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <MaterialCommunityIcons name="chevron-left" size={30} color={color} />
        </View>
      </Pressable>

      <Pressable
        style={[styles.arrow, styles.arrowRight]}
        hitSlop={10}
        onPress={() => go(1)}
      >
        <View style={[styles.arrowStep, styles.arrowStepRight]}>
          <LinearGradient
            colors={theme.gradients.heroStep}
            locations={STEP_SHADE_STOPS}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <MaterialCommunityIcons
            name="chevron-right"
            size={30}
            color={color}
          />
        </View>
      </Pressable>

      <View style={styles.dots} pointerEvents="none">
        {slides.map((_, i) => (
          <Dot key={i} active={i === safeIndex} color={color} />
        ))}
      </View>
    </Animated.View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    wrapper: {
      position: 'relative',
    },
    arrow: {
      position: 'absolute',
      top: 0,
      // Excluye el margen inferior de la hero card para abarcar justo su altura.
      bottom: theme.spacing.md,
      // Pegadas al borde exterior de la tarjeta (coincide con su margen horizontal).
      justifyContent: 'center',
      alignItems: 'stretch',
    },
    arrowLeft: {
      left: theme.spacing.md,
    },
    arrowRight: {
      right: theme.spacing.md,
    },
    // Peldaño lateral: ocupa TODA la altura de la hero card y va pegado a su borde.
    // Las esquinas exteriores copian el radio de la tarjeta (parecen su propio
    // borde); las interiores llevan un radio pequeño que apenas se ve, porque el
    // degradado ya llega transparente a ese lado. El conjunto se lee como un
    // escalón tallado en el lateral del dorado, no como un botón superpuesto.
    arrowStep: {
      width: HERO_ARROW_WIDTH,
      flex: 1,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrowStepLeft: {
      borderTopLeftRadius: theme.borderRadius.lg,
      borderBottomLeftRadius: theme.borderRadius.lg,
      borderTopRightRadius: theme.borderRadius.sm,
      borderBottomRightRadius: theme.borderRadius.sm,
    },
    arrowStepRight: {
      borderTopRightRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.lg,
      borderTopLeftRadius: theme.borderRadius.sm,
      borderBottomLeftRadius: theme.borderRadius.sm,
    },
    dots: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: theme.spacing.md + 10,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      height: 6,
      borderRadius: 3,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
