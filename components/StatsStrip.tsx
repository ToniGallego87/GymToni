import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
/** Una referencia de la fila (valor + rótulo: "11.200" / "semana pasada"). */
export interface StatsStripStat {
  value: string;
  label: string;
}

interface StatsStripProps {
  /** Icono del dato principal ("weight-lifter", "fire"). */
  icon: string;
  /** Color del icono (por defecto el dorado `primary`). */
  iconColor?: string;
  /** Dato principal ("1.240") y su unidad ("kg", "kcal"). */
  value: string;
  unit: string;
  /** Detalle tras el dato principal ("3 entrenos · 12 series"). */
  meta?: string;
  /** Hasta tres referencias (semana pasada / media / mejor). */
  stats?: StatsStripStat[];
}

/**
 * Fila de cifras dentro de la tarjeta de progreso de Inicio (la racha de
 * semanas). Antes era una tarjeta dorada de un carrusel, que rotaba y
 * desaparecía sola: aquí el dato queda fijo junto a la gráfica.
 */
export function StatsStrip({
  icon,
  iconColor,
  value,
  unit,
  meta,
  stats = [],
}: StatsStripProps) {
  return (
    <View style={styles.strip}>
      <View style={styles.mainRow}>
        <MaterialCommunityIcons
          name={icon as any}
          size={16}
          color={iconColor ?? theme.colors.primary}
        />
        <Text style={styles.mainValue}>{value}</Text>
        <Text style={styles.mainUnit}>{unit}</Text>
        {!!meta && (
          <Text style={styles.meta} numberOfLines={1}>
            · {meta}
          </Text>
        )}
      </View>
      {stats.length > 0 && (
        <View style={styles.refsRow}>
          {stats.map((stat, index) => (
            <React.Fragment key={stat.label}>
              {index > 0 && <View style={styles.refDivider} />}
              <View style={styles.ref}>
                <Text style={styles.refValue}>{stat.value}</Text>
                <Text style={styles.refLabel} numberOfLines={1}>
                  {stat.label}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    strip: {
      marginTop: 10,
      gap: 8,
    },
    // Centrada: es el único dato de la tira, así que sentarla a la izquierda
    // la dejaba descolgada bajo el título de la tarjeta.
    mainRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: 5,
    },
    mainValue: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
    },
    mainUnit: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    meta: {
      flexShrink: 1,
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    refsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    ref: { flex: 1, alignItems: 'center' },
    refDivider: {
      width: 1,
      height: 26,
      backgroundColor: theme.colors.border,
    },
    refValue: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
    },
    refLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginTop: 1,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
