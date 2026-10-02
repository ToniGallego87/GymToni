import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import type { Challenge } from '@lib/challenges';
import { ProgressRing } from './ProgressRing';

interface ChallengesStripProps {
  challenges: Challenge[];
  /** Abre el detalle de los retos (`ChallengesModal`). */
  onPress: () => void;
}

const RING_SIZE = 30;

/**
 * Tira bajo la hero de Inicio y Cardio: los retos de la semana, SIEMPRE a la
 * vista. Antes eran la segunda tarjeta dorada de un carrusel que, mientras no
 * se había entrenado hoy, se quedaba clavado en la de empezar: justo cuando se
 * decide entrenar, que es para lo que están, no se veían. Es superficie y no oro
 * a propósito: la acción principal es la hero, y esto la acompaña sin competir.
 *
 * Mismo rótulo en las dos pestañas ("Retos de la semana"): cada una enseña los
 * suyos (fuerza o cardio), pero son la misma cosa.
 */
export function ChallengesStrip({ challenges, onPress }: ChallengesStripProps) {
  const done = challenges.filter((c) => c.done).length;
  const total = challenges.length;
  const allDone = total > 0 && done === total;
  const title = t('Retos de la semana');

  return (
    <Pressable
      style={({ pressed }) => [styles.strip, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${t('{n} de {total} completados', {
        n: done,
        total,
      })}`}
    >
      {/* Insignia del bloque: bandera en un disco de oro tenue (verde si ya
          están todos), el mismo lenguaje que los iconos de sección. */}
      <View style={[styles.badge, allDone && styles.badgeDone]}>
        <MaterialCommunityIcons
          name={allDone ? 'trophy' : 'flag-checkered'}
          size={18}
          color={allDone ? theme.colors.success : theme.colors.primary}
        />
      </View>

      <View style={styles.summary}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {title}
        </Text>
        {/* El dato: los superados grandes, el total y la palabra pequeños. */}
        <View style={styles.countRow}>
          <Text style={[styles.countDone, allDone && styles.countDoneAll]}>
            {done}
          </Text>
          <Text style={styles.countTotal}>/{total}</Text>
          <Text style={styles.countWord} numberOfLines={1}>
            {t('completados')}
          </Text>
        </View>
      </View>

      {/* Un anillo por reto, con su icono dentro; superado, un check. */}
      <View style={styles.rings}>
        {challenges.map((c) => (
          <ProgressRing
            key={c.id}
            progress={c.target > 0 ? c.current / c.target : c.done ? 1 : 0}
            size={RING_SIZE}
            strokeWidth={3}
            color={c.done ? theme.colors.success : theme.colors.primaryLine}
          >
            <MaterialCommunityIcons
              name={(c.done ? 'check-bold' : c.icon) as any}
              size={14}
              color={c.done ? theme.colors.success : theme.colors.text}
            />
          </ProgressRing>
        ))}
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color={theme.colors.textSecondary}
      />
    </Pressable>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    strip: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
      paddingVertical: 12,
      paddingLeft: 12,
      paddingRight: 10,
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadow.soft,
    },
    pressed: {
      opacity: 0.8,
    },
    badge: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryMuted,
    },
    badgeDone: {
      backgroundColor: theme.colors.success + '22',
    },
    summary: {
      flex: 1,
      minWidth: 0,
    },
    // Rótulo de sección: versalitas pequeñas y espaciadas, como las cejas de
    // la app ("Día 3"), para que se lea como título y no como dato.
    eyebrow: {
      fontSize: 11,
      fontWeight: '800',
      lineHeight: 14,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.colors.textSecondary,
    },
    countRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: 1,
    },
    countDone: {
      fontSize: 22,
      fontWeight: '800',
      lineHeight: 27,
      color: theme.colors.primary,
      fontVariant: ['tabular-nums'],
    },
    countDoneAll: {
      color: theme.colors.success,
    },
    countTotal: {
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 20,
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
    },
    countWord: {
      flexShrink: 1,
      marginLeft: 6,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
      color: theme.colors.textSecondary,
    },
    rings: {
      flexDirection: 'row',
      gap: 6,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
