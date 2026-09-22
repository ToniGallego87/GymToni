import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';

interface LevelPillProps {
  level: number;
  /** Solo el número (sin "Nivel"): para la barra superior, donde no cabe más. */
  compact?: boolean;
  /** Si se pasa, la píldora es un botón (→ Logros). */
  onPress?: () => void;
}

/**
 * Píldora "Nivel N": el nivel de la cuenta (lib/level.ts), junto al nombre en
 * el perfil propio y en el público de los demás, y en compacto ("N") en la
 * barra superior de todas las pantallas, como acceso a Logros. Oro vivo con
 * tinta oscura, como las insignias: es lo que se enseña.
 */
export function LevelPill({ level, compact, onPress }: LevelPillProps) {
  const label = t('Nivel {n}', { n: level });
  const body = (
    <>
      <MaterialCommunityIcons
        name="star-four-points"
        size={compact ? 16 : 12}
        color={theme.colors.onGold}
      />
      <Text style={[styles.text, compact && styles.textCompact]}>
        {compact ? String(level) : label}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.pill,
          compact && styles.pillCompact,
          pressed && styles.pressed,
        ]}
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${t('Logros')}`}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View
      style={[styles.pill, compact && styles.pillCompact]}
      accessibilityLabel={label}
    >
      {body}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    pill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.primaryFill,
      borderWidth: 1,
      borderColor: theme.colors.primaryFillDark,
    },
    // En la barra superior: más grande (es un botón, no una etiqueta) y
    // centrada en la fila (el alignSelf de arriba la pegaba al borde de
    // arriba).
    pillCompact: {
      alignSelf: 'center',
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    textCompact: {
      fontSize: 15,
      lineHeight: 18,
    },
    pressed: {
      opacity: 0.8,
    },
    text: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      color: theme.colors.onGold,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
