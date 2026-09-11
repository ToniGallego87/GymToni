import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { formatRestTime } from '@lib/utils';
import { AppModal } from './AppModal';
import { Button } from './Button';

interface RestTimerModalProps {
  visible: boolean;
  /**
   * Segundos tecleados, en crudo: el campo puede quedarse vacío o a medias
   * mientras se escribe, así que el valor es texto y no número.
   */
  value: string;
  onChangeValue: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * "Editar Temporizador": el descanso por defecto de la rutina. Es el MISMO
 * ajuste de la MISMA rutina se abra desde su ficha o desde la pantalla de
 * registro, así que vive en un solo sitio (misma especialización de `AppModal`
 * que `ConfirmModal`).
 *
 * Antes eran dos copias con dos aspectos: el campo a 16 px en una y a 18 en
 * negrita en la otra, el "Equivalente" centrado aquí y en cursiva allá.
 */
export function RestTimerModal({
  visible,
  value,
  onChangeValue,
  onSave,
  onCancel,
}: RestTimerModalProps) {
  return (
    <AppModal
      visible={visible}
      onRequestClose={onCancel}
      title={t('Editar Temporizador')}
      icon="timer-sand"
      align="left"
      footer={
        <View style={styles.buttonRow}>
          <Button
            title={t('Cancelar')}
            onPress={onCancel}
            variant="secondary"
            size="medium"
            style={styles.button}
          />
          <Button
            title={t('Guardar')}
            onPress={onSave}
            variant="primary"
            size="medium"
            style={styles.button}
          />
        </View>
      }
    >
      <Text style={styles.label}>{t('Duración en segundos:')}</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        placeholder="150"
        placeholderTextColor={theme.colors.textSecondary}
        value={value}
        onChangeText={onChangeValue}
      />
      {/* Lo que significan esos segundos, en el mismo margen que el campo: el
          modal va alineado a la izquierda y una línea centrada bajo un campo
          de ancho completo se leía como otra cosa. */}
      <Text style={styles.equivalent}>
        {t('Equivalente:')} {formatRestTime(parseInt(value, 10) || 0)}
      </Text>
    </AppModal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    label: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    // Campo numérico grande: se abre para teclear un número corto y volver.
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      backgroundColor: theme.colors.inputBg,
    },
    equivalent: {
      marginTop: 10,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
    },
    button: {
      flex: 1,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
