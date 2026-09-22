import { subscribeTheme } from '@lib/themeStore';
import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '@lib/theme';

interface RestTimerRingProps {
  /** Fracción del descanso ya consumida (0 = recién lanzado, 1 = terminado). */
  progress: number;
  /** Diámetro total del anillo. */
  size: number;
  /** Grosor del trazo. */
  strokeWidth?: number;
  /** Color del trazo (por defecto el acento del descanso). */
  color?: string;
  /** Lo que va centrado dentro (la cuenta atrás). */
  children?: ReactNode;
}

/**
 * Rueda del descanso (y anillo de progreso de las insignias): un anillo que se va completando en el sentido de las
 * agujas del reloj a medida que pasa el tiempo, con la cuenta atrás en el
 * centro. Pista tenue del acento debajo y trazo del acento encima; el arco se
 * dibuja con `strokeDasharray` sobre la circunferencia y arranca arriba (el
 * `rotation` de -90° del SVG).
 */
export function RestTimerRing({
  progress,
  size,
  strokeWidth = 8,
  color = theme.colors.accentLine,
  children,
}: RestTimerRingProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeOpacity={0.22}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    center: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
