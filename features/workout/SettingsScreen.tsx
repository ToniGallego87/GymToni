import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  OptionToggle,
  StretchScrollView,
  WhatsNewModal,
} from '@components';
import { theme, setThemeMode } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t, language, setLanguage } from '@lib/i18n';
import { Language, ThemeMode } from '@lib/appSettings';
import { CHANGELOG } from '@data/changelog';

interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const floatingBackBottom =
    Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding =
    floatingBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;

  const latestChangelog = CHANGELOG[0] ?? null;

  const themeOptions: {
    value: ThemeMode;
    label: string;
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  }[] = [
    { value: 'dark', label: t('Oscuro'), icon: 'weather-night' },
    { value: 'light', label: t('Claro'), icon: 'white-balance-sunny' },
  ];

  const languageOptions: { value: Language; label: string }[] = [
    { value: 'es', label: 'Español' },
    { value: 'en', label: 'English' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar
        style={theme.statusBarStyle}
        translucent
        backgroundColor="transparent"
      />

      <StretchScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topBarHeight + 28,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionCard}>
          <GradientFill accent={theme.colors.primaryLine} />
          <View style={styles.sectionTitleRow}>
            <MaterialCommunityIcons
              name="theme-light-dark"
              size={18}
              color={theme.colors.text}
            />
            <Text style={styles.sectionTitle}>{t('Tema')}</Text>
          </View>
          {/* Cambio de tema en caliente: se aplica al instante. */}
          <OptionToggle
            options={themeOptions}
            value={theme.mode}
            onChange={setThemeMode}
          />
        </View>

        <View style={styles.sectionCard}>
          <GradientFill accent={theme.colors.primaryLine} />
          <View style={styles.sectionTitleRow}>
            <MaterialCommunityIcons
              name="translate"
              size={18}
              color={theme.colors.text}
            />
            <Text style={styles.sectionTitle}>{t('Idioma')}</Text>
          </View>
          {/* Cambio de idioma en caliente, al instante (como el tema). */}
          <OptionToggle
            options={languageOptions}
            value={language}
            onChange={setLanguage}
          />
        </View>

        {latestChangelog && (
          <Pressable
            style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            onPress={() => setShowWhatsNew(true)}
          >
            <MaterialCommunityIcons
              name="bullhorn-outline"
              size={20}
              color={theme.colors.text}
            />
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkLabel}>{t('Novedades')}</Text>
              <Text style={styles.linkHint}>
                {t('Qué ha cambiado en la versión {v}', {
                  v: latestChangelog.version,
                })}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        )}

        <Text style={styles.versionText}>
          GymBro · {t('Versión')} {Constants.expoConfig?.version ?? '—'}
        </Text>
      </StretchScrollView>

      <GlassTopBar
        title={t('Configuración')}
        icon="cog-outline"
        subtitle={t('Ajusta la app a tu gusto')}
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

      <WhatsNewModal
        visible={showWhatsNew}
        entry={latestChangelog}
        onClose={() => setShowWhatsNew(false)}
      />
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: theme.spacing.md,
      gap: 16,
    },
    sectionCard: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: 12,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      fontSize: 21,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.text,
      lineHeight: 30,
    },
    pressed: {
      opacity: 0.85,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      ...theme.shadow.soft,
    },
    linkTextWrap: {
      flex: 1,
    },
    linkLabel: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 20,
    },
    linkHint: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },
    versionText: {
      marginTop: 4,
      textAlign: 'center',
      fontSize: 12,
      color: theme.colors.textMuted,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
