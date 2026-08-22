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

export type HeroVariant =
  | 'start'
  | 'completed'
  | 'week-completed'
  | 'closed'
  | 'add';

interface HeroCardProps {
  variant: HeroVariant;
  icon: string;
  title: string;
  titleIcon?: string;
  subtitle?: string;
  onPress: () => void;
  // Dirección de entrada del contenido cuando la tarjeta forma parte de un
  // carrusel: el frame no se mueve, solo el contenido entra desde este lado.
  enterFrom?: 'left' | 'right';
  // Escala de pulsación del carrusel: si viene, la tarjeta la anima y es el
  // carrusel quien escala el conjunto (tarjeta + flechas + puntos).
  pressScale?: SharedValue<number>;
}

/**
 * Altura EXACTA del marco de una hero card. Es fija (no un mínimo) y la
 * comparten las tres tarjetas del carrusel: si una crece con su contenido, el
 * carrusel entero pega un salto al cambiar de página. El contenido va centrado,
 * así que los paddings solo acotan cuánto cabe; la variante con subtítulo se
 * compacta para caber en la misma caja en vez de estirarla.
 */
export const HERO_CARD_HEIGHT = 172;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function HeroCard({
  variant,
  icon,
  title,
  titleIcon,
  subtitle,
  onPress,
  enterFrom,
  pressScale,
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
  const hasSubtitle = !!subtitle;
  const localScale = useSharedValue(1);
  const scale = pressScale ?? localScale;

  // Suelta, la tarjeta se escala a sí misma; en un carrusel escala el conjunto.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale ? 1 : localScale.value }],
  }));

  // Animación de solo el CONTENIDO (icono + textos): el frame (gradiente) queda
  // fijo. En un carrusel el contenido entra deslizándose desde `enterFrom` con
  // un fundido; suelta (sin enterFrom) hace un fundido sutil de entrada.
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
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          // "Semana completada" lleva subtítulo; los puntos del carrusel se
          // superponen abajo, así que se sube el contenido para que la frase no
          // quede pegada a ellos.
          hasSubtitle && styles.gradientWithSubtitle,
        ]}
      >
        {/* Brillo superior (sheen) para dar volumen */}
        <LinearGradient
          colors={theme.gradients.sheen}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.sheen}
          pointerEvents="none"
        />

        <Animated.View style={[styles.content, contentStyle]}>
          <View style={[styles.iconWrap, hasSubtitle && styles.iconWrapCompact]}>
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
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
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
    gradientWithSubtitle: {
      // El hueco de abajo aparta el subtítulo de los puntitos del carrusel (van
      // a 10px del borde inferior de la tarjeta); el de arriba lo compensa para
      // que el bloque siga centrado dentro de la MISMA altura.
      paddingTop: 6,
      paddingBottom: 24,
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
    iconWrap: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: 'rgba(16, 19, 24, 0.16)',
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
      marginTop: 4,
      color: theme.colors.onGold,
      fontFamily: theme.fonts.display,
      fontSize: 17,
      lineHeight: 24,
      includeFontPadding: true,
      letterSpacing: 0.6,
      textAlign: 'center',
      opacity: 0.85,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
