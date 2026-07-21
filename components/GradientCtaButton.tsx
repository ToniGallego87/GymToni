import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { theme } from '@lib/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface GradientCtaButtonProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

// Botón principal estilo HeroCard (gradiente dorado + sheen, con encogido al
// pulsar): el CTA de "Guardar" del registro y de "Crear rutina", coherente con
// la hero de Inicio.
export function GradientCtaButton({
  icon,
  title,
  onPress,
  style,
}: GradientCtaButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.wrapper, animatedStyle, style]}
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
        style={styles.gradient}
      >
        <LinearGradient
          colors={theme.gradients.sheen}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.sheen}
          pointerEvents="none"
        />
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={theme.colors.onGold}
        />
        <Text style={styles.text}>{title}</Text>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const makeStyles = () => StyleSheet.create({
  wrapper: {
    borderRadius: theme.borderRadius.lg,
    ...theme.shadow.card,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 18,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  text: {
    color: theme.colors.onGold,
    fontFamily: theme.fonts.display,
    fontSize: 22,
    letterSpacing: 0.5,
    // Anton pega los glifos al borde superior de su caja de línea; con
    // includeFontPadding y lineHeight holgado se reserva sitio y no se corta.
    lineHeight: 30,
    includeFontPadding: true,
  },
});

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
