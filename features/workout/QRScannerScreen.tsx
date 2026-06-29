import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseRoutineShareLink, SharedRoutine } from '@lib/routineShare';
import { theme } from '@lib/theme';

interface QRScannerScreenProps {
  onScanSuccess: (shared: SharedRoutine) => void;
  onBack: () => void;
}

export function QRScannerScreen({
  onScanSuccess,
  onBack,
}: QRScannerScreenProps) {
  const insets = useSafeAreaInsets();
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleImport = () => {
    const trimmed = link.trim();
    if (!trimmed) {
      setError('Pega el enlace del QR aquí.');
      return;
    }
    const shared = parseRoutineShareLink(trimmed);
    if (shared) {
      onScanSuccess(shared);
    } else {
      setError(
        'Enlace no válido. Usa el enlace copiado desde "Compartir por QR".'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onBack}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Importar rutina por QR</Text>
        </View>

        {/* Instrucciones cámara */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionIcon}>📷</Text>
          <Text style={styles.instructionTitle}>
            Escanea con la cámara del móvil
          </Text>
          <Text style={styles.instructionText}>
            Abre la cámara de tu móvil, apunta al código QR de la rutina y
            GymToni se abrirá automáticamente con la rutina importada.
          </Text>
        </View>

        {/* Separador */}
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>o pega el enlace</Text>
          <View style={styles.separatorLine} />
        </View>

        {/* Pegar enlace */}
        <View style={styles.pasteSection}>
          <Text style={styles.pasteLabel}>Enlace del QR</Text>
          <TextInput
            style={styles.input}
            value={link}
            onChangeText={(t) => {
              setLink(t);
              setError(null);
            }}
            placeholder="gymtrack://import-routine?data=..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={3}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
          <TouchableOpacity
            style={[styles.importBtn, !link.trim() && styles.importBtnDisabled]}
            onPress={handleImport}
            activeOpacity={0.8}
          >
            <Text style={styles.importBtnText}>Importar rutina</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  instructionCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  instructionIcon: {
    fontSize: 48,
  },
  instructionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  instructionText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  separatorText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  pasteSection: {
    gap: 12,
  },
  pasteLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    color: '#fff',
    fontSize: 13,
    fontFamily: 'monospace',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '600',
  },
  importBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  importBtnDisabled: {
    opacity: 0.45,
  },
  importBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
