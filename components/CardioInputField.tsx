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

interface CardioInputFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  // Color de acento del día (push/pull/pierna). Tiñe el borde izquierdo.
  accent?: string;
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

  // Cerrar la tarjeta (back de Android / gesto de cierre): si en el paso de
  // datos hay minutos válidos, se confirma el cardio en vez de perderlo; si no,
  // se descarta. Junto al "hecho" del teclado, quita el botón Guardar.
  const handleModalDismiss = () => {
    if (isDetailsStep && cardioMinutes) {
      handleSaveCardio();
    } else {
      closeCardioModal();
    }
  };

  // Vuelve al primer paso descartando lo tecleado (botón "Atrás").
  const resetToTypeStep = () => {
    setSelectedCardioType(null);
    setCustomCardioType('');
    setCardioMinutes('');
    setCardioSpeed('');
    setCardioPendiente('');
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
      {!isExpanded ? (
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
            <Text style={styles.collapsedButtonText}>
              {t('Añadir cardio')}
            </Text>
          </View>
        </Pressable>
      ) : (
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
        </View>
      )}

      {/* Asistente en tres pasos dentro del mismo modal: elegir disciplina,
          nombrarla si es "Otro", y sus datos. En el paso de datos no hay botón
          Guardar: el cardio se confirma solo al pulsar "hecho" en el teclado o
          al cerrar la tarjeta (handleModalDismiss). */}
      <AppModal
        visible={showCardioModal}
        onRequestClose={handleModalDismiss}
        onOverlayPress={isDetailsStep ? handleModalDismiss : undefined}
        title={modalTitle}
        icon="run-fast"
        align={isDetailsStep ? 'left' : 'center'}
        footer={
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
        }
      >
        {isTypeStep && (
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

        {isDetailsStep && (
          <Text style={styles.saveHint}>
            {t('Se guarda solo: pulsa ✓ en el teclado o toca fuera.')}
          </Text>
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
      borderLeftWidth: 3,
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
      borderTopWidth: 1,
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
    saveHint: {
      marginTop: 14,
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
      lineHeight: 17,
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
