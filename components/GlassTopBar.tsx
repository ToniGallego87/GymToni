import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextStyle,
  ViewStyle,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import {
  GLASS_TOP_BAR_BLUR_INTENSITY,
  GLASS_TOP_BAR_BG,
  GLASS_TOP_BAR_OVERLAY,
} from './glassTokens';

const FrostedBlur = BlurView as unknown as React.ComponentType<any>;

export const GLASS_TOP_BAR_BASE_HEIGHT = 50;

interface GlassTopBarProps {
  title: string;
  /**
   * Icono MaterialCommunityIcons junto al título. Es la forma estándar de
   * titular una pantalla (icono 18px + texto 20/800); usar `titleElement`
   * solo para casos especiales (logo de Inicio, icono de día).
   */
  icon?: string;
  titleElement?: React.ReactNode;
  subtitle?: string;
  topInset: number;
  rightElement?: React.ReactNode;
  titleNumberOfLines?: number;
  subtitleNumberOfLines?: number;
  containerStyle?: ViewStyle;
  titleStyle?: TextStyle;
}

export function GlassTopBar({
  title,
  icon,
  titleElement,
  subtitle,
  topInset,
  rightElement,
  titleNumberOfLines = 1,
  subtitleNumberOfLines = 2,
  containerStyle,
  titleStyle,
}: GlassTopBarProps) {
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + topInset;
  const topBarPaddingTop = topInset + 6;
  const topBarBlurIntensity =
    Platform.OS === 'android'
      ? Math.max(GLASS_TOP_BAR_BLUR_INTENSITY, 72)
      : GLASS_TOP_BAR_BLUR_INTENSITY;

  // La barra crece con el contenido (minHeight) para que títulos de 2 líneas no
  // empujen el subtítulo contra el borde inferior; el paddingBottom garantiza aire.
  return (
    <View
      style={[
        styles.topBarBackground,
        { minHeight: topBarHeight, paddingTop: topBarPaddingTop },
        containerStyle,
      ]}
    >
      <FrostedBlur
        tint="dark"
        intensity={topBarBlurIntensity}
        experimentalBlurMethod="dimezisBlurView"
        style={styles.topBarBlur}
        pointerEvents="none"
      />
      <View style={styles.topBarGlassOverlay} pointerEvents="none" />
      <View style={styles.topBarContent}>
        <View style={styles.topBarRow}>
          <View style={styles.textWrap}>
            {titleElement ? (
              <View style={styles.titleElementWrap}>{titleElement}</View>
            ) : icon ? (
              <View style={styles.iconTitleRow}>
                <MaterialCommunityIcons
                  name={icon as any}
                  size={18}
                  color={theme.colors.text}
                />
                <Text
                  style={[styles.iconTitle, titleStyle]}
                  numberOfLines={titleNumberOfLines}
                >
                  {title}
                </Text>
              </View>
            ) : (
              <Text
                style={[styles.title, titleStyle]}
                numberOfLines={titleNumberOfLines}
              >
                {title}
              </Text>
            )}
            {!!subtitle && (
              <Text
                style={styles.subtitle}
                numberOfLines={subtitleNumberOfLines}
              >
                {subtitle}
              </Text>
            )}
          </View>
          {rightElement}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 25,
    justifyContent: 'flex-start',
    borderBottomWidth: 0,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: GLASS_TOP_BAR_BG,
    overflow: 'hidden',
  },
  topBarBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  topBarGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GLASS_TOP_BAR_OVERLAY,
  },
  topBarContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  textWrap: {
    flex: 1,
  },
  titleElementWrap: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconTitle: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 24,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: 'rgba(235, 239, 245, 0.86)',
    fontStyle: 'italic',
    lineHeight: 19,
  },
});
