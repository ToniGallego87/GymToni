import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { FloatingGlassBar } from './FloatingGlassBar';
import { GLASS_ACTIVE_ITEM_BG, GLASS_ACTIVE_ITEM_BORDER } from './glassTokens';

type FloatingPrimaryNavKey = 'home' | 'cardio' | 'calendar' | 'profile';

interface FloatingPrimaryNavProps {
  bottom: number;
  activeTab: FloatingPrimaryNavKey;
  /** Oculta el botón de Cardio cuando no hay ningún registro de cardio. */
  showCardio?: boolean;
  onPressHome?: () => void;
  onPressCardio?: () => void;
  onPressCalendar?: () => void;
  onPressProfile?: () => void;
}

type NavItem = {
  key: FloatingPrimaryNavKey;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress?: () => void;
};

export function FloatingPrimaryNav({
  bottom,
  activeTab,
  showCardio = true,
  onPressHome,
  onPressCardio,
  onPressCalendar,
  onPressProfile,
}: FloatingPrimaryNavProps) {
  const items: NavItem[] = [
    {
      key: 'home',
      label: t('Fuerza'),
      icon: 'dumbbell',
      onPress: onPressHome,
    },
    {
      key: 'cardio',
      label: t('Cardio'),
      icon: 'run-fast',
      onPress: onPressCardio,
    },
    {
      key: 'calendar',
      label: t('Calendario'),
      icon: 'calendar-month-outline',
      onPress: onPressCalendar,
    },
    {
      key: 'profile',
      label: t('Perfil'),
      icon: 'account-circle-outline',
      onPress: onPressProfile,
    },
  ];

  const visibleItems = showCardio
    ? items
    : items.filter((item) => item.key !== 'cardio');

  return (
    <FloatingGlassBar bottom={bottom}>
      {visibleItems.map((item) => {
        const isActive = item.key === activeTab;

        return (
          <TouchableOpacity
            key={item.key}
            // Tamaño/posición del contenido constante: el fondo activo es una
            // capa absoluta (no un borde en el propio item), así el icono y el
            // texto no se reajustan al cambiar de pestaña.
            style={styles.item}
            onPress={item.onPress}
            // La pestaña activa sigue siendo pulsable: las subpantallas de
            // Perfil (Rutinas/Datos) la marcan activa y pulsar vuelve a Perfil.
            disabled={!item.onPress}
            activeOpacity={0.88}
          >
            {isActive && (
              <Animated.View
                // Aparece creciendo desde muy pequeño hasta su tamaño. Como cada
                // pantalla monta su propia barra, al pulsar una opción se navega
                // y la nueva barra reproduce esta entrada.
                entering={ZoomIn.springify().damping(14).stiffness(180)}
                style={styles.itemActiveBg}
                pointerEvents="none"
              />
            )}
            <MaterialCommunityIcons
              name={item.icon}
              size={22}
              style={[styles.icon, isActive && styles.iconActive]}
            />
            <Text
              style={[styles.label, isActive && styles.labelActive]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </FloatingGlassBar>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    item: {
      flex: 1,
      borderRadius: 14,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      paddingVertical: 6,
    },
    itemActiveBg: {
      position: 'absolute',
      top: 2,
      left: 2,
      right: 2,
      bottom: 2,
      borderRadius: 14,
      backgroundColor: GLASS_ACTIVE_ITEM_BG,
      borderWidth: 1,
      borderColor: GLASS_ACTIVE_ITEM_BORDER,
    },
    icon: {
      color: theme.colors.textSecondary,
      marginBottom: 3,
    },
    iconActive: {
      color: theme.colors.white,
    },
    label: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
      letterSpacing: -0.2,
      textAlign: 'center',
    },
    labelActive: {
      color: theme.colors.white,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
