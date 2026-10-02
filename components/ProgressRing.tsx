import { subscribeTheme } from '@lib/themeStore';
import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '@lib/theme';

interface ProgressRingProps {
  /** Fracción completada (0 = vacío, 1 = lleno). */
  progress: number;
  /** Diámetro total del anillo. */
  size: number;
  /** Grosor del trazo. */
  strokeWidth?: number;
  /** Color del trazo (por defecto el acento estructural). */
  color?: string;
  /** Lo que va centrado dentro (un icono o una cifra). */
  children?: ReactNode;
}

/**
 * Anillo de progreso: se completa en el sentido de las agujas del reloj según
 * `progress`, con lo que se quiera centrado dentro. Lo usan las casillas de
 * insignias de Logros y los retos de la hero de estadísticas. (Se llamaba
 * `RestTimerRing` porque nació como rueda del descanso; el descanso pasó a ser
 * un relleno y el anillo se quedó para el progreso.) Pista tenue del acento
 * debajo y trazo del acento encima; el arco se dibuja con `strokeDasharray`
 * sobre la circunferencia y arranca arriba (el `rotation` de -90° del SVG).
 */
export function ProgressRing({
  progress,
  size,
  strokeWidth = 8,
  color = theme.colors.accentLine,
  children,
}: ProgressRingProps) {
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
