import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { theme } from '@lib/theme';

// Ráfaga de confeti desde el centro: celebración de un vistazo (el "Récord"
// del registro). Sin librería: un solo progreso 0→1 con driver nativo y cada
// trozo interpola su trayectoria (sale disparado, frena y cae).
const PIECES = 28;
const DURATION_MS = 1700;
// Muestras de la trayectoria: con más puntos la parábola se ve curva, no a
// tramos rectos.
const STEPS = [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1];

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function ConfettiBurst() {
  const progress = useRef(new Animated.Value(0)).current;

  const pieces = useMemo(() => {
    const colors = [
      theme.colors.primary,
      theme.colors.success,
      theme.colors.current,
      theme.colors.error,
      theme.colors.white,
    ];
    return Array.from({ length: PIECES }, (_, i) => {
      const angle = (i / PIECES) * Math.PI * 2 + Math.random() * 0.4;
      const distance = 90 + Math.random() * 100;
      // Algo más hacia arriba que hacia abajo: luego la caída lo compensa.
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance * 0.8 - 50;
      const fall = 140 + Math.random() * 100;
      const spin = (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540);
      const width = 6 + Math.random() * 4;
      const height = 10 + Math.random() * 6;
      return {
        color: colors[i % colors.length],
        width,
        height,
        translateX: progress.interpolate({
          inputRange: STEPS,
          outputRange: STEPS.map((t) => dx * easeOut(t)),
        }),
        translateY: progress.interpolate({
          inputRange: STEPS,
          outputRange: STEPS.map((t) => dy * easeOut(t) + fall * t * t),
        }),
        rotate: progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${spin}deg`],
        }),
      };
    });
  }, [progress]);

  const opacity = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 1, 0],
  });

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <View pointerEvents="none" style={styles.layer}>
      <View style={styles.origin}>
        {pieces.map((p, i) => (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                width: p.width,
                height: p.height,
                left: -p.width / 2,
                top: -p.height / 2,
                backgroundColor: p.color,
                opacity,
                transform: [
                  { translateX: p.translateX },
                  { translateY: p.translateY },
                  { rotate: p.rotate },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  origin: {
    width: 0,
    height: 0,
  },
  piece: {
    position: 'absolute',
    borderRadius: 2,
  },
});
