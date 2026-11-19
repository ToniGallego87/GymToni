import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useRef, useState } from 'react';
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
  // Vuelo de los puntos ganados hacia la píldora: 0 → aparecen a su izquierda,
  // 1 → dentro de ella, fundidos. Las chispas van con su propio valor (salen
  // escalonadas) para que no se muevan como un bloque.
  const flight = useRef(new Animated.Value(0)).current;
  const sparks = useRef(SPARKS.map(() => new Animated.Value(0))).current;
  const [flyingXp, setFlyingXp] = useState<number | null>(null);

  // Solo la de la barra superior late: es la que mira quien acaba de cerrar el
  // popup. Las del perfil se quedan quietas.
  useEffect(() => {
    if (!compact) return;
    return subscribeLevelPulse((xp) => {
      pulse.setValue(0);
      const beat = Animated.sequence([
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
      ]);
      // Sin puntos (subida de nivel): solo el latido.
      if (!xp) {
        // Un respiro: que el popup termine de irse antes del latido.
        Animated.sequence([Animated.delay(220), beat]).start();
        return;
      }
      // Con puntos: "+N pts" aparece junto a la píldora, vuela hacia ella
      // encogiendo con sus chispas y, al llegar, la píldora late: se ve que
      // los puntos han entrado en el nivel.
      setFlyingXp(xp);
      flight.setValue(0);
      sparks.forEach((spark) => spark.setValue(0));
      Animated.sequence([
        Animated.delay(220),
        Animated.parallel([
          Animated.timing(flight, {
            toValue: 1,
            duration: FLIGHT_MS,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.stagger(
            60,
            sparks.map((spark) =>
              Animated.timing(spark, {
                toValue: 1,
                duration: FLIGHT_MS - 120,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
              })
            )
          ),
        ]),
        beat,
      ]).start(({ finished }) => {
        if (finished) setFlyingXp(null);
      });
    });
  }, [compact, pulse, flight, sparks]);

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

  // Los puntos en vuelo: hermanos de la píldora (no hijos), así no los recorta
  // su `overflow` ni los agranda su latido. Centrados en ella y desplazados
  // por transform: llegar a 0 es estar dentro.
  const flyingPoints =
    compact && flyingXp != null ? (
      <View pointerEvents="none" style={styles.flightLayer}>
        {SPARKS.map(([dx, dy], i) => (
          <Animated.View
            key={i}
            style={[
              styles.spark,
              {
                opacity: sparks[i].interpolate({
                  inputRange: [0, 0.15, 0.8, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateX: sparks[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [dx, 0],
                    }),
                  },
                  {
                    translateY: sparks[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [dy, 0],
                    }),
                  },
                  {
                    scale: sparks[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.4],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
        <Animated.View
          style={[
            styles.flyingChip,
            {
              opacity: flight.interpolate({
                inputRange: [0, 0.12, 0.8, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  // Aparece a la izquierda, se queda un instante para leerse y
                  // entra en la píldora.
                  translateX: flight.interpolate({
                    inputRange: [0, 0.4, 1],
                    outputRange: [-FLY_FROM_X, -FLY_FROM_X + 6, 0],
                  }),
                },
                {
                  scale: flight.interpolate({
                    inputRange: [0, 0.15, 0.4, 1],
                    outputRange: [0.5, 1.12, 1, 0.25],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.flyingChipText}>
            {t('+{n} pts', { n: flyingXp })}
          </Text>
        </Animated.View>
      </View>
    ) : null;

  if (onPress) {
    return (
      <View>
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
        {flyingPoints}
      </View>
    );
  }
  const staticPill = (
    <View
      style={[styles.pill, compact && styles.pillCompact]}
      accessibilityLabel={label}
    >
      {body}
    </View>
  );
  return flyingPoints ? (
    <View>
      {staticPill}
      {flyingPoints}
    </View>
  ) : (
    staticPill
  );
}

/** Duración del vuelo de los puntos hasta la píldora (antes del latido). */
const FLIGHT_MS = 900;
/** Desde cuánto a la izquierda de la píldora salen los puntos. La barra
 * recorta lo que se salga de ella, así que el vuelo es en horizontal. */
const FLY_FROM_X = 84;
/** Chispas que acompañan a los puntos: desde dónde salen respecto al centro
 * de la píldora (x, y). Poco recorrido vertical: la barra es baja. */
const SPARKS: [number, number][] = [
  [-58, -14],
  [-96, 10],
  [-40, 15],
  [-120, -8],
  [-74, 4],
  [-26, -16],
];

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
    // Capa de los puntos en vuelo, del tamaño de la píldora y centrada en
    // ella: cada pieza parte de su centro y se desplaza por transform.
    flightLayer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Misma piel que la píldora (oro y tinta oscura): al encoger dentro de
    // ella se confunde con ella, que es la idea de "fundirse".
    flyingChip: {
      position: 'absolute',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.primaryFill,
      borderWidth: 1,
      borderColor: theme.colors.primaryFillDark,
      ...theme.shadow.soft,
    },
    flyingChipText: {
      fontSize: 13,
      fontWeight: '900',
      color: theme.colors.onGold,
      letterSpacing: 0.3,
    },
    spark: {
      position: 'absolute',
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primaryFill,
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
