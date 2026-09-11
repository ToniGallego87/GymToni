import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { intensityLabel, RoutineIntensity } from '@lib/routines';

/**
 * Color del tramo. Verde/ámbar/rojo son los colores de estado del tema: aquí no
 * significan bien/mal, solo cuánta caña lleva la semana.
 */
export const intensityColor = (level: RoutineIntensity): string =>
  level === 'soft'
    ? theme.colors.success
    : level === 'medium'
    ? theme.colors.warning
    : theme.colors.error;

/**
 * Distintivo de intensidad de una rutina (rayo + tramo).
 *
 * Fuente ÚNICA: lo pintan el tablón de Comunidad, la consulta de una rutina
 * pública y la lista de tus propias rutinas. Antes cada pantalla se montaba su
 * píldora y su tabla de colores, así que el mismo dato se veía distinto según
 * dónde lo miraras.
 */
export function RoutineIntensityPill({
  level,
  style,
}: {
  level: RoutineIntensity;
  style?: ViewStyle;
}) {
  const color = intensityColor(level);
  return (
    <View style={[styles.pill, { borderColor: color }, style]}>
      <MaterialCommunityIcons name="lightning-bolt" size={14} color={color} />
      <Text style={[styles.text, { color }]}>{intensityLabel(level)}</Text>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1,
    },
    text: { fontSize: 12, fontWeight: '800' },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
