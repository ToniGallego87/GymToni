import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { GymIcon, GYM_ICON_NAMES, GYM_ICON_LABELS } from './GymIcon';
import type { GymIconName } from './GymIcon';

interface GymIconGridProps {
  // Icono actualmente seleccionado (se resalta); null si no hay ninguno.
  activeIcon: GymIconName | null;
  onSelect: (icon: GymIconName) => void;
  // Márgenes propios de cada modal (el grid no impone separación exterior).
  style?: StyleProp<ViewStyle>;
}

// Rejilla del selector de icono de día. La usan los modales de "Nueva rutina"
// y del detalle de rutina: mismas celdas y mismo estado activo en ambos.
export function GymIconGrid({ activeIcon, onSelect, style }: GymIconGridProps) {
  return (
    <View style={[styles.iconGrid, style]}>
      {GYM_ICON_NAMES.map((iconName) => {
        const active = activeIcon === iconName;
        return (
          <Pressable
            key={iconName}
            style={({ pressed }) => [
              styles.iconButton,
              active && styles.iconButtonActive,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => onSelect(iconName)}
          >
            <GymIcon
              name={iconName}
              size={30}
              color={active ? theme.colors.primary : theme.colors.white}
            />
            <Text
              style={[
                styles.iconButtonLabel,
                active && { color: theme.colors.primary },
              ]}
              numberOfLines={1}
            >
              {t(GYM_ICON_LABELS[iconName])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'center',
  },
  iconButton: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.inputBg,
    alignItems: 'center',
    gap: 6,
  },
  iconButtonActive: {
    borderColor: theme.colors.primaryLine,
    backgroundColor: theme.colors.primary + '1A',
  },
  iconButtonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
