import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useState } from 'react';
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
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  GradientFill,
  LevelPill,
  getMenuTileWidth,
  MENU_TILE_GAP,
  MENU_TILE_INSET,
  MENU_TILE_PADDING,
  StretchScrollView,
} from '@components';
import { useAccountLevel } from '@hooks/useAccountLevel';
import { useWorkout } from '@hooks/useWorkout';
import { ProfileEditModal } from './ProfileEditModal';
import { hasProfileFilled, useMyProfile } from '@hooks/useMyProfile';
import { useAvatarPicker } from '@hooks/useAvatarPicker';
import { useSession } from '@lib/cloud/auth';
import { cardioSessionFromLog, isCardioOnlyLog } from '@lib/cardio';
import { theme } from '@lib/theme';
import { fmtNum, t } from '@lib/i18n';
import { currentBodyWeight, useBodyWeight } from '@lib/bodyWeight';
import { buildLocalActivity } from '@lib/activity';
import { useChallengeWins } from '@lib/level';
import { logDateKey, shortDayMonth } from '@lib/utils';

interface ProfileScreenProps {
  onOpenRoutines?: () => void;
  onOpenExerciseProgress?: () => void;
  // Peso corporal: se edita aquí, no en el carrusel de Cardio (se toca una vez
  // cada varias semanas y allí ocupaba media hero).
  onOpenBodyWeight?: () => void;
  // Logros: insignias que se desbloquean con el histórico de entrenos.
  onOpenAchievements?: () => void;
  // Actividad: tu trayectoria (días, retos e insignias) desde el móvil.
  onOpenActivity?: () => void;
  onOpenCalendar?: () => void;
  onOpenCardio?: () => void;
  onOpenSettings?: () => void;
  // Pantalla de cuenta (Datos y nube): sin sesión no hay perfil público que
  // completar, así que la tarjeta lleva a crearla en vez de al formulario.
  onOpenAccount?: () => void;
}

// Cuadrícula del menú: las medidas de la casilla (separación, margen a los
// lados y aire interior) vienen de `menuTileTokens`, compartidas con la
// cuadrícula de Logros. Aquí solo queda el rango de letra: `MENU_CHAR_WIDTH`
// es el ancho medio de un carácter en em con la negrita del sistema, y sirve
// para estimar cuánto ocupa la etiqueta.
const MENU_GAP = MENU_TILE_GAP;
const MENU_INSET = MENU_TILE_INSET;
const MENU_FONT_MIN = 12;
const MENU_FONT_MAX = 16;
const MENU_CHAR_WIDTH = 0.6;

type MenuEntry = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  /** Estado de lo que hay detrás (rutina activa, último peso…), si lo hay. */
  hint?: string;
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
  onOpenActivity,
  onOpenCalendar,
  onOpenCardio,
  onOpenSettings,
  onOpenAccount,
}: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { state } = useWorkout();
  // Nivel de la cuenta: lo permanente que dejan los retos y los logros.
  const { level, badges, challenges } = useAccountLevel();
  const wins = useChallengeWins();
  const weightSegments = useBodyWeight();
  const { user, loading: sessionLoading } = useSession();
  const { profile, loading: profileLoading } = useMyProfile();
  // Cambiar la foto desde el lápiz de su esquina, sin abrir el editor.
  const { pickAvatar, picking: pickingAvatar } = useAvatarPicker();
  const isProfileFilled = hasProfileFilled(profile);
  // Primera carga sin nada que enseñar (ni copia local ni respuesta todavía):
  // no se puede decir "Sin perfil" porque aún no se sabe. Con copia local esto
  // no llega a verse; solo pasa en el primer arranque tras iniciar sesión. La
  // sesión cuenta también: hasta que se resuelve no se sabe si hay cuenta.
  const profileUnknown = (sessionLoading || profileLoading) && !profile;
  // Sin cuenta no hay perfil público: el formulario se abriría para nada (el
  // "Guardar" sale desactivado). La tarjeta lo dice aquí y lleva a la cuenta.
  const hasAccount = !!user;

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { scrollBottomPadding } = getFloatingPrimaryNavMetrics(insets.bottom);

  const cardioSessionsCount = state.logs.filter(
    (l) => cardioSessionFromLog(l) != null
  ).length;
  // Solo fuerza: una sesión de solo cardio ya cuenta en "Sesiones cardio".
  const workoutsCount = state.logs.filter((l) => !isCardioOnlyLog(l)).length;
  // Subtítulo de la barra: desde cuándo entrenas (primer registro, de lo que sea).
  const firstLogDate = state.logs.reduce<string | null>((min, log) => {
    const key = logDateKey(log);
    return min === null || key < min ? key : min;
  }, null);

  // Cada cifra es el camino a su lista (mismo patrón que los contadores de
  // Comunidad).
  const summary = [
    {
      value: state.routines.length,
      label: t('Rutinas'),
      onPress: onOpenRoutines,
    },
    {
      value: workoutsCount,
      label: t('Entrenamientos'),
      onPress: onOpenCalendar,
    },
    {
      value: cardioSessionsCount,
      label: t('Sesiones cardio'),
      onPress: onOpenCardio,
    },
  ];

  // El perfil público se edita en un popup sobre esta pantalla.
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  // Seis casillas, tres por fila: icono + nombre corto y, debajo, el estado
  // de lo que hay detrás cuando hay algo que contar (como "Datos y nube" en
  // Configuración): así no hay que entrar en cada una para saber si hay algo
  // que mirar. Ejercicios y Configuración no tienen un dato que resumir.
  //
  // Todas NAVEGAN a una pantalla, que es la promesa del dibujo. La sexta era
  // "Temporizador" y rompía esa promesa: mismo tamaño y mismo peso para abrir
  // un modal con un número. Ese ajuste vive ahora en Configuración, con el tema
  // y el idioma (y se sigue tocando desde el ⋯ del registro, que es donde se
  // nota que el descanso se queda corto).
  const activeRoutine = state.routines.find((routine) => routine.isActive);
  const bodyWeight = currentBodyWeight(weightSegments);
  const unlockedBadges = badges.filter((badge) => badge.unlocked).length;
  const latestActivity = useMemo(
    () =>
      buildLocalActivity({
        logs: state.logs,
        routines: state.routines,
        badges,
        challenges,
        wins,
      })[0],
    [state.logs, state.routines, badges, challenges, wins]
  );
  const menu: MenuEntry[] = [
    {
      icon: 'book-open-variant',
      label: t('Rutinas'),
      hint: activeRoutine
        ? activeRoutine.name
        : state.routines.length
        ? t('Ninguna activa')
        : t('Crea la primera'),
      onPress: onOpenRoutines,
    },
    {
      icon: 'chart-line',
      label: t('Ejercicios'),
      onPress: onOpenExerciseProgress,
    },
    {
      icon: 'scale-bathroom',
      label: t('Peso'),
      hint: bodyWeight != null ? `${fmtNum(bodyWeight)} kg` : t('Sin anotar'),
      onPress: onOpenBodyWeight,
    },
    {
      icon: 'timeline-text-outline',
      label: t('Actividad'),
      // El último hito: lo que hay de nuevo en tu trayectoria.
      hint: latestActivity
        ? shortDayMonth(latestActivity.happenedOn)
        : t('Sin hitos'),
      onPress: onOpenActivity,
    },
    {
      icon: 'trophy-outline',
      label: t('Logros'),
      hint: t('{n} de {total}', { n: unlockedBadges, total: badges.length }),
      onPress: onOpenAchievements,
    },
    // Configuración, la última: se toca poco y no tiene estado que resumir.
    { icon: 'cog-outline', label: t('Configuración'), onPress: onOpenSettings },
  ];
  const menuRows: MenuEntry[][] = [];
  for (let i = 0; i < menu.length; i += 3) menuRows.push(menu.slice(i, i + 3));

  // Medida de la casilla (`menuTileTokens`, compartida con Logros) y, con
  // ella, un solo tamaño de letra para todas: el mayor con el que cabe la
  // etiqueta más larga en una línea. Con `adjustsFontSizeToFit` cada casilla
  // encogía la suya y "Configuración" salía más pequeño que "Peso".
  const { width: windowWidth } = useWindowDimensions();
  const tileWidth = getMenuTileWidth(windowWidth);
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
            paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP,
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
            {/* La foto se cambia desde la foto: un lápiz en su esquina, sin
                pasar por "Editar perfil". Era el único dato del perfil que se
                toca a menudo y costaba abrir un popup y buscar su botón. */}
            <View>
              <Avatar uri={profile?.avatar_url} size={72} />
              {hasAccount && (
                <Pressable
                  style={({ pressed }: { pressed: boolean }) => [
                    styles.avatarEditBadge,
                    pressed && styles.menuTilePressed,
                  ]}
                  onPress={pickAvatar}
                  disabled={pickingAvatar}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('Cambiar foto')}
                >
                  <MaterialCommunityIcons
                    name={pickingAvatar ? 'progress-upload' : 'camera'}
                    size={14}
                    color={theme.colors.onGold}
                  />
                </Pressable>
              )}
            </View>
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
              vive en el lápiz de la esquina de esta tarjeta. */}
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
            {summary.map((item, index) => (
              <React.Fragment key={item.label}>
                {index > 0 && <View style={styles.summaryDivider} />}
                <Pressable
                  style={({ pressed }) => [
                    styles.summaryItem,
                    pressed && styles.menuTilePressed,
                  ]}
                  onPress={item.onPress}
                  disabled={!item.onPress}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.value} ${item.label}`}
                >
                  <Text style={styles.summaryValue}>{item.value}</Text>
                  <Text style={styles.summaryLabel}>{item.label}</Text>
                </Pressable>
              </React.Fragment>
            ))}
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
                  { width: tileWidth },
                  pressed && styles.menuTilePressed,
                ]}
                onPress={entry.onPress}
                accessibilityRole="button"
                accessibilityLabel={
                  entry.hint ? `${entry.label}. ${entry.hint}` : entry.label
                }
              >
                {/* Icono y texto ocupan la casilla: es lo que se toca a diario. */}
                <MaterialCommunityIcons
                  name={entry.icon}
                  size={32}
                  color={theme.colors.text}
                />
                <Text
                  style={[styles.menuLabel, { fontSize: menuFontSize }]}
                  numberOfLines={1}
                >
                  {entry.label}
                </Text>
                {!!entry.hint && (
                  <Text style={styles.menuHint} numberOfLines={1}>
                    {entry.hint}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </StretchScrollView>

      <GlassTopBar
        title={t('Perfil')}
        icon="account-circle-outline"
        subtitle={
          firstLogDate
            ? t('Entrenando desde el {date}', {
                date: firstLogDate.split('-').reverse().join('/'),
              })
            : undefined
        }
        topInset={insets.top}
        onLayout={onTopBarLayout}
      />

      <ProfileEditModal
        visible={showProfileEdit}
        onClose={() => setShowProfileEdit(false)}
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
    // Lápiz de la foto: disco dorado pegado a su esquina inferior derecha, con
    // un borde del color del fondo para que se lea como encima de la foto y no
    // como parte de ella.
    avatarEditBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      borderWidth: 2,
      borderColor: theme.colors.surface,
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
      // Centrada: la última fila incompleta queda en el medio, no pegada a la
      // izquierda. Las casillas llevan ANCHO FIJO (`tileWidth`) y no `flex: 1`:
      // con flex, el hueco sobrante se repartía SOBRE la base medida de cada
      // casilla, así que las de etiqueta larga ("Configuración", "Logros")
      // salían más anchas —y por aspectRatio, más altas— que las de arriba.
      justifyContent: 'center',
      gap: MENU_GAP,
      marginHorizontal: MENU_INSET,
    },
    menuTile: {
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
    // Estado de la casilla, debajo del nombre: secundario y de una línea.
    menuHint: {
      marginTop: -4,
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 15,
      textAlign: 'center',
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
