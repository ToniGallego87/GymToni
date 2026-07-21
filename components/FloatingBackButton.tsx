import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  GLASS_BLUR_INTENSITY,
  GLASS_FLOATING_BG,
  GLASS_FLOATING_BORDER,
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
  label = `← ${t('Volver')}`,
}: FloatingBackButtonProps) {
  // En modo día el botón se pinta como una píldora oscura sólida con texto
  // blanco (en noche ya era cristal oscuro con texto blanco); así destaca sobre
  // el fondo claro en vez de fundirse con él. Se lee en render (no a nivel de
  // módulo) para que el cambio de tema en caliente aplique la variante correcta.
  const isLight = theme.mode === 'light';
  return (
    <Pressable
      style={[
        styles.floatingBackButton,
        isLight && styles.floatingBackButtonLight,
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
      <View
        style={[
          styles.floatingBackGlassOverlay,
          isLight && styles.floatingBackGlassOverlayLight,
        ]}
      />
      <Text
        style={[styles.backButtonText, isLight && styles.backButtonTextLight]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = () => StyleSheet.create({
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
  floatingBackButtonLight: {
    backgroundColor: 'rgba(18, 22, 30, 0.94)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  floatingBackBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingBackGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 12, 16, 0.05)',
    pointerEvents: 'none',
  },
  floatingBackGlassOverlayLight: {
    backgroundColor: 'rgba(10, 13, 18, 0.9)',
  },
  backButtonText: {
    color: theme.colors.white,
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  backButtonTextLight: {
    color: '#F5F7FA',
  },
});

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
