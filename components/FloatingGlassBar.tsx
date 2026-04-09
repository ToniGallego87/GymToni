import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { theme } from '@lib/theme';
import {
  GLASS_BLUR_INTENSITY,
  GLASS_FLOATING_BG,
  GLASS_FLOATING_BORDER,
  GLASS_FLOATING_HIGHLIGHT,
  GLASS_FLOATING_INNER_STROKE,
  GLASS_FLOATING_OVERLAY,
} from './glassTokens';

const FrostedBlur = BlurView as unknown as React.ComponentType<any>;

export const FLOATING_GLASS_BAR_HEIGHT = 72;
export const FLOATING_GLASS_BAR_MARGIN = 16;

interface FloatingGlassBarProps {
  bottom: number;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function FloatingGlassBar({ bottom, children, style }: FloatingGlassBarProps) {
  return (
    <View
      style={[
        styles.container,
        {
          left: FLOATING_GLASS_BAR_MARGIN,
          right: FLOATING_GLASS_BAR_MARGIN,
          bottom,
          minHeight: FLOATING_GLASS_BAR_HEIGHT,
        },
        style,
      ]}
    >
      <FrostedBlur
        tint="dark"
        intensity={GLASS_BLUR_INTENSITY}
        experimentalBlurMethod="dimezisBlurView"
        style={styles.blur}
      />
      <View style={styles.overlay} />
      <View style={styles.topHighlight} />
      <View style={styles.innerStroke} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 30,
    borderRadius: 28,
    backgroundColor: GLASS_FLOATING_BG,
    borderWidth: 1,
    borderColor: GLASS_FLOATING_BORDER,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 14,
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GLASS_FLOATING_OVERLAY,
    pointerEvents: 'none',
  },
  topHighlight: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 0,
    height: 1,
    backgroundColor: GLASS_FLOATING_HIGHLIGHT,
    opacity: 0.9,
    pointerEvents: 'none',
  },
  innerStroke: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: 1,
    bottom: 1,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: GLASS_FLOATING_INNER_STROKE,
    pointerEvents: 'none',
  },
  content: {
    paddingHorizontal: 8,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
