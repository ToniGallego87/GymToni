import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { fmtNum, t } from '@lib/i18n';
import { HERO_CARD_HEIGHT } from './HeroCard';

// Sangría lateral de la fila de datos: la misma que tenía cuando la tarjeta
// vivía en el carrusel de la hero, para no mover nada al retirarlo.
const STATS_ROW_INSET = 26;

// A partir de cuántos pesos del histórico tiene sentido dibujar la evolución, y
// cuántos de los últimos se pintan como máximo.
const MIN_POINTS_FOR_CHART = 3;
const MAX_POINTS = 8;

const CHART_HEIGHT = 36;

interface HeroWeightCardProps {
  /** Peso vigente (kg) o null si aún no se ha indicado ninguno. */
  weight: number | null;
  /** Histórico de pesos en kg, del más antiguo al más reciente. */
  history: number[];
  /** Abre la edición del peso. */
  onPress: () => void;
  /** Dirección de entrada del contenido en un carrusel (el frame no se mueve). */
  enterFrom?: 'left' | 'right';
  /** Escala de pulsación del carrusel: si viene, escala él el conjunto. */
  pressScale?: SharedValue<number>;
  /**
   * Fuera del carrusel (pantalla Peso): la tarjeta se ajusta a su contenido en
   * vez de a la altura fija de las hero de Inicio, y no pinta la sparkline (la
   * gráfica con fechas va debajo, en la pantalla).
   */
  compact?: boolean;
  /** Línea al pie ("Actualizado hace 3 días"); en ámbar si `warning`. */
  footer?: { icon: string; text: string; warning?: boolean };
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Gráfica de línea de los últimos pesos. El dominio se ajusta al rango real con
 * un margen (los pesos varían poco: partir de 0 aplanaría la línea) y el último
 * punto se marca más grueso por ser el vigente.
 */
function WeightSparkline({ values }: { values: number[] }) {
  const [width, setWidth] = useState(0);

  const padding = { top: 8, right: 6, bottom: 8, left: 6 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = CHART_HEIGHT - padding.top - padding.bottom;

  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  // Si todos los pesos son iguales el rango es 0: se centra la línea.
  const span = maxVal - minVal;
  const margin = span > 0 ? span * 0.25 : 0.5;
  const domainMin = minVal - margin;
  const domainMax = maxVal + margin;

  const getX = (i: number) =>
    padding.left +
    (values.length === 1
      ? plotWidth / 2
      : (i * plotWidth) / (values.length - 1));
  const getY = (value: number) =>
    padding.top +
    ((domainMax - value) / (domainMax - domainMin || 1)) * plotHeight;

  return (
    <View
      style={styles.chartWrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg width={width} height={CHART_HEIGHT}>
          <Polyline
            points={values.map((v, i) => `${getX(i)},${getY(v)}`).join(' ')}
            fill="none"
            stroke={theme.colors.onGold}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
          {values.map((v, i) => {
            const isLast = i === values.length - 1;
            return (
              <Circle
                key={i}
                cx={getX(i)}
                cy={getY(v)}
                r={isLast ? 4 : 2.5}
                fill={theme.colors.onGold}
                opacity={isLast ? 1 : 0.55}
              />
            );
          })}
        </Svg>
      )}
    </View>
  );
}

/**
 * Estado de la hero card de Cardio dedicado al peso corporal: muestra el peso
 * vigente, al pulsar abre su edición y, si hay histórico suficiente, dibuja la
 * evolución de los últimos pesos. Comparte frame (gradiente dorado, márgenes y
 * altura) con HeroCard, de la que es hermana.
 */
export function HeroWeightCard({
  weight,
  history,
  onPress,
  enterFrom,
  pressScale,
  compact = false,
  footer,
}: HeroWeightCardProps) {
  const localScale = useSharedValue(1);
  const scale = pressScale ?? localScale;

  // Suelta, la tarjeta se escala a sí misma; en un carrusel escala el conjunto.
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale ? 1 : localScale.value }],
  }));

  // Animación de solo el contenido (el frame/gradiente queda fijo en el carrusel).
  const enterDir = enterFrom === 'left' ? -1 : enterFrom === 'right' ? 1 : 0;
  const contentTx = useSharedValue(22 * enterDir);
  const contentOpacity = useSharedValue(0);
  useEffect(() => {
    contentTx.value = withTiming(0, { duration: 260 });
    contentOpacity.value = withTiming(1, { duration: 260 });
  }, []);
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentTx.value }],
    opacity: contentOpacity.value,
  }));

  const points = history.slice(-MAX_POINTS);
  const hasChart = !compact && points.length >= MIN_POINTS_FOR_CHART;

  // Bajo el peso: la diferencia con el anterior del histórico (o la invitación a
  // indicarlo si aún no hay ninguno).
  const prev = history.length >= 2 ? history[history.length - 2] : null;
  const delta = weight != null && prev != null ? weight - prev : null;
  const subline =
    weight == null
      ? t('Pulsa para indicar tu peso')
      : delta == null || Math.abs(delta) < 0.05
      ? t('Pulsa para actualizarlo')
      : t('{d} kg desde el anterior', {
          d: `${delta > 0 ? '+' : '−'}${fmtNum(Math.abs(delta))}`,
        });

  return (
    <AnimatedPressable
      style={[styles.wrapper, pressStyle]}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
    >
      <LinearGradient
        colors={theme.gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, compact && styles.gradientCompact]}
      >
        <LinearGradient
          colors={theme.gradients.sheen}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.sheen}
          pointerEvents="none"
        />

        <Animated.View style={contentStyle}>
          <Text style={styles.kicker}>{t('Tu peso')}</Text>
          <View style={styles.mainRow}>
            <MaterialCommunityIcons
              name="scale-bathroom"
              size={26}
              color={theme.colors.onGold}
            />
            <Text style={styles.mainValue}>
              {weight != null ? fmtNum(weight) : '—'}
            </Text>
            <Text style={styles.mainUnit}>kg</Text>
          </View>
          <Text style={styles.subline}>{subline}</Text>

          {hasChart && (
            <View style={styles.chartBlock}>
              <WeightSparkline values={points} />
              <Text style={styles.chartLabel}>
                {t('Últimos {n} registros', { n: points.length })}
              </Text>
            </View>
          )}

          {!!footer && (
            <View style={styles.footerRow}>
              <MaterialCommunityIcons
                name={
                  footer.icon as React.ComponentProps<
                    typeof MaterialCommunityIcons
                  >['name']
                }
                size={14}
                color={theme.colors.onGold}
                style={footer.warning ? undefined : styles.footerMuted}
              />
              <Text
                style={[
                  styles.footerText,
                  footer.warning && styles.footerWarning,
                ]}
              >
                {footer.text}
              </Text>
            </View>
          )}
        </Animated.View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    wrapper: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      ...theme.shadow.card,
    },
    gradient: {
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: 20,
      // El extra de abajo sube el bloque dentro de la altura fija de la hero.
      paddingTop: 14,
      paddingBottom: 24,
      height: HERO_CARD_HEIGHT,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    gradientCompact: {
      height: undefined,
      paddingTop: 12,
      paddingBottom: 12,
    },
    footerRow: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.onGoldVeil,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    footerMuted: { opacity: 0.75 },
    footerText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.onGold,
      opacity: 0.8,
    },
    // Dos semanas o más sin tocarlo: se marca, porque a partir de ahí las kcal
    // del cardio empiezan a mentir.
    footerWarning: {
      opacity: 1,
      fontWeight: '800',
    },
    sheen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '55%',
    },
    kicker: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: theme.colors.onGold,
      opacity: 0.75,
      marginBottom: 2,
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    mainValue: {
      fontFamily: theme.fonts.display,
      fontSize: 34,
      // Display de dígitos: lineHeight corto con su compensación, verificado a
      // ojo (ver la excepción en lib/__tests__/antonLineHeight.test.ts).
      lineHeight: 44,
      includeFontPadding: false,
      transform: [{ translateY: 4 }],
      color: theme.colors.onGold,
    },
    mainUnit: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.onGold,
      opacity: 0.8,
      alignSelf: 'flex-end',
      marginBottom: 4,
    },
    subline: {
      marginTop: 2,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
      color: theme.colors.onGold,
      opacity: 0.85,
    },
    chartBlock: {
      marginTop: 4,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: theme.colors.onGoldVeil,
      // Sangría de la fila de datos dentro del oro (heredada de cuando la
      // tarjeta compartía carrusel y dejaba sitio a sus flechas).
      marginHorizontal: STATS_ROW_INSET,
    },
    chartWrap: {
      height: CHART_HEIGHT,
    },
    chartLabel: {
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
      color: theme.colors.onGold,
      opacity: 0.7,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
