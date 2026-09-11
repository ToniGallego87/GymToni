import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t } from '@lib/i18n';
import { useRestSecondsLeft, useRestTimer } from '@lib/restTimerStore';
import { formatRestTime } from '@lib/utils';

// Contenido de la ventanita flotante del descanso (Picture-in-Picture, ver
// lib/pipTimer.ts). Se pinta en la RAÍZ del árbol y solo mientras el sistema
// tiene la app encogida: el resto de la app sigue montado detrás, intacto, para
// que al volver a pantalla completa el entreno esté donde se dejó.
//
// La ventana mide poco más que un icono de notificación y el sistema no le pasa
// los toques (tocarla devuelve la app a pantalla completa), así que aquí no hay
// botones: solo el dato, tan grande como quepa.

// La ventana es apaisada (16:9, ver PipTimerModule): la cuenta atrás manda y el
// nombre del ejercicio va debajo, en pequeño.
const COUNTDOWN_SIZE = 46;

export function PipRestTimer() {
  const restTimer = useRestTimer();
  // Misma cuenta atrás que la tarjeta del registro y que la barra flotante: las
  // tres restan contra el `endAt` del store, así que no pueden discrepar.
  const remaining = useRestSecondsLeft();
  const finished = !restTimer || remaining <= 0;

  return (
    <View style={styles.container}>
      {finished ? (
        <>
          <MaterialCommunityIcons
            name="check-circle"
            size={30}
            color={theme.colors.success}
          />
          <Text style={[styles.finishedText, { color: theme.colors.success }]}>
            {t('¡A por la siguiente serie!')}
          </Text>
        </>
      ) : (
        <>
          <View style={styles.countdownRow}>
            <MaterialCommunityIcons
              name="timer-sand"
              size={24}
              color={theme.colors.accentLine}
            />
            <Text style={styles.countdown} numberOfLines={1}>
              {formatRestTime(Math.max(0, remaining))}
            </Text>
          </View>
          <Text style={styles.exerciseName} numberOfLines={1}>
            {restTimer?.exerciseName || t('Descanso')}
          </Text>
        </>
      )}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    // Tapa la app entera: dentro de la ventanita no hay sitio para nada más, y
    // fuera de ella este componente ni se monta.
    container: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      gap: 2,
    },
    countdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    countdown: {
      fontSize: COUNTDOWN_SIZE,
      lineHeight: 64,
      fontFamily: theme.fonts.display,
      letterSpacing: 1,
      color: theme.colors.accentLine,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    exerciseName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    finishedText: {
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'center',
      marginTop: 6,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
