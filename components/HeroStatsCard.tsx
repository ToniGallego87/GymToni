import { subscribeTheme } from '@lib/themeStore';
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
import { HERO_ARROW_INSET } from './HeroCarousel';

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
              <Text style={styles.heroKicker}>{kicker}</Text>
              <View style={styles.heroMainRow}>
                <MaterialCommunityIcons
                  name={mainIcon as any}
                  size={30}
                  color={theme.colors.onGold}
                />
                <Text style={styles.heroMainValue}>{mainValue}</Text>
                <Text style={styles.heroMainUnit}>{mainUnit}</Text>
              </View>
              <Text style={styles.heroSubline}>{subline}</Text>
            </View>

            {stats.length > 0 && (
              <View style={styles.heroStatsRow}>
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
      </Animated.View>
    </LinearGradient>
  );
}

const makeStyles = () => StyleSheet.create({
  hero: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 20,
    paddingTop: 14,
    // Más padding abajo que arriba: el contenido va centrado, así que este hueco
    // extra lo sube en bloque y deja respirar la fila de datos frente a los
    // puntitos del carrusel (que van a 10px del borde inferior de la tarjeta).
    paddingBottom: 24,
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
    // Anton a 34px pide 51px de línea (ascendente 40 + descendente 11), más de
    // los que hay: la línea base queda a lineHeight - descendente = 32.8 y los
    // dígitos (altura de mayúscula 29.2) ocupan de 3.6 a 32.8. Con 40 la base
    // subía a 28.8 y Android recortaba el número por arriba; 44 le da hueco.
    lineHeight: 44,
    includeFontPadding: false,
    // Los dígitos quedan centrados en 18.2 y la caja en 22 (el hueco del
    // descendente, que las cifras no usan, tira de ellas hacia arriba): sin esto
    // el número se ve alto frente al icono y la unidad, que sí van centrados.
    transform: [{ translateY: 4 }],
    color: theme.colors.onGold,
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
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    color: theme.colors.onGold,
    opacity: 0.85,
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
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 19, 24, 0.16)',
    // Encogida a los lados: es el contenido más ancho de la tarjeta y sus
    // columnas exteriores llegaban a meterse bajo las flechas del carrusel.
    marginHorizontal: HERO_ARROW_INSET,
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

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
