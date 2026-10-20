import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@lib/theme';

interface SectionLegendProps {
  /**
   * Nombre de la sección ("Historial"), en versalitas. Se omite cuando algo
   * justo encima ya dice dónde estás —una pestaña activa, por ejemplo—: ahí
   * repetirlo es eco, y lo que aporta la línea es el `hint`.
   */
  title?: string;
  /** Qué miden sus cifras ("% frente a la vez anterior"), a la derecha. */
  hint?: string;
  /**
   * Un control propio en lugar del `hint` (el orden de la lista en Progreso):
   * la cabecera dice cuántos hay y cómo están, en la misma línea.
   */
  right?: React.ReactNode;
}

/**
 * Cabecera de una lista larga: cómo se llama y qué miden sus cifras, en una
 * línea para toda la lista en vez de repetirlo en cada tarjeta. La comparten
 * los historiales de semanas de Inicio y de Cardio.
 */
export function SectionLegend({ title, hint, right }: SectionLegendProps) {
  return (
    <View style={[styles.legend, !!right && styles.legendWithControl]}>
      {!!title && <Text style={styles.title}>{title}</Text>}
      {right ?? (!!hint && <Text style={styles.hint}>{hint}</Text>)}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    legend: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    // Con un control a la derecha la línea se alinea al centro: la línea base
    // de un botón con icono no es la de un texto.
    legendWithControl: {
      alignItems: 'center',
      marginBottom: 0,
    },
    title: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    hint: {
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
