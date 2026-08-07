import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';

interface LoadMoreButtonProps {
  onPress: () => void;
  // Margen/posición extra según la pantalla: en Inicio el margen horizontal lo
  // pone la sección que lo envuelve; en Cardio va aquí.
  style?: StyleProp<ViewStyle>;
}

// Botón "Cargar más" del historial paginado, compartido por Inicio (semanas de
// fuerza) y Cardio (semanas de cardio), que lo montaban idéntico por copia.
export function LoadMoreButton({ onPress, style }: LoadMoreButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <MaterialCommunityIcons
        name="reload"
        size={16}
        color={theme.colors.text}
      />
      <Text style={styles.text}>{t('Cargar más')}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      marginTop: 2,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    text: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
