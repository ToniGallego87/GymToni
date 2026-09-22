import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  AppModal,
  Button,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  StretchScrollView,
} from '@components';
import { Badge, BADGE_CATEGORY_ORDER, badgeCategoryLabel } from '@lib/badges';
import { useAccountLevel } from '@hooks/useAccountLevel';
import { theme } from '@lib/theme';
import { dateLocale, t } from '@lib/i18n';

interface AchievementsScreenProps {
  onBack: () => void;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TILES_PER_ROW = 4;

/**
 * Logros: catálogo fijo de insignias que se desbloquean con el histórico.
 *
 * El póster semanal (los "hitos") celebra UNA semana; esto acumula: el que
 * lleva 60 entrenos lo ve aquí y sabe cuánto le falta para el siguiente. Todo
 * sale de los logs al abrir (lib/badges): nada que guardar ni sincronizar.
 *
 * Misma cuadrícula de casillas que el menú de Perfil: icono + nombre, en color
 * si está conseguido y en gris si no. El detalle (cómo se consigue, cuánto
 * llevas, cuándo cayó) vive en un popup al tocar la casilla.
 */
export function AchievementsScreen({ onBack }: AchievementsScreenProps) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Badge | null>(null);

  // Las insignias salen del mismo cálculo compartido que el nivel: antes esta
  // pantalla volvía a recorrer el historial por su cuenta.
  const { badges, level } = useAccountLevel();
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  // Grupos por tipo, cada uno en filas de tres (la última se rellena con
  // huecos invisibles para que las casillas no se estiren).
  const groups = useMemo(
    () =>
      BADGE_CATEGORY_ORDER.map((category) => {
        const items = badges.filter((b) => b.category === category);
        const rows: (Badge | null)[][] = [];
        for (let i = 0; i < items.length; i += TILES_PER_ROW) {
          const row: (Badge | null)[] = items.slice(i, i + TILES_PER_ROW);
          while (row.length < TILES_PER_ROW) row.push(null);
          rows.push(row);
        }
        return { category, rows };
      }).filter((g) => g.rows.length > 0),
    [badges]
  );

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { bottom: backBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

  const longDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const selectedRatio =
    selected && selected.target > 0 ? selected.current / selected.target : 0;
  // Los de sí/no (objetivo 1) no necesitan barra: o está o no está.
  const selectedShowsProgress = !!selected && selected.target > 1;

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
          { paddingTop: topBarHeight + 28, paddingBottom: scrollBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera: el nivel de la cuenta (lo permanente) con su barra hasta
            el siguiente, y debajo cuántos logros llevas. */}
        <View style={styles.summaryCard}>
          <GradientFill accent={theme.colors.primaryLine} />
          <Text style={styles.summaryValue}>
            {t('Nivel {n}', { n: level.level })}
          </Text>
          <View style={styles.levelTrack}>
            <View
              style={[
                styles.levelFill,
                { width: `${Math.round(level.progress * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.summaryLabel}>
            {t('{xp} / {next} puntos · {done} / {total} logros', {
              xp: level.xp,
              next: level.nextLevelAt,
              done: unlockedCount,
              total: badges.length,
            })}
          </Text>
        </View>

        {groups.map(({ category, rows }) => (
          <View key={category} style={styles.group}>
            <Text style={styles.groupTitle}>
              {badgeCategoryLabel(category)}
            </Text>
            {rows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {row.map((badge, i) =>
                  badge ? (
                    <Pressable
                      key={badge.id}
                      style={({ pressed }) => [
                        styles.tile,
                        badge.unlocked
                          ? styles.tileUnlocked
                          : styles.tileLocked,
                        pressed && styles.tilePressed,
                      ]}
                      onPress={() => setSelected(badge)}
                      accessibilityRole="button"
                      accessibilityLabel={`${badge.name}. ${
                        badge.unlocked
                          ? t('Conseguido')
                          : t('Aún sin conseguir')
                      }`}
                    >
                      <MaterialCommunityIcons
                        name={badge.icon as IconName}
                        size={30}
                        color={
                          badge.unlocked
                            ? theme.colors.primary
                            : theme.colors.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.tileLabel,
                          !badge.unlocked && styles.tileLabelLocked,
                        ]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                      >
                        {badge.name}
                      </Text>
                    </Pressable>
                  ) : (
                    <View key={`gap-${i}`} style={styles.tileGap} />
                  )
                )}
              </View>
            ))}
          </View>
        ))}
      </StretchScrollView>

      <GlassTopBar
        title={t('Logros')}
        icon="trophy-outline"
        subtitle={t('Insignias y tu nivel')}
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={backBottom} />

      {/* Detalle del logro: cómo se consigue, cuánto llevas y cuándo cayó. */}
      <AppModal
        visible={!!selected}
        onRequestClose={() => setSelected(null)}
        onOverlayPress={() => setSelected(null)}
        title={selected?.name ?? ''}
        icon={selected?.icon as IconName}
        footer={
          <Button
            title={t('Volver')}
            variant="secondary"
            onPress={() => setSelected(null)}
          />
        }
      >
        {!!selected && (
          <View style={styles.detail}>
            <View
              style={[
                styles.detailIconWrap,
                selected.unlocked && styles.detailIconWrapUnlocked,
              ]}
            >
              <MaterialCommunityIcons
                name={selected.icon as IconName}
                size={44}
                color={
                  selected.unlocked
                    ? theme.colors.primary
                    : theme.colors.textSecondary
                }
              />
            </View>
            <Text style={styles.detailDescription}>{selected.description}</Text>

            {selectedShowsProgress && (
              <View style={styles.progressBlock}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(selectedRatio * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {selected.current} / {selected.target}
                </Text>
              </View>
            )}

            <View style={styles.detailStatusRow}>
              <MaterialCommunityIcons
                name={selected.unlocked ? 'check-circle' : 'lock-outline'}
                size={16}
                color={
                  selected.unlocked
                    ? theme.colors.success
                    : theme.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.detailStatus,
                  selected.unlocked && styles.detailStatusUnlocked,
                ]}
              >
                {selected.unlocked && selected.unlockedAt
                  ? t('Completado el {date}', {
                      date: longDate(selected.unlockedAt),
                    })
                  : t('Aún sin conseguir')}
              </Text>
            </View>
          </View>
        )}
      </AppModal>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { flex: 1 },
    content: { paddingHorizontal: theme.spacing.md, gap: 16 },

    summaryCard: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 14,
      alignItems: 'center',
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    summaryValue: {
      fontSize: 28,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.5,
      color: theme.colors.primary,
      lineHeight: 38,
    },
    summaryLabel: {
      marginTop: 2,
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },

    levelTrack: {
      alignSelf: 'stretch',
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.surfaceAlt,
      overflow: 'hidden',
      marginTop: 8,
      marginBottom: 4,
    },
    levelFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
    },

    group: { gap: 12 },
    groupTitle: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.colors.textSecondary,
      paddingHorizontal: 2,
    },

    // Cuadrícula: las mismas casillas cuadradas del menú de Perfil.
    gridRow: {
      flexDirection: 'row',
      gap: 10,
    },
    tile: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 4,
      ...theme.shadow.soft,
    },
    // Sin elevación: la sombra de Android se pintaba como un cuadrado más
    // oscuro bajo el fondo translúcido del dorado.
    tileUnlocked: {
      backgroundColor: theme.colors.primaryMuted,
      borderColor: theme.colors.primaryLine,
      shadowOpacity: 0,
      elevation: 0,
    },
    // Bloqueado: en gris, pero legible (hay que poder leer qué es). Sin sombra,
    // igual que tileUnlocked: si solo una de las dos la lleva, la elevación de
    // Android pinta un halo que hace parecer la casilla más grande.
    tileLocked: { opacity: 0.6, shadowOpacity: 0, elevation: 0 },
    tilePressed: { opacity: 0.8 },
    // Hueco de relleno con la MISMA caja que una casilla (borde y padding,
    // invisibles): sin ellos Yoga repartía el ancho distinto y las casillas
    // de una fila incompleta (las de los últimos logros, casi siempre sin
    // conseguir) salían más anchas que las de una fila llena.
    tileGap: {
      flex: 1,
      aspectRatio: 1,
      borderWidth: 1,
      borderColor: 'transparent',
      paddingHorizontal: 4,
    },
    tileLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 14,
      textAlign: 'center',
    },
    tileLabelLocked: { color: theme.colors.textSecondary },

    detail: { alignItems: 'center', gap: 6 },
    detailIconWrap: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      marginBottom: 6,
    },
    detailIconWrapUnlocked: {
      backgroundColor: theme.colors.primaryMuted,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
    },
    detailDescription: {
      fontSize: 15,
      color: theme.colors.text,
      lineHeight: 21,
      textAlign: 'center',
    },
    progressBlock: {
      alignSelf: 'stretch',
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    progressTrack: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.surfaceAlt,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: theme.colors.primary,
    },
    progressText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
    },
    detailStatusRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    detailStatus: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    detailStatusUnlocked: { color: theme.colors.success },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
