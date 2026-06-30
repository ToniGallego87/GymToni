import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';

interface CardioInputFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  // Color de acento del día (push/pull/pierna). Tiñe el borde izquierdo.
  accent?: string;
}

type CardioType =
  | 'treadmill'
  | 'outdoor-run'
  | 'stationary-bike'
  | 'elliptical'
  | 'other'
  | null;

const CARDIO_OPTIONS = [
  { id: 'treadmill', label: 'Correr en cinta', icon: 'run-fast' },
  { id: 'outdoor-run', label: 'Correr en exterior', icon: 'run' },
  { id: 'stationary-bike', label: 'Bici estática', icon: 'bicycle' },
  { id: 'elliptical', label: 'Elíptica', icon: 'human-handsup' },
  { id: 'other', label: 'Otro', icon: 'dots-horizontal-circle-outline' },
];

export function CardioInputField({
  value,
  onChangeText,
  placeholder = 'Ej: Cinta: 22.5mins, 11.5kmh',
  accent = theme.colors.primary,
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

  const parseCurrentValue = () => {
    if (!value) return;
    // Intentar parsear formato: "tipo: Xmins, YkmhZ%"
    // Por ahora, vamos a dejar que el usuario lo edite manualmente
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

    cardioText = `${typeLabel}: ${cardioMinutes}min`;
    if (cardioSpeed) {
      cardioText += `, ${cardioSpeed}kmh`;
    }
    if (cardioPendiente && selectedCardioType === 'treadmill') {
      cardioText += `, ${cardioPendiente}%`;
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
              color={theme.colors.darkGray}
            />
            <Text style={styles.addCardioText}>Añadir cardio</Text>
          </View>
        </Pressable>
      ) : (
        <View style={[styles.container, { borderLeftColor: accent }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons
                name="run"
                size={20}
                color={theme.colors.text}
                style={styles.icon}
              />
              <Text style={styles.title}>Cardio</Text>
            </View>
          </View>

          {cardioEntries.map((entry, index) => (
            <View key={index} style={styles.cardioDisplayContainer}>
              <Text style={styles.cardioDisplayText}>{entry}</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.clearButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => handleDeleteEntry(index)}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={16}
                  color={theme.colors.error}
                />
              </Pressable>
            </View>
          ))}
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
                color={theme.colors.darkGray}
              />
              <Text style={styles.addCardioText}>Añadir</Text>
            </View>
          </Pressable>
        </View>
      )}

      <Modal
        visible={showCardioModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCardioModal(false);
          setStep('type');
          setSelectedCardioType(null);
          setCustomCardioType('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {step === 'type' && !selectedCardioType && (
              <>
                <Text style={styles.modalTitle}>
                  Selecciona el tipo de cardio
                </Text>
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
                        name={option.icon as any}
                        size={20}
                        color={theme.colors.primary}
                      />
                      <Text style={styles.optionButtonText}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => {
                    setShowCardioModal(false);
                    setStep('type');
                  }}
                >
                  <Text style={styles.closeButtonText}>Cancelar</Text>
                </Pressable>
              </>
            )}

            {step === 'type' && selectedCardioType === 'other' && (
              <>
                <Text style={styles.modalTitle}>
                  Especifica el tipo de ejercicio
                </Text>
                <TextInput
                  style={styles.customTypeInput}
                  placeholder="Ej: Escalador, Remo, etc."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={customCardioType}
                  onChangeText={setCustomCardioType}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.confirmButton,
                    !customCardioType && styles.disabledButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleCardioTypeConfirm}
                  disabled={!customCardioType}
                >
                  <Text style={styles.confirmButtonText}>Continuar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => {
                    setSelectedCardioType(null);
                    setCustomCardioType('');
                  }}
                >
                  <Text style={styles.closeButtonText}>Atrás</Text>
                </Pressable>
              </>
            )}

            {step === 'details' && (
              <>
                <Text style={styles.modalTitle}>Detalles del cardio</Text>
                <View style={styles.detailsContainer}>
                  <View style={styles.inputRowCardio}>
                    <View style={styles.inputGroupCardio}>
                      <Text style={styles.labelCardio}>Minutos</Text>
                      <TextInput
                        style={styles.inputCardio}
                        placeholder="0"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={cardioMinutes}
                        onChangeText={setCardioMinutes}
                        keyboardType="decimal-pad"
                        maxLength={6}
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
                      />
                    </View>
                    {selectedCardioType === 'treadmill' && (
                      <View style={styles.inputGroupCardio}>
                        <Text style={styles.labelCardio}>Pendiente %</Text>
                        <TextInput
                          style={styles.inputCardio}
                          placeholder="0"
                          placeholderTextColor={theme.colors.textSecondary}
                          value={cardioPendiente}
                          onChangeText={setCardioPendiente}
                          keyboardType="decimal-pad"
                          maxLength={5}
                        />
                      </View>
                    )}
                  </View>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.saveButton,
                    !cardioMinutes && styles.disabledButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleSaveCardio}
                  disabled={!cardioMinutes}
                >
                  <Text style={styles.saveButtonText}>Guardar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => {
                    setSelectedCardioType(null);
                    setCustomCardioType('');
                    setCardioMinutes('');
                    setCardioSpeed('');
                    setCardioPendiente('');
                    setStep('type');
                  }}
                >
                  <Text style={styles.closeButtonText}>Atrás</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginVertical: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
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
  toggleButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  toggleButtonPressed: {
    opacity: 0.6,
  },
  toggleText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  icon: {
    marginRight: 8,
  },
  cardioDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.darkGray,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginTop: 10,
    gap: 8,
  },
  cardioDisplayText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  clearButton: {
    padding: 8,
    backgroundColor: theme.colors.error + '30',
    borderRadius: theme.borderRadius.sm,
  },
  addCardioButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginTop: 10,
  },
  collapsedButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginVertical: 12,
  },
  addCardioText: {
    color: theme.colors.darkGray,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  optionsScroll: {
    maxHeight: 300,
    marginBottom: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
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
    color: theme.colors.primary,
  },
  customTypeInput: {
    backgroundColor: theme.colors.darkGray,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 14,
  },
  detailsContainer: {
    marginBottom: 14,
  },
  inputRowCardio: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
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
    backgroundColor: theme.colors.darkGray,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.text,
    minHeight: 40,
  },
  saveButton: {
    backgroundColor: theme.colors.success,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.background,
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.background,
  },
  closeButton: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
