import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FloatingPrimaryNav,
  getFloatingPrimaryNavMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  StretchScrollView,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { hasAnyCardio, cardioSessionFromLog } from '@lib/cardio';
import { theme } from '@lib/theme';
import { t, formatAgo } from '@lib/i18n';
import { useSession } from '@lib/cloud/auth';
import { getLastSync } from '@lib/cloud/sync';

interface ProfileScreenProps {
  onOpenRoutines?: () => void;
  onOpenExerciseProgress?: () => void;
  onOpenData?: () => void;
  onOpenCloud?: () => void;
  onOpenSettings?: () => void;
  onNavigateHome?: () => void;
  onNavigateCardio?: () => void;
  onNavigateCalendar?: () => void;
  onNavigateCommunity?: () => void;
  onNavigateProfile?: () => void;
}

type MenuEntry = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  hint: string;
  onPress?: () => void;
  // Punto de estado sobre el icono (verde = sesión de nube iniciada).
  statusDot?: boolean;
};

export function ProfileScreen({
  onOpenRoutines,
  onOpenExerciseProgress,
  onOpenData,
  onOpenCloud,
  onOpenSettings,
  onNavigateHome,
  onNavigateCardio,
  onNavigateCalendar,
  onNavigateCommunity,
  onNavigateProfile,
}: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  // Estado de la nube para mostrarlo ya en el menú (sin abrir "Cuenta y nube").
  const { user } = useSession();
  const [lastSync, setLastSync] = useState<number | null>(null);

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

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { bottom: floatingNavBottom, scrollBottomPadding } =
    getFloatingPrimaryNavMetrics(insets.bottom);

  const cardioSessionsCount = state.logs.filter(
    (l) => cardioSessionFromLog(l) != null
  ).length;

  // Hint dinámico de "Cuenta y nube": refleja sesión y última sincronización, de
  // modo que "mis datos están a salvo" se vea de un vistazo desde el menú.
  const cloudHint = !user
    ? t('Guarda tus datos en la nube y sincroniza')
    : lastSync
    ? `${t('Sincronizado')} · ${formatAgo(lastSync)}`
    : t('Sesión iniciada');

  const menu: MenuEntry[] = [
    {
      icon: 'book-open-variant',
      label: t('Mis rutinas'),
      hint: t('Consulta, comparte o cambia de rutina'),
      onPress: onOpenRoutines,
    },
    {
      icon: 'chart-line',
      label: t('Progreso por ejercicio'),
      hint: t('Tu evolución y tus récords, ejercicio a ejercicio'),
      onPress: onOpenExerciseProgress,
    },
    {
      icon: 'folder-cog-outline',
      label: t('Datos'),
      hint: t('Exporta, importa o borra (copia local)'),
      onPress: onOpenData,
    },
    {
      icon: 'cloud-outline',
      label: t('Cuenta y nube'),
      hint: cloudHint,
      onPress: onOpenCloud,
      statusDot: !!user,
    },
    {
      icon: 'cog-outline',
      label: t('Configuración'),
      hint: t('Tema, idioma y novedades'),
      onPress: onOpenSettings,
    },
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
        <View style={styles.summaryCard}>
          <GradientFill accent={theme.colors.primaryLine} />
          <View style={styles.titleRow}>
            <MaterialCommunityIcons
              name="chart-box-outline"
              size={18}
              color={theme.colors.text}
            />
            <Text style={styles.summaryTitle}>{t('Resumen')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{state.routines.length}</Text>
              <Text style={styles.summaryLabel}>{t('Rutinas')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{state.logs.length}</Text>
              <Text style={styles.summaryLabel}>{t('Entrenamientos')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{cardioSessionsCount}</Text>
              <Text style={styles.summaryLabel}>{t('Sesiones cardio')}</Text>
            </View>
          </View>
        </View>

        {menu.map((entry) => (
          <Pressable
            key={entry.label}
            style={({ pressed }) => [
              styles.menuRow,
              pressed && styles.menuRowPressed,
            ]}
            onPress={entry.onPress}
          >
            <View style={styles.menuIconWrap}>
              <MaterialCommunityIcons
                name={entry.icon}
                size={22}
                color={theme.colors.text}
              />
              {entry.statusDot && <View style={styles.statusDot} />}
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuLabel}>{entry.label}</Text>
              <Text style={styles.menuHint}>{entry.hint}</Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        ))}

        <Text style={styles.versionText}>
          GymBro · {t('Versión')} {Constants.expoConfig?.version ?? '—'}
        </Text>
      </StretchScrollView>

      <GlassTopBar
        title={t('Perfil')}
        icon="account-circle-outline"
        subtitle={t('Tu rutina, tus datos y la configuración')}
        topInset={insets.top}
      />

      {/* Barra de navegación fija en app/App.tsx (fuera del pager). */}
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
      gap: 12,
    },
    summaryCard: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      marginBottom: 8,
      gap: 12,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    summaryTitle: {
      fontSize: 21,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.text,
      lineHeight: 30,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryValue: {
      fontSize: 32,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.5,
      color: theme.colors.primary,
      lineHeight: 45,
    },
    summaryLabel: {
      marginTop: 4,
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 17,
      textAlign: 'center',
    },
    summaryDivider: {
      width: 1,
      height: 42,
      backgroundColor: theme.colors.border,
    },
    menuRow: {
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
    menuRowPressed: {
      opacity: 0.8,
    },
    menuIconWrap: {
      width: 40,
      height: 40,
      borderRadius: theme.borderRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
    },
    // Punto verde de "sesión de nube activa" en la esquina del icono.
    statusDot: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: theme.colors.success,
      borderWidth: 1.5,
      borderColor: theme.colors.surface,
    },
    menuTextWrap: {
      flex: 1,
    },
    menuLabel: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 22,
    },
    menuHint: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },
    versionText: {
      marginTop: 8,
      textAlign: 'center',
      fontSize: 12,
      color: theme.colors.textMuted,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
