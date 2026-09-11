import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkout } from '@hooks/useWorkout';
import {
  countRoutineSets,
  duplicateRoutine,
  isLinkedRoutine,
  lastTrainedByRoutine,
  routineAuthorId,
  routineIntensity,
  RoutineStatus,
  routineStatus,
  sortRoutinesForList,
} from '@lib/routines';
import { theme } from '@lib/theme';
import { dateLocale, t } from '@lib/i18n';
import {
  ConfirmModal,
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientCtaButton,
  GradientFill,
  RoutineIntensityPill,
  RoutineOriginPill,
  StretchScrollView,
  Toast,
} from '../../components';
import { WorkoutRoutine } from '../../types';

interface RoutineSelectorScreenProps {
  onOpenRoutineDetails?: (routine: WorkoutRoutine) => void;
  onCreateRoutine?: () => void;
  // Perfil del autor de una rutina traída de la comunidad.
  onOpenProfile?: (userId: string, name: string) => void;
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
  onOpenProfile,
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

  // Orden por relevancia (la que entrenas arriba, las cerradas al final): la
  // pantalla existe para elegir rutina, y el array llega en orden de creación.
  const routines = sortRoutinesForList(
    state.routines,
    state.logs,
    state.activeRoutineId
  );

  // Último entrenamiento de cada rutina: dice si tiene historial (no se puede
  // borrar) y, en las cerradas, cuándo se dejaron. El historial se recorre una
  // sola vez para toda la lista.
  const lastTrained = lastTrainedByRoutine(state.logs);

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
        {/* Primer día de uso: la lista vacía dejaba el CTA suelto bajo una barra
            que prometía "consulta la que desees". */}
        {routines.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="book-open-variant"
              size={40}
              color={theme.colors.textMuted}
            />
            <Text style={styles.emptyTitle}>{t('Aún no tienes rutinas')}</Text>
            <Text style={styles.emptyHint}>
              {t('Crea la primera aquí abajo o cógela de la comunidad')}
            </Text>
          </View>
        )}

        {routines.map((routine: WorkoutRoutine) => {
          const status = routineStatus(
            routine,
            state.logs,
            state.activeRoutineId
          );
          const lastTrainedAt = lastTrained.get(routine.id);
          const totalSets = countRoutineSets(routine);

          return (
            <RoutineCard
              key={routine.id}
              routine={routine}
              isViewed={routine.id === displayedRoutineId}
              status={status}
              // Cuándo se dejó de usar: la fecha del último entrenamiento.
              closedAt={status === 'closed' ? lastTrainedAt : undefined}
              // Las rutinas viejas no guardaban las series planificadas: sin el
              // dato no se inventa un tramo (mismo criterio que el tablón).
              totalSets={totalSets}
              // Toque en la tarjeta: abre sus detalles (sin adoptarla como la de
              // Inicio). El botón "Ver en Inicio" es el que la marca.
              onOpenDetails={
                onOpenRoutineDetails
                  ? () => onOpenRoutineDetails(routine)
                  : undefined
              }
              onOpenProfile={onOpenProfile}
              onSelect={() =>
                dispatch({ type: 'SET_SELECTED_ROUTINE', payload: routine.id })
              }
              onDuplicate={() => handleDuplicateRoutine(routine)}
              // Solo se puede borrar una rutina sin historial.
              onDelete={
                lastTrainedAt !== undefined
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

interface RoutineCardProps {
  routine: WorkoutRoutine;
  isViewed: boolean; // Es la rutina que se muestra en Inicio
  status: RoutineStatus;
  // Solo en las cerradas: cuándo se registró su último entrenamiento.
  closedAt?: number;
  // Series planificadas en toda la rutina (0 = el plan no las guarda).
  totalSets: number;
  // Toque en la tarjeta: abre sus detalles (mirar sin adoptarla).
  onOpenDetails?: () => void;
  // Perfil del autor, si la rutina es de otra persona.
  onOpenProfile?: (userId: string, name: string) => void;
  // Botón "Ver en Inicio": marca esta rutina como la que se ve en Inicio.
  onSelect: () => void;
  onDuplicate: () => void;
  // Sin este handler no se pinta el botón de eliminar.
  onDelete?: () => void;
}

/** Fecha corta ("12 mar 2025") en el idioma activo. */
function formatShortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Tarjeta de rutina: cabecera, descripción y UNA línea de datos.
 *
 * Antes cada dato ocupaba su propio renglón a ancho completo (nombre, marca de
 * origen, descripción, "N días de entrenamiento" y la fila de estado), así que
 * una tarjeta pasaba de los 170 px y cabían tres rutinas por pantalla en una
 * lista que existe justamente para COMPARARLAS. Ahora el estado, los días y la
 * intensidad viven en un renglón, y la fila de abajo (de quién es la rutina y
 * "Ver en Inicio") solo aparece cuando dice algo: la rutina típica —tuya y ya
 * en Inicio— se queda en dos bloques.
 *
 * La situación se lee en palabras en vez de en tres señales de color, y la
 * cerrada además dice CUÁNDO se cerró (la fecha de su último entrenamiento):
 * sin ella una rutina que dejaste hace dos años se leía igual que la del mes
 * pasado. Ninguna capacidad cambia de sitio.
 */
function RoutineCard({
  routine,
  isViewed,
  status,
  closedAt,
  totalSets,
  onOpenDetails,
  onOpenProfile,
  onSelect,
  onDuplicate,
  onDelete,
}: RoutineCardProps) {
  const statusLabel =
    status === 'active'
      ? t('La que entrenas')
      : status === 'prepared'
      ? t('Sin estrenar')
      : closedAt
      ? t('Cerrada el {date}', { date: formatShortDate(closedAt) })
      : t('Cerrada');

  const daysLabel =
    routine.days.length === 1
      ? t('1 día')
      : t('{n} días', { n: routine.days.length });

  // De quién es: enlazada de la comunidad (no se edita) o copiada de alguien
  // (sí se edita, pero el crédito queda). En ambos casos lleva a su perfil.
  const isLinked = isLinkedRoutine(routine);
  const showOrigin = isLinked || !!routine.sourceAuthor;
  const authorId = routineAuthorId(routine);

  return (
    <TouchableOpacity
      style={[styles.routineCard, isViewed && styles.routineCardViewed]}
      onPress={onOpenDetails}
      accessibilityRole="button"
      // Cada tarjeta se anuncia por lo que es: antes las ocho decían lo mismo.
      accessibilityLabel={t('{name}. {status}. {days}', {
        name: routine.name,
        status: isViewed ? `${statusLabel}, ${t('En Inicio')}` : statusLabel,
        days: daysLabel,
      })}
      accessibilityHint={t('Consultar detalles de esta rutina')}
    >
      <GradientFill accent={theme.colors.primaryLine} />

      <View style={styles.headerRow}>
        <Text style={styles.routineCardName} numberOfLines={1}>
          {routine.name}
        </Text>
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
      </View>

      {/* Resumen, no el texto entero: la descripción completa está en la ficha. */}
      {!!routine.description && (
        <Text style={styles.routineCardDesc} numberOfLines={1}>
          {routine.description}
        </Text>
      )}

      {/* Los tres datos de un vistazo: en qué situación está, cuánto ocupa y
          cuánta caña lleva. */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText} numberOfLines={1}>
          <Text
            style={[
              styles.routineCardStatus,
              status === 'active' && styles.routineCardStatusActive,
            ]}
          >
            {isViewed ? `${statusLabel} · ${t('En Inicio')}` : statusLabel}
          </Text>
          {` · ${daysLabel}`}
        </Text>
        {totalSets > 0 && (
          <RoutineIntensityPill level={routineIntensity(totalSets)} />
        )}
      </View>

      {/* Fila que solo existe cuando tiene algo que decir. */}
      {(showOrigin || !isViewed) && (
        <View style={styles.cardActionsRow}>
          {showOrigin && (
            <RoutineOriginPill
              author={routine.sourceAuthor}
              copied={!isLinked}
              ownerId={authorId}
              onOpenProfile={onOpenProfile}
            />
          )}
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
      )}
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
    emptyState: {
      alignItems: 'center',
      gap: 6,
      paddingVertical: theme.spacing.xl,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
    },
    emptyHint: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    routineCard: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    routineCardViewed: {
      borderColor: theme.colors.primaryLine,
      borderWidth: 3,
    },
    // Nombre y acciones de la rutina, alineados ARRIBA: centrados verticalmente
    // los iconos flotaban a media tarjeta, lejos de aquello a lo que se refieren.
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
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
    // Situación + días + intensidad: los tres datos en un renglón.
    metaRow: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    metaText: {
      flexShrink: 1,
      fontSize: 13,
      color: theme.colors.lightGray,
      lineHeight: 18,
    },
    routineCardStatus: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    // La rutina que se entrena es la única que se tiñe: un acento, no tres.
    routineCardStatusActive: {
      color: theme.colors.primary,
    },
    // Atribución y "Ver en Inicio": la fila desaparece si no aplica ninguna.
    cardActionsRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
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
      flex: 1,
      fontSize: 18,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.text,
      lineHeight: 26,
    },
    routineCardDesc: {
      marginTop: 2,
      fontSize: 14,
      color: theme.colors.textSecondary,
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
