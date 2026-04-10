import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
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
  const topBarPaddingTop = Math.max(topInset - 16, 0);
  const sharedFrameStyle = { height: topBarHeight };
  const topBarBlurIntensity = Platform.OS === 'android'
    ? Math.max(GLASS_TOP_BAR_BLUR_INTENSITY, 72)
    : GLASS_TOP_BAR_BLUR_INTENSITY;
  const foregroundContent = (
    <View style={[styles.topBarForeground, sharedFrameStyle, { paddingTop: topBarPaddingTop }]}>
      <View style={styles.topBarContent}>
        <View style={styles.topBarRow}>
          <View style={styles.textWrap}>
            {titleElement ? (
              <View style={styles.titleElementWrap}>{titleElement}</View>
            ) : (
              <Text style={[styles.title, titleStyle]} numberOfLines={titleNumberOfLines}>
                {title}
              </Text>
            )}
            {!!subtitle && (
              <Text style={styles.subtitle} numberOfLines={subtitleNumberOfLines}>
                {subtitle}
              </Text>
            )}
          </View>
          {rightElement}
        </View>
      </View>
    </View>
  );

  return (
    <>
      <View
        style={[styles.topBarBackground, sharedFrameStyle, containerStyle]}
        pointerEvents="none"
      >
        <FrostedBlur
          tint="dark"
          intensity={topBarBlurIntensity}
          experimentalBlurMethod="dimezisBlurView"
          style={styles.topBarBlur}
        />
        <View style={styles.topBarGlassOverlay} />
      </View>
      {foregroundContent}
    </>
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
  topBarForeground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 26,
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
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: 'rgba(235, 239, 245, 0.86)',
    fontStyle: 'italic',
    lineHeight: 19,
  },
});
