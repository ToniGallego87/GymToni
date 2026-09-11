import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  stopRestTimer,
  useRestSecondsLeft,
  useRestTimer,
} from '@lib/restTimerStore';
import { formatRestTime } from '@lib/utils';
import {
  GLASS_BACK_BUTTON_BG,
  GLASS_BACK_BUTTON_BORDER,
  GLASS_BACK_BUTTON_OVERLAY,
  GLASS_BLUR_INTENSITY,
} from './glassTokens';

export const REST_TIMER_BAR_HEIGHT = 46;

interface RestTimerBarProps {
  /** Vuelve al registro del día que lanzó el descanso. */
  onPress: () => void;
  /** Distancia al borde inferior: la pone la raíz según lo que flote debajo. */
  bottom: number;
}

/**
 * El descanso en curso, fuera de la pantalla de registro. Aparece en cuanto se
 * navega a otro sitio con la cuenta atrás viva: mirar el Calendario o el
 * histórico entre serie y serie es lo normal, y antes ese paseo mataba el
 * temporizador porque vivía en el estado de la pantalla (ver
 * `lib/restTimerStore`).
 *
 * Es un ATAJO, no un mando: tocarla devuelve al entreno, donde están el "+30s"
 * y el resto. Lo único que se puede hacer desde aquí es cortarla, y se ve
 * (la × con su icono, nada escondido tras un gesto).
 *
 * Misma piel de cristal oscuro que el botón "Volver", con el que comparte
 * vecindario en las subpantallas.
 */
export function RestTimerBar({ onPress, bottom }: RestTimerBarProps) {
  const restTimer = useRestTimer();
  const seconds = useRestSecondsLeft();

  if (!restTimer || seconds <= 0) return null;

  return (
    <Pressable
      style={[styles.bar, { bottom, height: REST_TIMER_BAR_HEIGHT }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('Volver al entreno')}
    >
      <BlurView
        tint="dark"
        intensity={GLASS_BLUR_INTENSITY}
        experimentalBlurMethod="dimezisBlurView"
        style={styles.blur}
      />
      <View style={styles.overlay} />

      <MaterialCommunityIcons
        name="timer-sand"
        size={18}
        color={theme.colors.primaryFill}
      />
      <Text style={styles.countdown}>{formatRestTime(seconds)}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {restTimer.exerciseName || t('Descanso')}
      </Text>

      {/* Cortar el descanso sin volver al registro. Mismo disco con el aspa
          recortada que salta el descanso dentro de la tarjeta: una sola marca
          de "quitar esto" en toda la app. */}
      <Pressable
        style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
        onPress={stopRestTimer}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('Saltar descanso')}
      >
        <MaterialCommunityIcons
          name="close-circle"
          size={20}
          color={theme.colors.white}
        />
      </Pressable>
    </Pressable>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    bar: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1,
      borderColor: GLASS_BACK_BUTTON_BORDER,
      backgroundColor: GLASS_BACK_BUTTON_BG,
      overflow: 'hidden',
    },
    blur: {
      ...StyleSheet.absoluteFillObject,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: GLASS_BACK_BUTTON_OVERLAY,
    },
    // La cuenta atrás manda: es el dato por el que se mira la barra.
    countdown: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.primaryFill,
      lineHeight: 21,
      fontVariant: ['tabular-nums'],
    },
    // De qué descanso es. Cede el ancho antes que el número.
    label: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.white,
      lineHeight: 17,
    },
    skip: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    skipPressed: {
      opacity: 0.7,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
