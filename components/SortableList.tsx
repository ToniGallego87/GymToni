import { subscribeTheme } from '@lib/themeStore';
import React, { ReactNode, useCallback, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
 * Lista vertical cuyas filas se reordenan arrastrando por un asa.
 *
 * Sin librería de listas: `Gesture.Pan` sobre el asa (ya presente por el
 * pager y el estiramiento del scroll) y Reanimated para que la fila cogida siga
 * al dedo y las demás se aparten. Cada fila mide su alto con `onLayout`, así
 * que las filas pueden tener alturas distintas (un nombre a dos líneas).
 *
 * El asa se entrega a `renderItem` para que cada fila la coloque donde quiera:
 * el gesto vive SOLO ahí, el resto de la fila sigue tocándose con normalidad.
 * Cuando el arrastre se activa cancela el scroll de fuera (RNGH cancela los
 * gestos que no son simultáneos con el que se activa), así que la lista no se
 * desplaza mientras se coge una fila.
 *
 * Al soltar, `onMove(from, to)` recibe la posición de origen y la de destino en
 * la lista tal como estaba: quien la usa reordena su estado.
 */
interface SortableListProps<T> {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, handle: ReactNode, index: number) => ReactNode;
  onMove: (from: number, to: number) => void;
  /** Separación entre filas (la lista la pinta ella: no usar `gap` fuera). */
  gap?: number;
  /**
   * Ancho de la zona de toque del asa y tamaño de su icono. Por defecto, el
   * histórico (28 / 22); los días de una rutina piden un asa más grande (ver
   * `RoutineDetailScreen`), así que lo puede pedir quien use la lista.
   */
  handleWidth?: number;
  handleIconSize?: number;
  /**
   * Estilo extra para la zona de toque del asa: la usa la lista de días para
   * salirse del `padding` de la tarjeta (margen negativo) y quedar a ras del
   * borde izquierdo sin tocar el resto de filas que usan esta misma lista.
   */
  handleStyle?: StyleProp<ViewStyle>;
}

const SHIFT_MS = 160;

export function SortableList<T>({
  items,
  keyOf,
  renderItem,
  onMove,
  gap = 10,
  handleWidth,
  handleIconSize,
  handleStyle,
}: SortableListProps<T>) {
  // Altos medidos de cada fila (índice = posición en `items`). Se copian a un
  // shared value en cada medida para que el hilo de UI calcule destinos.
  const heightsRef = useRef<number[]>([]);
  const heights = useSharedValue<number[]>([]);
  const activeIndex = useSharedValue(-1);
  const targetIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);

  // Tras cada movimiento la lista se REMONTA entera (`key` = versión): las
  // filas nuevas nacen ya en el orden nuevo y sin transforms, y no se
  // reordenan vistas nativas. Reordenar hijos con transforms y elevación en
  // Android dejaba filas en blanco (hueco vacío donde debía verse una) y,
  // antes, un parpadeo con el orden viejo. Los shared values se limpian en el
  // mismo tick que el cambio de estado, así que las filas viejas desaparecen
  // con su desplazamiento puesto y las nuevas aparecen en su sitio.
  const [version, setVersion] = useState(0);
  const handleMove = useCallback(
    (from: number, to: number) => {
      activeIndex.value = -1;
      targetIndex.value = -1;
      dragY.value = 0;
      if (from === to) return;
      heightsRef.current = [];
      onMove(from, to);
      setVersion((v) => v + 1);
    },
    [onMove, activeIndex, targetIndex, dragY]
  );

  const onRowLayout = useCallback(
    (index: number, e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (heightsRef.current[index] === h) return;
      heightsRef.current[index] = h;
      heights.value = [...heightsRef.current];
    },
    [heights]
  );

  // Si la lista encoge, las medidas sobrantes no deben quedarse.
  if (heightsRef.current.length > items.length) {
    heightsRef.current.length = items.length;
  }

  return (
    <View key={version}>
      {items.map((item, index) => (
        <SortableRow
          key={keyOf(item)}
          index={index}
          count={items.length}
          gap={gap}
          heights={heights}
          activeIndex={activeIndex}
          targetIndex={targetIndex}
          dragY={dragY}
          onLayout={(e) => onRowLayout(index, e)}
          onMove={handleMove}
          handleWidth={handleWidth}
          handleIconSize={handleIconSize}
          handleStyle={handleStyle}
        >
          {(handle) => renderItem(item, handle, index)}
        </SortableRow>
      ))}
    </View>
  );
}

interface SortableRowProps {
  index: number;
  count: number;
  gap: number;
  heights: SharedValue<number[]>;
  activeIndex: SharedValue<number>;
  targetIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  onLayout: (e: LayoutChangeEvent) => void;
  onMove: (from: number, to: number) => void;
  children: (handle: ReactNode) => ReactNode;
  handleWidth?: number;
  handleIconSize?: number;
  handleStyle?: StyleProp<ViewStyle>;
}

/** Posición (top) de la fila `i` en la lista sin mover nada. */
function topOf(heights: number[], gap: number, i: number): number {
  'worklet';
  let y = 0;
  for (let k = 0; k < i; k++) y += (heights[k] ?? 0) + gap;
  return y;
}

/** A qué hueco cae el centro de la fila cogida con el desplazamiento actual. */
function targetFor(
  heights: number[],
  gap: number,
  active: number,
  dy: number,
  count: number
): number {
  'worklet';
  const center = topOf(heights, gap, active) + dy + (heights[active] ?? 0) / 2;
  let y = 0;
  for (let i = 0; i < count; i++) {
    const h = (heights[i] ?? 0) + gap;
    if (center < y + h) return i;
    y += h;
  }
  return count - 1;
}

function SortableRow({
  index,
  count,
  gap,
  heights,
  activeIndex,
  targetIndex,
  dragY,
  onLayout,
  onMove,
  children,
  handleWidth = 28,
  handleIconSize = 22,
  handleStyle,
}: SortableRowProps) {
  const pan = Gesture.Pan()
    // Se activa con un desplazamiento mínimo para ganarle al scroll de fuera:
    // el asa existe para esto, no hace falta esperar.
    .activeOffsetY([-3, 3])
    .onStart(() => {
      'worklet';
      activeIndex.value = index;
      targetIndex.value = index;
      dragY.value = 0;
    })
    .onUpdate((e) => {
      'worklet';
      dragY.value = e.translationY;
      targetIndex.value = targetFor(
        heights.value,
        gap,
        index,
        e.translationY,
        count
      );
    })
    .onEnd(() => {
      'worklet';
      const to = targetIndex.value;
      // Encaja la fila en su hueco (las demás ya están apartadas) y deja que
      // el padre reordene; el reset lo hace la lista cuando llega el orden
      // nuevo (ver `handleMove`).
      const h = heights.value;
      let snap = 0;
      if (to > index) {
        for (let k = index + 1; k <= to; k++) snap += (h[k] ?? 0) + gap;
      } else if (to < index) {
        for (let k = to; k < index; k++) snap -= (h[k] ?? 0) + gap;
      }
      dragY.value = withTiming(snap, { duration: 120 });
      runOnJS(onMove)(index, to);
    });

  // Sin `zIndex` animado: en Android cambiarlo en caliente reordena los hijos
  // nativos y hacía desaparecer filas. La fila cogida se pinta encima por su
  // `elevation` (los hermanos van a 0).
  const style = useAnimatedStyle(() => {
    const active = activeIndex.value;
    if (active === index) {
      return {
        transform: [{ translateY: dragY.value }, { scale: 1.02 }],
        shadowOpacity: 0.18,
        elevation: 6,
      };
    }
    // Sin arrastre: nada que animar (ni muelle de vuelta, que tras un
    // reordenado real haría "viajar" la fila desde su hueco viejo).
    if (active < 0) {
      return {
        transform: [{ translateY: 0 }, { scale: 1 }],
        shadowOpacity: 0,
        elevation: 0,
      };
    }
    // Las demás se apartan para dejar el hueco donde caería la fila cogida.
    let shift = 0;
    if (active >= 0) {
      const target = targetIndex.value;
      const size = (heights.value[active] ?? 0) + gap;
      if (index > active && index <= target) shift = -size;
      else if (index < active && index >= target) shift = size;
    }
    return {
      transform: [
        { translateY: withTiming(shift, { duration: SHIFT_MS }) },
        { scale: 1 },
      ],
      shadowOpacity: 0,
      elevation: 0,
    };
  });

  const handle = (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.handle, { width: handleWidth }, handleStyle]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('Arrastra para reordenar')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
      >
        <MaterialCommunityIcons
          name="drag-vertical"
          size={handleIconSize}
          color={theme.colors.textSecondary}
        />
      </View>
    </GestureDetector>
  );

  return (
    <Animated.View
      style={[styles.row, { marginBottom: index < count - 1 ? gap : 0 }, style]}
      onLayout={onLayout}
    >
      {children(handle)}
    </Animated.View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    row: {
      ...theme.shadow.card,
      shadowOpacity: 0,
      elevation: 0,
    },
    handle: {
      width: 28,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
