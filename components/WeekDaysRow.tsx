import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { theme } from '@lib/theme';
import { WorkoutDay } from '../types';
import { DayAccentIcon } from './DayAccentIcon';
import { ProgressRing } from './ProgressRing';

// Diámetro de cada día: con 7 días la fila mide 7 × 26 + 6 × 4 = 206.
const WEEK_DAY_DOT_SIZE = 26;
const DOT_GAP = 4;

interface WeekDaysRowProps {
  /** Los días de la rutina, en su orden. */
  days: WorkoutDay[];
  /** Días ya entrenados esta semana: se encienden en verde. */
  doneDayIds: ReadonlySet<string>;
  /** El día que toca: aro dorado (si no está hecho ya). */
  nextDayId?: string;
  /**
   * El día de HOY a medias: en vez de encenderse entero, un anillo verde se va
   * llenando con los ejercicios completados (`progress`, 0..1).
   */
  inProgress?: { dayId: string; progress: number };
  /** Lo que lee el lector de pantalla por la fila entera ("2 de 4 días"). */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * La semana en curso dibujada: un icono por día de la rutina, verde lo hecho,
 * con aro dorado el que toca, anillo que se llena el de hoy a medias y apagado
 * lo que falta. Responde "¿qué me queda?" sin leer nada. La pintan la cabecera
 * de la semana en Inicio y la de Elige la sesión: el mismo dato en dos
 * pantallas seguidas se dibuja igual para reconocerse sin volver a leerlo.
 */
export function WeekDaysRow({
  days,
  doneDayIds,
  nextDayId,
  inProgress,
  accessibilityLabel,
  style,
}: WeekDaysRowProps) {
  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      {days.map((day) => {
        if (inProgress?.dayId === day.id) {
          return (
            <ProgressRing
              key={day.id}
              progress={inProgress.progress}
              size={WEEK_DAY_DOT_SIZE}
              strokeWidth={2}
              color={theme.colors.success}
            >
              <DayAccentIcon
                emoji={day.emoji}
                name={day.name}
                size={15}
                color={theme.colors.text}
              />
            </ProgressRing>
          );
        }
        const done = doneDayIds.has(day.id);
        const next = !done && day.id === nextDayId;
        return (
          <View
            key={day.id}
            style={[styles.dot, done && styles.dotDone, next && styles.dotNext]}
          >
            <DayAccentIcon
              emoji={day.emoji}
              name={day.name}
              size={15}
              color={
                done
                  ? theme.colors.success
                  : next
                  ? theme.colors.primary
                  : theme.colors.textSecondary
              }
            />
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: DOT_GAP,
    },
    // Pendiente: aro y fondo suaves pero legibles (con `border` a secas y el
    // icono en `textMuted` casi no se distinguía del fondo de la tarjeta).
    dot: {
      width: WEEK_DAY_DOT_SIZE,
      height: WEEK_DAY_DOT_SIZE,
      borderRadius: WEEK_DAY_DOT_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: theme.colors.textMuted + '99',
      backgroundColor: theme.colors.surfaceAlt,
    },
    dotDone: {
      borderColor: theme.colors.success,
      backgroundColor: theme.colors.success + '22',
    },
    dotNext: {
      borderColor: theme.colors.primaryLine,
      borderWidth: 2,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
