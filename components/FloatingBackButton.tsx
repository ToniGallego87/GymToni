import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { theme } from '@lib/theme';
import {
  GLASS_BLUR_INTENSITY,
  GLASS_FLOATING_BG,
  GLASS_FLOATING_BORDER,
  GLASS_FLOATING_OVERLAY,
} from './glassTokens';

const FrostedBlur = BlurView as unknown as React.ComponentType<any>;

export const FLOATING_BACK_BUTTON_HEIGHT = 58;
export const FLOATING_BACK_BUTTON_MARGIN = 16;

interface FloatingBackButtonProps {
  onPress: () => void;
  bottom: number;
  label?: string;
}

export function FloatingBackButton({
  onPress,
  bottom,
  label = '← Volver',
}: FloatingBackButtonProps) {
  return (
    <Pressable
      style={[
        styles.floatingBackButton,
        {
          left: FLOATING_BACK_BUTTON_MARGIN,
          right: FLOATING_BACK_BUTTON_MARGIN,
          bottom,
          height: FLOATING_BACK_BUTTON_HEIGHT,
        },
      ]}
      onPress={onPress}
    >
      <FrostedBlur
        tint="dark"
        intensity={GLASS_BLUR_INTENSITY}
        experimentalBlurMethod="dimezisBlurView"
        style={styles.floatingBackBlur}
      />
      <View style={styles.floatingBackGlassOverlay} />
      <Text style={styles.backButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floatingBackButton: {
    position: 'absolute',
    zIndex: 30,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: GLASS_FLOATING_BG,
    borderWidth: 1,
    borderColor: GLASS_FLOATING_BORDER,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  floatingBackBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingBackGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 12, 16, 0.05)',
    pointerEvents: 'none',
  },
  backButtonText: {
    color: theme.colors.primary,
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
});
