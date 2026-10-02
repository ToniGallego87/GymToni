import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { canonicalDecimals, t } from '@lib/i18n';
import {
  disciplineIconName,
  parseCardioEntry,
  hasIncline,
  formatEntryResults,
} from '@lib/cardio';
import { AppModal } from './AppModal';
import { Button } from './Button';
import {
  MENU_TILE_GAP,
  MENU_TILE_INSET,
  MENU_TILE_PADDING,
} from './menuTileTokens';

interface CardioInputFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  // Color de acento del día (push/pull/pierna). Tiñe el borde izquierdo.
  accent?: string;
  // Disciplinas a la vista como casillas (icono + nombre, como el menú de
  // Perfil) en vez del botón "Añadir cardio" + lista en el modal. Lo usa
  // "Insertar cardio" (solo cardio), donde elegir disciplina es LA acción: la
  // casilla abre directamente el popup de detalles.
  inlinePicker?: boolean;
}

type CardioType =
  | 'treadmill'
  | 'treadmill-walk'
  | 'outdoor-run'
  | 'stationary-bike'
  | 'elliptical'
  | 'other'
  | null;

// Disciplinas de cinta: muestran el campo de pendiente.
const TREADMILL_TYPES: CardioType[] = ['treadmill', 'treadmill-walk'];

const CARDIO_OPTIONS = [
  { id: 'treadmill', label: t('Correr en cinta') },
  { id: 'treadmill-walk', label: t('Andar en cinta') },
  { id: 'outdoor-run', label: t('Correr en exterior') },
  { id: 'stationary-bike', label: t('Bici estática') },
  { id: 'elliptical', label: t('Elíptica') },
  { id: 'other', label: t('Otro') },
];

// Icono de una opción del picker. Fuente única: disciplineIconName (la misma que
// la lista de disciplinas ya registradas y la vista de consulta), para que la
// misma disciplina no tenga dos iconos distintos. "Otro" no es una disciplina
// concreta, así que conserva su icono de affordance.
const optionIconName = (option: { id: string; label: string }): string =>
  option.id === 'other'
    ? 'dots-horizontal-circle-outline'
    : disciplineIconName(option.label);

export function CardioInputField({
  value,
  onChangeText,
  accent = theme.colors.primaryLine,
  inlinePicker = false,
}: CardioInputFieldProps) {
  const [cardioEntries, setCardioEntries] = useState<string[]>(() => {
    if (!value) return [];
    return value.split(' | ').filter((e) => e.trim());
  });
  // La tarjeta solo existe cuando hay al menos un cardio guardado; mientras no
  // lo haya, se muestra el botón "Añadir cardio".
  const isExpanded = cardioEntries.length > 0;
  const [showCardioModal, setShowCardioModal] = useState(false);
  const [selectedCardioType, setSelectedCardioType] =
    useState<CardioType>(null);
  const [customCardioType, setCustomCardioType] = useState('');
  const [cardioMinutes, setCardioMinutes] = useState('');
  const [cardioSpeed, setCardioSpeed] = useState('');
  const [cardioPendiente, setCardioPendiente] = useState('');
  const [step, setStep] = useState<'type' | 'details'>('type');

  // Paso en el que está el asistente del modal.
  const isTypeStep = step === 'type' && !selectedCardioType;
  const isCustomTypeStep = step === 'type' && selectedCardioType === 'other';
  const isDetailsStep = step === 'details';
  const modalTitle = isDetailsStep
    ? t('Detalles del cardio')
    : isCustomTypeStep
    ? t('Especifica el tipo de ejercicio')
    : t('Selecciona el tipo de cardio');

  const closeCardioModal = () => {
    setShowCardioModal(false);
    setStep('type');
    setSelectedCardioType(null);
    setCustomCardioType('');
  };

  // Cerrar la tarjeta (back de Android, gesto de cierre o toque en el velo)
  // DESCARTA, como en cualquier otro modal de la app. Antes guardaba si había
  // minutos, que es lo contrario de lo que significa tocar fuera en el resto de
  // la app; confirmar es ahora el botón "Guardar" del pie (o el ✓ del teclado).
  const handleModalDismiss = () => closeCardioModal();

  // Vuelve al primer paso para corregir la disciplina. Los datos ya tecleados
  // (minutos, velocidad, pendiente) se CONSERVAN: quien pulsa "Atrás" casi
  // siempre se equivocó de disciplina, no de números, y volver a teclearlos era
  // un castigo silencioso.
  // Con las casillas fuera del modal no hay paso de disciplina al que volver:
  // "Atrás" cierra y se elige otra casilla.
  const resetToTypeStep = () => {
    if (inlinePicker) {
      closeCardioModal();
      return;
    }
    setSelectedCardioType(null);
    setCustomCardioType('');
    setStep('type');
  };

  const handleSelectCardioType = (typeId: string) => {
    setSelectedCardioType(typeId as CardioType);
    if (typeId === 'other') {
      setStep('type'); // Mostrar campo de texto para tipo personalizado
    } else {
      setStep('details');
    }
  };

  // Casilla de disciplina (modo inlinePicker): abre el popup ya en su paso.
  const handleTilePress = (typeId: string) => {
    handleSelectCardioType(typeId);
    setShowCardioModal(true);
  };

  const optionRows: (typeof CARDIO_OPTIONS)[] = [];
  for (let i = 0; i < CARDIO_OPTIONS.length; i += 3) {
    optionRows.push(CARDIO_OPTIONS.slice(i, i + 3));
  }

  const handleCardioTypeConfirm = () => {
    if (customCardioType.trim()) {
      setStep('details');
    }
  };

  const handleSaveCardio = () => {
    if (!selectedCardioType || !cardioMinutes) return;

    let cardioText = '';
    let typeLabel =
      customCardioType ||
      CARDIO_OPTIONS.find((o) => o.id === selectedCardioType)?.label ||
      '';

    // Lo tecleado puede venir con coma decimal (teclado español); se guarda
    // siempre con punto, que es lo que parsea lib/cardio.
    cardioText = `${typeLabel}: ${canonicalDecimals(cardioMinutes)}min`;
    if (cardioSpeed) {
      cardioText += `, ${canonicalDecimals(cardioSpeed)}kmh`;
    }
    if (cardioPendiente && TREADMILL_TYPES.includes(selectedCardioType)) {
      cardioText += `, ${canonicalDecimals(cardioPendiente)}%`;
    }

    const newEntries = [...cardioEntries, cardioText];
    setCardioEntries(newEntries);
    onChangeText(newEntries.join(' | '));

    setSelectedCardioType(null);
    setCustomCardioType('');
    setCardioMinutes('');
    setCardioSpeed('');
    setCardioPendiente('');
    setStep('type');
    setShowCardioModal(false);
  };

  const handleDeleteEntry = (index: number) => {
    const newEntries = cardioEntries.filter((_, i) => i !== index);
    setCardioEntries(newEntries);
    onChangeText(newEntries.join(' | '));
  };

  return (
    <>
      {!isExpanded && !inlinePicker ? (
        <Pressable
          style={({ pressed }) => [
            styles.collapsedButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => {
            setShowCardioModal(true);
            setStep('type');
          }}
        >
          <View style={styles.buttonContent}>
            <MaterialCommunityIcons
              name="run-fast"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.collapsedButtonText}>{t('Añadir cardio')}</Text>
          </View>
        </Pressable>
      ) : isExpanded ? (
        <View style={[styles.container, { borderLeftColor: accent }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons
                name="run-fast"
                size={20}
                color={theme.colors.text}
                style={styles.icon}
              />
              <Text style={styles.title}>{t('Cardio')}</Text>
            </View>
          </View>

          {/* Cada entrada se pinta como en la vista de consulta: icono real de la
              disciplina (cuesta incluida), nombre y resultados formateados
              (mismos helpers de lib/cardio), en vez del texto crudo guardado. */}
          {cardioEntries.map((entry, index) => {
            const parsed = parseCardioEntry(entry);
            return (
              <View key={index} style={styles.cardioEntryRow}>
                <MaterialCommunityIcons
                  name={
                    disciplineIconName(
                      parsed.type,
                      hasIncline(parsed.pendiente)
                    ) as any
                  }
                  size={26}
                  color={theme.colors.white}
                />
                <View style={styles.cardioEntryInfo}>
                  <Text style={styles.cardioEntryName} numberOfLines={1}>
                    {parsed.type}
                  </Text>
                  <Text style={styles.cardioEntryResults} numberOfLines={1}>
                    {formatEntryResults(parsed)}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.clearButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => handleDeleteEntry(index)}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={16}
                    color={theme.colors.error}
                  />
                </Pressable>
              </View>
            );
          })}
          {/* Con casillas a la vista, añadir otra disciplina es pulsar otra
              casilla: el botón sobra. */}
          {!inlinePicker && (
            <Pressable
              style={({ pressed }) => [
                styles.addCardioButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => {
                setShowCardioModal(true);
                setStep('type');
              }}
            >
              <View style={styles.buttonContent}>
                <MaterialCommunityIcons
                  name="plus"
                  size={16}
                  color={theme.colors.onGold}
                />
                <Text style={styles.addCardioText}>{t('Añadir')}</Text>
              </View>
            </Pressable>
          )}
        </View>
      ) : null}

      {/* Disciplinas como casillas (mismo dibujo que el menú de Perfil): un
          toque abre el popup de detalles de esa disciplina. Con su rótulo: la
          rejilla salía a pelo y no decía qué se esperaba de ella. */}
      {inlinePicker && (
        <Text style={styles.pickerTitle}>{t('Selecciona la disciplina')}</Text>
      )}
      {inlinePicker && (
        <View style={styles.tileGrid}>
          {optionRows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.tileRow}>
              {row.map((option) => (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    styles.tile,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => handleTilePress(option.id)}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                >
                  <MaterialCommunityIcons
                    name={optionIconName(option) as any}
                    size={34}
                    color={theme.colors.text}
                  />
                  <Text style={styles.tileLabel} numberOfLines={2}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Asistente en tres pasos dentro del mismo modal: elegir disciplina,
          nombrarla si es "Otro", y sus datos. El paso de datos se confirma con
          su botón "Guardar" (o con el ✓ del teclado, que hace lo mismo); antes
          no había botón y había que adivinarlo leyendo una nota. */}
      <AppModal
        visible={showCardioModal}
        onRequestClose={handleModalDismiss}
        onOverlayPress={handleModalDismiss}
        title={modalTitle}
        icon="run-fast"
        align={isDetailsStep ? 'left' : 'center'}
        footer={
          isDetailsStep ? (
            <View style={styles.modalButtons}>
              <Button
                title={t('Atrás')}
                onPress={resetToTypeStep}
                variant="secondary"
                size="medium"
                style={styles.modalButton}
              />
              <Button
                title={t('Guardar')}
                onPress={handleSaveCardio}
                disabled={!cardioMinutes}
                variant="primary"
                size="medium"
                style={styles.modalButton}
              />
            </View>
          ) : (
            <>
              {isCustomTypeStep && (
                <Button
                  title={t('Continuar')}
                  onPress={handleCardioTypeConfirm}
                  disabled={!customCardioType}
                  size="medium"
                />
              )}
              <Button
                title={isTypeStep ? t('Cancelar') : t('Atrás')}
                onPress={isTypeStep ? closeCardioModal : resetToTypeStep}
                variant="secondary"
                size="medium"
              />
            </>
          )
        }
      >
        {/* Con casillas no hay paso de lista (y así no asoma al cerrar). */}
        {isTypeStep && !inlinePicker && (
          <ScrollView
            style={styles.optionsScroll}
            showsVerticalScrollIndicator={false}
          >
            {CARDIO_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [
                  styles.optionButton,
                  pressed && styles.optionButtonPressed,
                ]}
                onPress={() => handleSelectCardioType(option.id)}
              >
                <MaterialCommunityIcons
                  name={optionIconName(option) as any}
                  size={20}
                  color={theme.colors.white}
                />
                <Text style={styles.optionButtonText}>{option.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {isCustomTypeStep && (
          <TextInput
            style={styles.customTypeInput}
            placeholder={t('Ej: Escalador, Remo, etc.')}
            placeholderTextColor={theme.colors.textSecondary}
            value={customCardioType}
            onChangeText={setCustomCardioType}
          />
        )}

        {isDetailsStep && (
          <View style={styles.inputRowCardio}>
            <View style={styles.inputGroupCardio}>
              <Text style={styles.labelCardio}>{t('Minutos')}</Text>
              <TextInput
                style={styles.inputCardio}
                placeholder="0"
                placeholderTextColor={theme.colors.textSecondary}
                value={cardioMinutes}
                onChangeText={setCardioMinutes}
                keyboardType="decimal-pad"
                maxLength={6}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveCardio}
              />
            </View>
            <View style={styles.inputGroupCardio}>
              <Text style={styles.labelCardio}>km/h</Text>
              <TextInput
                style={styles.inputCardio}
                placeholder="0"
                placeholderTextColor={theme.colors.textSecondary}
                value={cardioSpeed}
                onChangeText={setCardioSpeed}
                keyboardType="decimal-pad"
                maxLength={5}
                returnKeyType="done"
                onSubmitEditing={handleSaveCardio}
              />
            </View>
            {TREADMILL_TYPES.includes(selectedCardioType) && (
              <View style={styles.inputGroupCardio}>
                <Text style={styles.labelCardio}>{t('Pendiente %')}</Text>
                <TextInput
                  style={styles.inputCardio}
                  placeholder="0"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={cardioPendiente}
                  onChangeText={setCardioPendiente}
                  keyboardType="decimal-pad"
                  maxLength={5}
                  returnKeyType="done"
                  onSubmitEditing={handleSaveCardio}
                />
              </View>
            )}
          </View>
        )}
      </AppModal>
    </>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      marginVertical: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderLeftWidth: 5,
      borderLeftColor: theme.colors.primaryLine,
      ...theme.shadow.soft,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.text,
      lineHeight: 22,
    },
    icon: {
      marginRight: 8,
    },
    // Fila de una disciplina ya registrada: icono + nombre/resultados + borrar.
    // Mismo lenguaje visual que las filas de la vista de consulta; separadas por
    // una línea fina para leerlas como lista bajo la cabecera.
    cardioEntryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingTop: 12,
      marginTop: 12,
      borderTopWidth: 2,
      borderTopColor: theme.colors.border,
    },
    cardioEntryInfo: {
      flex: 1,
    },
    cardioEntryName: {
      fontSize: 17,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.3,
      color: theme.colors.text,
      lineHeight: 24,
      includeFontPadding: false,
      textAlignVertical: 'center',
      transform: [{ translateY: Platform.OS === 'android' ? 2 : 4 }],
    },
    cardioEntryResults: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    clearButton: {
      padding: 8,
      backgroundColor: theme.colors.error + '30',
      borderRadius: theme.borderRadius.sm,
    },
    addCardioButton: {
      backgroundColor: theme.colors.primaryFill,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: theme.borderRadius.sm,
      alignItems: 'center',
      marginTop: 10,
    },
    // Estilo secundario/outline (no relleno dorado): "Añadir cardio" es la
    // entrada a una sección secundaria y no debe competir en peso con el CTA
    // dorado "Hecho" del pie. El dorado queda como único protagonista.
    collapsedButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      borderColor: theme.colors.primaryLine,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: theme.borderRadius.sm,
      alignItems: 'center',
      marginVertical: 12,
    },
    collapsedButtonText: {
      color: theme.colors.primary,
      fontWeight: '800',
      fontSize: 15,
    },
    addCardioText: {
      color: theme.colors.onGold,
      fontWeight: '800',
      fontSize: 15,
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    buttonPressed: {
      opacity: 0.8,
    },
    // Casillas de disciplina: copia del `menuTile` de Perfil (superficie,
    // borde, sombra suave, cuadradas). `flexBasis: 0` + `flexGrow: 1` para que
    // todas midan lo mismo tenga la etiqueta la longitud que tenga.
    // Rótulo de la rejilla de disciplinas (modo inlinePicker).
    pickerTitle: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    tileGrid: {
      gap: MENU_TILE_GAP,
      marginVertical: 12,
      marginHorizontal: MENU_TILE_INSET,
    },
    tileRow: {
      flexDirection: 'row',
      gap: MENU_TILE_GAP,
    },
    tile: {
      flexGrow: 1,
      flexBasis: 0,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: MENU_TILE_PADDING,
      ...theme.shadow.soft,
    },
    tileLabel: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 16,
      textAlign: 'center',
    },
    optionsScroll: {
      marginTop: 12,
      maxHeight: 300,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.colors.primaryMuted,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    optionButtonPressed: {
      opacity: 0.8,
    },
    optionButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.white,
    },
    customTypeInput: {
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.colors.text,
      marginBottom: 14,
    },
    inputRowCardio: {
      marginTop: 12,
      flexDirection: 'row',
      gap: 8,
    },
    // Pie del paso de datos: "Atrás" y "Guardar" a la par, como el resto de
    // modales de la app (ver AppModal / ConfirmModal).
    modalButtons: {
      flexDirection: 'row',
      gap: 10,
    },
    modalButton: {
      flex: 1,
    },
    inputGroupCardio: {
      flex: 1,
    },
    labelCardio: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    inputCardio: {
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.colors.text,
      minHeight: 40,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
