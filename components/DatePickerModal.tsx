import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { getToday } from '@lib/utils';
import { AppModal } from './AppModal';
import { Button } from './Button';

interface DatePickerModalProps {
  visible: boolean;
  /** Fecha seleccionada actual (YYYY-MM-DD). */
  value: string;
  onSelect: (date: string) => void;
  onRequestClose: () => void;
  /** Fecha máxima seleccionable (YYYY-MM-DD). Por defecto, hoy: no se registra a futuro. */
  maxDate?: string;
}

const toKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(
    2,
    '0'
  )}`;

/**
 * Selector de fecha propio (sin librería externa): un calendario mensual como el
 * de la pantalla Calendario, para registrar o reasignar un entreno a otro día.
 * No permite fechas futuras (`maxDate`, hoy por defecto) y ofrece atajos a hoy y
 * ayer, que es lo que se elige el 90% de las veces.
 */
export function DatePickerModal({
  visible,
  value,
  onSelect,
  onRequestClose,
  maxDate = getToday(),
}: DatePickerModalProps) {
  const MONTH_NAMES = [
    t('Enero'),
    t('Febrero'),
    t('Marzo'),
    t('Abril'),
    t('Mayo'),
    t('Junio'),
    t('Julio'),
    t('Agosto'),
    t('Septiembre'),
    t('Octubre'),
    t('Noviembre'),
    t('Diciembre'),
  ];
  const WEEK_DAYS = [
    t('Lun'),
    t('Mar'),
    t('Mié'),
    t('Jue'),
    t('Vie'),
    t('Sáb'),
    t('Dom'),
  ];

  // Mes mostrado, arrancando en el de la fecha seleccionada.
  const initial = useMemo(() => {
    const [year, month] = value.split('-').map(Number);
    return { year, month: month - 1 };
  }, [value]);
  const [view, setView] = useState(initial);
  // Selección pendiente: pulsar un día solo la cambia; el cambio no se aplica
  // hasta pulsar Guardar. Arranca en la fecha actual del entreno (`value`).
  const [pending, setPending] = useState(value);

  // Cada vez que se ABRE el calendario se reinicia al mes y día actuales: si se
  // cerró con otro día tocado (sin guardar), no debe quedar recordado.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setView(initial);
      setPending(value);
    }
  }

  const maxKey = maxDate;
  const todayKey = getToday();
  const hasChange = pending !== value;

  const firstWeekDay = (new Date(view.year, view.month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array(firstWeekDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const goMonth = (delta: number) =>
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  // No se puede avanzar más allá del mes de la fecha máxima.
  const [maxYear, maxMonth] = maxKey.split('-').map(Number);
  const canGoNext = view.year * 12 + view.month < maxYear * 12 + (maxMonth - 1);

  return (
    <AppModal
      visible={visible}
      onRequestClose={onRequestClose}
      title={t('Fecha del entreno')}
      icon="calendar-edit"
      align="left"
      footer={
        <View style={styles.footerRow}>
          <Button
            title={t('Cerrar')}
            onPress={onRequestClose}
            variant="secondary"
            size="medium"
            style={styles.footerButton}
          />
          <Button
            title={t('Guardar')}
            onPress={() => onSelect(pending)}
            variant="primary"
            size="medium"
            disabled={!hasChange}
            style={styles.footerButton}
          />
        </View>
      }
    >
      <View style={styles.monthRow}>
        <Pressable
          style={styles.navButton}
          onPress={() => goMonth(-1)}
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={22}
            color={theme.colors.text}
          />
        </Pressable>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[view.month]} {view.year}
        </Text>
        <Pressable
          style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}
          onPress={() => canGoNext && goMonth(1)}
          disabled={!canGoNext}
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={theme.colors.text}
          />
        </Pressable>
      </View>

      <View style={styles.weekHeader}>
        {WEEK_DAYS.map((label) => (
          <Text key={label} style={styles.weekHeaderText}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((dayNumber, index) => {
          if (!dayNumber) {
            return <View key={`empty-${index}`} style={styles.cell} />;
          }
          const key = toKey(view.year, view.month, dayNumber);
          const disabled = key > maxKey;
          const selected = key === pending;
          // El día que tenía el entreno se marca (oro tenue) cuando se elige
          // otro distinto, para que se entienda el cambio de una fecha a otra.
          const isOriginal = key === value && hasChange;
          const isToday = key === todayKey;

          return (
            <Pressable
              key={key}
              style={styles.cell}
              disabled={disabled}
              onPress={() => setPending(key)}
            >
              {/* Caja interna cuadrada de tamaño fijo: el realce y el número
                  quedan centrados sin depender de la altura de la celda. */}
              <View
                style={[
                  styles.dayBox,
                  selected && styles.dayCellSelected,
                  !selected && isOriginal && styles.dayCellOriginal,
                  !selected && !isOriginal && isToday && styles.dayCellToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    disabled && styles.dayTextDisabled,
                    selected && styles.dayTextSelected,
                    !selected && isOriginal && styles.dayTextOriginal,
                  ]}
                >
                  {dayNumber}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </AppModal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
      marginBottom: 12,
    },
    navButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    navButtonDisabled: {
      opacity: 0.25,
    },
    monthTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.text,
    },
    weekHeader: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    weekHeaderText: {
      flex: 1,
      textAlign: 'center',
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cell: {
      width: `${100 / 7}%`,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 3,
    },
    // Círculo de tamaño fijo que centra número y realce con exactitud (mismo
    // redondeo para selección, día original y hoy).
    dayBox: {
      width: 40,
      height: 40,
      borderRadius: 20,
      // En Android un fondo con borderRadius pero sin borde no recorta las
      // esquinas (el día seleccionado salía cuadrado): overflow lo fuerza.
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCellSelected: {
      backgroundColor: theme.colors.primaryFill,
    },
    // Día original (el que tenía el entreno) mientras hay otro elegido: oro tenue
    // con borde, para leerse como "de aquí venías".
    dayCellOriginal: {
      backgroundColor: theme.colors.primaryMuted,
      borderWidth: 1.5,
      borderColor: theme.colors.primaryLine,
    },
    dayCellToday: {
      borderWidth: 1.5,
      borderColor: theme.colors.primaryLine,
    },
    dayText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
      // Android añade padding de fuente que descentra el glifo hacia arriba;
      // se anula para que quede centrado en la caja.
      includeFontPadding: false,
      textAlign: 'center',
    },
    dayTextDisabled: {
      color: theme.colors.textMuted,
      opacity: 0.4,
    },
    dayTextSelected: {
      color: theme.colors.onGold,
      fontWeight: '800',
    },
    dayTextOriginal: {
      color: theme.colors.primaryLight,
      fontWeight: '800',
    },
    footerRow: {
      flexDirection: 'row',
      gap: 10,
    },
    footerButton: {
      flex: 1,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
