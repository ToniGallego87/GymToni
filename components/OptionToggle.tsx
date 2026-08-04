import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';

export interface OptionToggleOption<T extends string | number | boolean> {
  value: T;
  label: string;
  /** Icono MaterialCommunityIcons a la izquierda de la etiqueta (opcional). */
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}

interface OptionToggleProps<T extends string | number | boolean> {
  options: OptionToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Segmentado binario de dos (o más) opciones, una activa. Único componente para
 * los toggles de dos botones repartidos por la app (tema e idioma en
 * Configuración, backup automático en Datos): antes cada pantalla lo montaba a
 * mano con medidas casi iguales pero distinto token de estado activo (de ahí que
 * el de backup pintara oro sólido sobre oro y quedara ilegible en oscuro).
 *
 * El estado activo va SIEMPRE con fondo translúcido `primaryMuted` + tinta
 * `primary`, el patrón legible en ambos temas. Para el segmentado de iconos de
 * las gráficas, ver `SegmentedFilter`.
 */
export function OptionToggle<T extends string | number | boolean>({
  options,
  value,
  onChange,
  style,
}: OptionToggleProps<T>) {
  return (
    <View style={[styles.row, style]}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={String(option.value)}
            style={({ pressed }) => [
              styles.option,
              active && styles.optionActive,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              if (!active) onChange(option.value);
            }}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
          >
            {!!option.icon && (
              <MaterialCommunityIcons
                name={option.icon}
                size={22}
                color={
                  active ? theme.colors.primary : theme.colors.textSecondary
                }
              />
            )}
            <Text style={[styles.label, active && styles.labelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 10,
    },
    option: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    optionActive: {
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.primaryMuted,
    },
    label: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    labelActive: {
      color: theme.colors.primary,
    },
    pressed: {
      opacity: 0.85,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
