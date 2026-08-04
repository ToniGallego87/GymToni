import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useRef } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// Margen extra a los lados para que las sombras de las tarjetas interiores no
// las recorte el `overflow: hidden` del contenedor (se compensa con padding
// interior para que el contenido quede a su ancho normal). Coincide con el
// padding horizontal del scroll (theme.spacing.md) para no salirse del marco.
const SHADOW_BLEED = 16;
// Hueco bajo la última tarjeta para que su sombra (que cae hacia abajo) quepa
// dentro del recorte.
const SHADOW_BLEED_BOTTOM = 10;

interface CollapsibleProps {
  open: boolean;
  children: React.ReactNode;
  duration?: number;
}

// Acordeón que anima SU PROPIA altura (no aplica transform al padre), de modo
// que las sombras de elevación de los hijos se mantienen intactas y el contenido
// de abajo se recoloca en flujo normal, sin solaparse con lo que desaparece.
//
// La medida real del contenido se toma de una copia invisible posicionada en
// absoluto (fuera del flujo), nunca del contenedor visible. Así el contenedor
// visible arranca siempre en altura 0 sin depender de que Android mida bien un
// hijo dentro de un padre forzado a 0 (en Android eso propaga la restricción
// de altura al hijo y `onLayout` nunca llega a reportar el alto real, dejando
// el acordeón bloqueado en 0 para siempre).
export function Collapsible({
  open,
  children,
  duration = 260,
}: CollapsibleProps) {
  const measured = useRef(0);
  const height = useSharedValue(0);
  // Solo se anima una vez hay una medida real; el valor inicial (al medir por
  // primera vez) se fija directamente, sin transición.
  const ready = useRef(false);

  const onMeasureLayout = (event: LayoutChangeEvent) => {
    const h = event.nativeEvent.layout.height;
    if (h <= 0) return;
    const changed = Math.abs(h - measured.current) > 0.5;
    measured.current = h;
    if (!ready.current) {
      height.value = open ? h : 0;
      ready.current = true;
    } else if (open && changed) {
      // El contenido cambió estando abierto (p. ej. nuevo día): ajustar el alto
      // sin animación para que no “salte”.
      height.value = h;
    }
  };

  // Solo reacciona a cambios de `open` DESPUÉS del montaje (la primera medida
  // ya fija el valor inicial correcto sin animación, más arriba).
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (!ready.current) return;
    height.value = withTiming(open ? measured.current : 0, {
      duration,
      easing: Easing.inOut(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <View>
      {/* Copia invisible fuera de flujo, solo para medir la altura real del
          contenido sin que el contenedor visible dependa de medirse a sí
          mismo mientras está (o empieza) colapsado. */}
      <View
        style={styles.measurer}
        pointerEvents="none"
        onLayout={onMeasureLayout}
      >
        <View style={styles.inner}>{children}</View>
      </View>

      <Animated.View style={[styles.clip, animatedStyle]}>
        <View style={styles.inner}>{children}</View>
      </Animated.View>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    measurer: {
      position: 'absolute',
      // Mismo ancho que la copia visible (que usa marginHorizontal negativo):
      // se estira más allá de los bordes del padre en lugar de anclarse a 0/0,
      // para que el contenido envuelva igual y la medida sea fiel.
      left: -SHADOW_BLEED,
      right: -SHADOW_BLEED,
      top: 0,
      opacity: 0,
    },
    clip: {
      overflow: 'hidden',
      marginHorizontal: -SHADOW_BLEED,
    },
    inner: {
      paddingHorizontal: SHADOW_BLEED,
      paddingBottom: SHADOW_BLEED_BOTTOM,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
