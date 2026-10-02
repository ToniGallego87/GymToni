import React, { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  GradientFill,
  OptionToggle,
  StretchScrollView,
  ValueStepper,
  WhatsNewModal,
} from '@components';
import { theme, setThemeMode } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t, formatAgo, language, setLanguage } from '@lib/i18n';
import { Language, ThemeMode } from '@lib/appSettings';
import { CHANGELOG } from '@data/changelog';
import {
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
  stepRestDuration,
  useRestDuration,
} from '@lib/restTimerStore';
import { formatRestTime } from '@lib/utils';
import { useSession } from '@lib/cloud/auth';
import { getLastSync } from '@lib/cloud/sync';

interface SettingsScreenProps {
  onBack: () => void;
  onOpenData?: () => void;
}

/**
 * Configuración: los ajustes de la app arriba (tema e idioma, lo que se toca
 * de verdad), luego "Datos y nube" y al pie las novedades de la versión.
 *
 * Ese orden es el de la pregunta que trae aquí a la gente: primero "quiero
 * cambiar algo", después "dónde están mis datos", y por último "qué ha cambiado",
 * que es lectura y no ajuste.
 */
export function SettingsScreen({ onBack, onOpenData }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const { user } = useSession();
  const [lastSync, setLastSync] = useState<number | null>(null);
  // Descanso por defecto entre series (lib/restTimerStore): ajuste de la
  // persona, no de cada rutina. Se toca aquí mismo con dos flechas.
  const restDuration = useRestDuration();

  useEffect(() => {
    if (!user) {
      setLastSync(null);
      return;
    }
    let active = true;
    getLastSync(user.id).then((ts) => {
      if (active) setLastSync(ts);
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Hint dinámico: refleja sesión y última sincronización, para que "mis datos
  // están a salvo" se vea sin entrar.
  const cloudHint = !user
    ? t('Copias, exportar/importar y cuenta en la nube')
    : lastSync
    ? `${t('Sincronizado')} · ${formatAgo(lastSync)}`
    : t('Sesión iniciada');

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { bottom: floatingBackBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

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
            paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP,
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

        {/* Descanso por defecto entre series: un ajuste de la persona de un
            solo valor, así que vive aquí con el tema y el idioma —y con su MISMA
            piel, porque se comporta igual: cambia un valor en el sitio, no lleva
            a otra pantalla. Antes era una fila-enlace con un lápiz que abría un
            modal con un campo de texto, indistinguible de "Datos y nube", que sí
            navega. Se sigue tocando también desde el ⋯ del registro, que es donde
            se nota que se queda corto. */}
        <View style={styles.sectionCard}>
          <GradientFill accent={theme.colors.primaryLine} />
          <View style={styles.sectionTitleRow}>
            <MaterialCommunityIcons
              name="timer-sand"
              size={18}
              color={theme.colors.text}
            />
            <Text style={styles.sectionTitle}>
              {t('Temporizador de descanso')}
            </Text>
          </View>
          <ValueStepper
            label={t('Temporizador de descanso')}
            value={formatRestTime(restDuration)}
            atMin={restDuration <= MIN_REST_SECONDS}
            atMax={restDuration >= MAX_REST_SECONDS}
            onDecrement={() => stepRestDuration(-1)}
            onIncrement={() => stepRestDuration(1)}
          />
          <Text style={styles.sectionHint}>
            {t('Entre series, en saltos de 30 s (de 0:00 a 5:00)')}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
          onPress={onOpenData}
        >
          <View style={styles.linkIconWrap}>
            <MaterialCommunityIcons
              name="folder-cog-outline"
              size={20}
              color={theme.colors.text}
            />
            {/* Punto verde: hay sesión de nube activa. */}
            {!!user && <View style={styles.statusDot} />}
          </View>
          <View style={styles.linkTextWrap}>
            <Text style={styles.linkLabel}>{t('Datos y nube')}</Text>
            <Text style={styles.linkHint}>{cloudHint}</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={theme.colors.textSecondary}
          />
        </Pressable>

        {latestChangelog && (
          <Pressable
            style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            onPress={() => setShowWhatsNew(true)}
          >
            <View style={styles.linkIconWrap}>
              <MaterialCommunityIcons
                name="bullhorn-outline"
                size={20}
                color={theme.colors.text}
              />
            </View>
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
        onLayout={onTopBarLayout}
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
      flexShrink: 1,
      fontSize: 21,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.text,
      lineHeight: 30,
    },
    // Aclaración bajo un control de la tarjeta (el rango del temporizador).
    sectionHint: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
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
    // Hueco fijo del icono: las dos filas (nube y novedades) alinean su texto
    // aunque una lleve el punto de estado encima.
    linkIconWrap: {
      width: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusDot: {
      position: 'absolute',
      top: -3,
      right: -3,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: theme.colors.success,
      borderWidth: 1.5,
      borderColor: theme.colors.surface,
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
