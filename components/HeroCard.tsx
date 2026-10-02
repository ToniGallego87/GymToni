import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';

export type HeroVariant =
  | 'start'
  | 'completed'
  | 'week-completed'
  | 'closed'
  | 'add';

/** Una referencia de la fila bajo el título (valor + unidad + rótulo). */
export interface HeroCardStat {
  value: string;
  unit?: string;
  label: string;
}

interface HeroCardProps {
  variant: HeroVariant;
  icon: string;
  title: string;
  titleIcon?: string;
  subtitle?: string;
  /**
   * Pone junto al subtítulo un botón "Cambiar" (icono de intercambiar),
   * independiente del toque de la tarjeta. Lo usa Inicio: el subtítulo NOMBRA
   * el día que toca, tocar la tarjeta entra en él y "Cambiar" abre "Elige la
   * sesión" para coger otro. Antes el propio subtítulo era el botón, con un
   * chevron que se leía como "ir a este día" y llevaba a otro sitio.
   */
  onSubtitlePress?: () => void;
  /** Rótulo accesible del botón "Cambiar" (por defecto, "Cambiar"). */
  subtitleAccessibilityLabel?: string;
  /**
   * Fila de hasta tres referencias bajo el título (Cardio: kcal de hace 7
   * días, media diaria y mejor día). Compacta la tarjeta como el subtítulo.
   */
  stats?: HeroCardStat[];
  onPress: () => void;
}

/**
 * Altura EXACTA del marco de una hero card: fija (no un mínimo) para que la
 * hero no cambie de alto al pasar de un estado a otro. El contenido va
 * centrado, así que los paddings solo acotan cuánto cabe; la variante con
 * subtítulo se compacta para caber en la misma caja en vez de estirarla.
 */
export const HERO_CARD_HEIGHT = 172;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function HeroCard({
  variant,
  icon,
  title,
  titleIcon,
  subtitle,
  onSubtitlePress,
  subtitleAccessibilityLabel,
  stats,
  onPress,
}: HeroCardProps) {
  // Paletas de gradiente por estado (orden claro→base→oscuro, diagonal). Se
  // definen en render para leer los gradientes del tema VIVO (cambio en
  // caliente). La hero de Fuerza es SIEMPRE el mismo oro (`primary`) en todos
  // sus estados dorados —empezar, completado, semana completada y cerrada—,
  // consistente con la de Cardio; solo "añadir rutina" usa el naranja de aviso.
  const GRADIENTS: Record<HeroVariant, [string, string, string]> = {
    start: theme.gradients.primary,
    completed: theme.gradients.primary,
    'week-completed': theme.gradients.primary,
    closed: theme.gradients.primary,
    add: theme.gradients.warning,
  };
  const colors = GRADIENTS[variant];
  // Con subtítulo cabe menos: el bloque se compacta para no estirar el marco.
  const hasStats = !!stats && stats.length > 0;
  const hasSubtitle = !!subtitle || hasStats;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Fundido sutil de entrada del CONTENIDO (icono + textos); el marco queda fijo.
  const contentOpacity = useSharedValue(0);
  useEffect(() => {
    contentOpacity.value = withTiming(1, { duration: 260 });
  }, []);
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <AnimatedPressable
      style={[styles.wrapper, animatedStyle]}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
      accessibilityRole="button"
      accessibilityLabel={[
        title,
        subtitle,
        ...(stats ?? []).map((s) =>
          [s.value, s.unit, s.label].filter(Boolean).join(' ')
        ),
      ]
        .filter(Boolean)
        .join('. ')}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Brillo superior (sheen) para dar volumen */}
        <LinearGradient
          colors={theme.gradients.sheen}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.sheen}
          pointerEvents="none"
        />

        <Animated.View
          style={[styles.content, hasStats && styles.contentWide, contentStyle]}
        >
          <View
            style={[styles.iconWrap, hasSubtitle && styles.iconWrapCompact]}
          >
            <MaterialCommunityIcons
              name={icon as any}
              size={hasSubtitle ? 38 : 44}
              style={[styles.icon, hasSubtitle && styles.iconCompact]}
            />
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            {!!titleIcon && (
              <MaterialCommunityIcons
                name={titleIcon as any}
                size={26}
                color={theme.colors.onGold}
              />
            )}
          </View>
          {!!subtitle && (
            <View style={styles.subtitleRow}>
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
              {/* La alternativa, con forma de botón propio y diciendo lo que
                  hace: el texto de al lado es parte de la tarjeta (entra en
                  ese día), esto es lo que cambia de día. */}
              {!!onSubtitlePress && (
                <Pressable
                  style={({ pressed }) => [
                    styles.changeChip,
                    pressed && styles.changeChipPressed,
                  ]}
                  onPress={onSubtitlePress}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    subtitleAccessibilityLabel ?? t('Cambiar')
                  }
                >
                  <MaterialCommunityIcons
                    name="swap-horizontal"
                    size={16}
                    color={theme.colors.onGold}
                  />
                  <Text style={styles.changeChipText}>{t('Cambiar')}</Text>
                </Pressable>
              )}
            </View>
          )}
          {hasStats && (
            <View style={styles.statsRow}>
              {stats!.map((stat, index) => (
                <React.Fragment key={stat.label}>
                  {index > 0 && <View style={styles.statDivider} />}
                  <View style={styles.stat}>
                    <Text style={styles.statValue} numberOfLines={1}>
                      {stat.value}
                      {!!stat.unit && (
                        <Text style={styles.statUnit}> {stat.unit}</Text>
                      )}
                    </Text>
                    <Text style={styles.statLabel} numberOfLines={1}>
                      {stat.label}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
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
      // Holgado, pero no tanto como para que un título de dos líneas no quepa
      // ahora que la altura no cede.
      paddingVertical: 10,
      paddingHorizontal: 24,
      height: HERO_CARD_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    sheen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '55%',
    },
    content: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Con cifras debajo, el bloque ocupa el ancho de la tarjeta: si no, la
    // fila solo medía lo que el título y los rótulos salían cortados.
    contentWide: {
      alignSelf: 'stretch',
    },
    iconWrap: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: theme.colors.onGoldVeil,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    iconWrapCompact: {
      width: 60,
      height: 60,
      borderRadius: 30,
      marginBottom: 6,
    },
    icon: {
      fontSize: 44,
      color: theme.colors.onGold,
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    title: {
      color: theme.colors.onGold,
      fontFamily: theme.fonts.display,
      fontSize: 26,
      lineHeight: 36,
      // Anton pega el glifo al borde superior de su caja; includeFontPadding:false
      // + translateY lo centra frente al icono de al lado (mismo patrón que
      // heroComparePct en CardioScreen).
      includeFontPadding: false,
      transform: [{ translateY: 4 }],
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    iconCompact: {
      fontSize: 38,
    },
    subtitle: {
      flexShrink: 1,
      color: theme.colors.onGold,
      fontFamily: theme.fonts.display,
      fontSize: 17,
      lineHeight: 24,
      includeFontPadding: true,
      letterSpacing: 0.6,
      textAlign: 'center',
      opacity: 0.85,
    },
    // Subtítulo y, si lo hay, su botón "Cambiar" en la misma fila.
    subtitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 4,
      maxWidth: '100%',
    },
    // "Cambiar": cápsula sobre el oro con el velo de la propia hero (el mismo
    // que el círculo del icono), tinta `onGold`. Tiene forma de botón a
    // propósito: es una acción distinta de la tarjeta.
    changeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.onGoldVeil,
    },
    changeChipPressed: {
      opacity: 0.7,
    },
    changeChipText: {
      color: theme.colors.onGold,
      fontSize: 13,
      fontWeight: '800',
    },
    // Referencias bajo el título, separadas con el velo de la propia hero. El
    // margen negativo les devuelve parte del padding lateral de la tarjeta:
    // son tres columnas con rótulo ("media diaria"), y con los 24 de padding
    // no les cabía el texto.
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      marginTop: 8,
      marginHorizontal: -16,
    },
    stat: { flex: 1, alignItems: 'center' },
    statDivider: {
      width: 1,
      height: 26,
      backgroundColor: theme.colors.onGoldVeil,
    },
    statValue: {
      color: theme.colors.onGold,
      fontSize: 15,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    statUnit: {
      fontSize: 11,
      fontWeight: '700',
    },
    statLabel: {
      color: theme.colors.onGold,
      fontSize: 11,
      fontWeight: '600',
      opacity: 0.8,
      marginTop: 1,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
