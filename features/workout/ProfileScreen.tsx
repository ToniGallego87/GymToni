import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  getFloatingPrimaryNavMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  LevelPill,
  RestTimerModal,
  StretchScrollView,
} from '@components';
import { useAccountLevel } from '@hooks/useAccountLevel';
import { useWorkout } from '@hooks/useWorkout';
import { ProfileEditModal } from './ProfileEditModal';
import { hasProfileFilled, useMyProfile } from '@hooks/useMyProfile';
import { useSession } from '@lib/cloud/auth';
import { cardioSessionFromLog } from '@lib/cardio';
import { setRestDuration, useRestDuration } from '@lib/restTimerStore';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';

interface ProfileScreenProps {
  onOpenRoutines?: () => void;
  onOpenExerciseProgress?: () => void;
  // Peso corporal: se edita aquí, no en el carrusel de Cardio (se toca una vez
  // cada varias semanas y allí ocupaba media hero).
  onOpenBodyWeight?: () => void;
  // Logros: insignias que se desbloquean con el histórico de entrenos.
  onOpenAchievements?: () => void;
  onOpenSettings?: () => void;
  // Pantalla de cuenta (Datos y nube): sin sesión no hay perfil público que
  // completar, así que la tarjeta lleva a crearla en vez de al formulario.
  onOpenAccount?: () => void;
}

// Cuadrícula del menú: separación entre casillas, margen a los lados (para
// que el cuadrado sea algo más pequeño que el ancho del tercio) y el rango de
// letra. `MENU_CHAR_WIDTH` es el ancho medio de un carácter en em con la
// negrita del sistema: sirve para estimar cuánto ocupa la etiqueta.
const MENU_GAP = 12;
const MENU_INSET = 8;
const MENU_TILE_PADDING = 8;
const MENU_FONT_MIN = 12;
const MENU_FONT_MAX = 16;
const MENU_CHAR_WIDTH = 0.6;

type MenuEntry = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
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
  onOpenAchievements,
  onOpenSettings,
  onOpenAccount,
}: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  // Nivel de la cuenta: lo permanente que dejan los retos y los logros.
  const { level } = useAccountLevel();
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
  // El perfil público se edita en un popup sobre esta pantalla.
  const [showProfileEdit, setShowProfileEdit] = useState(false);

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

  // Seis casillas, tres por fila: icono + nombre corto. Sin subtítulos: una
  // cuadrícula se lee de un vistazo y cabe sin scroll junto a la identidad.
  const menu: MenuEntry[] = [
    { icon: 'book-open-variant', label: t('Rutinas'), onPress: onOpenRoutines },
    {
      icon: 'chart-line',
      label: t('Ejercicios'),
      onPress: onOpenExerciseProgress,
    },
    { icon: 'scale-bathroom', label: t('Peso'), onPress: onOpenBodyWeight },
    {
      icon: 'timer-sand',
      label: t('Temporizador'),
      onPress: handleOpenTimerModal,
    },
    { icon: 'cog-outline', label: t('Configuración'), onPress: onOpenSettings },
    { icon: 'trophy-outline', label: t('Logros'), onPress: onOpenAchievements },
  ];
  const menuRows: MenuEntry[][] = [];
  for (let i = 0; i < menu.length; i += 3) menuRows.push(menu.slice(i, i + 3));

  // Un solo tamaño de letra para las seis casillas: el mayor con el que cabe
  // la etiqueta más larga en una línea. Con `adjustsFontSizeToFit` cada casilla
  // encogía la suya y "Configuración" salía más pequeño que "Peso".
  const { width: windowWidth } = useWindowDimensions();
  const tileWidth =
    (windowWidth - theme.spacing.md * 2 - MENU_INSET * 2 - MENU_GAP * 2) / 3;
  const longestLabel = Math.max(...menu.map((entry) => entry.label.length));
  const menuFontSize = Math.max(
    MENU_FONT_MIN,
    Math.min(
      MENU_FONT_MAX,
      (tileWidth - MENU_TILE_PADDING * 2) / (longestLabel * MENU_CHAR_WIDTH)
    )
  );

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
          {/* Editar (o completar) el perfil público: solo con cuenta, que es
              donde vive. Arriba a la derecha de la tarjeta, junto al nombre.
              Mientras no se sabe si hay perfil, espera desactivado. */}
          {hasAccount && (
            <Pressable
              style={({ pressed }) => [
                styles.editButton,
                pressed && styles.menuTilePressed,
              ]}
              onPress={() => setShowProfileEdit(true)}
              disabled={profileUnknown}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={
                isProfileFilled ? t('Editar perfil') : t('Completar perfil')
              }
            >
              <MaterialCommunityIcons
                name={isProfileFilled ? 'pencil' : 'account-plus-outline'}
                size={18}
                color={theme.colors.primary}
              />
            </Pressable>
          )}
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
              <LevelPill level={level.level} />
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
          {/* Sin cuenta el perfil público no se puede completar: el único
              botón del cuerpo es el que lleva a crearla. Con cuenta, editar
              vive en el lápiz de la barra superior. */}
          {!profileUnknown && !hasAccount && (
            <Button
              title={t('Crear cuenta')}
              variant="primary"
              size="medium"
              onPress={() => onOpenAccount?.()}
            />
          )}

          {/* ── Tus números, en la misma tarjeta ──────────────────────────── */}
          {/* Sin título: tres cifras rotuladas no necesitan que las presenten.
              Los números van a 24: son contexto, no el héroe. */}
          <View style={styles.summaryDividerLine} />
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
        {menuRows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.menuGridRow}>
            {row.map((entry) => (
              <Pressable
                key={entry.label}
                style={({ pressed }) => [
                  styles.menuTile,
                  pressed && styles.menuTilePressed,
                ]}
                onPress={entry.onPress}
                accessibilityRole="button"
                accessibilityLabel={entry.label}
              >
                {/* Icono y texto ocupan la casilla: es lo que se toca a diario. */}
                <MaterialCommunityIcons
                  name={entry.icon}
                  size={38}
                  color={theme.colors.text}
                />
                <Text
                  style={[styles.menuLabel, { fontSize: menuFontSize }]}
                  numberOfLines={1}
                >
                  {entry.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </StretchScrollView>

      <GlassTopBar
        title={t('Perfil')}
        icon="account-circle-outline"
        subtitle={t('Tu rutina, tus datos y la configuración')}
        topInset={insets.top}
      />

      <ProfileEditModal
        visible={showProfileEdit}
        onClose={() => setShowProfileEdit(false)}
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

    // Cabecera: foto + nombre + bio, y debajo las cifras, en una sola tarjeta.
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
      // Deja sitio al lápiz de la esquina.
      paddingRight: 36,
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

    // Lápiz de la tarjeta: misma píldora que el "Editar" de la ficha de rutina,
    // en la esquina superior derecha, a la altura del nombre.
    editButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 1,
      width: 34,
      height: 34,
      borderRadius: theme.borderRadius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
    },

    // Números. Sin título propio ni icono: los rótulos ya nombran cada cifra.
    summaryDividerLine: {
      height: 1,
      backgroundColor: theme.colors.border,
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

    // Menú: cuadrícula de casillas cuadradas, tres por fila, con el mismo
    // radio, borde y sombra que las tarjetas de arriba.
    menuGridRow: {
      flexDirection: 'row',
      gap: MENU_GAP,
      marginHorizontal: MENU_INSET,
    },
    menuTile: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: MENU_TILE_PADDING,
      ...theme.shadow.soft,
    },
    menuTilePressed: {
      opacity: 0.8,
    },
    menuLabel: {
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 20,
      textAlign: 'center',
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
