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
}

// Paletas de gradiente por estado. El orden es claro→base→oscuro (diagonal).
// La hero card de Fuerza se mantiene siempre en amarillo/dorado, también
// completado el entrenamiento o cerrada la rutina (consistente con la de Cardio).
const GRADIENTS: Record<HeroVariant, [string, string, string]> = {
  start: theme.gradients.primary,
  completed: theme.gradients.primary,
  'week-completed': theme.gradients.amber,
  closed: theme.gradients.primary,
  add: theme.gradients.warning,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function HeroCard({
  variant,
  icon,
  title,
  titleIcon,
  subtitle,
  onPress,
  enterFrom,
}: HeroCardProps) {
  const colors = GRADIENTS[variant];
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
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

        <Animated.View style={[styles.content, contentStyle]}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons
              name={icon as any}
              size={44}
              style={styles.icon}
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

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadow.card,
  },
  gradient: {
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 172,
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
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16, 19, 24, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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
  subtitle: {
    marginTop: 8,
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
