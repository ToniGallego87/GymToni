import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
import { duplicateRoutine } from '@lib/routines';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  ConfirmModal,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientCtaButton,
  GradientFill,
  StretchScrollView,
  Toast,
} from '../../components';
import { WorkoutRoutine } from '../../types';

interface RoutineSelectorScreenProps {
  onOpenRoutineDetails?: (routine: WorkoutRoutine) => void;
  onCreateRoutine?: () => void;
  onBack: () => void;
}

/**
 * Vista de Rutinas: lista las rutinas para consultarlas o marcar cuál se ve en
 * Inicio. Tocar una tarjeta abre sus detalles (mirar sin adoptarla); el botón
 * "Mostrar en Inicio" de cada tarjeta la marca como la que se ve en Inicio
 * (`SET_SELECTED_ROUTINE`). Nada de esto la activa: la activa la decide
 * entrenar, no mirar.
 */
export function RoutineSelectorScreen({
  onOpenRoutineDetails,
  onCreateRoutine,
  onBack,
}: RoutineSelectorScreenProps) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useWorkout();
  const [routineToDeleteId, setRoutineToDeleteId] = useState<
    string | undefined
  >(undefined);
  const [duplicatedName, setDuplicatedName] = useState<string | null>(null);

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  // Esta vista no es una pestaña de navegación: lleva botón Volver abajo en vez
  // de la barra flotante, así que su padding se calcula con la altura del botón.
  const { bottom: backBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

  // La rutina marcada; si ya no existe, la activa (misma regla que Inicio).
  const displayedRoutineId = state.routines.some(
    (routine) => routine.id === state.selectedRoutineId
  )
    ? state.selectedRoutineId
    : state.activeRoutineId;

  // La copia queda "preparada" y seleccionada (ADD_ROUTINE): se ajusta y se
  // estrena registrando en ella el primer día, sin tocar la rutina en curso.
  const handleDuplicateRoutine = (routine: WorkoutRoutine) => {
    const copy = duplicateRoutine(
      routine,
      state.routines.map((item) => item.name)
    );
    dispatch({ type: 'ADD_ROUTINE', payload: copy });
    setDuplicatedName(copy.name);
  };

  const handleDeleteRoutine = () => {
    if (!routineToDeleteId) return;
    // El reducer reajusta la selección si se borra la seleccionada.
    dispatch({ type: 'DELETE_ROUTINE', payload: routineToDeleteId });
    setRoutineToDeleteId(undefined);
  };

  return (
    <View style={styles.container}>
      <StatusBar
        style={theme.statusBarStyle}
        translucent
        backgroundColor="transparent"
      />

      <StretchScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topBarHeight + 28,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {state.routines.map((routine: WorkoutRoutine) => {
          const routineHasLogs = state.logs.some(
            (log) => log.routineId === routine.id
          );
          const isActive = routine.id === state.activeRoutineId;

          return (
            <RoutineCard
              key={routine.id}
              routine={routine}
              isViewed={routine.id === displayedRoutineId}
              // Un ÚNICO estado por rutina, dicho con palabras:
              //  - 'active'   la que se entrena ahora mismo.
              //  - 'prepared' creada pero aún sin estrenar (se activará al
              //               registrar su primer día).
              //  - 'closed'   tiene historial pero ya no es la activa (es lo
              //               que Inicio llama "Rutina cerrada").
              status={
                isActive ? 'active' : routineHasLogs ? 'closed' : 'prepared'
              }
              // Toque en la tarjeta: abre sus detalles (sin adoptarla como la de
              // Inicio). El botón "Ver en Inicio" es el que la marca.
              onOpenDetails={
                onOpenRoutineDetails
                  ? () => onOpenRoutineDetails(routine)
                  : undefined
              }
              onSelect={() =>
                dispatch({ type: 'SET_SELECTED_ROUTINE', payload: routine.id })
              }
              onDuplicate={() => handleDuplicateRoutine(routine)}
              // Solo se puede borrar una rutina sin historial.
              onDelete={
                routineHasLogs
                  ? undefined
                  : () => setRoutineToDeleteId(routine.id)
              }
            />
          );
        })}

        {!!onCreateRoutine && (
          <GradientCtaButton
            icon="plus"
            title={t('Nueva rutina')}
            onPress={onCreateRoutine}
            style={styles.newRoutineCta}
          />
        )}
      </StretchScrollView>

      <GlassTopBar
        title={t('Rutinas')}
        icon="book-open-variant"
        subtitle={t('Consulta la que desees o crea una nueva')}
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={backBottom} />

      {!!duplicatedName && (
        <Toast
          message={t('Copiada como "{name}"', { name: duplicatedName })}
          type="success"
          bottom={backBottom + FLOATING_BACK_BUTTON_HEIGHT + 12}
          onDismiss={() => setDuplicatedName(null)}
        />
      )}

      <ConfirmModal
        visible={!!routineToDeleteId}
        title={t('¿Eliminar rutina?')}
        message={t('Esta acción no se puede deshacer. ¿Estás seguro?')}
        confirmLabel={t('Eliminar')}
        onConfirm={handleDeleteRoutine}
        onCancel={() => setRoutineToDeleteId(undefined)}
      />
    </View>
  );
}

/** Situación de una rutina, dicha con una sola palabra. */
type RoutineStatus = 'active' | 'prepared' | 'closed';

interface RoutineCardProps {
  routine: WorkoutRoutine;
  isViewed: boolean; // Es la rutina que se muestra en Inicio
  status: RoutineStatus;
  // Toque en la tarjeta: abre sus detalles (mirar sin adoptarla).
  onOpenDetails?: () => void;
  // Botón "Ver en Inicio": marca esta rutina como la que se ve en Inicio.
  onSelect: () => void;
  onDuplicate: () => void;
  // Sin este handler no se pinta el botón de eliminar.
  onDelete?: () => void;
}

/**
 * Tarjeta de rutina.
 *
 * La situación se lee en UNA línea de texto en vez de en tres señales de color
 * (insignia dorada "Activa", insignia azul "Preparada" y botón-casa dorado "en
 * Inicio"), que obligaban a aprenderse un código para responder algo tan simple
 * como "¿en qué rutina estoy?". Ninguna capacidad cambia de sitio: "ver en
 * Inicio" sigue siendo un botón propio —ahora rotulado— y el estado "cerrada",
 * que solo se nombraba en el héroe de Inicio, por fin se dice también aquí.
 */
function RoutineCard({
  routine,
  isViewed,
  status,
  onOpenDetails,
  onSelect,
  onDuplicate,
  onDelete,
}: RoutineCardProps) {
  const statusLabel =
    status === 'active'
      ? t('La que entrenas')
      : status === 'prepared'
      ? t('Sin estrenar')
      : t('Cerrada');

  return (
    <TouchableOpacity
      style={[styles.routineCard, isViewed && styles.routineCardViewed]}
      onPress={onOpenDetails}
      accessibilityRole="button"
      accessibilityLabel={t('Consultar detalles de esta rutina')}
    >
      <GradientFill accent={theme.colors.primaryLine} />
      <View style={styles.routineCardContent}>
        <Text style={styles.routineCardName}>{routine.name}</Text>
        <Text style={styles.routineCardDesc}>{routine.description}</Text>
        <Text style={styles.routineCardDays}>
          {t('{n} días de entrenamiento', { n: routine.days.length })}
        </Text>

        <View style={styles.routineCardStatusRow}>
          <Text
            style={[
              styles.routineCardStatus,
              status === 'active' && styles.routineCardStatusActive,
            ]}
            numberOfLines={1}
          >
            {isViewed ? `${statusLabel} · ${t('En Inicio')}` : statusLabel}
          </Text>
          {/* Solo cuando NO es la de Inicio: si ya lo es, lo dice la línea de
              arriba y el botón sobraba (estaba ahí solo como estado, deshabilitado). */}
          {!isViewed && (
            <Pressable
              style={({ pressed }: { pressed: boolean }) => [
                styles.routineCardHomeButton,
                pressed && styles.routineCardIconButtonPressed,
              ]}
              onPress={onSelect}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('Ver en Inicio')}
            >
              <MaterialCommunityIcons
                name="home-outline"
                size={15}
                color={theme.colors.primary}
              />
              <Text style={styles.routineCardHomeText}>
                {t('Ver en Inicio')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
      <View style={styles.routineCardRight}>
        {/* Duplicar: se parte de una rutina que ya funciona para hacer la
            siguiente (la copia queda sin estrenar, no toca a la que entrenas). */}
        <Pressable
          style={({ pressed }: { pressed: boolean }) => [
            styles.routineCardIconButton,
            pressed && styles.routineCardIconButtonPressed,
          ]}
          onPress={onDuplicate}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('Duplicar')}
        >
          <MaterialCommunityIcons
            name="content-copy"
            size={18}
            color={theme.colors.textSecondary}
          />
        </Pressable>
        {/* Eliminar estaba solo tras un long-press, sin nada que lo indicara. */}
        {!!onDelete && (
          <Pressable
            style={({ pressed }: { pressed: boolean }) => [
              styles.routineCardIconButton,
              pressed && styles.routineCardIconButtonPressed,
            ]}
            onPress={onDelete}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('Eliminar')}
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={18}
              color={theme.colors.error}
            />
          </Pressable>
        )}
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: theme.spacing.md,
    },
    routineCard: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      padding: 18,
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    routineCardViewed: {
      borderColor: theme.colors.primaryLine,
      borderWidth: 3,
    },
    routineCardContent: {
      flex: 1,
    },
    routineCardRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    routineCardIconButton: {
      padding: 4,
      borderRadius: theme.borderRadius.sm,
    },
    routineCardIconButtonPressed: {
      opacity: 0.6,
    },
    // Línea de situación de la rutina + la acción de traerla a Inicio.
    routineCardStatusRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
    },
    routineCardStatus: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      lineHeight: 17,
    },
    // La rutina que se entrena es la única que se tiñe: un acento, no tres.
    routineCardStatusActive: {
      color: theme.colors.primary,
    },
    // "Ver en Inicio": acción rotulada (antes era un icono-casa sin texto que
    // además hacía de indicador de estado).
    routineCardHomeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
    },
    routineCardHomeText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.primary,
      lineHeight: 16,
    },
    routineCardName: {
      fontSize: 21,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.text,
      marginBottom: 4,
      lineHeight: 30,
    },
    routineCardDesc: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    routineCardDays: {
      fontSize: 14,
      color: theme.colors.lightGray,
    },
    // "Nueva rutina": único CTA primario de la vista (GradientCtaButton dorado,
    // como "Crear rutina"/"Guardar"). Antes había además un segundo botón dorado
    // ("Consultar detalles") que competía; ahora el detalle se abre tocando la
    // tarjeta, así que este queda como único héroe.
    newRoutineCta: {
      marginTop: 4,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
