import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useRef } from 'react';
import { PixelRatio, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lib/theme';

export interface BarChartPoint {
  key: string;
  value: number;
  /** Etiqueta bajo la barra ("S3", "jul"). */
  label: string;
  /** Texto sobre (o bajo) la barra: el valor ya formateado. */
  valueLabel: string;
  color: string;
  /** Tinta del valor. Por defecto, la de la barra. */
  valueColor?: string;
  /** Destaca la etiqueta del eje X (la semana/mes en curso). */
  highlighted?: boolean;
}

interface BarChartProps {
  points: BarChartPoint[];
  width: number;
  /** Rango del eje Y: cada gráfica tiene su criterio (ver los consumidores). */
  domain: { min: number; max: number };
  /** Formatea las tres marcas del eje Y. */
  formatYTick: (value: number) => string;
  /**
   * Valores con signo: dibuja el eje del cero y las barras negativas crecen
   * hacia abajo (progreso semanal). Sin él, las barras nacen del suelo del
   * dominio (métricas de cardio, siempre positivas).
   */
  signed?: boolean;
  /**
   * Si las etiquetas del eje X no caben (fechas como "14 sept"), las barras se
   * deslizan en horizontal con un ancho mínimo por barra en vez de apretarse
   * hasta pisarse. Arranca mostrando las últimas. Solo fuera del pager de
   * pestañas (Progreso por ejercicio): dentro, el gesto se lo disputaría.
   */
  scrollable?: boolean;
}

// Ancho de la gráfica en las tres pantallas que la usan (Inicio, Cardio y
// Progreso por ejercicio): el ancho de la ventana menos el margen lateral de
// las tarjetas, acotado para que no se estire en pantallas grandes ni se
// estruje en las estrechas. Vive aquí y no repetido en cada pantalla porque el
// `SegmentedFilter` que va debajo se alinea con la gráfica: las dos tienen que
// medir exactamente lo mismo.
export const getChartWidth = (windowWidth: number): number =>
  Math.max(250, Math.min(windowWidth - theme.spacing.md * 2 - 20, 420));

const HEIGHT = 170;
const PADDING = { top: 18, right: 12, bottom: 28, left: 42 };
// Ancho aproximado de un carácter de las marcas del eje Y (11 px) y aire entre
// la marca y la rejilla. El margen izquierdo crece con la marca más larga
// ("101,7"): con uno fijo, el primer dígito se cortaba.
const Y_CHAR_WIDTH = 6.8;
const Y_LABEL_GAP = 12;
// Ancho mínimo por barra en modo deslizable: lo que pide "28 sept" a 12 px.
const MIN_SLOT_WIDTH = 56;
const LABEL_MIN_WIDTH = 44;
const VALUE_LABEL_WIDTH = 44;

/**
 * Gráfica de barras de la app (progreso semanal en Inicio y métricas mensuales
 * en Cardio). Antes cada pantalla tenía su propia copia, casi idéntica: mismo
 * alto, mismo cálculo de ranuras y anchos, mismas tres líneas de rejilla.
 *
 * Aquí solo vive el dibujo; el dominio y el color de cada barra los decide
 * quien la usa, que es lo único en lo que las dos gráficas difieren de verdad.
 */
export function BarChart({
  points,
  width,
  domain,
  formatYTick,
  signed = false,
  scrollable = false,
}: BarChartProps) {
  // El texto escala con el tamaño de letra del sistema: las medidas que
  // dependen de él, también.
  const fontScale = PixelRatio.getFontScale();
  const yTicks = [domain.max, (domain.max + domain.min) / 2, domain.min];
  const yTickLabels = yTicks.map(formatYTick);
  const longestYTick = Math.max(...yTickLabels.map((label) => label.length));
  const paddingLeft = Math.max(
    PADDING.left,
    Math.ceil(longestYTick * Y_CHAR_WIDTH * fontScale + Y_LABEL_GAP)
  );

  const plotWidth = width - paddingLeft - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  // Deslizable solo si hace falta. Entonces caben N barras y media: la cortada
  // del borde izquierdo dice que hay más.
  const minSlotWidth = MIN_SLOT_WIDTH * fontScale;
  const scrolls =
    scrollable && points.length > 0 && plotWidth / points.length < minSlotWidth;
  const slotWidth = scrolls
    ? plotWidth /
      (Math.max(1, Math.floor(plotWidth / minSlotWidth - 0.5)) + 0.5)
    : points.length > 0
    ? plotWidth / points.length
    : plotWidth;
  const contentWidth = scrolls ? slotWidth * points.length : plotWidth;
  const barWidth = Math.max(18, Math.min(slotWidth * 0.55, 34));
  const labelWidth = Math.max(LABEL_MIN_WIDTH, slotWidth - 4);
  // X dentro de la capa de barras (que ya empieza en el margen izquierdo).
  const getX = (index: number) =>
    index * slotWidth + (slotWidth - barWidth) / 2;

  // Al cambiar los datos (otro ejercicio, otra medida), a las más recientes.
  const scrollRef = useRef<ScrollView>(null);
  const pointsKey = points.map((point) => point.key).join('|');
  useEffect(() => {
    if (scrolls) scrollRef.current?.scrollToEnd({ animated: false });
  }, [pointsKey, scrolls]);

  const getY = (value: number) => {
    if (domain.max === domain.min) return PADDING.top + plotHeight / 2;
    return (
      PADDING.top +
      ((domain.max - value) / (domain.max - domain.min)) * plotHeight
    );
  };

  // Con signo las barras salen del cero; si no, del suelo del dominio.
  const baselineValue = signed ? 0 : domain.min;
  const baselineY = getY(baselineValue);

  // Capa de las barras y sus etiquetas, a la derecha del eje Y. Deslizable o
  // fija; la rejilla y las marcas del eje van fuera y no se mueven.
  const renderPlotLayer = (children: React.ReactNode) =>
    scrolls ? (
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.plotLayer, { left: paddingLeft, width: plotWidth }]}
        contentContainerStyle={{ width: contentWidth, height: HEIGHT }}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: false })
        }
      >
        {children}
      </ScrollView>
    ) : (
      <View
        style={[styles.plotLayer, { left: paddingLeft, width: plotWidth }]}
        pointerEvents="none"
      >
        {children}
      </View>
    );

  return (
    <View style={styles.wrapper}>
      <View style={[styles.chart, { width }]}>
        {yTicks.map((tick, index) => (
          <View
            key={`grid-${index}`}
            style={[
              styles.gridLine,
              { top: getY(tick), left: paddingLeft, width: plotWidth },
            ]}
          />
        ))}

        {signed && (
          <View
            style={[
              styles.axisLine,
              { top: baselineY, left: paddingLeft, width: plotWidth },
            ]}
          />
        )}

        {renderPlotLayer(
          points.map((point, index) => {
            const x = getX(index);
            const y = getY(point.value);
            const isPositive = point.value >= baselineValue;
            const barTop = isPositive ? y : baselineY;
            const barHeight = Math.max(Math.abs(baselineY - y), 4);

            return (
              <React.Fragment key={point.key}>
                <View
                  style={[
                    styles.bar,
                    {
                      left: x,
                      top: barTop,
                      height: barHeight,
                      width: barWidth,
                      backgroundColor: point.color,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.valueLabel,
                    {
                      color: point.valueColor ?? point.color,
                      left: x + barWidth / 2 - VALUE_LABEL_WIDTH / 2,
                      top: isPositive ? barTop - 16 : barTop + barHeight + 2,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {point.valueLabel}
                </Text>
                <Text
                  style={[
                    styles.xLabel,
                    point.highlighted && styles.xLabelHighlighted,
                    {
                      left: x + barWidth / 2 - labelWidth / 2,
                      width: labelWidth,
                      top: HEIGHT - 20,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {point.label}
                </Text>
              </React.Fragment>
            );
          })
        )}

        {yTicks.map((tick, index) => (
          <Text
            key={`y-${index}`}
            style={[
              styles.yLabel,
              { top: getY(tick) - 8, width: paddingLeft - 4 },
            ]}
            numberOfLines={1}
          >
            {yTickLabels[index]}
          </Text>
        ))}
      </View>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    wrapper: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      overflow: 'hidden',
    },
    chart: {
      height: HEIGHT,
      position: 'relative',
    },
    gridLine: {
      position: 'absolute',
      height: 1,
      backgroundColor: theme.colors.border,
      opacity: 0.8,
    },
    axisLine: {
      position: 'absolute',
      height: 1,
      backgroundColor: theme.colors.veryLightGray,
      opacity: 0.65,
    },
    plotLayer: {
      position: 'absolute',
      top: 0,
      height: HEIGHT,
    },
    bar: {
      position: 'absolute',
      borderRadius: 6,
    },
    valueLabel: {
      position: 'absolute',
      width: VALUE_LABEL_WIDTH,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
    },
    xLabel: {
      position: 'absolute',
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },
    xLabelHighlighted: {
      color: theme.colors.primary,
      fontWeight: '800',
    },
    yLabel: {
      position: 'absolute',
      left: 0,
      textAlign: 'right',
      fontSize: 11,
      color: theme.colors.textSecondary,
      paddingRight: 6,
      lineHeight: 16,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
