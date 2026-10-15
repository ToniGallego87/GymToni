import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { ProgressRing } from './ProgressRing';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Proporciones respecto al diámetro de la medalla (60 en la lista de Logros).
const RING_RATIO = 72 / 60;
const ICON_RATIO = 28 / 60;
const STROKE_RATIO = 4 / 60;

interface BadgeMedalProps {
  icon: string;
  unlocked: boolean;
  /**
   * Avance (0..1) de un logro por recuento aún sin conseguir: se pinta como
   * anillo alrededor. Sin él, uno sin conseguir lleva candado.
   */
  progress?: number;
  /** Diámetro de la medalla; el hueco que ocupa es el del anillo. */
  size?: number;
}

/**
 * La medalla de un logro, la MISMA en la lista de Logros y en su detalle.
 * Conseguida: círculo con el degradado de oro de la marca y el icono en su
 * tinta. Sin conseguir: círculo apagado con el icono en gris; si es por
 * recuento, con el anillo de lo que llevas alrededor, y si es de sí/no, con un
 * candado.
 */
export function BadgeMedal({
  icon,
  unlocked,
  progress,
  size = 60,
}: BadgeMedalProps) {
  const ring = Math.round(size * RING_RATIO);
  const iconSize = Math.round(size * ICON_RATIO);
  const box = { width: ring, height: ring };
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (unlocked) {
    return (
      <View style={[styles.box, box]}>
        <LinearGradient
          colors={theme.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.medal, circle, styles.unlocked]}
        >
          <MaterialCommunityIcons
            name={icon as IconName}
            size={iconSize}
            color={theme.colors.onGold}
          />
        </LinearGradient>
      </View>
    );
  }

  const locked = (
    <View style={[styles.medal, circle, styles.locked]}>
      <MaterialCommunityIcons
        name={icon as IconName}
        size={iconSize}
        color={theme.colors.textSecondary}
        style={styles.iconLocked}
      />
    </View>
  );

  if (progress != null) {
    return (
      <View style={[styles.box, box]}>
        <ProgressRing
          progress={progress}
          size={ring}
          strokeWidth={Math.max(3, Math.round(size * STROKE_RATIO))}
          color={theme.colors.primary}
        >
          {locked}
        </ProgressRing>
      </View>
    );
  }

  const lockSize = Math.round(size / 3);
  return (
    <View style={[styles.box, box]}>
      {locked}
      <View
        style={[
          styles.lockBadge,
          {
            width: lockSize,
            height: lockSize,
            borderRadius: lockSize / 2,
            right: (ring - size) / 2 + 2,
            bottom: (ring - size) / 2 + 2,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="lock"
          size={Math.round(lockSize * 0.55)}
          color={theme.colors.textSecondary}
        />
      </View>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    box: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    medal: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    unlocked: {
      borderWidth: 2,
      borderColor: theme.colors.primaryLine,
    },
    locked: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    iconLocked: { opacity: 0.6 },
    lockBadge: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
