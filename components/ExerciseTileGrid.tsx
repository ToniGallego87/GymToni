import { subscribeTheme } from '@lib/themeStore';
import React, { ReactNode, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { getCatalogExercise, thumbUrl } from '@data/exerciseCatalog';
import { buildTargetReps, ExerciseForm } from '@lib/exerciseForm';
import { ConfirmModal } from './ConfirmModal';
import { ExerciseGifButton } from './ExerciseGifButton';
import { SortableGrid } from './SortableGrid';

// Misma retícula que el menú del perfil (ProfileScreen): tres casillas por
// fila con el mismo hueco entre ellas. Ya no son cuadradas (ver `tile`): el
// GIF entero pide más alto que ancho.
const COLUMNS = 3;
const GAP = 12;
// Líneas que reserva el nombre (centrado en ese hueco si ocupa menos).
const NAME_LINES = 3;
const NAME_LINE_HEIGHT = 13;
// Alto de la fila de lápiz y papelera en edición (y del hueco que la iguala
// en la casilla de añadir).
const ACTIONS_HEIGHT = 32;
// Alto de la franja del asa (ver `SortableGrid`).
const HANDLE_HEIGHT = 22;

export interface ExerciseTile {
  id: string;
  name: string;
  catalogId?: string;
  targetSets?: number | string;
  targetReps?: number | string;
}

/** Filas del editor → casillas, con el plan escrito como en lectura. */
export function exerciseTilesFromForms(rows: ExerciseForm[]): ExerciseTile[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    catalogId: row.catalogId,
    targetSets: row.sets,
    targetReps: buildTargetReps(row),
  }));
}

/** Lo que hace falta para editar los ejercicios en la propia cuadrícula. */
export interface ExerciseTileEditing {
  onEdit: (id: string) => void;
  /** Ya confirmado: la cuadrícula pregunta antes de llamarlo. */
  onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onAdd: () => void;
  /** Un día guardado no puede quedarse sin ejercicios. */
  canRemove: boolean;
}

interface ExerciseTileGridProps {
  exercises: ExerciseTile[];
  /** Color del día: el punto que ocupa el sitio del GIF cuando no lo hay. */
  accent: string;
  /** Si llega, la cuadrícula está en edición (ver `ExerciseTileEditing`). */
  editing?: ExerciseTileEditing;
}

/**
 * Los ejercicios de un día como cuadrícula de casillas (el mismo dibujo que
 * las opciones del perfil): nombre arriba, el GIF entero en medio y series x
 * reps debajo, en gris y pequeño. Lo usan la ficha de la rutina propia, la de
 * una rutina de la comunidad y "Nueva rutina", para que un día se vea igual en
 * todas.
 *
 * En edición la cuadrícula NO cambia de forma: cada casilla gana una barrita
 * arriba para arrastrarla a cualquier hueco, y lápiz (abre el editor) y
 * papelera (pide confirmación) abajo; al final, una casilla "+" para añadir.
 * Antes editar cambiaba a una lista vertical de nombres sin GIF: otra
 * pantalla distinta para el mismo día.
 *
 * El GIF no se recorta (`fitMode="contain"`): se ve el movimiento entero, y
 * la casilla crece en alto lo que haga falta.
 */
export function ExerciseTileGrid({
  exercises,
  accent,
  editing,
}: ExerciseTileGridProps) {
  const [toRemove, setToRemove] = useState<ExerciseTile | null>(null);

  if (editing) {
    const removeName = toRemove?.name.trim();
    return (
      <>
        <SortableGrid
          items={exercises}
          keyOf={(exercise) => exercise.id}
          columns={COLUMNS}
          gap={GAP}
          onMove={editing.onMove}
          renderItem={(exercise, handle) => (
            <EditableTile
              exercise={exercise}
              accent={accent}
              handle={handle}
              canRemove={editing.canRemove}
              onEdit={() => editing.onEdit(exercise.id)}
              onRemove={() => setToRemove(exercise)}
            />
          )}
          trailing={<AddTile onPress={editing.onAdd} />}
        />
        <ConfirmModal
          visible={!!toRemove}
          icon="trash-can-outline"
          title={t('¿Quitar el ejercicio?')}
          message={
            removeName
              ? t('"{name}" desaparecerá de este día de la rutina.', {
                  name: removeName,
                })
              : t('El ejercicio desaparecerá de este día de la rutina.')
          }
          confirmLabel={t('Quitar')}
          onConfirm={() => {
            if (toRemove) editing.onRemove(toRemove.id);
            setToRemove(null);
          }}
          onCancel={() => setToRemove(null)}
        />
      </>
    );
  }

  const rows: ExerciseTile[][] = [];
  for (let i = 0; i < exercises.length; i += COLUMNS) {
    rows.push(exercises.slice(i, i + COLUMNS));
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((exercise) => (
            <View key={exercise.id} style={[styles.tile, styles.tileFlex]}>
              <TileName name={exercise.name} />
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
                <GifPlaceholder accent={accent} />
              )}
              <TileSets exercise={exercise} />
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

// Hueco fijo de tres líneas con el nombre centrado en vertical: así todos los
// GIF de una fila quedan a la misma altura tenga el nombre una línea o tres.
function TileName({ name }: { name: string }) {
  const trimmed = name.trim();
  return (
    <View style={styles.nameBox}>
      <Text
        style={[styles.name, !trimmed && styles.nameEmpty]}
        numberOfLines={NAME_LINES}
      >
        {trimmed || t('Sin nombre')}
      </Text>
    </View>
  );
}

function TileSets({ exercise }: { exercise: ExerciseTile }) {
  return (
    <Text style={styles.sets} numberOfLines={1}>
      {exercise.targetSets || '-'}x{exercise.targetReps || '-'}
    </Text>
  );
}

// Sin GIF asignado: el punto de color del día ocupa el mismo hueco para que
// los nombres queden a la misma altura.
function GifPlaceholder({ accent }: { accent: string }) {
  return (
    <View style={styles.gifPlaceholder}>
      <View style={[styles.dot, { backgroundColor: accent }]} />
    </View>
  );
}

interface EditableTileProps {
  exercise: ExerciseTile;
  accent: string;
  handle: ReactNode;
  canRemove: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

function EditableTile({
  exercise,
  accent,
  handle,
  canRemove,
  onEdit,
  onRemove,
}: EditableTileProps) {
  const catalogExercise = getCatalogExercise(exercise.catalogId);
  const name = exercise.name.trim() || t('Sin nombre');

  return (
    <View style={[styles.tile, styles.tileEditing]}>
      {handle}
      {/* El cuerpo entero también abre el editor: en edición el GIF no se
          reproduce, es la casilla del ejercicio que se está tocando. */}
      <Pressable
        style={({ pressed }) => [styles.tileBody, pressed && styles.pressed]}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={t('Editar {name}', { name })}
      >
        <TileName name={exercise.name} />
        {catalogExercise ? (
          <View style={styles.gifWrap}>
            <Image
              source={{ uri: thumbUrl(catalogExercise) }}
              style={styles.thumb}
              resizeMode="contain"
            />
          </View>
        ) : (
          <GifPlaceholder accent={accent} />
        )}
        <TileSets exercise={exercise} />
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          onPress={onEdit}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t('Editar {name}', { name })}
        >
          <MaterialCommunityIcons
            name="pencil-outline"
            size={18}
            color={theme.colors.primary}
          />
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable
          style={({ pressed }) => [
            styles.action,
            !canRemove && styles.disabled,
            pressed && styles.pressed,
          ]}
          onPress={onRemove}
          disabled={!canRemove}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t('Quitar ejercicio')}
        >
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={18}
            color={canRemove ? theme.colors.error : theme.colors.textSecondary}
          />
        </Pressable>
      </View>
    </View>
  );
}

// Casilla vacía con un "+": el sitio donde iría el siguiente ejercicio. Mide
// lo mismo que una casilla en edición (asa, nombre, GIF, plan y acciones) para
// no descuadrar la fila.
function AddTile({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.tile,
        styles.tileEditing,
        styles.addTile,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('Añadir ejercicio')}
    >
      <View style={{ height: HANDLE_HEIGHT }} />
      <View style={styles.tileBody}>
        <View style={styles.nameBox}>
          <Text style={styles.addLabel} numberOfLines={NAME_LINES}>
            {t('Añadir ejercicio')}
          </Text>
        </View>
        <View style={styles.gifPlaceholder}>
          <View style={styles.addCircle}>
            <MaterialCommunityIcons
              name="plus"
              size={28}
              color={theme.colors.primary}
            />
          </View>
        </View>
        <Text style={styles.sets}> </Text>
      </View>
      <View style={{ height: ACTIONS_HEIGHT }} />
    </Pressable>
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
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 8,
      ...theme.shadow.soft,
    },
    tileFlex: {
      flex: 1,
    },
    // En edición el asa y las acciones van a ras de los bordes de la casilla.
    tileEditing: {
      paddingTop: 0,
      paddingBottom: 0,
      gap: 0,
      overflow: 'hidden',
    },
    tileBody: {
      width: '100%',
      alignItems: 'center',
      gap: 4,
      paddingBottom: 6,
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
    thumb: {
      width: '100%',
      height: '100%',
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
    nameEmpty: {
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
      fontWeight: '600',
    },
    sets: {
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 13,
      color: theme.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    // Lápiz y papelera a partes iguales, separados por una raya: la fila es
    // el pie de la casilla, a ras de sus bordes.
    actions: {
      alignSelf: 'stretch',
      marginHorizontal: -8,
      height: ACTIONS_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    action: {
      flex: 1,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionDivider: {
      width: 1,
      height: '60%',
      backgroundColor: theme.colors.border,
    },
    addTile: {
      borderStyle: 'dashed',
      borderColor: theme.colors.primaryLine,
      backgroundColor: 'transparent',
      shadowOpacity: 0,
      elevation: 0,
    },
    addLabel: {
      fontSize: 10.5,
      fontWeight: '800',
      lineHeight: NAME_LINE_HEIGHT,
      color: theme.colors.primary,
      textAlign: 'center',
    },
    addCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: theme.colors.primaryLine,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.8,
    },
    disabled: {
      opacity: 0.4,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
