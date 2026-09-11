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
   * Se ignora si `value` es 0: eso es "igual", no una dirección.
   */
  improved?: boolean;
  /** Se pega tras el número: '%' (por defecto) o ' kcal'. */
  suffix?: string;
  decimals?: number;
  iconSize?: number;
  /** Ajuste extra de la tipografía del número (tamaño por defecto: 15). */
  textStyle?: StyleProp<TextStyle>;
  /**
   * Fuerza el color del signo y el número (por defecto, verde/rojo/ámbar según
   * la dirección). Lo usa la semana de descarga, que va en azul al margen del
   * signo.
   */
  color?: string;
}

/**
 * Chip de tendencia: signo ▲/▼/= + el valor del cambio, animado desde 0. Único
 * componente para el indicador de subida/bajada que Inicio y Cardio repetían
 * con tipografías, colores y animación divergentes (Inicio animaba el número,
 * Cardio lo pintaba estático). Mismo signo, mismos colores y misma animación
 * en las dos pantallas.
 *
 * Los TRES estados de la medida viven aquí: sube (verde ▲), baja (rojo ▼) e
 * igual (ámbar =). El "igual" no es una dirección, así que no lleva flecha:
 * pintarlo con una habría mentido sobre el dato (y es lo que pasaba cuando
 * cada pantalla se lo montaba por su cuenta).
 */
export function TrendDelta({
  value,
  improved,
  suffix = '%',
  decimals = 1,
  iconSize = 15,
  textStyle,
  color: colorOverride,
}: TrendDeltaProps) {
  const isFlat = value === 0;
  const isUp = improved ?? value >= 0;
  const color =
    colorOverride ??
    (isFlat
      ? theme.colors.warning
      : isUp
      ? theme.colors.success
      : theme.colors.error);
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons
        name={isFlat ? 'equal' : isUp ? 'arrow-up-bold' : 'arrow-down-bold'}
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
