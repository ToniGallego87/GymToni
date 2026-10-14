import { subscribeTheme } from '@lib/themeStore';
import React, { ReactNode, useCallback, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';

/**
 * Cuadrícula cuyas casillas se reordenan arrastrando por un asa, en cualquier
 * dirección: el hermano en 2D de `SortableList` (mismo enfoque: `Gesture.Pan`
 * en el asa y Reanimated para que la casilla cogida siga al dedo y las demás
 * se corran a su hueco nuevo).
 *
 * Cada casilla mide su caja con `onLayout`; el destino es el hueco cuyo centro
 * queda más cerca del centro de la casilla cogida. Al soltar, `onMove(from,
 * to)` recibe las posiciones en la lista tal como estaba.
 *
 * `trailing` es una casilla extra al final (el "+" de añadir ejercicio): ocupa
 * su hueco en la retícula pero ni se arrastra ni es destino.
 */
interface SortableGridProps<T> {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, handle: ReactNode, index: number) => ReactNode;
  onMove: (from: number, to: number) => void;
  columns?: number;
  gap?: number;
  trailing?: ReactNode;
}

const SHIFT_MS = 160;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function SortableGrid<T>({
  items,
  keyOf,
  renderItem,
  onMove,
  columns = 3,
  gap = 12,
  trailing,
}: SortableGridProps<T>) {
  const [width, setWidth] = useState(0);
  const boxesRef = useRef<Box[]>([]);
  const boxes = useSharedValue<Box[]>([]);
  const activeIndex = useSharedValue(-1);
  const targetIndex = useSharedValue(-1);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  // Remontar tras cada movimiento, como `SortableList`: reordenar vistas
  // nativas con transforms y elevación en Android dejaba huecos en blanco.
  const [version, setVersion] = useState(0);
  const handleMove = useCallback(
    (from: number, to: number) => {
      activeIndex.value = -1;
      targetIndex.value = -1;
      dragX.value = 0;
      dragY.value = 0;
      if (from === to) return;
      boxesRef.current = [];
      onMove(from, to);
      setVersion((v) => v + 1);
    },
    [onMove, activeIndex, targetIndex, dragX, dragY]
  );

  const onCellLayout = useCallback(
    (index: number, e: LayoutChangeEvent) => {
      const { x, y, width: w, height: h } = e.nativeEvent.layout;
      const prev = boxesRef.current[index];
      if (prev && prev.x === x && prev.y === y && prev.w === w && prev.h === h)
        return;
      boxesRef.current[index] = { x, y, w, h };
      boxes.value = [...boxesRef.current];
    },
    [boxes]
  );

  if (boxesRef.current.length > items.length) {
    boxesRef.current.length = items.length;
  }

  // Ancho de casilla: el del contenedor repartido entre las columnas. Hasta
  // medirlo no se pinta nada (un frame), para no saltar de tamaño.
  const cellWidth = width > 0 ? (width - gap * (columns - 1)) / columns : 0;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.container}
    >
      {cellWidth > 0 && (
        <View key={version} style={[styles.grid, { gap }]}>
          {items.map((item, index) => (
            <SortableCell
              key={keyOf(item)}
              index={index}
              count={items.length}
              width={cellWidth}
              boxes={boxes}
              activeIndex={activeIndex}
              targetIndex={targetIndex}
              dragX={dragX}
              dragY={dragY}
              onLayout={(e) => onCellLayout(index, e)}
              onMove={handleMove}
            >
              {(handle) => renderItem(item, handle, index)}
            </SortableCell>
          ))}
          {!!trailing && <View style={{ width: cellWidth }}>{trailing}</View>}
        </View>
      )}
    </View>
  );
}

interface SortableCellProps {
  index: number;
  count: number;
  width: number;
  boxes: SharedValue<Box[]>;
  activeIndex: SharedValue<number>;
  targetIndex: SharedValue<number>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  onLayout: (e: LayoutChangeEvent) => void;
  onMove: (from: number, to: number) => void;
  children: (handle: ReactNode) => ReactNode;
}

/** Hueco cuyo centro queda más cerca del centro de la casilla cogida. */
function targetFor(
  boxes: Box[],
  active: number,
  dx: number,
  dy: number,
  count: number
): number {
  'worklet';
  const from = boxes[active];
  if (!from) return active;
  const cx = from.x + from.w / 2 + dx;
  const cy = from.y + from.h / 2 + dy;
  let best = active;
  let bestDistance = Number.MAX_VALUE;
  for (let i = 0; i < count; i++) {
    const box = boxes[i];
    if (!box) continue;
    const ddx = box.x + box.w / 2 - cx;
    const ddy = box.y + box.h / 2 - cy;
    const distance = ddx * ddx + ddy * ddy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

function SortableCell({
  index,
  count,
  width,
  boxes,
  activeIndex,
  targetIndex,
  dragX,
  dragY,
  onLayout,
  onMove,
  children,
}: SortableCellProps) {
  const pan = Gesture.Pan()
    // Se activa al primer movimiento en cualquier eje para ganarle al scroll
    // de fuera: el asa existe para esto.
    .activeOffsetX([-3, 3])
    .activeOffsetY([-3, 3])
    .onStart(() => {
      'worklet';
      activeIndex.value = index;
      targetIndex.value = index;
      dragX.value = 0;
      dragY.value = 0;
    })
    .onUpdate((e) => {
      'worklet';
      dragX.value = e.translationX;
      dragY.value = e.translationY;
      targetIndex.value = targetFor(
        boxes.value,
        index,
        e.translationX,
        e.translationY,
        count
      );
    })
    .onEnd(() => {
      'worklet';
      const to = targetIndex.value;
      // Encaja la casilla en su hueco (las demás ya se han corrido) y deja que
      // el padre reordene; el reset lo hace la cuadrícula (ver `handleMove`).
      const from = boxes.value[index];
      const dest = boxes.value[to];
      if (from && dest) {
        dragX.value = withTiming(dest.x - from.x, { duration: 120 });
        dragY.value = withTiming(dest.y - from.y, { duration: 120 });
      }
      runOnJS(onMove)(index, to);
    });

  // Sin `zIndex` animado (ver `SortableList`): la casilla cogida va encima
  // por su `elevation`.
  const style = useAnimatedStyle(() => {
    const active = activeIndex.value;
    if (active === index) {
      return {
        transform: [
          { translateX: dragX.value },
          { translateY: dragY.value },
          { scale: 1.04 },
        ],
        shadowOpacity: 0.22,
        elevation: 8,
      };
    }
    if (active < 0) {
      return {
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
        shadowOpacity: 0,
        elevation: 0,
      };
    }
    // Las que quedan entre el origen y el destino se corren un hueco hacia el
    // que deja libre la casilla cogida.
    const target = targetIndex.value;
    let slot = index;
    if (index > active && index <= target) slot = index - 1;
    else if (index < active && index >= target) slot = index + 1;
    const own = boxes.value[index];
    const dest = boxes.value[slot];
    const shiftX = own && dest ? dest.x - own.x : 0;
    const shiftY = own && dest ? dest.y - own.y : 0;
    return {
      transform: [
        { translateX: withTiming(shiftX, { duration: SHIFT_MS }) },
        { translateY: withTiming(shiftY, { duration: SHIFT_MS }) },
        { scale: 1 },
      ],
      shadowOpacity: 0,
      elevation: 0,
    };
  });

  const handle = (
    <GestureDetector gesture={pan}>
      <View
        style={styles.handle}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('Arrastra para mover')}
        hitSlop={{ top: 6, bottom: 4, left: 4, right: 4 }}
      >
        <View style={styles.handleBar} />
      </View>
    </GestureDetector>
  );

  return (
    <Animated.View style={[styles.cell, { width }, style]} onLayout={onLayout}>
      {children(handle)}
    </Animated.View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: {
      width: '100%',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cell: {
      ...theme.shadow.card,
      shadowOpacity: 0,
      elevation: 0,
    },
    // Asa: una barrita a lo ancho de la casilla, como el tirador de una hoja
    // inferior. La zona de toque es toda la franja, no solo la barra.
    handle: {
      alignSelf: 'stretch',
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    handleBar: {
      width: 32,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.colors.textSecondary,
      opacity: 0.7,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
