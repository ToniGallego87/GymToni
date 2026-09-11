import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { exerciseName } from '@data/exerciseCatalog';
import {
  buildTargetReps,
  ExerciseForm,
  MAX_SETS,
  MIN_SETS,
  RepUnit,
} from '@lib/exerciseForm';
import { ExercisePickerModal } from './ExercisePickerModal';
import { GifViewerModal } from './GifViewerModal';

interface ExerciseFormRowProps {
  exercise: ExerciseForm;
  accent: string;
  canRemove: boolean;
  onChange: (changes: Partial<ExerciseForm>) => void;
  onRemove: () => void;
  onCollapse: () => void;
}

/**
 * Editor estructurado de un ejercicio: nombre + stepper de series +
 * reps/segundos. Lo usan "Nueva rutina" y el editor de ejercicios de un día ya
 * guardado, para que crear y editar se hagan igual (antes editar era un
 * textarea con formato "Nombre — 4x8" parseado a mano).
 */
export function ExerciseFormRow({
  exercise,
  accent,
  canRemove,
  onChange,
  onRemove,
  onCollapse,
}: ExerciseFormRowProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [showGif, setShowGif] = useState(false);

  const adjustSets = (delta: number) => {
    const next = Math.min(MAX_SETS, Math.max(MIN_SETS, exercise.sets + delta));
    onChange({ sets: next });
  };

  const hasName = !!exercise.name.trim();

  return (
    <>
      <View style={styles.exerciseRow}>
        <View style={styles.exerciseNameRow}>
          <TextInput
            style={styles.exerciseNameInput}
            placeholder={t('Ej: Press banca')}
            placeholderTextColor={theme.colors.textSecondary}
            value={exercise.name}
            // Escribir a mano rompe el vínculo con el catálogo (ya no es ese GIF).
            onChangeText={(value) =>
              onChange({ name: value, catalogId: undefined })
            }
          />
          <Pressable
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setShowPicker(true)}
            hitSlop={8}
            accessibilityLabel={t('Buscar en el catálogo')}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={18}
              color={theme.colors.primary}
            />
          </Pressable>
          {!!exercise.catalogId && (
            <Pressable
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setShowGif(true)}
              hitSlop={8}
              accessibilityLabel={t('Ver GIF')}
            >
              <MaterialCommunityIcons
                name="play-box-outline"
                size={18}
                color={theme.colors.primary}
              />
            </Pressable>
          )}
          {hasName && (
            <Pressable
              style={({ pressed }) => [
                styles.collapseButton,
                { borderColor: accent },
                pressed && styles.buttonPressed,
              ]}
              onPress={onCollapse}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="check" size={18} color={accent} />
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.removeExerciseButton,
              !canRemove && styles.controlDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={onRemove}
            disabled={!canRemove}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="close"
              size={18}
              color={
                canRemove ? theme.colors.error : theme.colors.textSecondary
              }
            />
          </Pressable>
        </View>

        <View style={styles.exerciseControlsRow}>
          <View style={styles.controlBlock}>
            <Text style={styles.controlLabel}>{t('Series')}</Text>
            <View style={styles.stepper}>
              <Pressable
                style={({ pressed }) => [
                  styles.stepperButton,
                  exercise.sets <= MIN_SETS && styles.controlDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => adjustSets(-1)}
                disabled={exercise.sets <= MIN_SETS}
                hitSlop={6}
              >
                <MaterialCommunityIcons
                  name="minus"
                  size={18}
                  color={theme.colors.text}
                />
              </Pressable>
              <Text style={styles.stepperValue}>{exercise.sets}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.stepperButton,
                  exercise.sets >= MAX_SETS && styles.controlDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => adjustSets(1)}
                disabled={exercise.sets >= MAX_SETS}
                hitSlop={6}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={18}
                  color={theme.colors.text}
                />
              </Pressable>
            </View>
          </View>

          <View style={[styles.controlBlock, styles.controlBlockGrow]}>
            <Text style={styles.controlLabel}>
              {exercise.unit === 'seg' ? t('Segundos') : t('Repeticiones')}
            </Text>
            <View style={styles.repsRow}>
              <TextInput
                style={styles.repsInput}
                placeholder={
                  exercise.unit === 'seg' ? t('Ej: 30-45') : t('Ej: 10-12')
                }
                placeholderTextColor={theme.colors.textSecondary}
                value={exercise.reps}
                onChangeText={(value) => onChange({ reps: value })}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
              <View style={styles.unitToggle}>
                {(['reps', 'seg'] as RepUnit[]).map((unit) => {
                  const active = exercise.unit === unit;
                  return (
                    <Pressable
                      key={unit}
                      style={[
                        styles.unitOption,
                        active && [
                          styles.unitOptionActive,
                          { borderColor: accent },
                        ],
                      ]}
                      onPress={() => onChange({ unit })}
                    >
                      <Text
                        style={[
                          styles.unitOptionText,
                          active && [
                            styles.unitOptionTextActive,
                            { color: accent },
                          ],
                        ]}
                      >
                        {unit === 'reps' ? t('reps') : t('seg')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </View>

      <ExercisePickerModal
        visible={showPicker}
        onRequestClose={() => setShowPicker(false)}
        onSelect={(picked) => {
          onChange({ name: exerciseName(picked), catalogId: picked.id });
          setShowPicker(false);
        }}
      />
      <GifViewerModal
        visible={showGif}
        onRequestClose={() => setShowGif(false)}
        catalogId={exercise.catalogId}
        fallbackName={exercise.name}
      />
    </>
  );
}

interface ExerciseSummaryRowProps {
  exercise: ExerciseForm;
  canRemove: boolean;
  onEdit: () => void;
  onRemove: () => void;
  // Reordenar el ejercicio dentro del día. Si no se pasan, no salen las flechas
  // (p. ej. al crear una rutina, donde el orden es el de tecleo).
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

/**
 * Fila colapsada: el ejercicio ya definido.
 *
 * Va en DOS alturas. En una sola línea el nombre —que es el dato por el que se
 * reconoce la fila— competía por el ancho con cinco dianas (reordenar, editar,
 * GIF, borrar) y se quedaba con unos 80 px: ocho caracteres, así que "Press
 * banca inclinado con mancuernas" se leía "Press banca i…". Ahora el nombre
 * tiene la primera línea entera (hasta dos renglones) y los controles bajan a
 * una fila propia, donde caben a tamaño de dedo: las flechas eran de 30×22 px,
 * apiladas una sobre otra, el control más fácil de fallar de la pantalla.
 */
export function ExerciseSummaryRow({
  exercise,
  canRemove,
  onEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: ExerciseSummaryRowProps) {
  const [showGif, setShowGif] = useState(false);
  const showReorder = !!onMoveUp || !!onMoveDown;

  return (
    <>
      <View style={styles.summaryCard}>
        {/* Primera altura: el nombre manda, y tocarlo abre el editor (el lápiz
            lo delata). Hasta dos renglones antes de recortar. */}
        <Pressable
          style={({ pressed }) => [
            styles.summaryNameRow,
            pressed && styles.buttonPressed,
          ]}
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={t('Editar {name}', {
            name: exercise.name.trim(),
          })}
        >
          <Text style={styles.summaryName} numberOfLines={2}>
            {exercise.name.trim()}
          </Text>
          <MaterialCommunityIcons
            name="pencil"
            size={16}
            color={theme.colors.textSecondary}
          />
        </Pressable>

        {/* Segunda altura: el plan a la izquierda y los controles a la derecha,
            todos de 44 px de alto. */}
        <View style={styles.summaryMetaRow}>
          <Text style={styles.summarySets}>
            {exercise.sets}x{buildTargetReps(exercise)}
          </Text>
          <View style={styles.summaryActions}>
            {!!exercise.catalogId && (
              <Pressable
                style={({ pressed }) => [
                  styles.summaryAction,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setShowGif(true)}
                accessibilityRole="button"
                accessibilityLabel={t('Ver GIF')}
              >
                <MaterialCommunityIcons
                  name="play-box-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </Pressable>
            )}
            {showReorder && (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.summaryAction,
                    !canMoveUp && styles.controlDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={onMoveUp}
                  disabled={!canMoveUp}
                  accessibilityRole="button"
                  accessibilityLabel={t('Subir ejercicio')}
                >
                  <MaterialCommunityIcons
                    name="chevron-up"
                    size={22}
                    color={
                      canMoveUp ? theme.colors.text : theme.colors.textSecondary
                    }
                  />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.summaryAction,
                    !canMoveDown && styles.controlDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={onMoveDown}
                  disabled={!canMoveDown}
                  accessibilityRole="button"
                  accessibilityLabel={t('Bajar ejercicio')}
                >
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={22}
                    color={
                      canMoveDown
                        ? theme.colors.text
                        : theme.colors.textSecondary
                    }
                  />
                </Pressable>
              </>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.summaryAction,
                !canRemove && styles.controlDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={onRemove}
              disabled={!canRemove}
              accessibilityRole="button"
              accessibilityLabel={t('Quitar ejercicio')}
            >
              <MaterialCommunityIcons
                name="close"
                size={20}
                color={
                  canRemove ? theme.colors.error : theme.colors.textSecondary
                }
              />
            </Pressable>
          </View>
        </View>
      </View>

      <GifViewerModal
        visible={showGif}
        onRequestClose={() => setShowGif(false)}
        catalogId={exercise.catalogId}
        fallbackName={exercise.name}
      />
    </>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    exerciseRow: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      gap: 12,
    },
    exerciseNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    exerciseNameInput: {
      flex: 1,
      minWidth: 0,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.colors.text,
      fontSize: 15,
      lineHeight: 20,
    },
    removeExerciseButton: {
      width: 38,
      height: 38,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    collapseButton: {
      width: 38,
      height: 38,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    iconButton: {
      width: 34,
      height: 38,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    // Tarjeta de dos alturas: nombre arriba, plan y controles abajo.
    summaryCard: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 4,
    },
    summaryNameRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    summaryName: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 21,
    },
    summaryMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    summarySets: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
    summaryActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    // Diana de 44 px: las flechas apiladas de antes medían 30×22 y se fallaban.
    summaryAction: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    exerciseControlsRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    controlBlock: {
      gap: 6,
    },
    controlBlockGrow: {
      flex: 1,
      minWidth: 0,
    },
    controlLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    stepperButton: {
      width: 32,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValue: {
      minWidth: 24,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
    },
    repsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    repsInput: {
      flex: 1,
      minWidth: 0,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      height: 44,
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    unitToggle: {
      flexDirection: 'row',
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    unitOption: {
      paddingHorizontal: 12,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 2,
      borderColor: 'transparent',
    },
    unitOptionActive: {
      backgroundColor: theme.colors.surface,
    },
    unitOptionText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    unitOptionTextActive: {
      color: theme.colors.primary,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    controlDisabled: {
      opacity: 0.4,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
