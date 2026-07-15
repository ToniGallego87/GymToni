import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';

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
 */
export function HeroCarousel({ slides, controlColor }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
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
  } as { enterFrom: 'left' | 'right' });

  return (
    <View style={styles.wrapper}>
      {activeSlide}

      <Pressable
        style={[styles.arrow, styles.arrowLeft]}
        hitSlop={10}
        onPress={() => go(-1)}
      >
        <View style={styles.arrowBubble}>
          <MaterialCommunityIcons name="chevron-left" size={30} color={color} />
        </View>
      </Pressable>

      <Pressable
        style={[styles.arrow, styles.arrowRight]}
        hitSlop={10}
        onPress={() => go(1)}
      >
        <View style={styles.arrowBubble}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  arrow: {
    position: 'absolute',
    top: 0,
    // Excluye el margen inferior de la hero card para centrar sobre la tarjeta.
    bottom: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Flechas altas y anchas, pegadas al borde de la tarjeta e integradas: un panel
  // translúcido oscuro que se funde con el dorado (poco borde, esquinas suaves).
  arrowLeft: {
    left: theme.spacing.md,
  },
  arrowRight: {
    right: theme.spacing.md,
  },
  arrowBubble: {
    width: 30,
    height: 132,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 19, 24, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.26)',
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
