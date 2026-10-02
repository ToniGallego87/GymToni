import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { antonCenterNudge } from '@lib/textStyles';
import { GradientFill } from './GradientFill';

interface ChartCardProps {
  /** Color del borde y del tinte del fondo. */
  accent: string;
  /** Icono del título (18px). */
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** Qué MIDE la gráfica ("Progreso / semana", "kcal / mes"). */
  title: string;
  /** Dato de cabecera a la derecha del título (mejora, total del mes…). */
  right?: React.ReactNode;
  /** Cifras bajo la cabecera, dentro de la zona pulsable (`StatsStrip`). */
  summary?: React.ReactNode;
  /** Hay gráfica que desplegar. Sin esto la cabecera no se pulsa ni hay galón. */
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  /** La gráfica y su filtro: se centran solos (ver `ChartArea`). */
  children?: React.ReactNode;
  /** Márgenes: los pone la pantalla, que es quien conoce su ritmo vertical. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Tarjeta de gráfica de la app: borde de acento, fondo de degradado, cabecera
 * pulsable (icono + qué mide + galón, y un dato a la derecha), cifras opcionales
 * debajo y, al desplegar, la gráfica con su filtro centrados.
 *
 * Fuente ÚNICA de Inicio (progreso semanal) y Cardio (métrica mensual). Antes
 * eran dos copias que habían derivado: Inicio centraba el contenido y dejaba el
 * padding lateral a cero, Cardio lo ponía a 16 y centraba en un contenedor
 * aparte, y los márgenes inferiores no coincidían. El aspecto común es el de
 * Inicio —padding lateral 0 en la tarjeta y 16 en la cabecera—, porque así la
 * gráfica (de ancho `getChartWidth`, que es más ancha que el hueco entre
 * paddings de 16) respira dentro de la tarjeta en vez de invadirlos.
 *
 * Progreso por ejercicio no la usa: su tarjeta no es pulsable ni colapsable y
 * su título es el GIF del ejercicio. De ella sí comparte la parte de abajo,
 * `ChartArea`, que es donde vivían las diferencias de centrado y márgenes.
 */
export function ChartCard({
  accent,
  icon,
  title,
  right,
  summary,
  expandable = false,
  expanded = false,
  onToggle,
  children,
  style,
}: ChartCardProps) {
  return (
    <View style={[styles.card, { borderColor: accent }, style]}>
      <GradientFill accent={accent} />
      <TouchableOpacity
        style={styles.header}
        onPress={expandable ? onToggle : undefined}
        disabled={!expandable}
        activeOpacity={0.85}
      >
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons
              name={icon}
              size={18}
              color={theme.colors.text}
            />
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {expandable && (
              <MaterialCommunityIcons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.text}
              />
            )}
          </View>
          {right}
        </View>
        {summary}
      </TouchableOpacity>

      {expandable && expanded && <ChartArea>{children}</ChartArea>}
    </View>
  );
}

/**
 * La gráfica y su `SegmentedFilter`, centrados. Ambos miden `getChartWidth`, que
 * no depende del padding de la tarjeta, así que el bloque se centra en su propio
 * contenedor (la cabecera necesita el ancho completo y no deja centrar arriba).
 *
 * El hueco entre la gráfica y el filtro lo pone el propio `SegmentedFilter`
 * (`SEGMENTED_FILTER_CHART_GAP`) en cada pantalla; aquí solo vive el centrado y
 * el aire inferior, que era otra de las cosas que habían derivado.
 */
export function ChartArea({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.area, style]}>{children}</View>;
}

const makeStyles = () =>
  StyleSheet.create({
    card: {
      borderRadius: theme.borderRadius.md,
      borderWidth: 2,
      // Sin padding lateral: la cabecera pone el suyo y la gráfica —más ancha
      // que el hueco entre paddings— se centra con aire a los dos lados.
      paddingVertical: 16,
      paddingHorizontal: 0,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
      ...theme.shadow.card,
    },
    header: {
      width: '100%',
      paddingHorizontal: 16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      // El dato de la derecha manda: el título cede antes que él.
      flexShrink: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 20,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.5,
      color: theme.colors.text,
      lineHeight: 28,
      includeFontPadding: false,
      textAlignVertical: 'center',
      flexShrink: 1,
      ...antonCenterNudge,
    },
    area: {
      alignItems: 'center',
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
