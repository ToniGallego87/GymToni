import { subscribeTheme } from '@lib/themeStore';
import React, { ReactNode, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { exerciseName } from '@data/exerciseCatalog';
import { ExerciseForm, MAX_SETS, MIN_SETS, RepUnit } from '@lib/exerciseForm';
import { AppModal } from './AppModal';
import { Button } from './Button';
import { ConfirmModal } from './ConfirmModal';
import { ExercisePickerModal } from './ExercisePickerModal';
import { GifViewerModal } from './GifViewerModal';

interface ExerciseEditorModalProps {
  visible: boolean;
  /** Ejercicio que se edita; `null` mientras el modal está cerrado. */
  exercise: ExerciseForm | null;
  accent: string;
  onChange: (changes: Partial<ExerciseForm>) => void;
  /** "Listo", tocar fuera o atrás: cerrar ES guardar (no hay "Cancelar"). */
  onDone: () => void;
}

/**
 * Editor de un ejercicio en un popup: nombre (con buscador del catálogo y su
 * GIF), stepper de series y reps/segundos. Lo usan "Nueva rutina" y el editor
 * de ejercicios de un día ya guardado, para que crear y editar se hagan igual.
 *
 * Antes se editaba desplegado en la propia fila, encajonado entre las demás:
 * cinco dianas pequeñas y campos que competían con la lista. El popup da al
 * formulario el ancho de la pantalla y deja la lista limpia detrás.
 */
export function ExerciseEditorModal({
  visible,
  exercise,
  accent,
  onChange,
  onDone,
}: ExerciseEditorModalProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [showGif, setShowGif] = useState(false);

  const sets = exercise?.sets ?? MIN_SETS;
  const adjustSets = (delta: number) => {
    const next = Math.min(MAX_SETS, Math.max(MIN_SETS, sets + delta));
    onChange({ sets: next });
  };

  const unit = exercise?.unit ?? 'reps';

  return (
    <>
      <AppModal
        visible={visible}
        onRequestClose={onDone}
        onOverlayPress={onDone}
        icon="pencil-outline"
        title={t('Ejercicio')}
        align="left"
        footer={<Button title={t('Listo')} onPress={onDone} />}
      >
        <View style={styles.editor}>
          <View style={styles.controlBlock}>
            <Text style={styles.controlLabel}>{t('Nombre')}</Text>
            <View style={styles.exerciseNameRow}>
              <TextInput
                style={styles.exerciseNameInput}
                placeholder={t('Ej: Press banca')}
                placeholderTextColor={theme.colors.textSecondary}
                value={exercise?.name ?? ''}
                autoFocus={!exercise?.name}
                // Escribir a mano rompe el vínculo con el catálogo (ya no es
                // ese GIF).
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
              {!!exercise?.catalogId && (
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
            </View>
          </View>

          <View style={styles.exerciseControlsRow}>
            <View style={styles.controlBlock}>
              <Text style={styles.controlLabel}>{t('Series')}</Text>
              <View style={styles.stepper}>
                <Pressable
                  style={({ pressed }) => [
                    styles.stepperButton,
                    sets <= MIN_SETS && styles.controlDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => adjustSets(-1)}
                  disabled={sets <= MIN_SETS}
                  hitSlop={6}
                >
                  <MaterialCommunityIcons
                    name="minus"
                    size={18}
                    color={theme.colors.text}
                  />
                </Pressable>
                <Text style={styles.stepperValue}>{sets}</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.stepperButton,
                    sets >= MAX_SETS && styles.controlDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => adjustSets(1)}
                  disabled={sets >= MAX_SETS}
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
                {unit === 'seg' ? t('Segundos') : t('Repeticiones')}
              </Text>
              <View style={styles.repsRow}>
                <TextInput
                  style={styles.repsInput}
                  placeholder={unit === 'seg' ? t('Ej: 30-45') : t('Ej: 10-12')}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={exercise?.reps ?? ''}
                  onChangeText={(value) => onChange({ reps: value })}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
                <View style={styles.unitToggle}>
                  {(['reps', 'seg'] as RepUnit[]).map((option) => {
                    const active = unit === option;
                    return (
                      <Pressable
                        key={option}
                        style={[
                          styles.unitOption,
                          active && [
                            styles.unitOptionActive,
                            { borderColor: accent },
                          ],
                        ]}
                        onPress={() => onChange({ unit: option })}
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
                          {option === 'reps' ? t('reps') : t('seg')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        </View>
      </AppModal>

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
        catalogId={exercise?.catalogId}
        fallbackName={exercise?.name ?? ''}
      />
    </>
  );
}

interface ExerciseSummaryRowProps {
  exercise: ExerciseForm;
  canRemove: boolean;
  onEdit: () => void;
  onRemove: () => void;
  /** Asa de arrastre (la pone `SortableList`); va a la izquierda del nombre. */
  dragHandle?: ReactNode;
}

/**
 * Fila de un ejercicio en el editor del día: nombre, lápiz y papelera. Nada
 * más: el plan y el GIF se tocan en el popup del lápiz; el orden, con el asa.
 *
 * La papelera pide confirmación: quitar un ejercicio de una rutina guardada
 * se lleva por delante su historial, y antes era una X de un solo toque.
 */
export function ExerciseSummaryRow({
  exercise,
  canRemove,
  onEdit,
  onRemove,
  dragHandle,
}: ExerciseSummaryRowProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const name = exercise.name.trim();

  return (
    <>
      <View
        style={[
          styles.summaryCard,
          !!dragHandle && styles.summaryCardWithHandle,
        ]}
      >
        {dragHandle}
        <Pressable
          style={({ pressed }) => [
            styles.summaryNameRow,
            pressed && styles.buttonPressed,
          ]}
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={t('Editar {name}', {
            name: name || t('Sin nombre'),
          })}
        >
          <Text
            style={[styles.summaryName, !name && styles.summaryNameEmpty]}
            numberOfLines={2}
          >
            {name || t('Sin nombre')}
          </Text>
          <MaterialCommunityIcons
            name="pencil"
            size={18}
            color={theme.colors.textSecondary}
          />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.summaryAction,
            !canRemove && styles.controlDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setConfirmRemove(true)}
          disabled={!canRemove}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('Quitar ejercicio')}
        >
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={20}
            color={canRemove ? theme.colors.error : theme.colors.textSecondary}
          />
        </Pressable>
      </View>

      <ConfirmModal
        visible={confirmRemove}
        icon="trash-can-outline"
        title={t('¿Quitar el ejercicio?')}
        message={
          name
            ? t('"{name}" desaparecerá de este día de la rutina.', { name })
            : t('El ejercicio desaparecerá de este día de la rutina.')
        }
        confirmLabel={t('Quitar')}
        onConfirm={() => {
          setConfirmRemove(false);
          onRemove();
        }}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    editor: {
      gap: 14,
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
    iconButton: {
      width: 38,
      height: 44,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    // Fila de la lista: nombre + plan + lápiz a la izquierda (todo abre el
    // editor) y la papelera a la derecha, a tamaño de dedo.
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingLeft: 12,
      paddingRight: 4,
      paddingVertical: 4,
    },
    summaryCardWithHandle: {
      paddingLeft: 0,
    },
    summaryNameRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
    },
    summaryName: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 21,
    },
    summaryNameEmpty: {
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
      fontWeight: '500',
    },
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
      width: 36,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValue: {
      minWidth: 28,
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
