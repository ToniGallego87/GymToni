import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppModal,
  Button,
  ConfirmModal,
  ExerciseEditorModal,
  ExerciseSummaryRow,
  SortableList,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GradientCtaButton,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  GradientFill,
  GymIcon,
  GymIconGrid,
  GYM_ICON_LABELS,
  detectGymIcon,
  Toast,
  StretchScrollView,
} from '../../components';
import type { GymIconName } from '../../components';
import { generateId } from '@lib/utils';
import {
  buildExercisesFromText,
  buildWorkoutExercises,
  createEmptyExercise,
  ExerciseForm,
  parseImportedExercise,
} from '@lib/exerciseForm';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { parseRoutineShareLink, stripIconTag } from '@lib/routineShare';
import { WorkoutDay, WorkoutRoutine } from '../../types';

interface NewRoutineScreenProps {
  existingRoutineCount: number;
  onCreateRoutine: (routine: WorkoutRoutine) => void;
  onBack: () => void;
  // Salta a la pestaña Comunidad: la tercera vía de "¿ya tienes la rutina?",
  // para quien no tiene ninguna y no sabe que hay decenas listas.
  onOpenCommunity?: () => void;
  // Días con los que arrancar el formulario (importación por QR/deep link).
  initialDays?: { title: string; exercisesText: string; icon?: GymIconName }[];
}

interface NewRoutineDayForm {
  id: string;
  title: string;
  exercises: ExerciseForm[];
  // Icono elegido a mano. Si es undefined, se autodetecta por el título; si no
  // se puede detectar, la creación cae a `fullbody` (nunca bloquea).
  icon?: GymIconName;
}

// Icono efectivo de un día en el formulario: el elegido a mano o, si no, el
// autodetectado por el título. null si aún no se puede determinar (el selector
// lo dice con "Elegir icono"; al crear se usa `fullbody`).
/** Mueve la fila `from` al hueco `to`; fuera de rango, devuelve la lista tal cual. */
function moveRow<T>(rows: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length) return rows;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(Math.min(to, next.length), 0, moved);
  return next;
}

function effectiveDayIcon(day: NewRoutineDayForm): GymIconName | null {
  return day.icon ?? detectGymIcon(day.title);
}

// Parsea una rutina completa en texto: cada día es un bloque separado por línea en
// blanco; la primera línea del bloque es el nombre del día y el resto, ejercicios.
function buildDaysFromRoutineText(text: string): NewRoutineDayForm[] {
  return text
    .replace(/\r/g, '')
    .split(/\n\s*\n+/)
    .map((block) =>
      block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    )
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const [titleLine, ...rest] = lines;
      const { title, icon } = stripIconTag(titleLine);
      const exercises = rest.map(parseImportedExercise);
      return {
        id: generateId(),
        title,
        icon,
        exercises: exercises.length ? exercises : [createEmptyExercise()],
      };
    });
}

export function NewRoutineScreen({
  existingRoutineCount,
  onCreateRoutine,
  onBack,
  onOpenCommunity,
  initialDays,
}: NewRoutineScreenProps) {
  const insets = useSafeAreaInsets();
  // Nombre y descripción de la rutina. Si se dejan vacíos se generan como antes
  // ("Rutina N" / "Rutina personalizada (N días)").
  const [routineName, setRoutineName] = useState('');
  const [routineDescription, setRoutineDescription] = useState('');
  const [days, setDays] = useState<NewRoutineDayForm[]>(() =>
    initialDays && initialDays.length
      ? initialDays.map((day) => ({
          id: generateId(),
          title: day.title,
          icon: day.icon,
          exercises: buildExercisesFromText(day.exercisesText),
        }))
      : [{ id: generateId(), title: '', exercises: [createEmptyExercise()] }]
  );
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  // Importar por ENLACE (el que viaja dentro del QR). Antes era una pantalla
  // completa que decía "escanea con la cámara" y luego ofrecía una caja de
  // pegar: el escaneo de verdad lo hace la cámara del sistema y entra por deep
  // link, así que aquí solo queda pegar, y eso cabe en un modal como el
  // hermano de texto plano.
  const [showLinkImport, setShowLinkImport] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  // Ejercicio con el editor abierto; el resto se muestran colapsados si tienen nombre.
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(
    null
  );
  // Día cuyo selector de icono está abierto.
  const [iconPickerDayId, setIconPickerDayId] = useState<string | null>(null);
  // Día pendiente de confirmar su borrado (antes se quitaba sin preguntar).
  const [dayToDeleteId, setDayToDeleteId] = useState<string | null>(null);

  const handleImportText = () => {
    const parsed = buildDaysFromRoutineText(importText);
    if (!parsed.length) {
      setToast({
        message: t('No se reconoció ninguna rutina en el texto'),
        type: 'error',
      });
      return;
    }
    const limited = parsed.slice(0, 7);
    setDays(limited);
    setShowImport(false);
    setImportText('');
    setToast({
      message: t(
        limited.length > 1 ? 'Importados {n} días' : 'Importado 1 día',
        {
          n: limited.length,
        }
      ),
      type: 'success',
    });
  };
  // Enlace de rutina pegado a mano: mismo destino que el texto plano (rellenar
  // los días del formulario), y el mismo aviso si no se reconoce.
  const handleImportLink = () => {
    const trimmed = linkText.trim();
    if (!trimmed) {
      setLinkError(t('Pega el enlace del QR aquí.'));
      return;
    }
    const shared = parseRoutineShareLink(trimmed);
    if (!shared) {
      setLinkError(
        t('Enlace no válido. Usa el enlace copiado desde "Compartir por QR".')
      );
      return;
    }
    setDays(
      shared.days.slice(0, 7).map((day) => ({
        id: generateId(),
        title: day.title,
        icon: day.icon,
        exercises: buildExercisesFromText(day.exercisesText),
      }))
    );
    setShowLinkImport(false);
    setLinkText('');
    setLinkError(null);
    setToast({
      message: t(
        shared.days.length > 1 ? 'Importados {n} días' : 'Importado 1 día',
        { n: Math.min(shared.days.length, 7) }
      ),
      type: 'success',
    });
  };

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { bottom: floatingBackBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

  const isDayComplete = (day: NewRoutineDayForm) =>
    !!day.title.trim() && day.exercises.some((ex) => ex.name.trim());

  const canAddNewDay = useMemo(() => days.every(isDayComplete), [days]);
  // Primera carencia del formulario, para decirla en vivo bajo el CTA. Un
  // título vacío solo se marca en rojo cuando el día ya tiene ejercicios (si
  // no, el formulario recién abierto saldría en rojo antes de tocar nada).
  const firstMissing = useMemo(() => {
    for (const [index, day] of days.entries()) {
      if (!day.title.trim())
        return t('Falta el título del Día {n}', { n: index + 1 });
      if (!day.exercises.some((ex) => ex.name.trim()))
        return t('Faltan ejercicios en el Día {n}', { n: index + 1 });
    }
    return null;
  }, [days]);
  const titleMissing = (day: NewRoutineDayForm) =>
    !day.title.trim() && day.exercises.some((ex) => ex.name.trim());
  const canAddMoreDays = canAddNewDay && days.length < 7;

  const updateDay = (
    dayId: string,
    updater: (day: NewRoutineDayForm) => NewRoutineDayForm
  ) => {
    setDays((previous) =>
      previous.map((day) => (day.id === dayId ? updater(day) : day))
    );
  };

  const handleUpdateTitle = (dayId: string, value: string) => {
    updateDay(dayId, (day) => ({ ...day, title: value }));
  };

  const handleSelectIcon = (dayId: string, icon: GymIconName) => {
    updateDay(dayId, (day) => ({ ...day, icon }));
    setIconPickerDayId(null);
  };

  const handleUpdateExercise = (
    dayId: string,
    exerciseId: string,
    changes: Partial<ExerciseForm>
  ) => {
    updateDay(dayId, (day) => ({
      ...day,
      exercises: day.exercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, ...changes } : ex
      ),
    }));
  };

  const handleAddExercise = (dayId: string) => {
    const exercise = createEmptyExercise();
    updateDay(dayId, (day) => ({
      ...day,
      exercises: [...day.exercises, exercise],
    }));
    setEditingExerciseId(exercise.id);
  };

  // Arrastre por el asa: la fila `from` cae en el hueco `to`.
  const handleMoveExerciseTo = (dayId: string, from: number, to: number) => {
    updateDay(dayId, (day) => ({
      ...day,
      exercises: moveRow(day.exercises, from, to),
    }));
  };

  const handleRemoveExercise = (dayId: string, exerciseId: string) => {
    updateDay(dayId, (day) =>
      day.exercises.length <= 1
        ? day
        : {
            ...day,
            exercises: day.exercises.filter((ex) => ex.id !== exerciseId),
          }
    );
  };

  const handleAddDay = () => {
    if (days.length >= 7) {
      setToast({ message: t('Máximo 7 días'), type: 'error' });
      return;
    }

    setDays((previous) => [
      ...previous,
      { id: generateId(), title: '', exercises: [createEmptyExercise()] },
    ]);
  };

  // Quitar un día se confirma antes, como en la ficha de una rutina guardada:
  // se lleva por delante los ejercicios ya tecleados, que aquí no existen en
  // ningún otro sitio todavía.
  const handleRemoveDay = (dayId: string) => {
    setDays((previous) =>
      previous.length <= 1
        ? previous
        : previous.filter((day) => day.id !== dayId)
    );
    setDayToDeleteId(null);
  };

  // Arrastre por el asa: el día `from` cae en el hueco `to`. Mismo gesto (y
  // mismo `SortableList`) que ya ordena los ejercicios dentro de cada día y que
  // ordena los días en la ficha de una rutina guardada. El número visible
  // ("Día N") se deriva del índice al construir la rutina (ver
  // buildRoutineDays), así que basta con mover la entrada de sitio.
  const handleMoveDayTo = (from: number, to: number) => {
    setDays((previous) => moveRow(previous, from, to));
  };

  const buildRoutineDays = (): WorkoutDay[] => {
    if (!days.length) {
      throw new Error(t('Añade al menos un día'));
    }

    return days.map((entry, index) => {
      const dayTitle = entry.title.trim();
      if (!dayTitle) {
        throw new Error(t('Falta el título del Día {n}', { n: index + 1 }));
      }

      const exercises = buildWorkoutExercises(entry.exercises);
      if (!exercises.length) {
        throw new Error(t('Faltan ejercicios en el Día {n}', { n: index + 1 }));
      }

      // Sin icono reconocible ("Lunes", "Día A") se cae a `fullbody`, el mismo
      // fallback que `resolveDayIcon` usa al leer datos: un dato decorativo no
      // puede bloquear la creación de la primera rutina. El selector sigue ahí
      // para cambiarlo.
      const icon = effectiveDayIcon(entry) ?? 'fullbody';

      return {
        id: generateId(),
        dayNumber: index + 1,
        name: `${t('Día')} ${index + 1} - ${dayTitle}`,
        // `emoji` guarda ahora el nombre del icono (ver GymIcon/DayAccentIcon).
        emoji: icon,
        exercises,
      };
    });
  };

  const handleCreate = () => {
    try {
      const builtDays = buildRoutineDays();

      onCreateRoutine({
        id: generateId(),
        name:
          routineName.trim() || `${t('Rutina')} ${existingRoutineCount + 1}`,
        description:
          routineDescription.trim() ||
          t('Rutina personalizada ({n} días)', { n: builtDays.length }),
        // La rutina nueva queda "preparada", no activa: el reducer (ADD_ROUTINE
        // + syncActiveRoutine) mantiene la activa actual hasta que se registre
        // el primer entrenamiento en esta.
        isActive: false,
        createdAt: Date.now(),
        days: builtDays,
      });

      setToast({ message: t('Nueva rutina creada'), type: 'success' });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('No se pudo crear la rutina');
      setToast({ message, type: 'error' });
    }
  };

  // Tarjeta de un día del formulario. `dragHandle` solo llega cuando la lista
  // de días es arrastrable (dos o más): con uno solo no hay nada que ordenar y
  // el asa sería un adorno.
  const renderDayCard = (
    day: NewRoutineDayForm,
    index: number,
    dragHandle?: React.ReactNode
  ) => {
    const accent = theme.colors.accentLine;
    const dayIcon = effectiveDayIcon(day);
    const canRemoveThisDay = days.length > 1;

    return (
      <View
        key={day.id}
        style={[
          styles.dayCard,
          // Dentro de la lista arrastrable la separación la pone la propia
          // lista (`gap`), no el contenedor de fuera.
          !!dragHandle && styles.dayCardSortable,
          { borderLeftColor: accent },
        ]}
      >
        <GradientFill accent={accent} />

        {/* Línea 1: asa de arrastre (si hay más de un día), "Día N" y el
            selector de icono. Ordenar ya no es una fila de flechas debajo:
            es el mismo asa que ordena los ejercicios de este día y los días
            de una rutina ya guardada. */}
        <View style={styles.dayHeaderRow}>
          {dragHandle}
          <Text style={styles.dayTitleDisplay}>
            {t('Día')} {index + 1}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.dayIconPick,
              !dayIcon && styles.dayIconPickEmpty,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setIconPickerDayId(day.id)}
          >
            {dayIcon ? (
              <>
                <GymIcon name={dayIcon} size={18} color={theme.colors.white} />
                <Text style={styles.dayIconPickText}>
                  {t(GYM_ICON_LABELS[dayIcon])}
                </Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons
                  name="help-circle-outline"
                  size={18}
                  color={theme.colors.primary}
                />
                <Text
                  style={[
                    styles.dayIconPickText,
                    { color: theme.colors.primary },
                  ]}
                >
                  {t('Elegir icono')}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, titleMissing(day) && styles.inputError]}
            placeholder={t('Ej: Push, Pierna, Torso…')}
            placeholderTextColor={theme.colors.textSecondary}
            value={day.title}
            onChangeText={(value) => handleUpdateTitle(day.id, value)}
          />
        </View>

        <Text style={styles.label}>{t('Ejercicios')}</Text>

        <SortableList
          items={day.exercises}
          keyOf={(exercise) => exercise.id}
          onMove={(from, to) => handleMoveExerciseTo(day.id, from, to)}
          renderItem={(exercise, handle) => (
            <ExerciseSummaryRow
              exercise={exercise}
              canRemove={day.exercises.length > 1}
              onEdit={() => setEditingExerciseId(exercise.id)}
              onRemove={() => handleRemoveExercise(day.id, exercise.id)}
              dragHandle={handle}
            />
          )}
        />

        {/* Popup de edición del ejercicio abierto (el lápiz de su fila),
            el mismo que en la ficha de una rutina guardada. Cerrarlo sin
            nombre descarta la fila si el día tiene otras. */}
        {(() => {
          const editing = day.exercises.find(
            (exercise) => exercise.id === editingExerciseId
          );
          if (!editing) return null;
          return (
            <ExerciseEditorModal
              visible
              exercise={editing}
              accent={accent}
              onChange={(changes) =>
                handleUpdateExercise(day.id, editing.id, changes)
              }
              onDone={() => {
                if (!editing.name.trim()) {
                  handleRemoveExercise(day.id, editing.id);
                }
                setEditingExerciseId(null);
              }}
            />
          );
        })()}

        <Pressable
          style={({ pressed }) => [
            styles.addExerciseButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => handleAddExercise(day.id)}
        >
          <MaterialCommunityIcons
            name="plus-circle-outline"
            size={18}
            color={theme.colors.primary}
          />
          <Text style={styles.addExerciseText}>{t('Añadir ejercicio')}</Text>
        </Pressable>

        {/* Quitar el día: rotulado y al pie del bloque, lejos del asa, igual
            que en la ficha de una rutina guardada. Antes era una papelera
            pegada a las flechas de ordenar y borraba sin preguntar. */}
        {canRemoveThisDay && (
          <Pressable
            style={({ pressed }) => [
              styles.removeDayButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setDayToDeleteId(day.id)}
            accessibilityRole="button"
            accessibilityLabel={t('Quitar día')}
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={16}
              color={theme.colors.error}
            />
            <Text style={styles.removeDayText}>{t('Quitar día')}</Text>
          </Pressable>
        )}
      </View>
    );
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
            paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Vías de partida alternativas al formulario manual: se ofrecen ARRIBA
            (antes colgaban debajo del CTA "Crear rutina", como si fueran un paso
            posterior). Quien ya tiene la rutina en otro sitio la trae de una. */}
        <View style={styles.importGroup}>
          <Text style={styles.importGroupLabel}>
            {t('¿Ya tienes la rutina en otro sitio?')}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.qrButton,
              pressed && styles.qrButtonPressed,
            ]}
            onPress={() => setShowLinkImport(true)}
          >
            <MaterialCommunityIcons
              name="link-variant"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.qrButtonText}>
              {t('Pegar el enlace de una rutina')}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.qrButton,
              pressed && styles.qrButtonPressed,
            ]}
            onPress={() => setShowImport(true)}
          >
            <MaterialCommunityIcons
              name="text-box-plus-outline"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.qrButtonText}>
              {t('Crear a partir de texto plano')}
            </Text>
          </Pressable>
          {onOpenCommunity && (
            <Pressable
              style={({ pressed }) => [
                styles.qrButton,
                pressed && styles.qrButtonPressed,
              ]}
              onPress={onOpenCommunity}
            >
              <MaterialCommunityIcons
                name="account-group-outline"
                size={18}
                color={theme.colors.primary}
              />
              <Text style={styles.qrButtonText}>
                {t('Elegir una de la comunidad')}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.manualDivider}>
          <View style={styles.manualDividerLine} />
          <Text style={styles.manualDividerText}>{t('o créala a mano')}</Text>
          <View style={styles.manualDividerLine} />
        </View>

        <View
          style={[styles.dayCard, { borderLeftColor: theme.colors.accentLine }]}
        >
          <GradientFill accent={theme.colors.accentLine} />
          <Text style={styles.dayTitleDisplay}>{t('Rutina')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('Nombre (ej: Rutina {n})', {
                n: existingRoutineCount + 1,
              })}
              placeholderTextColor={theme.colors.textSecondary}
              value={routineName}
              onChangeText={setRoutineName}
              maxLength={40}
            />
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('Descripción (opcional)')}
              placeholderTextColor={theme.colors.textSecondary}
              value={routineDescription}
              onChangeText={setRoutineDescription}
              maxLength={80}
            />
          </View>
        </View>

        {days.length > 1 ? (
          <View style={styles.daysSortable}>
            <SortableList
              items={days}
              keyOf={(day) => day.id}
              gap={12}
              onMove={handleMoveDayTo}
              handleWidth={44}
              handleIconSize={28}
              handleStyle={styles.dayDragHandle}
              renderItem={(day, handle, index) =>
                renderDayCard(day, index, handle)
              }
            />
          </View>
        ) : (
          days.map((day, index) => renderDayCard(day, index))
        )}

        <View style={styles.rowButtons}>
          <Pressable
            style={[styles.dayChip, !canAddMoreDays && styles.dayChipDisabled]}
            onPress={handleAddDay}
            disabled={!canAddMoreDays}
          >
            <MaterialCommunityIcons
              name="plus-thick"
              size={16}
              color={
                canAddMoreDays
                  ? theme.colors.primary
                  : theme.colors.textSecondary
              }
            />
            <Text
              style={[
                styles.dayChipText,
                !canAddMoreDays && styles.dayChipTextDisabled,
              ]}
            >
              {t('Añadir día')}
            </Text>
          </Pressable>
        </View>

        <GradientCtaButton
          icon="check-bold"
          title={t('Crear rutina')}
          onPress={handleCreate}
          style={styles.createButton}
        />
        {/* Qué falta, en vivo y bajo el CTA: antes solo se sabía al pulsar,
            como toast, y había que volver a subir a buscar el hueco. */}
        {!!firstMissing && (
          <View style={styles.missingRow}>
            <MaterialCommunityIcons
              name="information-outline"
              size={15}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.missingText}>{firstMissing}</Text>
          </View>
        )}
      </StretchScrollView>

      <GlassTopBar
        title={t('Nueva rutina')}
        icon="playlist-plus"
        subtitle={t('Define los ejercicios que realizarás cada día')}
        topInset={insets.top}
        onLayout={onTopBarLayout}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

      <AppModal
        visible={showImport}
        onRequestClose={() => setShowImport(false)}
        title={t('Crear a partir de texto plano')}
        icon="text-box-plus-outline"
        align="left"
        message={t(
          'Un día por bloque (sepáralos con una línea en blanco). La primera línea es el nombre del día; debajo, un ejercicio por línea. Añade una "s" tras las reps para marcar segundos (ej: Plancha 3x30s).'
        )}
        footer={
          <View style={styles.modalButtons}>
            <Button
              title={t('Cancelar')}
              onPress={() => setShowImport(false)}
              variant="secondary"
              size="medium"
              style={styles.modalButton}
            />
            <Button
              title={t('Importar')}
              onPress={handleImportText}
              variant="primary"
              size="medium"
              style={styles.modalButton}
            />
          </View>
        }
      >
        <TextInput
          style={styles.modalTextarea}
          multiline
          textAlignVertical="top"
          placeholder={
            'Push\nPress banca 4x6-8\nPress militar 3x8-10\n\nPull\nDominadas 4x8\nRemo 4x10-12'
          }
          placeholderTextColor={theme.colors.textSecondary}
          value={importText}
          onChangeText={setImportText}
        />
      </AppModal>

      {/* Pegar el enlace de una rutina (el que viaja dentro del QR). El mensaje
          recuerda que el QR de verdad se escanea con la cámara del móvil y abre
          la app solo: aquí solo hace falta entrar si te han pasado el enlace
          suelto. Antes esto era una pantalla completa fuera del sistema de
          diseño; ahora es el hermano del modal de texto plano. */}
      <AppModal
        visible={showLinkImport}
        onRequestClose={() => setShowLinkImport(false)}
        title={t('Pegar el enlace de una rutina')}
        icon="link-variant"
        align="left"
        message={t(
          'Si tienes el código QR delante, apunta con la cámara del móvil y GymBro se abrirá solo con la rutina. Si te han pasado el enlace, pégalo aquí.'
        )}
        footer={
          <View style={styles.modalButtons}>
            <Button
              title={t('Cancelar')}
              onPress={() => setShowLinkImport(false)}
              variant="secondary"
              size="medium"
              style={styles.modalButton}
            />
            <Button
              title={t('Importar')}
              onPress={handleImportLink}
              variant="primary"
              size="medium"
              style={styles.modalButton}
            />
          </View>
        }
      >
        <TextInput
          style={styles.modalLinkInput}
          multiline
          textAlignVertical="top"
          placeholder="gymbro://import-routine?data=..."
          placeholderTextColor={theme.colors.textSecondary}
          value={linkText}
          onChangeText={(value) => {
            setLinkText(value);
            setLinkError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!!linkError && <Text style={styles.modalError}>{linkError}</Text>}
      </AppModal>

      <AppModal
        visible={iconPickerDayId !== null}
        onRequestClose={() => setIconPickerDayId(null)}
        title={t('Selecciona un icono para este día')}
        icon="shape-outline"
        footer={
          <Button
            title={t('Cerrar')}
            onPress={() => setIconPickerDayId(null)}
            variant="secondary"
            size="medium"
          />
        }
      >
        <GymIconGrid
          style={styles.iconGrid}
          activeIcon={(() => {
            const day = days.find((d) => d.id === iconPickerDayId);
            return day ? effectiveDayIcon(day) : null;
          })()}
          onSelect={(iconName) =>
            iconPickerDayId && handleSelectIcon(iconPickerDayId, iconName)
          }
        />
      </AppModal>

      {/* Quitar un día se pregunta antes: se lleva sus ejercicios, que en este
          formulario aún no existen en ningún otro sitio. Mismo modal y mismo
          criterio que la ficha de una rutina guardada. */}
      <ConfirmModal
        visible={!!dayToDeleteId}
        title={t('¿Quitar el día?')}
        message={t(
          'Se quitará del formulario junto con los ejercicios que le hayas puesto. ¿Continuar?'
        )}
        confirmLabel={t('Quitar')}
        onConfirm={() => dayToDeleteId && handleRemoveDay(dayToDeleteId)}
        onCancel={() => setDayToDeleteId(null)}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </View>
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
      marginTop: 0,
      gap: 12,
    },
    dayCard: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderTopColor: theme.colors.border,
      borderRightColor: theme.colors.border,
      borderBottomColor: theme.colors.border,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primaryLine,
      padding: theme.spacing.md,
      gap: 10,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    dayHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    // Lista de días arrastrable: la separación entre tarjetas la pone la
    // propia lista (`gap`), así que el contenedor solo aporta el hueco de
    // abajo (el `gap: 12` del scroll no llega dentro de ella).
    daysSortable: {
      marginBottom: 0,
    },
    dayCardSortable: {
      marginBottom: 0,
    },
    // El asa se sale del `padding` de la tarjeta (margen negativo) para quedar
    // a ras de su borde izquierdo, igual que en la ficha de una rutina.
    dayDragHandle: {
      marginLeft: -theme.spacing.md,
      marginVertical: -theme.spacing.md,
    },
    // Quitar el día: rotulado y al pie del bloque, lejos del asa. Borrar un día
    // se lleva sus ejercicios, así que pide confirmación (ConfirmModal).
    removeDayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    removeDayText: {
      color: theme.colors.error,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 17,
    },
    dayTitleDisplay: {
      fontSize: 21,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.5,
      color: theme.colors.text,
      lineHeight: 30,
    },
    dayIconPick: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBg,
    },
    dayIconPickEmpty: {
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.primary + '1A',
    },
    dayIconPickText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.text,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      lineHeight: 18,
    },
    inputRow: {
      flexDirection: 'row',
    },
    input: {
      flex: 1,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: theme.colors.text,
      fontSize: 15,
      lineHeight: 20,
    },
    addExerciseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.surfaceAlt,
    },
    addExerciseText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    rowButtons: {
      flexDirection: 'row',
      gap: 10,
    },
    dayChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.pill,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.surface,
    },
    dayChipDisabled: {
      borderColor: theme.colors.border,
      opacity: 0.5,
    },
    dayChipText: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.primary,
      lineHeight: 18,
    },
    dayChipTextDisabled: {
      color: theme.colors.textSecondary,
    },
    createButton: {
      marginTop: 4,
    },
    missingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 8,
    },
    missingText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    inputError: {
      borderColor: theme.colors.error,
    },
    importGroup: {
      gap: 8,
    },
    importGroupLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    manualDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginVertical: 2,
    },
    manualDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    manualDividerText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    qrButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 4,
      paddingVertical: 14,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.colors.primaryLine,
      backgroundColor: theme.colors.surfaceAlt,
    },
    qrButtonPressed: {
      opacity: 0.9,
    },
    qrButtonText: {
      color: theme.colors.primary,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    modalTextarea: {
      marginTop: 12,
      minHeight: 180,
      maxHeight: 320,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    // Caja del enlace pegado: como la de texto plano pero baja (un enlace ocupa
    // dos o tres renglones, no una rutina entera).
    modalLinkInput: {
      marginTop: 12,
      minHeight: 76,
      maxHeight: 140,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    modalError: {
      marginTop: 8,
      color: theme.colors.error,
      fontSize: 13,
      lineHeight: 18,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 10,
    },
    modalButton: {
      flex: 1,
      minWidth: 0,
    },
    iconGrid: {
      marginTop: 12,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
