import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';

export interface HeroStat {
  value: string;
  label: string;
}

interface HeroStatsCardProps {
  /** Etiqueta superior (ej: "Esta semana"). */
  kicker: string;
  /** Icono del dato principal. */
  mainIcon: string;
  /** Valor principal grande (ej: "820"). */
  mainValue: string;
  /** Unidad del dato principal (ej: "kcal", "kg"). */
  mainUnit: string;
  /** Línea de detalle bajo el dato principal. */
  subline: string;
  /** Hasta tres referencias (semana pasada / media / mejor). */
  stats: HeroStat[];
  /** Si es true, se muestra `emptyText` centrado en vez de los datos. */
  isEmpty?: boolean;
  emptyText?: string;
  /** Contenido opcional al pie (ej: fila de peso corporal en Cardio). */
  footer?: React.ReactNode;
  /**
   * Modo compacto: encoge el dato principal y las distancias verticales para que
   * la tarjeta quepa en la misma altura aun llevando `footer` (lo usa Cardio,
   * que añade la fila de peso, para igualar la altura de la hero de Fuerza).
   */
  dense?: boolean;
  /** Dirección de entrada del contenido en un carrusel (el frame no se mueve). */
  enterFrom?: 'left' | 'right';
}

/**
 * Tarjeta hero de estadísticas con gradiente dorado, del mismo aspecto que la
 * HeroCard de Fuerza. La usan tanto Cardio (kcal semanales) como Fuerza
 * (volumen semanal) para que ambos "estados de estadísticas" sean idénticos.
 * Sus márgenes coinciden con los de HeroCard para alinear las flechas del
 * carrusel.
 */
export function HeroStatsCard({
  kicker,
  mainIcon,
  mainValue,
  mainUnit,
  subline,
  stats,
  isEmpty,
  emptyText,
  footer,
  dense,
  enterFrom,
}: HeroStatsCardProps) {
  // Animación de solo el contenido (el frame/gradiente queda fijo en el carrusel).
  const enterDir = enterFrom === 'left' ? -1 : enterFrom === 'right' ? 1 : 0;
  const contentTx = useSharedValue(22 * enterDir);
  const contentOpacity = useSharedValue(0);
  useEffect(() => {
    contentTx.value = withTiming(0, { duration: 260 });
    contentOpacity.value = withTiming(1, { duration: 260 });
  }, []);
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentTx.value }],
    opacity: contentOpacity.value,
  }));

  return (
    <LinearGradient
      colors={theme.gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <LinearGradient
        colors={theme.gradients.sheen}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.heroSheen}
        pointerEvents="none"
      />

      <Animated.View style={contentStyle}>
      {isEmpty ? (
        <Text style={styles.heroEmptyText}>{emptyText}</Text>
      ) : (
        <>
          <View>
            <Text style={[styles.heroKicker, dense && styles.heroKickerDense]}>
              {kicker}
            </Text>
            <View style={styles.heroMainRow}>
              <MaterialCommunityIcons
                name={mainIcon as any}
                size={dense ? 26 : 30}
                color={theme.colors.onGold}
              />
              <Text
                style={[styles.heroMainValue, dense && styles.heroMainValueDense]}
              >
                {mainValue}
              </Text>
              <Text style={styles.heroMainUnit}>{mainUnit}</Text>
            </View>
            <Text style={[styles.heroSubline, dense && styles.heroSublineDense]}>
              {subline}
            </Text>
          </View>

          {stats.length > 0 && (
            <View
              style={[styles.heroStatsRow, dense && styles.heroStatsRowDense]}
            >
              {stats.map((stat, index) => (
                <React.Fragment key={stat.label}>
                  {index > 0 && <View style={styles.heroStatDivider} />}
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>{stat.value}</Text>
                    <Text style={styles.heroStatLabel}>{stat.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}
        </>
      )}

      {footer}
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 172,
    justifyContent: 'center',
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  heroSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  heroKicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: theme.colors.onGold,
    opacity: 0.75,
    marginBottom: 6,
  },
  heroKickerDense: {
    marginBottom: 2,
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroMainValue: {
    fontFamily: theme.fonts.display,
    fontSize: 34,
    lineHeight: 44,
    includeFontPadding: false,
    transform: [{ translateY: 4 }],
    color: theme.colors.onGold,
  },
  heroMainValueDense: {
    fontSize: 28,
    lineHeight: 36,
    transform: [{ translateY: 3 }],
  },
  heroMainUnit: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.onGold,
    opacity: 0.8,
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  heroSubline: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    color: theme.colors.onGold,
    opacity: 0.85,
  },
  heroSublineDense: {
    marginTop: 2,
  },
  heroEmptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onGold,
    opacity: 0.8,
    lineHeight: 20,
    textAlign: 'center',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 19, 24, 0.16)',
  },
  heroStatsRowDense: {
    marginTop: 4,
    paddingTop: 4,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(16, 19, 24, 0.16)',
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.onGold,
  },
  heroStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.onGold,
    opacity: 0.8,
    marginTop: 2,
    textAlign: 'center',
  },
});
