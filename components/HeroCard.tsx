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
  subtitle?: string;
  onPress: () => void;
}

// Paletas de gradiente por estado. El orden es claro→base→oscuro (diagonal).
const GRADIENTS: Record<HeroVariant, [string, string, string]> = {
  start: ['#F9D85A', '#F7CC3D', '#E0B226'],
  completed: ['#7CD99A', '#52C878', '#3DA866'],
  'week-completed': ['#F9D85A', '#F2B33D', '#E08A26'],
  closed: ['#F59898', '#F06A6A', '#D85151'],
  add: ['#FFC97A', '#FFB347', '#F2982C'],
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function HeroCard({
  variant,
  icon,
  title,
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
          colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.sheen}
          pointerEvents="none"
        />

        <View style={styles.iconWrap}>
          <MaterialCommunityIcons
            name={icon as any}
            size={38}
            style={styles.icon}
          />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
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
    paddingVertical: 25,
    paddingHorizontal: 24,
    alignItems: 'center',
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 19, 24, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 40,
    color: theme.colors.darkGray,
  },
  title: {
    color: theme.colors.darkGray,
    fontFamily: theme.fonts.display,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    color: theme.colors.darkGray,
    fontFamily: theme.fonts.display,
    fontSize: 17,
    letterSpacing: 0.6,
    textAlign: 'center',
    opacity: 0.85,
  },
});
