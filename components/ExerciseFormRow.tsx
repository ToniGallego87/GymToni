import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  equipmentLabel,
  exerciseName,
  getCatalogExercise,
  suggestCatalogExercises,
  targetLabel,
  thumbUrl,
} from '@data/exerciseCatalog';
import { ExerciseForm, MAX_SETS, MIN_SETS, RepUnit } from '@lib/exerciseForm';
import { formatExerciseNames, otherExerciseNames } from '@lib/exerciseIdentity';
import { useExerciseNames } from '@hooks/useExerciseKeyResolver';
import { AppModal } from './AppModal';
import { Button } from './Button';
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
 * Editor de un ejercicio en un popup. Lo usan "Nueva rutina" y la ficha de
 * una rutina guardada (lápiz de cada casilla), para que crear y editar se
 * hagan igual.
 *
 * Tres bloques, de arriba abajo, en el orden en que se piensa:
 * 1. Qué ejercicio es: la miniatura del GIF y el nombre, que ES el título
 *    (antes el título decía "Ejercicio" y el nombre era un campo más debajo).
 * 2. De qué ejercicio del catálogo es: una sola línea con "Cambiar" y ✕, o el
 *    botón para buscarlo y las propuestas mientras se escribe.
 * 3. El plan: series y repeticiones (o segundos), una fila cada uno con el
 *    rótulo a la izquierda y el control a la derecha.
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

  const linked = getCatalogExercise(exercise?.catalogId);
  const typedName = exercise?.name ?? '';
  // Los otros nombres con los que ya aparece este ejercicio en tus rutinas y tu
  // historial (sin el escrito aquí ni el del catálogo, que ya se ven).
  const { resolve, namesByKey } = useExerciseNames();
  const otherNames = linked
    ? otherExerciseNames(
        namesByKey.get(resolve({ name: typedName, catalogId: linked.id })),
        typedName,
        linked.es,
        linked.en
      )
    : [];
  // Propuestas del catálogo para lo que se escribe, solo si aún no es ningún
  // ejercicio del catálogo (ver `suggestCatalogExercises`: nunca elige sola).
  const suggestions = useMemo(
    () =>
      visible && !exercise?.catalogId ? suggestCatalogExercises(typedName) : [],
    [visible, exercise?.catalogId, typedName]
  );

  const sets = exercise?.sets ?? MIN_SETS;
  const adjustSets = (delta: number) => {
    const next = Math.min(MAX_SETS, Math.max(MIN_SETS, sets + delta));
    onChange({ sets: next });
  };

  const unit = exercise?.unit ?? 'reps';

  // Cabecera: miniatura + nombre editable a tamaño de título. La miniatura
  // reproduce el GIF si hay ejercicio del catálogo; si no, abre el buscador.
  const header = (
    <View style={styles.header}>
      <Pressable
        style={({ pressed }) => [styles.headerThumb, pressed && styles.pressed]}
        onPress={() => (linked ? setShowGif(true) : setShowPicker(true))}
        accessibilityRole="button"
        accessibilityLabel={linked ? t('Ver GIF') : t('Buscar en el catálogo')}
      >
        {linked ? (
          <>
            <Image
              source={{ uri: thumbUrl(linked) }}
              style={styles.headerThumbImage}
              resizeMode="contain"
            />
            <View style={styles.headerThumbBadge}>
              <MaterialCommunityIcons
                name="play"
                size={12}
                color={theme.colors.onGold}
              />
            </View>
          </>
        ) : (
          <MaterialCommunityIcons
            name="image-search-outline"
            size={24}
            color={theme.colors.textSecondary}
          />
        )}
      </Pressable>
      <View style={styles.headerNameWrap}>
        <TextInput
          style={styles.headerName}
          placeholder={t('Nombre del ejercicio')}
          placeholderTextColor={theme.colors.textSecondary}
          value={typedName}
          autoFocus={!typedName}
          multiline
          // Multilínea para que un nombre largo se lea entero, pero sin saltos
          // de línea: Intro cierra el teclado.
          blurOnSubmit
          returnKeyType="done"
          maxLength={80}
          // El nombre es solo la etiqueta: cambiarlo NO rompe el vínculo con
          // el catálogo (llamarlo "Banca" sigue siendo el press de banca, con
          // su GIF y su historial). Vaciarlo sí: es empezar otro ejercicio.
          // Para decir "no es este", la ✕ de la línea del catálogo.
          onChangeText={(raw) => {
            const value = raw.replace(/\n/g, ' ');
            onChange(
              value.trim()
                ? { name: value }
                : { name: value, catalogId: undefined }
            );
          }}
          accessibilityLabel={t('Nombre')}
        />
      </View>
    </View>
  );

  return (
    <>
      <AppModal
        visible={visible}
        onRequestClose={onDone}
        onOverlayPress={onDone}
        title={typedName || t('Ejercicio')}
        header={header}
        align="left"
        footer={<Button title={t('Listo')} onPress={onDone} />}
      >
        <View style={styles.editor}>
          {linked ? (
            // Qué ejercicio ES, con los otros nombres con los que lo llamas:
            // un ejercicio, varios nombres. Lo que junta su historial es el
            // ejercicio, no lo escrito.
            <View style={styles.catalogRow}>
              <MaterialCommunityIcons
                name="book-open-variant"
                size={16}
                color={theme.colors.primary}
              />
              <View style={styles.catalogText}>
                <Text style={styles.catalogName} numberOfLines={2}>
                  {exerciseName(linked)}
                </Text>
                {otherNames.length > 0 && (
                  <Text style={styles.catalogAliases} numberOfLines={2}>
                    {t('También lo llamas: {names}', {
                      names: formatExerciseNames(otherNames),
                    })}
                  </Text>
                )}
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.textButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => setShowPicker(true)}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.textButtonLabel}>{t('Cambiar')}</Text>
              </Pressable>
              <Pressable
                onPress={() => onChange({ catalogId: undefined })}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('No es este ejercicio')}
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={18}
                  color={theme.colors.textMuted}
                />
              </Pressable>
            </View>
          ) : (
            <View style={styles.catalogSearch}>
              {/* Sin ejercicio del catálogo, la app propone mientras
                  escribes: un toque y lo escrito pasa a ser ESE ejercicio
                  (con su GIF; el nombre luego se puede cambiar). */}
              {suggestions.length > 0 && (
                <View style={styles.suggestions}>
                  <Text style={styles.sectionLabel}>
                    {t('¿Es alguno de estos?')}
                  </Text>
                  {suggestions.map((suggestion) => (
                    <Pressable
                      key={suggestion.id}
                      style={({ pressed }) => [
                        styles.suggestionRow,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        onChange({
                          name: exerciseName(suggestion),
                          catalogId: suggestion.id,
                        })
                      }
                    >
                      <Image
                        source={{ uri: thumbUrl(suggestion) }}
                        style={styles.suggestionThumb}
                        resizeMode="cover"
                      />
                      <View style={styles.suggestionText}>
                        <Text style={styles.suggestionName} numberOfLines={2}>
                          {exerciseName(suggestion)}
                        </Text>
                        <Text style={styles.suggestionMeta} numberOfLines={1}>
                          {targetLabel(suggestion.target)} ·{' '}
                          {equipmentLabel(suggestion.equipment)}
                        </Text>
                      </View>
                      <MaterialCommunityIcons
                        name="plus-circle-outline"
                        size={20}
                        color={theme.colors.primary}
                      />
                    </Pressable>
                  ))}
                </View>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.searchButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => setShowPicker(true)}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons
                  name="magnify"
                  size={18}
                  color={theme.colors.primary}
                />
                <Text style={styles.searchButtonText}>
                  {t('Buscar en el catálogo')}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.plan}>
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>{t('Series')}</Text>
              <View style={styles.stepper}>
                <Pressable
                  style={({ pressed }) => [
                    styles.stepperButton,
                    sets <= MIN_SETS && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => adjustSets(-1)}
                  disabled={sets <= MIN_SETS}
                  hitSlop={6}
                  accessibilityLabel={t('Menos series')}
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
                    sets >= MAX_SETS && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => adjustSets(1)}
                  disabled={sets >= MAX_SETS}
                  hitSlop={6}
                  accessibilityLabel={t('Más series')}
                >
                  <MaterialCommunityIcons
                    name="plus"
                    size={18}
                    color={theme.colors.text}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.planDivider} />

            {/* Qué se cuenta en cada serie (repeticiones o segundos) a la
                izquierda, como rótulo que se elige; cuántas, a la derecha. */}
            <View style={styles.planRow}>
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
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.unitOptionText,
                          active && styles.unitOptionTextActive,
                        ]}
                      >
                        {option === 'reps' ? t('Reps') : t('Segundos')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={styles.repsInput}
                placeholder={unit === 'seg' ? '30-45' : '10-12'}
                placeholderTextColor={theme.colors.textSecondary}
                value={exercise?.reps ?? ''}
                onChangeText={(value) => onChange({ reps: value })}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                accessibilityLabel={
                  unit === 'seg' ? t('Segundos') : t('Repeticiones')
                }
              />
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

const THUMB_SIZE = 64;

const makeStyles = () =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },
    headerThumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    headerThumbImage: {
      width: '100%',
      height: '100%',
    },
    headerThumbBadge: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.colors.primaryLine,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerNameWrap: {
      flex: 1,
      minWidth: 0,
      borderBottomWidth: 1.5,
      borderBottomColor: theme.colors.primaryLine,
    },
    // El nombre a tamaño de título (el mismo que el de `AppModal`): es lo
    // que encabeza el popup. La raya dorada de debajo dice que se escribe.
    headerName: {
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 23,
      color: theme.colors.text,
      paddingVertical: 4,
      paddingHorizontal: 0,
      maxHeight: 23 * 3 + 8,
    },
    editor: {
      gap: 16,
    },
    catalogRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.primaryMuted,
    },
    catalogText: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    catalogName: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
    },
    catalogAliases: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    textButton: {
      paddingHorizontal: 2,
    },
    textButtonLabel: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    catalogSearch: {
      gap: 10,
    },
    searchButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 40,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
    },
    searchButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    suggestions: {
      gap: 6,
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    suggestionThumb: {
      width: 36,
      height: 36,
      borderRadius: 6,
      backgroundColor: theme.colors.surfaceAlt,
    },
    suggestionText: {
      flex: 1,
      minWidth: 0,
    },
    suggestionName: {
      fontSize: 14,
      color: theme.colors.text,
    },
    suggestionMeta: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    // El plan en una tarjeta: dos filas iguales, rótulo a la izquierda y
    // control a la derecha.
    plan: {
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: 12,
    },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      minHeight: 60,
    },
    planDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
    },
    planLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
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
      width: 40,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValue: {
      minWidth: 28,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
    },
    repsInput: {
      width: 108,
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      height: 44,
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
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
      paddingHorizontal: 10,
      height: 40,
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
      color: theme.colors.text,
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.4,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
