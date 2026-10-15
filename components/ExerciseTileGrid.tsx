import { subscribeTheme } from '@lib/themeStore';
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { getCatalogExercise, thumbUrl } from '@data/exerciseCatalog';
import { buildTargetReps, ExerciseForm } from '@lib/exerciseForm';
import { ConfirmModal } from './ConfirmModal';
import { ExerciseGifButton, GifCornerBadge } from './ExerciseGifButton';
import { SortableGrid } from './SortableGrid';
import { TrendDelta } from './TrendDelta';

// Misma retícula que el menú del perfil (ProfileScreen): tres casillas por
// fila con el mismo hueco entre ellas. Ya no son cuadradas (ver `tile`): el
// GIF entero pide más alto que ancho.
const COLUMNS = 3;
const GAP = 12;
// Registro (`selection`): ruleta horizontal bajo un marco fijo (ver
// `ExerciseWheel`). Todas las casillas se maquetan a WHEEL_BIG y se ESCALAN:
// a tamaño completo en el marco y a WHEEL_SMALL fuera (textos incluidos).
const COMPACT_NAME_LINES = 2;
const COMPACT_NAME_LINE_HEIGHT = 17;
// Pie de la casilla (0/3): el cuerpo del nombre y, en la del marco, mayor (ver
// `setsSelected`); el alto es el de la mayor.
const COMPACT_FOOT_HEIGHT = 24;
const WHEEL_BIG = 146;
const WHEEL_SMALL = 100;
const WHEEL_GAP = 10;
const WHEEL_SMALL_SCALE = WHEEL_SMALL / WHEEL_BIG;
// Miniatura: fracción del ancho interior de la casilla (`thumbCompact`).
const WHEEL_THUMB_RATIO = 0.86;
// Paso del encaje: lo que separa dos casillas pequeñas.
const WHEEL_STEP = WHEEL_SMALL + WHEEL_GAP;
// Lo que se apartan las vecinas cuando la del marco está grande.
const WHEEL_PUSH = (WHEEL_BIG - WHEEL_SMALL) / 2;
// Alto de la casilla grande, calculado (no medido) para que el marco lo sepa
// desde el primer frame: borde y padding (1 + 6 por lado; el adicional, 2 + 5),
// nombre, pie, los dos huecos entre ellos (4) y la miniatura cuadrada.
// Si cambian esos estilos, cambia esto.
const WHEEL_TILE_CHROME = 2 * (1 + 6);
const WHEEL_BIG_HEIGHT =
  WHEEL_TILE_CHROME +
  COMPACT_NAME_LINES * COMPACT_NAME_LINE_HEIGHT +
  COMPACT_FOOT_HEIGHT +
  2 * 4 +
  WHEEL_THUMB_RATIO * (WHEEL_BIG - WHEEL_TILE_CHROME);
// Aire arriba y abajo para la sombra de las casillas (el ScrollView recorta).
const WHEEL_SHADOW_ROOM = 5;
const WHEEL_HEIGHT = WHEEL_BIG_HEIGHT + WHEEL_SHADOW_ROOM * 2;
// Soltar sin inercia: espera antes de elegir (ver `endDrag`).
const SETTLE_FALLBACK_MS = 150;
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
  /** Ejercicio adicional del registro (no es del día): borde azul. */
  extra?: boolean;
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

/** Cómo va un ejercicio en el registro (pie de su casilla). */
export interface ExerciseTileProgress {
  /** Series hechas de verdad (las saltadas no cuentan). */
  done: number;
  /** Objetivo de series (0: sin objetivo). */
  target: number;
  completed: boolean;
  /** Lleva nota escrita: marca en la miniatura. */
  hasNote?: boolean;
  /** Mejora frente a la vez anterior, si ya hay con qué comparar. */
  trend?: { percent: number; isImproved: boolean } | null;
}

/** El registro: una casilla elegida (borde de oro) cuyo panel va debajo. */
export interface ExerciseTileSelection {
  selectedId: string | null;
  onSelect: (id: string) => void;
  progressOf: (id: string) => ExerciseTileProgress;
  /** Fija un GIF del catálogo al ejercicio (desde la lupa de la elegida). */
  onAssignGif?: (id: string, catalogId: string) => void;
  /** "+" al final de la ruleta: añadir un ejercicio adicional a la sesión. */
  onAdd?: () => void;
  /**
   * Padding lateral de la pantalla: la tira sangra hasta el borde (las
   * casillas se deslizan por debajo) y arranca alineada con el resto.
   */
  inset?: number;
}

interface ExerciseTileGridProps {
  exercises: ExerciseTile[];
  /** Color del día: el punto que ocupa el sitio del GIF cuando no lo hay. */
  accent: string;
  /** Si llega, la cuadrícula está en edición (ver `ExerciseTileEditing`). */
  editing?: ExerciseTileEditing;
  /** Si llega, cada casilla se elige con un toque (ver `ExerciseTileSelection`). */
  selection?: ExerciseTileSelection;
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
 *
 * En el registro (`selection`) las casillas van en una sola fila deslizable y
 * cada una se elige con un toque: la elegida lleva borde de oro, el play de su
 * GIF y el pie dice las series hechas de su objetivo. El panel para meterlas lo
 * pinta el registro bajo la tira.
 */
export function ExerciseTileGrid({
  exercises,
  accent,
  editing,
  selection,
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

  if (selection) {
    return (
      <ExerciseWheel
        exercises={exercises}
        accent={accent}
        selection={selection}
      />
    );
  }

  const columns = COLUMNS;
  const rows: ExerciseTile[][] = [];
  for (let i = 0; i < exercises.length; i += columns) {
    rows.push(exercises.slice(i, i + columns));
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
          {row.length < columns &&
            Array.from({ length: columns - row.length }).map((_, i) => (
              <View key={`spacer-${i}`} style={styles.spacer} />
            ))}
        </View>
      ))}
    </View>
  );
}

// Hueco fijo de tres líneas (dos en compacto) con el nombre centrado en
// vertical: así todos los GIF de una fila quedan a la misma altura tenga el
// nombre una línea o tres.
function TileName({
  name,
  lines = NAME_LINES,
  compact,
}: {
  name: string;
  lines?: number;
  /** Casilla del registro: letra algo mayor (la casilla también lo es). */
  compact?: boolean;
}) {
  const trimmed = name.trim();
  const lineHeight = compact ? COMPACT_NAME_LINE_HEIGHT : NAME_LINE_HEIGHT;
  return (
    <View style={[styles.nameBox, { height: lines * lineHeight }]}>
      <Text
        style={[
          styles.name,
          compact && styles.nameCompact,
          !trimmed && styles.nameEmpty,
        ]}
        numberOfLines={lines}
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
function GifPlaceholder({
  accent,
  compact,
  badge,
}: {
  accent: string;
  compact?: boolean;
  badge?: ReactNode;
}) {
  return (
    <View style={[styles.gifPlaceholder, compact && styles.thumbCompact]}>
      {badge}
      <View style={[styles.dot, { backgroundColor: accent }]} />
    </View>
  );
}

// Miniatura quieta del catálogo (o el punto del día): en edición y en el
// registro la casilla se pulsa para otra cosa, no para ver el GIF.
function TileThumb({
  catalogId,
  accent,
  compact,
  badge,
}: {
  catalogId?: string;
  accent: string;
  compact?: boolean;
  /** Marca en la esquina de la miniatura (la nota del registro). */
  badge?: ReactNode;
}) {
  const catalogExercise = getCatalogExercise(catalogId);
  if (!catalogExercise) {
    return <GifPlaceholder accent={accent} compact={compact} badge={badge} />;
  }
  return (
    <View style={[styles.gifWrap, compact && styles.thumbCompact]}>
      <Image
        source={{ uri: thumbUrl(catalogExercise) }}
        style={styles.thumb}
        resizeMode="contain"
      />
      {badge}
    </View>
  );
}

/**
 * Registro: los ejercicios como una ruleta horizontal bajo un marco de oro
 * FIJO en el centro. Se arrastra la fila; el ejercicio que encaja en el marco
 * es el elegido y su panel sale debajo. Al soltar, la casilla con más de la
 * mitad dentro se encaja sola (`snapToInterval`). Las casillas crecen al
 * acercarse al marco y encogen al alejarse, siguiendo al dedo (`WheelSlot`).
 *
 * Tocar una casilla la lleva al marco; y si la elegida cambia desde fuera
 * (al completar un ejercicio se pasa al siguiente), la ruleta gira sola.
 */
function ExerciseWheel({
  exercises,
  accent,
  selection,
}: {
  exercises: ExerciseTile[];
  accent: string;
  selection: ExerciseTileSelection;
}) {
  const { selectedId, inset = 0 } = selection;
  const scrollRef = useRef<Animated.ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const selectedIndex = exercises.findIndex((e) => e.id === selectedId);
  const scrollX = useSharedValue(Math.max(0, selectedIndex) * WHEEL_STEP);
  // Primera colocación sin animación: al entrar, la ruleta ya está en su sitio.
  const placedRef = useRef(false);
  const draggingRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lo último que llegó por props, para los avisos del gesto (que llegan del
  // hilo de UI a funciones estables).
  const latestRef = useRef({
    exercises,
    selectedId,
    onSelect: selection.onSelect,
  });
  latestRef.current = { exercises, selectedId, onSelect: selection.onSelect };

  const cancelSettle = useCallback(() => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;
  }, []);

  // La ruleta se ha parado en `x`: elige el ejercicio del marco.
  const settle = useCallback(
    (x: number) => {
      cancelSettle();
      const {
        exercises: list,
        selectedId: current,
        onSelect,
      } = latestRef.current;
      const index = Math.min(
        list.length - 1,
        Math.max(0, Math.round(x / WHEEL_STEP))
      );
      const id = list[index]?.id;
      if (id && id !== current) onSelect(id);
    },
    [cancelSettle]
  );

  const beginDrag = useCallback(() => {
    draggingRef.current = true;
    cancelSettle();
  }, [cancelSettle]);

  // Al soltar casi siempre sigue un encaje con inercia (y su fin elige). Por
  // si no llega —soltar justo en su sitio—, se elige igual tras un momento.
  const endDrag = useCallback(
    (x: number) => {
      draggingRef.current = false;
      cancelSettle();
      settleTimerRef.current = setTimeout(() => settle(x), SETTLE_FALLBACK_MS);
    },
    [cancelSettle, settle]
  );

  useEffect(() => cancelSettle, [cancelSettle]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
    onBeginDrag: () => {
      runOnJS(beginDrag)();
    },
    onEndDrag: (e) => {
      runOnJS(endDrag)(e.contentOffset.x);
    },
    onMomentumBegin: () => {
      runOnJS(cancelSettle)();
    },
    onMomentumEnd: (e) => {
      runOnJS(settle)(e.contentOffset.x);
    },
  });

  useEffect(() => {
    if (!viewportWidth || selectedIndex < 0 || draggingRef.current) return;
    const x = selectedIndex * WHEEL_STEP;
    scrollRef.current?.scrollTo({ x, animated: placedRef.current });
    if (!placedRef.current) scrollX.value = x;
    placedRef.current = true;
  }, [selectedIndex, viewportWidth, scrollX]);

  // Aire a los lados para que el primero y el último también lleguen al marco.
  const sidePadding = Math.max(0, (viewportWidth - WHEEL_STEP) / 2);

  return (
    <View
      style={[styles.wheel, { marginHorizontal: -inset }]}
      onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
    >
      {viewportWidth > 0 && (
        <>
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={WHEEL_STEP}
            decelerationRate="fast"
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingLeft: sidePadding }}
          >
            {exercises.map((exercise, index) => (
              <WheelSlot key={exercise.id} index={index} scrollX={scrollX}>
                <SelectableTile
                  exercise={exercise}
                  accent={accent}
                  selected={exercise.id === selectedId}
                  progress={selection.progressOf(exercise.id)}
                  onPress={() => selection.onSelect(exercise.id)}
                  onAssignGif={
                    selection.onAssignGif
                      ? (catalogId) =>
                          selection.onAssignGif?.(exercise.id, catalogId)
                      : undefined
                  }
                />
              </WheelSlot>
            ))}
            {/* Aire de la derecha (el mismo que el padding izquierdo): con él
              el último llega al marco y no más allá. El "+" vive DENTRO de
              ese aire, en el sitio del siguiente: se ve junto al último pero
              la ruleta no puede encajarlo en el marco. */}
            <View style={{ width: sidePadding }}>
              {!!selection.onAdd && <WheelAddTile onPress={selection.onAdd} />}
            </View>
          </Animated.ScrollView>
          {/* El marco: fijo, encima, y deja pasar los toques (el play). Con
            un adicional dentro lleva por dentro su anillo azul. */}
          <View
            pointerEvents="none"
            style={[
              styles.wheelFrame,
              { left: (viewportWidth - WHEEL_BIG) / 2 },
            ]}
          >
            {!!exercises[selectedIndex]?.extra && (
              <View style={styles.wheelFrameExtra} />
            )}
          </View>
        </>
      )}
    </View>
  );
}

/**
 * Hueco de una casilla en la ruleta: todos miden lo mismo (el paso del
 * encaje); la casilla de dentro se escala según su distancia al marco —entera
 * en él, pequeña a partir de un paso, y todo su contenido con ella— y se
 * aparta lo que crece la del marco, para que entre casilla y casilla quede
 * siempre el mismo hueco.
 */
function WheelSlot({
  index,
  scrollX,
  children,
}: {
  index: number;
  scrollX: SharedValue<number>;
  children: ReactNode;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const offset = index - scrollX.value / WHEEL_STEP;
    const distance = Math.min(Math.abs(offset), 1);
    return {
      transform: [
        // Primero el desplazamiento: así no lo encoge la escala.
        { translateX: Math.sign(offset) * WHEEL_PUSH * distance },
        { scale: interpolate(distance, [0, 1], [1, WHEEL_SMALL_SCALE]) },
      ],
    };
  });
  return (
    <View style={styles.wheelSlot}>
      <Animated.View style={[styles.wheelTile, animatedStyle]}>
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * "+" de la ruleta: añadir un ejercicio adicional. Mismo tamaño y sitio que
 * una casilla pequeña más allá de la última (siempre fuera del marco), con
 * borde punteado como la casilla de añadir de la rutina.
 */
function WheelAddTile({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.wheelSlot}>
      <View
        style={[
          styles.wheelTile,
          {
            transform: [
              { translateX: WHEEL_PUSH },
              { scale: WHEEL_SMALL_SCALE },
            ],
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.tile,
            styles.tileCompact,
            styles.addTile,
            styles.wheelAddTile,
            pressed && styles.pressed,
          ]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={t('Añadir ejercicio')}
        >
          <View style={styles.addCircle}>
            <MaterialCommunityIcons
              name="plus"
              size={30}
              color={theme.colors.primary}
            />
          </View>
          <Text style={[styles.addLabel, styles.nameCompact]} numberOfLines={2}>
            {t('Añadir ejercicio')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

interface SelectableTileProps {
  exercise: ExerciseTile;
  accent: string;
  selected: boolean;
  progress: ExerciseTileProgress;
  onPress: () => void;
  onAssignGif?: (catalogId: string) => void;
}

// Casilla del registro: la del marco es la elegida, y un toque en otra la lleva
// al marco. Una completada lleva borde verde con su check y la mejora frente a
// la vez anterior (o las series hechas, si alguna se saltó). Con nota, un icono
// arriba a la derecha de la miniatura.
//
// La elegida enseña el GIF EN MOVIMIENTO (solo ella: uno a la vez) con una lupa
// amarilla abajo a la derecha: un toque lo amplía en el visor. Sin GIF
// asignado, la lupa de buscar uno.
function SelectableTile({
  exercise,
  accent,
  selected,
  progress,
  onPress,
  onAssignGif,
}: SelectableTileProps) {
  const name = exercise.name.trim() || t('Sin nombre');
  const { done, target, completed, hasNote, trend } = progress;
  // Completado con alguna serie saltada: se dice cuántas se hicieron (2/3),
  // no la mejora.
  const showTrend = completed && !!trend && done >= target;
  const noteBadge = hasNote ? (
    <View
      style={styles.noteBadge}
      accessible
      accessibilityLabel={t('Nota del ejercicio')}
    >
      <MaterialCommunityIcons
        name="note-text"
        size={11}
        color={theme.colors.onGold}
      />
    </View>
  ) : null;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.tile,
        styles.tileCompact,
        completed && styles.tileCompleted,
        exercise.extra && styles.tileExtra,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={
        target > 0
          ? `${name}. ${t('{a} de {b} series hechas', { a: done, b: target })}`
          : name
      }
    >
      <TileName name={exercise.name} lines={COMPACT_NAME_LINES} compact />
      {/* La miniatura fija está SIEMPRE (elegir no la recarga: antes se
          cambiaba por la del botón de GIF y parpadeaba); la elegida gana
          encima la capa con el GIF en movimiento y la lupa. */}
      <TileThumb
        catalogId={exercise.catalogId}
        accent={accent}
        compact
        badge={
          <>
            {selected ? (
              <ExerciseGifButton
                name={exercise.name}
                catalogId={exercise.catalogId}
                onAssign={onAssignGif}
                layer
              />
            ) : (
              // Fuera del marco la lupa solo se ve (el toque lleva la
              // casilla al marco, y ahí ya amplía).
              <GifCornerBadge search={!exercise.catalogId} />
            )}
            {noteBadge}
          </>
        }
      />
      <View style={styles.progressRow}>
        {completed && (
          <MaterialCommunityIcons
            name="check-circle"
            size={14}
            color={theme.colors.success}
          />
        )}
        {showTrend && trend ? (
          <TrendDelta
            value={trend.percent}
            improved={trend.isImproved}
            iconSize={12}
            textStyle={styles.progressTrend}
          />
        ) : target > 0 ? (
          // Mismo dibujo que el recuento de retos de Inicio (ChallengesStrip):
          // las hechas grandes y en color —oro; azul si es adicional; verde
          // si está completo— y "/objetivo" pequeño en blanco. En el marco,
          // todo más grande.
          <View style={styles.countRow}>
            <Text
              style={[
                styles.countDone,
                selected && styles.countDoneSelected,
                exercise.extra && styles.countDoneExtra,
                completed && styles.setsCompleted,
              ]}
            >
              {done}
            </Text>
            <Text
              style={[styles.countTotal, selected && styles.countTotalSelected]}
            >
              /{target}
            </Text>
          </View>
        ) : (
          <Text style={[styles.sets, styles.setsCompact]} numberOfLines={1}>
            {`${exercise.targetSets || '-'}x${exercise.targetReps || '-'}`}
          </Text>
        )}
      </View>
    </Pressable>
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
        <TileThumb catalogId={exercise.catalogId} accent={accent} />
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
    // Registro: la casilla elegida, con borde de oro más grueso (el padding
    // cede lo que gana el borde para que la casilla no crezca).
    // Registro: el ancho lo pone `WheelSlot` (animado). Padding, borde y
    // huecos entran en WHEEL_BIG_HEIGHT.
    tileCompact: {
      width: '100%',
      padding: 6,
      gap: 4,
    },
    wheel: {
      height: WHEEL_HEIGHT,
    },
    wheelSlot: {
      width: WHEEL_STEP,
      height: WHEEL_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Maquetada siempre a tamaño completo (más ancha que su hueco, centrada):
    // la escala de `WheelSlot` la encoge.
    wheelTile: {
      width: WHEEL_BIG,
    },
    // Borde más grueso que el de la rutina: escalado a casilla pequeña, el de
    // 1 px se quedaba en un hilo.
    wheelAddTile: {
      borderWidth: 2,
      padding: 5,
      height: WHEEL_BIG_HEIGHT,
      justifyContent: 'center',
      gap: 10,
    },
    // El marco fijo: el mismo borde de oro que el panel de debajo.
    wheelFrame: {
      position: 'absolute',
      top: WHEEL_SHADOW_ROOM,
      width: WHEEL_BIG,
      height: WHEEL_BIG_HEIGHT,
      borderWidth: 3,
      borderColor: theme.colors.primaryLine,
      borderRadius: theme.borderRadius.md,
    },
    // Anillo azul del adicional, por dentro del oro (tapa el borde azul de la
    // propia casilla, que queda debajo del marco).
    wheelFrameExtra: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderWidth: 3,
      borderColor: theme.colors.emoji_blue,
      borderRadius: theme.borderRadius.md - 3,
    },
    // Miniatura del registro: algo más estrecha que la casilla, centrada.
    thumbCompact: {
      width: `${WHEEL_THUMB_RATIO * 100}%`,
    },
    tileCompleted: {
      borderColor: theme.colors.success,
    },
    // Adicional (no es del día): borde azul más grueso; el padding cede lo que
    // gana el borde para que mida lo mismo (WHEEL_BIG_HEIGHT).
    tileExtra: {
      borderWidth: 2,
      padding: 5,
      borderColor: theme.colors.emoji_blue,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: COMPACT_FOOT_HEIGHT,
    },
    setsCompact: {
      fontSize: 13,
      fontWeight: '800',
      lineHeight: COMPACT_FOOT_HEIGHT,
    },
    countRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    countDone: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.primary,
      fontVariant: ['tabular-nums'],
    },
    countDoneSelected: {
      fontSize: 20,
      lineHeight: COMPACT_FOOT_HEIGHT,
    },
    countDoneExtra: {
      color: theme.colors.emoji_blue,
    },
    countTotal: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
    },
    countTotalSelected: {
      fontSize: 14,
    },
    setsCompleted: {
      color: theme.colors.success,
    },
    // Nota del ejercicio: insignia dorada (oro de superficie con su tinta)
    // arriba a la derecha de la miniatura (abajo va el play de la elegida);
    // destaca sobre el fondo claro de los GIF del catálogo en día y en noche.
    noteBadge: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryFill,
    },
    progressTrend: {
      fontSize: 13,
      lineHeight: COMPACT_FOOT_HEIGHT,
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
    nameCompact: {
      fontSize: 13,
      lineHeight: COMPACT_NAME_LINE_HEIGHT,
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
