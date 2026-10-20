import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { t } from '@lib/i18n';
import {
  CatalogExercise,
  categoryLabel,
  equipmentLabel,
  TagFilter,
  tagFilterOptions,
  targetLabel,
  UNCLASSIFIED,
} from '@data/exerciseCatalog';
import { SegmentedFilter, SegmentedOption } from './SegmentedFilter';

interface CatalogTagFiltersProps {
  /**
   * Los ejercicios que se filtran (para ofrecer solo las etiquetas que tienen).
   * `undefined` = ejercicio propio, sin etiquetas: añade "Sin clasificar".
   */
  items: (CatalogExercise | undefined)[];
  value: TagFilter;
  onChange: (next: TagFilter) => void;
  style?: StyleProp<ViewStyle>;
  /**
   * Solo la fila de zonas, sin músculo ni equipo. Para listas cortas (Progreso:
   * 30-40 ejercicios) donde la cascada entera era más chrome que lista y el
   * buscador ya encuentra por músculo y equipo ("bíceps mancuerna").
   */
  zoneOnly?: boolean;
}

/**
 * Filtro por las etiquetas del catálogo: zona, y al elegirla, músculo y equipo.
 * Lo comparten el buscador del catálogo (rutinas) y Progreso.
 *
 * Empieza con una sola fila (la zona) y crece al elegir: con las tres a la vez
 * eran ~60 chips encima de la lista. Cada fila ofrece SOLO lo que hay dentro
 * de lo ya elegido (los músculos de esa zona, los equipos de ese músculo), así
 * que ningún chip lleva a una lista vacía. Para ir directo a un músculo sin
 * pasar por la zona está el buscador: "bíceps" también busca por etiqueta.
 */
export function CatalogTagFilters({
  items,
  value,
  onChange,
  style,
  zoneOnly = false,
}: CatalogTagFiltersProps) {
  const options = useMemo(() => tagFilterOptions(items, value), [items, value]);

  const categoryOptions: SegmentedOption<string | undefined>[] = [
    // Sola, la fila no necesita decir de qué es "cualquiera": en corto deja
    // ver más zonas sin deslizar.
    { id: undefined, label: zoneOnly ? t('Todas') : t('Cualquier zona') },
    ...options.category.map((key) => ({ id: key, label: categoryLabel(key) })),
    ...(options.unclassified
      ? [{ id: UNCLASSIFIED, label: t('Sin clasificar') }]
      : []),
  ];
  const targetOptions: SegmentedOption<string | undefined>[] = [
    { id: undefined, label: t('Cualquier músculo') },
    ...options.target.map((key) => ({ id: key, label: targetLabel(key) })),
  ];
  const equipmentOptions: SegmentedOption<string | undefined>[] = [
    { id: undefined, label: t('Cualquier equipo') },
    ...options.equipment.map((key) => ({
      id: key,
      label: equipmentLabel(key),
    })),
  ];

  // Con una zona de verdad (no "Sin clasificar") se abre el resto. Una fila
  // con una sola opción no filtra nada: no se pinta.
  const zoneChosen =
    !zoneOnly && !!value.category && value.category !== UNCLASSIFIED;

  return (
    <View style={[styles.container, style]}>
      <SegmentedFilter
        options={categoryOptions}
        value={value.category}
        // Otra zona, otros músculos y equipos: lo de abajo vuelve a "cualquiera".
        onChange={(category) => onChange({ category })}
      />
      {zoneChosen && options.target.length > 1 && (
        <SegmentedFilter
          options={targetOptions}
          value={value.target}
          onChange={(target) => onChange({ category: value.category, target })}
        />
      )}
      {zoneChosen && options.equipment.length > 1 && (
        <SegmentedFilter
          options={equipmentOptions}
          value={value.equipment}
          onChange={(equipment) => onChange({ ...value, equipment })}
        />
      )}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: {
      gap: 8,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
