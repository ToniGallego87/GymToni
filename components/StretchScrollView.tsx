import React, { forwardRef, ReactNode } from 'react';
import { LayoutChangeEvent, ScrollViewProps, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

// Efecto de estiramiento (rubber-band) al hacer scroll más allá del límite,
// arriba o abajo. El contenido sigue al dedo con resistencia y vuelve con un
// muelle suave. Funciona igual en iOS y Android (no depende del bounce nativo).
//
// Solo afecta al contenido scrolleable: las barras flotantes (título / navegación)
// se montan como hermanas fuera de este componente, así que quedan fijas.

const RESISTANCE = 0.2; // cuánto sigue el contenido al dedo (menor = más rígido)
const MAX_STRETCH = 45; // desplazamiento máximo en px
const SPRING = { damping: 20, stiffness: 220, mass: 0.45 };

export interface StretchScrollViewProps extends ScrollViewProps {
  children?: ReactNode;
}

export const StretchScrollView = forwardRef<Animated.ScrollView, StretchScrollViewProps>(
  function StretchScrollView(
    { children, onLayout, onContentSizeChange, contentContainerStyle, ...props },
    _ref
  ) {
    const scrollRef = useAnimatedRef<Animated.ScrollView>();
    const scrollOffset = useScrollViewOffset(scrollRef);
    const stretch = useSharedValue(0);
    const contentHeight = useSharedValue(0);
    const containerHeight = useSharedValue(0);

    // Gesto nativo del propio scroll: se compone como simultáneo para que el
    // scroll normal siga funcionando mientras leemos el desplazamiento del dedo.
    const nativeGesture = Gesture.Native();

    const panGesture = Gesture.Pan()
      .onChange(e => {
        'worklet';
        const maxOffset = Math.max(contentHeight.value - containerHeight.value, 0);
        const atTop = scrollOffset.value <= 0;
        const atBottom = scrollOffset.value >= maxOffset;

        let next = stretch.value;
        if (atTop) {
          // Límite superior: solo se permite estirar hacia abajo (positivo).
          next = Math.max(0, stretch.value + e.changeY * RESISTANCE);
        } else if (atBottom) {
          // Límite inferior: solo se permite estirar hacia arriba (negativo).
          next = Math.min(0, stretch.value + e.changeY * RESISTANCE);
        } else {
          next = 0;
        }

        // Tope duro para que el estiramiento sea siempre leve.
        stretch.value = Math.max(-MAX_STRETCH, Math.min(MAX_STRETCH, next));
      })
      .onFinalize(() => {
        'worklet';
        stretch.value = withSpring(0, SPRING);
      });

    const composedGesture = Gesture.Simultaneous(nativeGesture, panGesture);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: stretch.value }],
    }));

    // El estilo del contenedor (padding, gap, flexGrow…) se aplica al wrapper
    // interno para que el gap separe los hijos reales y no quede inutilizado por
    // el nivel extra que añade el wrapper del estiramiento.
    return (
      <GestureDetector gesture={composedGesture}>
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.grow}
          scrollEventThrottle={16}
          onLayout={(e: LayoutChangeEvent) => {
            containerHeight.value = e.nativeEvent.layout.height;
            onLayout?.(e);
          }}
          onContentSizeChange={(w: number, h: number) => {
            contentHeight.value = h;
            onContentSizeChange?.(w, h);
          }}
          {...props}
        >
          <Animated.View style={[styles.grow, contentContainerStyle, animatedStyle]}>
            {children}
          </Animated.View>
        </Animated.ScrollView>
      </GestureDetector>
    );
  }
);

const styles = StyleSheet.create({
  grow: {
    flexGrow: 1,
  },
});
