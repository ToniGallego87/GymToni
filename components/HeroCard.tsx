import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
}

// Paletas de gradiente por estado. El orden es claro→base→oscuro (diagonal).
const GRADIENTS: Record<HeroVariant, [string, string, string]> = {
  start: theme.gradients.primary,
  completed: theme.gradients.success,
  'week-completed': theme.gradients.amber,
  closed: theme.gradients.danger,
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
}: HeroCardProps) {
  const colors = GRADIENTS[variant];
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
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
              color={theme.colors.darkGray}
            />
          )}
        </View>
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
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
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16, 19, 24, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  icon: {
    fontSize: 44,
    color: theme.colors.darkGray,
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
    color: theme.colors.darkGray,
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
    color: theme.colors.darkGray,
    fontFamily: theme.fonts.display,
    fontSize: 17,
    lineHeight: 24,
    includeFontPadding: true,
    letterSpacing: 0.6,
    textAlign: 'center',
    opacity: 0.85,
  },
});
