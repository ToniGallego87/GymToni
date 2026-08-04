import { subscribeTheme } from '@lib/themeStore';
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextStyle,
  ViewStyle,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, getModeBackgroundColor } from '@lib/theme';
import { requestThemeReveal } from '@lib/themeTransition';
import { t } from '@lib/i18n';
import {
  GLASS_TINT,
  GLASS_TOP_BAR_BLUR_INTENSITY,
  GLASS_TOP_BAR_BG,
  GLASS_TOP_BAR_HAIRLINE,
  GLASS_TOP_BAR_OVERLAY,
} from './glassTokens';

const FrostedBlur = BlurView as unknown as React.ComponentType<any>;

export const GLASS_TOP_BAR_BASE_HEIGHT = 50;

interface GlassTopBarProps {
  title: string;
  /**
   * Icono MaterialCommunityIcons junto al título. Es la forma estándar de
   * titular una pantalla (icono 18px + texto 20/800); usar `titleElement`
   * solo para casos especiales (logo de Inicio, icono de día).
   */
  icon?: string;
  titleElement?: React.ReactNode;
  subtitle?: string;
  /**
   * Si se pasa, el subtítulo se vuelve pulsable (con un icono de lápiz-calendario
   * que lo delata como tocable) y ejecuta esto al pulsarlo. Se usa en el registro
   * para editar la fecha directamente desde el subtítulo.
   */
  onSubtitlePress?: () => void;
  topInset: number;
  rightElement?: React.ReactNode;
  /**
   * Menú de tres puntos (cambio de tema) al final de la barra. Activo por
   * defecto: es el marco compartido para que las opciones globales aparezcan
   * en TODAS las pantallas, no solo en Inicio. Pasar `false` para ocultarlo.
   */
  showMenu?: boolean;
  /**
   * Opciones propias de la pantalla que se añaden ARRIBA del cambio de tema en
   * el mismo menú de tres puntos (p. ej. "Modificar temporizador" en el
   * registro). Cada una cierra el menú al pulsarse.
   */
  menuItems?: {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    label: string;
    onPress: () => void;
  }[];
  titleNumberOfLines?: number;
  subtitleNumberOfLines?: number;
  containerStyle?: ViewStyle;
  titleStyle?: TextStyle;
}

export function GlassTopBar({
  title,
  icon,
  titleElement,
  subtitle,
  onSubtitlePress,
  topInset,
  rightElement,
  showMenu = true,
  menuItems,
  titleNumberOfLines = 1,
  subtitleNumberOfLines = 2,
  containerStyle,
  titleStyle,
}: GlassTopBarProps) {
  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + topInset;
  const topBarPaddingTop = topInset + 6;
  const topBarBlurIntensity =
    Platform.OS === 'android'
      ? Math.max(GLASS_TOP_BAR_BLUR_INTENSITY, 72)
      : GLASS_TOP_BAR_BLUR_INTENSITY;

  // Menú de tres puntos compartido: el botón va en la fila de la barra, pero el
  // desplegable y su fondo se pintan como HERMANOS de la barra (fuera de su
  // overflow:hidden, que si no los recortaría). El estado vive aquí para que
  // las opciones globales estén en el mismo sitio en TODAS las pantallas.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<View>(null);

  // La opción ofrece siempre el modo contrario al activo.
  const nextMode = theme.mode === 'dark' ? 'light' : 'dark';
  const nextThemeIcon =
    nextMode === 'light' ? 'white-balance-sunny' : 'weather-night';
  const nextThemeLabel =
    nextMode === 'light' ? t('Modo claro') : t('Modo oscuro');

  // Dispara el revelado del cambio de tema desde el centro del BOTÓN de tres
  // puntos (measureInWindow da su posición en pantalla); el overlay de la raíz
  // lo pinta.
  const handleSelectNextTheme = () => {
    const fire = (x: number, y: number) => {
      requestThemeReveal({
        x,
        y,
        mode: nextMode,
        color: getModeBackgroundColor(nextMode),
      });
      setMenuOpen(false);
    };
    const node = menuButtonRef.current;
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x, y, w, h) => fire(x + w / 2, y + h / 2));
    } else {
      fire(0, topBarHeight);
    }
  };

  // La barra crece con el contenido (minHeight) para que títulos de 2 líneas no
  // empujen el subtítulo contra el borde inferior; el paddingBottom garantiza aire.
  return (
    <>
      <View
        style={[
          styles.topBarBackground,
          { minHeight: topBarHeight, paddingTop: topBarPaddingTop },
          containerStyle,
        ]}
      >
        <FrostedBlur
          tint={GLASS_TINT}
          intensity={topBarBlurIntensity}
          experimentalBlurMethod="dimezisBlurView"
          style={styles.topBarBlur}
          pointerEvents="none"
        />
        <View style={styles.topBarGlassOverlay} pointerEvents="none" />
        <View style={styles.topBarContent}>
          <View style={styles.topBarRow}>
            <View style={styles.textWrap}>
              {titleElement ? (
                <View style={styles.titleElementWrap}>{titleElement}</View>
              ) : icon ? (
                <View style={styles.iconTitleRow}>
                  <MaterialCommunityIcons
                    name={icon as any}
                    size={18}
                    color={theme.colors.text}
                  />
                  <Text
                    style={[styles.iconTitle, titleStyle]}
                    numberOfLines={titleNumberOfLines}
                  >
                    {title}
                  </Text>
                </View>
              ) : (
                <Text
                  style={[styles.title, titleStyle]}
                  numberOfLines={titleNumberOfLines}
                >
                  {title}
                </Text>
              )}
              {!!subtitle &&
                (onSubtitlePress ? (
                  <Pressable
                    onPress={onSubtitlePress}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.subtitleButton,
                      pressed && styles.subtitlePressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={subtitle}
                  >
                    <Text
                      style={styles.subtitleLink}
                      numberOfLines={subtitleNumberOfLines}
                    >
                      {subtitle}
                    </Text>
                    <MaterialCommunityIcons
                      name="calendar-edit"
                      size={14}
                      color={theme.colors.primary}
                    />
                  </Pressable>
                ) : (
                  <Text
                    style={styles.subtitle}
                    numberOfLines={subtitleNumberOfLines}
                  >
                    {subtitle}
                  </Text>
                ))}
            </View>
            {rightElement}
            {showMenu && (
              <Pressable
                ref={menuButtonRef}
                onPress={() => setMenuOpen((o) => !o)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.topBarMenuButton,
                  pressed && styles.topBarMenuButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('Opciones')}
              >
                <MaterialCommunityIcons
                  name="dots-vertical"
                  size={22}
                  color={theme.colors.text}
                />
              </Pressable>
            )}
          </View>
        </View>
      </View>
      {showMenu && menuOpen && (
        <Pressable
          style={styles.themeMenuBackdrop}
          onPress={() => setMenuOpen(false)}
        />
      )}
      {showMenu && menuOpen && (
        <View style={[styles.themeMenu, { top: topBarHeight + 4 }]}>
          {menuItems?.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => {
                setMenuOpen(false);
                item.onPress();
              }}
              style={({ pressed }) => [
                styles.themeMenuItem,
                pressed && styles.themeMenuItemPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={20}
                color={theme.colors.text}
              />
              <Text style={styles.themeMenuItemText}>{item.label}</Text>
            </Pressable>
          ))}
          {!!menuItems?.length && <View style={styles.themeMenuDivider} />}
          <Pressable
            onPress={handleSelectNextTheme}
            style={({ pressed }) => [
              styles.themeMenuItem,
              pressed && styles.themeMenuItemPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={nextThemeLabel}
          >
            <MaterialCommunityIcons
              name={nextThemeIcon}
              size={20}
              color={theme.colors.text}
            />
            <Text style={styles.themeMenuItemText}>{nextThemeLabel}</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    topBarBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 25,
      justifyContent: 'flex-start',
      // En día un filo sutil separa la barra del contenido que pasa por debajo;
      // en noche el propio blur oscuro ya define el límite.
      borderBottomWidth: theme.mode === 'light' ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: GLASS_TOP_BAR_HAIRLINE,
      backgroundColor: GLASS_TOP_BAR_BG,
      overflow: 'hidden',
    },
    topBarBlur: {
      ...StyleSheet.absoluteFillObject,
    },
    topBarGlassOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: GLASS_TOP_BAR_OVERLAY,
    },
    topBarContent: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    topBarRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    textWrap: {
      flex: 1,
    },
    titleElementWrap: {
      justifyContent: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.colors.text,
    },
    iconTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconTitle: {
      flexShrink: 1,
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 24,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
      lineHeight: 19,
    },
    subtitleButton: {
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
    },
    subtitlePressed: {
      opacity: 0.6,
    },
    // Pulsable: tinta dorada (rol de acción) en vez del gris del subtítulo, para
    // que se lea como algo que se puede tocar.
    subtitleLink: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '700',
      lineHeight: 19,
    },
    topBarMenuButton: {
      padding: 4,
      marginRight: -4,
      borderRadius: theme.borderRadius.sm,
    },
    topBarMenuButtonPressed: {
      opacity: 0.6,
    },
    themeMenuBackdrop: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 26,
    },
    themeMenu: {
      position: 'absolute',
      right: theme.spacing.md,
      zIndex: 27,
      minWidth: 176,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 4,
      overflow: 'hidden',
      ...theme.shadow.card,
    },
    themeMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    themeMenuItemPressed: {
      backgroundColor: theme.colors.surfaceAlt,
    },
    themeMenuDivider: {
      // `border` es casi idéntico a `surface` en oscuro (línea invisible): se usa
      // `textMuted`, un gris medio que contrasta en ambos temas.
      height: 1,
      backgroundColor: theme.colors.textMuted,
      opacity: 0.4,
      marginVertical: 4,
    },
    themeMenuItemText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
      lineHeight: 20,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
