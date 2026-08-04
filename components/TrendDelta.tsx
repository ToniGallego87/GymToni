import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleProp, StyleSheet, TextStyle, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { AnimatedCounter } from './AnimatedCounter';

interface TrendDeltaProps {
  /** Valor del cambio. La magnitud mostrada es su valor absoluto. */
  value: number;
  /**
   * Dirección (verde ▲ / rojo ▼). Por defecto la marca el signo de `value`;
   * pásalo cuando la magnitud viene ya en positivo y el sentido va aparte.
   */
  improved?: boolean;
  /** Se pega tras el número: '%' (por defecto) o ' kcal'. */
  suffix?: string;
  decimals?: number;
  iconSize?: number;
  /** Ajuste extra de la tipografía del número (tamaño por defecto: 15). */
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Chip de tendencia: flecha ▲/▼ + el valor del cambio, animado desde 0. Único
 * componente para el indicador de subida/bajada que Inicio y Cardio repetían
 * con tipografías, colores y animación divergentes (Inicio animaba el número,
 * Cardio lo pintaba estático). Misma flecha, mismo verde/rojo y misma animación
 * en las dos pantallas.
 */
export function TrendDelta({
  value,
  improved,
  suffix = '%',
  decimals = 1,
  iconSize = 15,
  textStyle,
}: TrendDeltaProps) {
  const isUp = improved ?? value >= 0;
  const color = isUp ? theme.colors.success : theme.colors.error;
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons
        name={isUp ? 'arrow-up-bold' : 'arrow-down-bold'}
        size={iconSize}
        color={color}
      />
      <AnimatedCounter
        value={Math.abs(value)}
        decimals={decimals}
        suffix={suffix}
        style={[styles.text, { color }, textStyle]}
      />
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    text: {
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 18,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
