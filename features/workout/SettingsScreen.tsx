import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ConfirmModal,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  StretchScrollView,
  WhatsNewModal,
} from '@components';
import { theme, themeMode } from '@lib/theme';
import { t, language } from '@lib/i18n';
import {
  Language,
  ThemeMode,
  restartApp,
  setStoredLanguage,
  setStoredThemeMode,
} from '@lib/appSettings';
import { CHANGELOG } from '@data/changelog';

interface SettingsScreenProps {
  onBack: () => void;
}

// Cambio pendiente de confirmar: tema o idioma (se aplican reiniciando).
type PendingChange =
  | { kind: 'theme'; value: ThemeMode }
  | { kind: 'language'; value: Language };

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(
    null
  );
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const floatingBackBottom =
    Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding =
    floatingBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;

  const latestChangelog = CHANGELOG[0] ?? null;

  const handleConfirmChange = () => {
    if (!pendingChange) return;
    if (pendingChange.kind === 'theme') {
      setStoredThemeMode(pendingChange.value);
    } else {
      setStoredLanguage(pendingChange.value);
    }
    setPendingChange(null);
    // Relanza el bundle para que theme.ts/i18n.ts se reevalúen con el nuevo valor.
    restartApp();
  };

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
          <View style={styles.optionRow}>
            {themeOptions.map((option) => {
              const active = themeMode === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    styles.option,
                    active && styles.optionActive,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (!active) {
                      setPendingChange({ kind: 'theme', value: option.value });
                    }
                  }}
                >
                  <MaterialCommunityIcons
                    name={option.icon}
                    size={22}
                    color={
                      active ? theme.colors.primary : theme.colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.optionLabel,
                      active && styles.optionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
          <View style={styles.optionRow}>
            {languageOptions.map((option) => {
              const active = language === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    styles.option,
                    active && styles.optionActive,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (!active) {
                      setPendingChange({
                        kind: 'language',
                        value: option.value,
                      });
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      active && styles.optionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.sectionHint}>
            {t('El cambio de tema o idioma reinicia la app.')}
          </Text>
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

      <ConfirmModal
        visible={pendingChange !== null}
        title={
          pendingChange?.kind === 'language'
            ? t('Cambiar idioma')
            : t('Cambiar tema')
        }
        message={t(
          'La app se reiniciará para aplicar el cambio. Tus datos no se tocan.'
        )}
        confirmLabel={t('Aplicar')}
        confirmVariant="primary"
        onConfirm={handleConfirmChange}
        onCancel={() => setPendingChange(null)}
      />

      <WhatsNewModal
        visible={showWhatsNew}
        entry={latestChangelog}
        onClose={() => setShowWhatsNew(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    lineHeight: 26,
  },
  sectionHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  optionActive: {
    borderColor: theme.colors.primaryLine,
    backgroundColor: theme.colors.primaryMuted,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  optionLabelActive: {
    color: theme.colors.primary,
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
