import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { AppModal } from './AppModal';
import { Button } from './Button';

interface ReportModalProps {
  visible: boolean;
  /** Qué se está reportando ("esta rutina", "este comentario", "este perfil"). */
  what: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * Reportar contenido público de otra persona. Especialización de `AppModal`,
 * como `ConfirmModal`, para que reportar se vea igual desde donde se haga
 * (rutina, perfil o comentario).
 *
 * El motivo es OPCIONAL: obligar a escribirlo hace que mucha gente no reporte, y
 * el parte ya dice qué se reportó y quién. Se avisa de que además desaparece de
 * su vista, que es lo que el usuario espera al pulsar.
 */
export function ReportModal({
  visible,
  what,
  busy = false,
  onCancel,
  onConfirm,
}: ReportModalProps) {
  const [reason, setReason] = useState('');

  const close = () => {
    setReason('');
    onCancel();
  };

  return (
    <AppModal
      visible={visible}
      onRequestClose={close}
      title={t('¿Reportar {what}?', { what })}
      icon="flag-outline"
      align="left"
      message={t(
        'Lo revisaremos. Además dejará de aparecerte en este dispositivo.'
      )}
      footer={
        <View style={styles.footer}>
          <Button
            title={t('Cancelar')}
            onPress={close}
            variant="secondary"
            size="medium"
            style={styles.button}
          />
          <Button
            title={busy ? t('Enviando…') : t('Reportar')}
            onPress={() => {
              const value = reason;
              setReason('');
              onConfirm(value);
            }}
            variant="danger"
            size="medium"
            disabled={busy}
            style={styles.button}
          />
        </View>
      }
    >
      <Text style={styles.label}>{t('Motivo (opcional)')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('Qué problema tiene')}
        placeholderTextColor={theme.colors.textMuted}
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={300}
      />
    </AppModal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    footer: { flexDirection: 'row', gap: 10 },
    button: { flex: 1 },
    label: {
      marginTop: 12,
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    input: {
      minHeight: 72,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.colors.text,
      backgroundColor: theme.colors.inputBg,
      textAlignVertical: 'top',
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
