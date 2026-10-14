import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  CatalogExercise,
  equipmentLabel,
  exerciseName,
  getExerciseCatalog,
  searchCatalog,
  TagFilter,
  targetLabel,
  thumbUrl,
} from '@data/exerciseCatalog';
import { CatalogTagFilters } from './CatalogTagFilters';
import { GifViewerModal } from './GifViewerModal';

interface ExercisePickerModalProps {
  visible: boolean;
  onRequestClose: () => void;
  /**
   * Se llama con el ejercicio elegido; el llamante cierra el modal. En modo
   * `reference` no se usa (tocar una fila solo muestra su GIF).
   */
  onSelect?: (exercise: CatalogExercise) => void;
  /**
   * Modo consulta: no se elige nada, tocar una fila abre su GIF. Para mirar un
   * ejercicio de referencia desde el registro o el detalle del día.
   */
  reference?: boolean;
  /** Búsqueda inicial (p. ej. el nombre del ejercicio que se consulta). */
  initialQuery?: string;
  /**
   * En modo consulta, permite fijar el GIF previsualizado al ejercicio de la
   * rutina: el visor del GIF muestra un botón **Asignar** que guarda su
   * `catalogId`.
   */
  onAssign?: (catalogId: string) => void;
}

/**
 * Catálogo de ejercicios buscable para elegir sin teclear a mano. Busca por
 * nombre (ES/EN, sin tildes) y etiqueta, filtra por zona → músculo → equipo
 * (`CatalogTagFilters`) y deja previsualizar el
 * GIF antes de elegir. Al seleccionar, devuelve el ejercicio del catálogo.
 */
export function ExercisePickerModal({
  visible,
  onRequestClose,
  onSelect,
  reference = false,
  initialQuery = '',
  onAssign,
}: ExercisePickerModalProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(initialQuery);
  const [tagFilter, setTagFilter] = useState<TagFilter>({});
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Al reabrir, arrancar por la búsqueda inicial (el ejercicio consultado).
  useEffect(() => {
    if (visible) setQuery(initialQuery);
  }, [visible, initialQuery]);

  const handleRowPress = (item: CatalogExercise) => {
    if (reference) setPreviewId(item.id);
    else onSelect?.(item);
  };

  // Cerrado no calcula NADA: el modal queda montado en cada tarjeta que lo
  // ofrece (registro, detalle, rutina), y buscar en los 1300 ejercicios por
  // cada una al montar era lo que hacía tardar segundos en abrir esas vistas.
  //
  // Lo que se puede elegir (sin las copias ocultas): de aquí salen las
  // etiquetas que ofrece el filtro.
  const pickable = useMemo(
    () => (visible ? getExerciseCatalog().filter((e) => !e.hidden) : []),
    [visible]
  );

  // De más a menos relevante, con los sinónimos de gimnasio ("press banca",
  // "jalón al pecho"), las etiquetas ("bíceps", "mancuerna") y el filtro de
  // zona → músculo → equipo.
  const results = useMemo(
    () => (visible ? searchCatalog(query, tagFilter) : []),
    [visible, query, tagFilter]
  );

  const renderItem = ({ item }: { item: CatalogExercise }) => (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
        onPress={() => handleRowPress(item)}
      >
        <Image
          source={{ uri: thumbUrl(item) }}
          style={styles.thumb}
          resizeMode="cover"
        />
        <View style={styles.rowText}>
          <Text style={styles.rowName} numberOfLines={2}>
            {exerciseName(item)}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {targetLabel(item.target)} · {equipmentLabel(item.equipment)}
          </Text>
        </View>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
        onPress={() => setPreviewId(item.id)}
        hitSlop={8}
        accessibilityLabel={t('Ver GIF')}
      >
        <MaterialCommunityIcons
          name="play-box-outline"
          size={22}
          color={theme.colors.primary}
        />
      </Pressable>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onRequestClose}
    >
      <StatusBar style={theme.statusBarStyle} />
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color={theme.colors.text}
          />
          <Text style={styles.headerTitle}>
            {reference ? t('Ver ejercicio') : t('Catálogo de ejercicios')}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.pressed,
            ]}
            onPress={onRequestClose}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="close"
              size={22}
              color={theme.colors.text}
            />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={theme.colors.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={t('Buscar ejercicio…')}
            placeholderTextColor={theme.colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          )}
        </View>

        <CatalogTagFilters
          items={pickable}
          value={tagFilter}
          onChange={setTagFilter}
          style={styles.filter}
        />

        <Text style={styles.count}>
          {t('{n} ejercicios', { n: results.length })}
        </Text>

        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={8}
          removeClippedSubviews
          ListEmptyComponent={
            <Text style={styles.empty}>{t('Sin resultados')}</Text>
          }
        />
      </View>

      <GifViewerModal
        visible={previewId !== null}
        onRequestClose={() => setPreviewId(null)}
        catalogId={previewId ?? undefined}
        onAssign={
          onAssign
            ? (assignedId) => {
                onAssign(assignedId);
                setPreviewId(null);
                onRequestClose();
              }
            : undefined
        }
      />
    </Modal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
    },
    closeButton: {
      width: 38,
      height: 38,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
      paddingHorizontal: 12,
      height: 46,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBg,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      color: theme.colors.text,
      fontSize: 15,
    },
    filter: {
      marginTop: 12,
    },
    count: {
      marginTop: 12,
      marginBottom: 4,
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    list: {
      gap: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rowMain: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 8,
    },
    thumb: {
      width: 48,
      height: 48,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.surface,
    },
    rowText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    rowName: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
    },
    rowMeta: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    eyeButton: {
      width: 44,
      height: 44,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    empty: {
      marginTop: 40,
      textAlign: 'center',
      color: theme.colors.textSecondary,
      fontSize: 14,
    },
    pressed: {
      opacity: 0.8,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
