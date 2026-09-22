import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { HERO_ARROW_INSET } from './HeroCarousel';
import { HERO_CARD_HEIGHT } from './HeroCard';
import { RestTimerRing } from './RestTimerRing';

export interface HeroStat {
  /** Cifra ('820', '1/3'). Si viene `progress`, se ignora: se pinta el anillo. */
  value: string;
  label: string;
  /**
   * 0..1: en vez de la cifra, un anillo que se rellena con el progreso y lleva
   * `icon` dentro (los retos de la hero card). Superado (>= 1) el icono pasa a
   * ser un check.
   */
  progress?: number;
  icon?: string;
}

// Anillo de progreso de un stat (retos): cabe en el alto de la cifra.
const STAT_RING_SIZE = 30;

interface HeroStatsCardProps {
  /** Etiqueta superior (ej: "Esta semana"). */
  kicker: string;
  /** Icono del dato principal. */
  mainIcon: string;
  /** Valor principal grande (ej: "820"). */
  mainValue: string;
  /** Unidad del dato principal (ej: "kcal", "kg"). */
  mainUnit: string;
  /** Línea de detalle bajo el dato principal (opcional). */
  subline?: string;
  /** Hasta tres referencias (semana pasada / media / mejor). */
  stats: HeroStat[];
  /** Si es true, se muestra `emptyText` centrado en vez de los datos. */
  isEmpty?: boolean;
  emptyText?: string;
  /** Dirección de entrada del contenido en un carrusel (el frame no se mueve). */
  enterFrom?: 'left' | 'right';
  /** Si se pasa, la tarjeta entera se vuelve pulsable (p. ej. abrir los retos). */
  onPress?: () => void;
  // Escala de pulsación del carrusel: si viene, la tarjeta la anima y es el
  // carrusel quien escala el conjunto (tarjeta + flechas + puntos).
  pressScale?: SharedValue<number>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Tarjeta hero de estadísticas con gradiente dorado, del mismo aspecto que la
 * HeroCard de Fuerza. La usan tanto Cardio (kcal semanales) como Fuerza
 * (volumen semanal) para que ambos "estados de estadísticas" sean idénticos.
 * Sus márgenes coinciden con los de HeroCard para alinear las flechas del
 * carrusel.
 */
export function HeroStatsCard({
  kicker,
  mainIcon,
  mainValue,
  mainUnit,
  subline,
  stats,
  isEmpty,
  emptyText,
  enterFrom,
  onPress,
  pressScale,
}: HeroStatsCardProps) {
  const localScale = useSharedValue(1);
  const scale = pressScale ?? localScale;
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

  // Suelta, la tarjeta se escala a sí misma; en un carrusel escala el conjunto.
  const pressableStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale ? 1 : localScale.value }],
  }));

  const gradient = (
    <LinearGradient
      colors={theme.gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <LinearGradient
        colors={theme.gradients.sheen}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.heroSheen}
        pointerEvents="none"
      />

      <Animated.View style={contentStyle}>
        {isEmpty ? (
          <Text style={styles.heroEmptyText}>{emptyText}</Text>
        ) : (
          <>
            <View>
              {/* Pulsable: el chevron junto al kicker lo delata (las tres
                  tarjetas del carrusel comparten dorado y dibujo, y sin él
                  no se sabe cuál responde al toque). */}
              <View style={styles.heroKickerRow}>
                <Text style={styles.heroKicker}>{kicker}</Text>
                {!!onPress && (
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={16}
                    color={theme.colors.onGold}
                    style={styles.heroKickerChevron}
                  />
                )}
              </View>
              <View style={styles.heroMainRow}>
                <MaterialCommunityIcons
                  name={mainIcon as any}
                  size={30}
                  color={theme.colors.onGold}
                />
                <Text style={styles.heroMainValue}>{mainValue}</Text>
                <Text style={styles.heroMainUnit}>{mainUnit}</Text>
              </View>
              {!!subline && <Text style={styles.heroSubline}>{subline}</Text>}
            </View>

            {stats.length > 0 && (
              <View style={styles.heroStatsRow}>
                {stats.map((stat, index) => (
                  <React.Fragment key={stat.label}>
                    {index > 0 && <View style={styles.heroStatDivider} />}
                    <View style={styles.heroStat}>
                      {stat.progress != null ? (
                        <RestTimerRing
                          progress={stat.progress}
                          size={STAT_RING_SIZE}
                          strokeWidth={3}
                          color={theme.colors.onGold}
                        >
                          <MaterialCommunityIcons
                            name={
                              (stat.progress >= 1
                                ? 'check-bold'
                                : stat.icon ?? 'flag-checkered') as any
                            }
                            size={14}
                            color={theme.colors.onGold}
                          />
                        </RestTimerRing>
                      ) : (
                        <Text style={styles.heroStatValue}>{stat.value}</Text>
                      )}
                      <Text style={styles.heroStatLabel}>{stat.label}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}
          </>
        )}
      </Animated.View>
    </LinearGradient>
  );

  if (!onPress) return gradient;

  return (
    <AnimatedPressable
      style={pressableStyle}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
    >
      {gradient}
    </AnimatedPressable>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    hero: {
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: 20,
      paddingTop: 14,
      // Más padding abajo que arriba: el contenido va centrado, así que este hueco
      // extra lo sube en bloque y deja respirar la fila de datos frente a los
      // puntitos del carrusel (que van a 10px del borde inferior de la tarjeta).
      paddingBottom: 24,
      height: HERO_CARD_HEIGHT,
      justifyContent: 'center',
      overflow: 'hidden',
      ...theme.shadow.card,
    },
    heroSheen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '55%',
    },
    heroKickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    heroKicker: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      textAlign: 'center',
      color: theme.colors.onGold,
      opacity: 0.75,
    },
    heroKickerChevron: { opacity: 0.75, marginLeft: -2 },
    heroMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    heroMainValue: {
      fontFamily: theme.fonts.display,
      fontSize: 34,
      // Anton a 34px pide 51px de línea (ascendente 40 + descendente 11), más de
      // los que hay: la línea base queda a lineHeight - descendente = 32.8 y los
      // dígitos (altura de mayúscula 29.2) ocupan de 3.6 a 32.8. Con 40 la base
      // subía a 28.8 y Android recortaba el número por arriba; 44 le da hueco.
      lineHeight: 44,
      includeFontPadding: false,
      // Los dígitos quedan centrados en 18.2 y la caja en 22 (el hueco del
      // descendente, que las cifras no usan, tira de ellas hacia arriba): sin esto
      // el número se ve alto frente al icono y la unidad, que sí van centrados.
      transform: [{ translateY: 4 }],
      color: theme.colors.onGold,
    },
    heroMainUnit: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.onGold,
      opacity: 0.8,
      alignSelf: 'flex-end',
      marginBottom: 4,
    },
    heroSubline: {
      marginTop: 2,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
      color: theme.colors.onGold,
      opacity: 0.85,
    },
    heroEmptyText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.onGold,
      opacity: 0.8,
      lineHeight: 20,
      textAlign: 'center',
    },
    heroStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: theme.colors.onGoldVeil,
      // Encogida a los lados: es el contenido más ancho de la tarjeta y sus
      // columnas exteriores llegaban a meterse bajo las flechas del carrusel.
      marginHorizontal: HERO_ARROW_INSET,
    },
    heroStat: {
      flex: 1,
      alignItems: 'center',
    },
    heroStatDivider: {
      width: 1,
      height: 32,
      backgroundColor: theme.colors.onGoldVeil,
    },
    heroStatValue: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.onGold,
    },
    heroStatLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.onGold,
      opacity: 0.8,
      marginTop: 2,
      textAlign: 'center',
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
