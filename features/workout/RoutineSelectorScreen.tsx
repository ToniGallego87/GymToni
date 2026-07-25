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
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
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
 * Inicio. Pulsar una NO la activa (ver `SET_SELECTED_ROUTINE` en el contexto):
 * la activa la decide entrenar, no mirar.
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
  const backBottom = Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding = backBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;

  // La rutina marcada; si ya no existe, la activa (misma regla que Inicio).
  const displayedRoutineId = state.routines.some(
    (routine) => routine.id === state.selectedRoutineId
  )
    ? state.selectedRoutineId
    : state.activeRoutineId;
  const displayedRoutine = state.routines.find(
    (routine) => routine.id === displayedRoutineId
  );

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
              isActive={isActive}
              // "Preparada": creada pero aún no entrenada. Se activará al
              // registrar su primer día.
              isPrepared={!isActive && !routineHasLogs}
              onPress={() =>
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
          <TouchableOpacity
            style={styles.newRoutineCard}
            onPress={onCreateRoutine}
          >
            <Text style={styles.newRoutineCardText}>{t('+ Nueva rutina')}</Text>
          </TouchableOpacity>
        )}

        {!!displayedRoutine && !!onOpenRoutineDetails && (
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => onOpenRoutineDetails(displayedRoutine)}
          >
            <Text style={styles.detailsButtonText}>
              {t('Consultar detalles de esta rutina')}
            </Text>
          </TouchableOpacity>
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

interface RoutineCardProps {
  routine: WorkoutRoutine;
  isViewed: boolean; // Para el borde grueso (seleccionada)
  isActive: boolean; // Para el check "Activa"
  isPrepared: boolean; // Para la etiqueta "Preparada"
  onPress: () => void;
  onDuplicate: () => void;
  // Sin este handler no se pinta el botón de eliminar.
  onDelete?: () => void;
}

function RoutineCard({
  routine,
  isViewed,
  isActive,
  isPrepared,
  onPress,
  onDuplicate,
  onDelete,
}: RoutineCardProps) {
  return (
    <TouchableOpacity
      style={[styles.routineCard, isViewed && styles.routineCardViewed]}
      onPress={onPress}
    >
      <GradientFill accent={theme.colors.primaryLine} />
      <View style={styles.routineCardContent}>
        <Text style={styles.routineCardName}>{routine.name}</Text>
        <Text style={styles.routineCardDesc}>{routine.description}</Text>
        <Text style={styles.routineCardDays}>
          {t('{n} días de entrenamiento', { n: routine.days.length })}
        </Text>
      </View>
      <View style={styles.routineCardRight}>
        {isActive ? (
          <View style={styles.routineCardActiveIndicator}>
            <MaterialCommunityIcons
              name="check-bold"
              size={13}
              color={theme.colors.onGold}
            />
            <Text style={styles.routineCardActiveText}>{t('Activa')}</Text>
          </View>
        ) : isPrepared ? (
          <View style={styles.routineCardPreparedIndicator}>
            <MaterialCommunityIcons
              name="progress-clock"
              size={13}
              color={theme.colors.emoji_blue}
            />
            <Text style={styles.routineCardPreparedText}>{t('Preparada')}</Text>
          </View>
        ) : null}
        {/* Duplicar: se parte de una rutina que ya funciona para hacer la
            siguiente (la copia queda "preparada", no toca a la activa). */}
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

const makeStyles = () => StyleSheet.create({
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
  routineCardName: {
    fontSize: 21,
    fontFamily: theme.fonts.display,
    letterSpacing: 0.4,
    color: theme.colors.text,
    marginBottom: 4,
    lineHeight: 26,
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
  routineCardActiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primaryFill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
  },
  routineCardActiveText: {
    fontSize: 13,
    color: theme.colors.onGold,
    fontWeight: '800',
  },
  routineCardPreparedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.emoji_blueMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
  },
  routineCardPreparedText: {
    fontSize: 13,
    color: theme.colors.emoji_blue,
    fontWeight: '800',
  },
  // Relleno de oro vivo con tinta oscura (como el selector Fuerza/Cardio): el
  // amarillo brillante solo lee como fondo, no como texto sobre el lienzo claro.
  newRoutineCard: {
    backgroundColor: theme.colors.primaryFill,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primaryFillDark,
    paddingVertical: 18,
    alignItems: 'center',
  },
  newRoutineCardText: {
    color: theme.colors.onGold,
    fontSize: 17,
    fontWeight: '800',
  },
  detailsButton: {
    marginTop: 8,
    backgroundColor: theme.colors.primaryFill,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primaryFillDark,
    paddingVertical: 14,
    alignItems: 'center',
  },
  detailsButtonText: {
    color: theme.colors.onGold,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
});

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
