import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { GymIconName } from '@lib/gymIcons';
import { GymIcon } from './GymIcon';

export interface SegmentedOption<T extends string | undefined> {
  id: T;
  label: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** Silueta de grupo muscular (días de rutina); manda sobre `icon`. */
  gymIcon?: GymIconName;
}

interface SegmentedFilterProps<T extends string | undefined> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  style?: StyleProp<ViewStyle>;
  /**
   * 'always' (por defecto): icono + texto en cada chip.
   * 'below': chips de solo icono, todos del mismo ancho, y el nombre de la
   * opción activa centrado bajo el raíl. Para etiquetas largas y de medida
   * imprevisible (los nombres de día en Inicio): dentro del chip empujarían el
   * raíl a scrollear y lo moverían al cambiar de opción.
   */
  labelMode?: 'always' | 'below';
}

/**
 * Filtro segmentado: todas las opciones a la vista, la activa rellena de oro.
 * Sustituye a los botones que rotaban entre opciones a cada pulsación (había
 * que dar la vuelta entera para volver a la anterior y no se veía qué más
 * había). Mismo lenguaje que el toggle Fuerza/Cardio del calendario.
 *
 * El raíl scrollea en horizontal cuando las opciones no caben, pero scrollear
 * esconde opciones: los chips van apretados a propósito (4 métricas de "Tu
 * evolución" o de Cardio caben en un móvil estrecho) y las etiquetas que no
 * tienen medida fija —los nombres de día— usan `labelMode="below"`.
 */
export function SegmentedFilter<T extends string | undefined>({
  options,
  value,
  onChange,
  style,
  labelMode = 'always',
}: SegmentedFilterProps<T>) {
  const iconsOnly = labelMode === 'below';
  const activeLabel = options.find((option) => option.id === value)?.label;

  const chips = options.map((option) => {
    const active = option.id === value;
    // El segmento activo es relleno de oro: su tinta es la del oro, no la del
    // texto normal (ver theme.ts).
    const color = active ? theme.colors.onGold : theme.colors.textSecondary;

    // Sin icono no se puede esconder la etiqueta: el chip quedaría vacío.
    const hasIcon = !!option.gymIcon || !!option.icon;
    const showLabel = !iconsOnly || !hasIcon;

    return (
      <Pressable
        key={String(option.id)}
        style={({ pressed }) => [
          styles.chip,
          !showLabel && styles.chipIconOnly,
          active && styles.chipActive,
          pressed && styles.chipPressed,
        ]}
        onPress={() => {
          if (!active) onChange(option.id);
        }}
        accessibilityRole="button"
        accessibilityLabel={option.label}
        accessibilityState={{ selected: active }}
      >
        {option.gymIcon ? (
          <GymIcon
            name={option.gymIcon}
            size={showLabel ? 16 : 22}
            color={color}
          />
        ) : (
          !!option.icon && (
            <MaterialCommunityIcons
              name={option.icon}
              size={showLabel ? 14 : 20}
              color={color}
            />
          )
        )}
        {showLabel && (
          <Text style={[styles.chipText, { color }]} numberOfLines={1}>
            {option.label}
          </Text>
        )}
      </Pressable>
    );
  });

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.track}>
        {iconsOnly ? (
          // Sin scroll: los iconos siempre caben, y repartiéndose el ancho a
          // partes iguales llenan el raíl entero.
          <View style={styles.content}>{chips}</View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {chips}
          </ScrollView>
        )}
      </View>

      {iconsOnly && !!activeLabel && (
        <Text style={styles.activeLabel} numberOfLines={1}>
          {activeLabel}
        </Text>
      )}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    wrap: {
      marginTop: 18,
    },
    track: {
      padding: 4,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    // El nombre de la opción activa, fuera del raíl: dentro del chip cambiaría el
    // ancho de los iconos a cada pulsación.
    activeLabel: {
      marginTop: 8,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.2,
      color: theme.colors.text,
      textAlign: 'center',
    },
    content: {
      // Row explícito: el contenedor del ScrollView horizontal ya lo es, pero el
      // raíl de solo iconos es un View normal.
      flexDirection: 'row',
      gap: 4,
      // Con pocas opciones el raíl no se llena: se centran en vez de quedar
      // pegadas a la izquierda con un hueco muerto al lado.
      flexGrow: 1,
      justifyContent: 'center',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 9,
      paddingHorizontal: 9,
      borderRadius: theme.borderRadius.sm,
    },
    // A partes iguales: llenan el raíl y no se mueven al cambiar de opción.
    chipIconOnly: {
      flex: 1,
      paddingVertical: 11,
      paddingHorizontal: 0,
    },
    chipActive: {
      backgroundColor: theme.colors.primaryFill,
    },
    chipPressed: {
      opacity: 0.75,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.1,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
