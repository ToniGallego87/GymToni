import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  getFloatingPrimaryNavMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  RestTimerModal,
  StretchScrollView,
} from '@components';
import { useWorkout } from '@hooks/useWorkout';
import { hasProfileFilled, useMyProfile } from '@hooks/useMyProfile';
import { useSession } from '@lib/cloud/auth';
import { cardioSessionFromLog } from '@lib/cardio';
import { setRestDuration, useRestDuration } from '@lib/restTimerStore';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { formatRestTime } from '@lib/utils';

interface ProfileScreenProps {
  onOpenRoutines?: () => void;
  onOpenExerciseProgress?: () => void;
  // Peso corporal: se edita aquí, no en el carrusel de Cardio (se toca una vez
  // cada varias semanas y allí ocupaba media hero).
  onOpenBodyWeight?: () => void;
  onOpenSettings?: () => void;
  onOpenProfileEdit?: () => void;
  // Pantalla de cuenta (Datos y nube): sin sesión no hay perfil público que
  // completar, así que la tarjeta lleva a crearla en vez de al formulario.
  onOpenAccount?: () => void;
}

type MenuEntry = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  hint: string;
  onPress?: () => void;
};

/**
 * Perfil: quién eres (foto, nombre y bio del perfil público), tus números y las
 * tres pantallas que cuelgan de aquí (rutinas, progreso y configuración).
 *
 * La cabecera es lo primero porque es lo que da nombre a la pantalla: antes
 * "Perfil" abría en un recuento de rutinas y entrenamientos y el perfil público
 * —el que ve la gente en Comunidad— solo se editaba desde allí, así que no había
 * ningún sitio donde verse a uno mismo. Los ajustes vuelven a su pantalla:
 * apilados aquí abajo estiraban Perfil con dos selectores que se tocan una vez
 * al año.
 */
export function ProfileScreen({
  onOpenRoutines,
  onOpenExerciseProgress,
  onOpenBodyWeight,
  onOpenSettings,
  onOpenProfileEdit,
  onOpenAccount,
}: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  const { user, loading: sessionLoading } = useSession();
  const { profile, loading: profileLoading } = useMyProfile();
  const isProfileFilled = hasProfileFilled(profile);
  // Primera carga sin nada que enseñar (ni copia local ni respuesta todavía):
  // no se puede decir "Sin perfil" porque aún no se sabe. Con copia local esto
  // no llega a verse; solo pasa en el primer arranque tras iniciar sesión. La
  // sesión cuenta también: hasta que se resuelve no se sabe si hay cuenta.
  const profileUnknown = (sessionLoading || profileLoading) && !profile;
  // Sin cuenta no hay perfil público: el formulario se abriría para nada (el
  // "Guardar" sale desactivado). La tarjeta lo dice aquí y lleva a la cuenta.
  const hasAccount = !!user;

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { scrollBottomPadding } = getFloatingPrimaryNavMetrics(insets.bottom);

  const cardioSessionsCount = state.logs.filter(
    (l) => cardioSessionFromLog(l) != null
  ).length;

  // Descanso entre series: ajuste de la PERSONA, así que se edita aquí (antes
  // vivía en cada rutina y había que repetirlo al crear o copiar una). Mismo
  // diálogo que abre el ⋯ del registro; los dos escriben en el mismo sitio.
  const restDuration = useRestDuration();
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerInput, setTimerInput] = useState('');

  const handleOpenTimerModal = () => {
    setTimerInput(String(restDuration));
    setShowTimerModal(true);
  };

  const handleSaveTimer = () => {
    const seconds = parseInt(timerInput, 10);
    if (!isNaN(seconds) && seconds > 0) setRestDuration(seconds);
    setShowTimerModal(false);
    setTimerInput('');
  };

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
      icon: 'scale-bathroom',
      label: t('Peso corporal'),
      hint: t('Actualízalo y mira cómo ha ido cambiando'),
      onPress: onOpenBodyWeight,
    },
    {
      icon: 'timer-sand',
      label: t('Temporizador de descanso'),
      hint: t('{time} entre series, en todas tus rutinas', {
        time: formatRestTime(restDuration),
      }),
      onPress: handleOpenTimerModal,
    },
    {
      icon: 'cog-outline',
      label: t('Configuración'),
      hint: t('Tema, idioma, tus datos en la nube y novedades'),
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
        {/* ── Quién eres ──────────────────────────────────────────────────── */}
        <View style={styles.identityCard}>
          <GradientFill accent={theme.colors.primaryLine} />
          <View style={styles.identityRow}>
            <Avatar uri={profile?.avatar_url} size={72} />
            <View style={styles.identityTextWrap}>
              <Text style={styles.identityName} numberOfLines={2}>
                {profileUnknown
                  ? t('Cargando…')
                  : isProfileFilled
                  ? profile?.display_name
                  : hasAccount
                  ? t('Sin perfil')
                  : t('Sin cuenta')}
              </Text>
              {!profileUnknown && (
                <Text style={styles.identityBio} numberOfLines={3}>
                  {isProfileFilled
                    ? profile?.bio?.trim() ||
                      t('Sin biografía: cuéntale a la gente qué entrenas.')
                    : hasAccount
                    ? t(
                        'Tu foto y tu nombre son lo que ve la gente en Comunidad.'
                      )
                    : t(
                        'El perfil público vive en tu cuenta: sin ella no se puede completar. Créala en Datos y nube.'
                      )}
                </Text>
              )}
            </View>
          </View>
          {/* Un solo botón, y dice lo que toca: editar si ya hay perfil,
              completarlo si aún no lo hay, y crear la cuenta si ni eso: sin
              ella el formulario no puede guardar. Mientras no se sabe cuál de
              los casos es, el botón no invita a "completar" un perfil que
              puede existir ya: espera desactivado. */}
          <Button
            title={
              profileUnknown
                ? t('Cargando…')
                : isProfileFilled
                ? t('Editar perfil')
                : hasAccount
                ? t('Completar perfil')
                : t('Crear cuenta')
            }
            variant={
              isProfileFilled || profileUnknown ? 'secondary' : 'primary'
            }
            size="medium"
            disabled={profileUnknown}
            onPress={() =>
              hasAccount ? onOpenProfileEdit?.() : onOpenAccount?.()
            }
          />
        </View>

        {/* ── Tus números ─────────────────────────────────────────────────── */}
        {/* Sin título: tres cifras rotuladas no necesitan que las presenten, y
            el "Resumen" con su icono ocupaba una línea entera de la primera
            pantalla. Los números bajan de 32 a 24: son contexto, no el héroe. */}
        <View style={styles.summaryCard}>
          <GradientFill accent={theme.colors.primaryLine} />
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

        {/* ── A dónde ir ──────────────────────────────────────────────────── */}
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
      </StretchScrollView>

      <GlassTopBar
        title={t('Perfil')}
        icon="account-circle-outline"
        subtitle={t('Tu rutina, tus datos y la configuración')}
        topInset={insets.top}
      />

      <RestTimerModal
        visible={showTimerModal}
        value={timerInput}
        onChangeValue={setTimerInput}
        onSave={handleSaveTimer}
        onCancel={() => setShowTimerModal(false)}
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

    // Cabecera: foto + nombre + bio + su botón.
    identityCard: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: 14,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    identityTextWrap: {
      flex: 1,
      gap: 3,
    },
    identityName: {
      fontSize: 22,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.text,
      lineHeight: 30,
    },
    identityBio: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },

    // Números. Sin título propio ni icono: los rótulos ya nombran cada cifra.
    summaryCard: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 14,
      overflow: 'hidden',
      ...theme.shadow.soft,
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
      fontSize: 24,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.5,
      color: theme.colors.primary,
      lineHeight: 33,
    },
    summaryLabel: {
      marginTop: 2,
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
      textAlign: 'center',
    },
    summaryDivider: {
      width: 1,
      height: 34,
      backgroundColor: theme.colors.border,
    },

    // Menú
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
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
