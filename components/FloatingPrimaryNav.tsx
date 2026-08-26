import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { Avatar } from './Avatar';
import { FloatingGlassBar } from './FloatingGlassBar';
import { GLASS_ACTIVE_ITEM_BG, GLASS_ACTIVE_ITEM_BORDER } from './glassTokens';

// Diámetro de la foto en la barra: ocupa lo mismo que el icono al que sustituye.
const NAV_AVATAR_SIZE = 22;

type FloatingPrimaryNavKey =
  | 'home'
  | 'cardio'
  | 'calendar'
  | 'community'
  | 'profile';

interface FloatingPrimaryNavProps {
  bottom: number;
  activeTab: FloatingPrimaryNavKey;
  /** Oculta el botón de Cardio cuando no hay ningún registro de cardio. */
  showCardio?: boolean;
  /**
   * Foto del perfil público. Si la hay, la pestaña de Perfil la pinta en lugar
   * del icono genérico: la cara propia se reconoce antes que una silueta, y de
   * paso la barra dice de un vistazo con qué cuenta estás.
   */
  profileAvatarUri?: string | null;
  onPressHome?: () => void;
  onPressCardio?: () => void;
  onPressCalendar?: () => void;
  onPressCommunity?: () => void;
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
  profileAvatarUri,
  onPressHome,
  onPressCardio,
  onPressCalendar,
  onPressCommunity,
  onPressProfile,
}: FloatingPrimaryNavProps) {
  const items: NavItem[] = [
    {
      // "Inicio", no "Fuerza": es como se llama la pantalla en su propia barra
      // superior, en la documentación y en el resto del código. El icono de
      // mancuerna ya dice que es la vista de fuerza.
      key: 'home',
      label: t('Inicio'),
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
      key: 'community',
      label: t('Comunidad'),
      icon: 'account-group-outline',
      onPress: onPressCommunity,
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
            {item.key === 'profile' && profileAvatarUri ? (
              // La foto sustituye al icono: mismo hueco (22 + su margen) para
              // que la fila no se descuadre. Activa lleva aro, que es como se
              // marca aquí lo seleccionado (el tinte no vale sobre una foto).
              <View
                style={[styles.avatarWrap, isActive && styles.avatarWrapActive]}
              >
                <Avatar uri={profileAvatarUri} size={NAV_AVATAR_SIZE} />
              </View>
            ) : (
              <MaterialCommunityIcons
                name={item.icon}
                size={22}
                style={[styles.icon, isActive && styles.iconActive]}
              />
            )}
            <Text
              style={[styles.label, isActive && styles.labelActive]}
              numberOfLines={1}
              // Con 5 pestañas, etiquetas largas ("Calendario", "Comunidad") se
              // encogen lo justo para caber en su celda en vez de truncarse.
              adjustsFontSizeToFit
              minimumFontScale={0.8}
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
    // El aro se pinta por fuera de la foto (borde + padding), así la cara no
    // encoge al pasar a activa ni se recorta contra el borde.
    avatarWrap: {
      marginBottom: 3,
      borderRadius: NAV_AVATAR_SIZE,
      borderWidth: 1.5,
      borderColor: 'transparent',
      opacity: 0.7,
    },
    avatarWrapActive: {
      borderColor: theme.colors.white,
      opacity: 1,
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
