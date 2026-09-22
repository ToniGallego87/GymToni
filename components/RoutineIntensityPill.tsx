import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  intensityLabel,
  intensityRange,
  RoutineIntensity,
} from '@lib/routines';
import { AppModal } from './AppModal';
import { Button } from './Button';

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

const LEVELS: RoutineIntensity[] = ['soft', 'medium', 'hard'];

/**
 * Distintivo de intensidad de una rutina (rayo + tramo).
 *
 * Fuente ÚNICA: lo pintan el tablón de Comunidad, la consulta de una rutina
 * pública y la lista de tus propias rutinas. Antes cada pantalla se montaba su
 * píldora y su tabla de colores, así que el mismo dato se veía distinto según
 * dónde lo miraras.
 *
 * Tocarlo abre una chuleta con los tres tramos: el color solo no dice de qué
 * depende, y los cortes en series/semana solo vivían en el código.
 */
export function RoutineIntensityPill({
  level,
  style,
}: {
  level: RoutineIntensity;
  style?: ViewStyle;
}) {
  const color = intensityColor(level);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.pill,
          { borderColor: color },
          pressed && styles.pressed,
          style,
        ]}
        onPress={() => setOpen(true)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('Qué significa la intensidad')}
      >
        <MaterialCommunityIcons name="lightning-bolt" size={14} color={color} />
        <Text style={[styles.text, { color }]}>{intensityLabel(level)}</Text>
      </Pressable>

      <AppModal
        visible={open}
        onRequestClose={() => setOpen(false)}
        onOverlayPress={() => setOpen(false)}
        icon="lightning-bolt"
        title={t('Intensidad de la rutina')}
        message={t('Según las series planificadas en toda la semana.')}
        align="left"
        footer={
          <Button
            title={t('Entendido')}
            variant="secondary"
            onPress={() => setOpen(false)}
          />
        }
      >
        <View style={styles.rows}>
          {LEVELS.map((item) => {
            const c = intensityColor(item);
            const current = item === level;
            return (
              <View
                key={item}
                style={[styles.row, current && styles.rowCurrent]}
              >
                <MaterialCommunityIcons
                  name="lightning-bolt"
                  size={16}
                  color={c}
                />
                <Text style={[styles.rowLabel, { color: c }]}>
                  {intensityLabel(item)}
                </Text>
                <Text style={styles.rowRange}>{intensityRange(item)}</Text>
              </View>
            );
          })}
        </View>
      </AppModal>
    </>
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
    pressed: { opacity: 0.7 },
    text: { fontSize: 12, fontWeight: '800' },
    rows: { gap: 6, marginTop: 14 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    rowCurrent: {
      backgroundColor: theme.colors.surfaceAlt,
      borderColor: theme.colors.border,
    },
    rowLabel: { width: 64, fontSize: 14, fontWeight: '800' },
    rowRange: { flex: 1, color: theme.colors.textSecondary, fontSize: 13 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
