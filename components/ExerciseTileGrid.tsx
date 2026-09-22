import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@lib/theme';
import { ExerciseGifButton } from './ExerciseGifButton';

// Misma retícula que el menú del perfil (ProfileScreen): tres casillas por
// fila con el mismo hueco entre ellas. Ya no son cuadradas (ver `tile`): el
// GIF entero pide más alto que ancho.
const COLUMNS = 3;
const GAP = 12;
// Líneas que reserva el nombre (centrado en ese hueco si ocupa menos).
const NAME_LINES = 3;
const NAME_LINE_HEIGHT = 13;

export interface ExerciseTile {
  id: string;
  name: string;
  catalogId?: string;
  targetSets?: number | string;
  targetReps?: number | string;
}

interface ExerciseTileGridProps {
  exercises: ExerciseTile[];
  /** Color del día: el punto que ocupa el sitio del GIF cuando no lo hay. */
  accent: string;
}

/**
 * Los ejercicios de un día en lectura, como cuadrícula de casillas (el mismo
 * dibujo que las opciones del perfil): nombre arriba, el GIF entero en
 * medio y series x reps debajo, en gris y pequeño. Lo usan la
 * ficha de la rutina propia y la de una rutina de la comunidad, para que un
 * día se vea igual en las dos.
 *
 * Antes era una lista vertical con la miniatura a 34 px: el GIF, que es lo que
 * responde "¿qué ejercicio era?", apenas se veía, y un día de seis ejercicios
 * ocupaba seis filas. Aquí caben en dos.
 *
 * El GIF ya no se recorta (`fitMode="contain"`, antes "cover" con zoom): se ve
 * el movimiento entero, y la casilla crece en alto lo que haga falta.
 */
export function ExerciseTileGrid({ exercises, accent }: ExerciseTileGridProps) {
  const rows: ExerciseTile[][] = [];
  for (let i = 0; i < exercises.length; i += COLUMNS) {
    rows.push(exercises.slice(i, i + COLUMNS));
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((exercise) => (
            <View key={exercise.id} style={styles.tile}>
              {/* Hueco fijo de tres líneas con el nombre centrado en vertical:
                  así todos los GIF de una fila quedan a la misma altura tenga
                  el nombre una línea o tres. */}
              <View style={styles.nameBox}>
                <Text style={styles.name} numberOfLines={NAME_LINES}>
                  {exercise.name}
                </Text>
              </View>
              {exercise.catalogId ? (
                <View style={styles.gifWrap}>
                  <ExerciseGifButton
                    name={exercise.name}
                    catalogId={exercise.catalogId}
                    fitMode="contain"
                    style={styles.gif}
                  />
                </View>
              ) : (
                // Sin GIF asignado: el punto de color del día ocupa el mismo
                // hueco para que los nombres queden a la misma altura.
                <View style={styles.gifPlaceholder}>
                  <View style={[styles.dot, { backgroundColor: accent }]} />
                </View>
              )}
              <Text style={styles.sets} numberOfLines={1}>
                {exercise.targetSets || '-'}x{exercise.targetReps || '-'}
              </Text>
            </View>
          ))}
          {/* Huecos vacíos en la última fila para que las casillas que sí hay
              no se estiren y midan lo mismo que las demás. */}
          {row.length < COLUMNS &&
            Array.from({ length: COLUMNS - row.length }).map((_, i) => (
              <View key={`spacer-${i}`} style={styles.spacer} />
            ))}
        </View>
      ))}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    grid: {
      gap: GAP,
    },
    row: {
      flexDirection: 'row',
      gap: GAP,
    },
    // Sin `aspectRatio`: la altura la marca el GIF cuadrado de dentro más las
    // dos líneas de texto, así la casilla crece lo que haga falta. Por lo
    // demás, copia del `menuTile` del perfil (superficie, borde, sombra suave).
    tile: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 8,
      ...theme.shadow.soft,
    },
    // Misma caja que una casilla (borde y padding, invisibles) para que Yoga
    // reparta el ancho igual en las filas incompletas.
    spacer: {
      flex: 1,
      borderWidth: 1,
      borderColor: 'transparent',
      padding: 8,
    },
    // Contenedor del GIF: cuadrado a todo el ancho (los GIF del catálogo son
    // cuadrados: así `contain` lo llena entero sin bandas).
    gifWrap: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: theme.borderRadius.sm,
      overflow: 'hidden',
      backgroundColor: theme.colors.surfaceAlt,
    },
    // Sobrescribe el cuadro fijo de 34 px del botón: aquí llena `gifWrap`
    // entero. `width`/`height` explícitos: el botón trae 34 x 34 fijos y en
    // Yoga un ancho fijo gana a `left`+`right`, así que `absoluteFill` a secas
    // lo dejaba en 34 px en la esquina.
    gif: {
      width: '100%',
      height: '100%',
      borderWidth: 0,
      borderRadius: 0,
    },
    gifPlaceholder: {
      width: '100%',
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    nameBox: {
      width: '100%',
      height: NAME_LINES * NAME_LINE_HEIGHT,
      justifyContent: 'center',
    },
    name: {
      fontSize: 10.5,
      fontWeight: '800',
      lineHeight: NAME_LINE_HEIGHT,
      color: theme.colors.text,
      textAlign: 'center',
    },
    sets: {
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 13,
      color: theme.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
