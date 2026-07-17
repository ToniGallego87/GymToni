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
import { t } from '@lib/i18n';

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
      setError(t('Pega el enlace del QR aquí.'));
      return;
    }
    const shared = parseRoutineShareLink(trimmed);
    if (shared) {
      onScanSuccess(shared);
    } else {
      setError(
        t('Enlace no válido. Usa el enlace copiado desde "Compartir por QR".')
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style={theme.statusBarStyle} />
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
          <Text style={styles.headerTitle}>{t('Importar rutina por QR')}</Text>
        </View>

        {/* Instrucciones cámara */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionIcon}>📷</Text>
          <Text style={styles.instructionTitle}>
            {t('Escanea con la cámara del móvil')}
          </Text>
          <Text style={styles.instructionText}>
            {t(
              'Abre la cámara de tu móvil, apunta al código QR de la rutina y GymBro se abrirá automáticamente con la rutina importada.'
            )}
          </Text>
        </View>

        {/* Separador */}
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>{t('o pega el enlace')}</Text>
          <View style={styles.separatorLine} />
        </View>

        {/* Pegar enlace */}
        <View style={styles.pasteSection}>
          <Text style={styles.pasteLabel}>{t('Enlace del QR')}</Text>
          <TextInput
            style={styles.input}
            value={link}
            onChangeText={(value) => {
              setLink(value);
              setError(null);
            }}
            placeholder="gymbro://import-routine?data=..."
            placeholderTextColor={theme.colors.textMuted}
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
            <Text style={styles.importBtnText}>{t('Importar rutina')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  instructionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  instructionIcon: {
    fontSize: 48,
  },
  instructionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  instructionText: {
    color: theme.colors.textSecondary,
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
    backgroundColor: theme.colors.surfaceAlt,
  },
  separatorText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  pasteSection: {
    gap: 12,
  },
  pasteLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: 13,
    fontFamily: 'monospace',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
    fontWeight: '600',
  },
  importBtn: {
    backgroundColor: theme.colors.primaryFill,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  importBtnDisabled: {
    opacity: 0.45,
  },
  importBtnText: {
    color: theme.colors.onGold,
    fontSize: 16,
    fontWeight: '700',
  },
});
