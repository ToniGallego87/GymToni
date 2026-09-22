import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { subscribeLevelPulse } from '@lib/levelPulse';

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
 *
 * La compacta (la de la barra) además se anima al cerrarse un popup de premio
 * (`lib/levelPulse`): un latido que la agranda y la blanquea para que se vea
 * de dónde han ido a parar los puntos que se acaban de ganar.
 */
export function LevelPill({ level, compact, onPress }: LevelPillProps) {
  const label = t('Nivel {n}', { n: level });
  const pulse = useRef(new Animated.Value(0)).current;

  // Solo la de la barra superior late: es la que mira quien acaba de cerrar el
  // popup. Las del perfil se quedan quietas.
  useEffect(() => {
    if (!compact) return;
    return subscribeLevelPulse(() => {
      pulse.setValue(0);
      Animated.sequence([
        // Un respiro: que el popup termine de irse antes del latido.
        Animated.delay(220),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.back(2.5)),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 480,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [compact, pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.6],
  });
  const spin = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const body = (
    <>
      {/* Destello: capa blanca que aparece según crece la píldora y se va
          según encoge, así el latido va del oro al blanco y vuelta (la
          opacidad sí va por el hilo nativo; el color de fondo, no). */}
      {compact && (
        <Animated.View
          pointerEvents="none"
          style={[styles.flash, { opacity: pulse }]}
        />
      )}
      <Animated.View style={compact ? { transform: [{ rotate: spin }] } : null}>
        <MaterialCommunityIcons
          name="star-four-points"
          size={compact ? 16 : 12}
          color={theme.colors.onGold}
        />
      </Animated.View>
      <Text style={[styles.text, compact && styles.textCompact]}>
        {compact ? String(level) : label}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <Animated.View style={compact ? { transform: [{ scale }] } : null}>
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
      </Animated.View>
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
      overflow: 'hidden',
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
    // Blanco literal (no `theme.colors.white`, que en tema claro es la tinta
    // oscura): la píldora se va blanqueando según crece y recupera su oro al
    // encoger, porque la opacidad sigue al mismo valor que la escala.
    flash: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#ffffff',
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
