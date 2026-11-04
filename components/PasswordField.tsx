import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { t } from '@lib/i18n';
import { theme } from '@lib/theme';

interface PasswordFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  /** Contraseña que se está creando (autorrelleno de contraseña nueva). */
  isNew?: boolean;
}

/**
 * Campo de contraseña con ojo para verla. Las que se escriben una sola vez
 * (nueva, sin campo de repetir) se comprueban así antes de fijar una con una
 * errata; lo usan recuperar, cambiar y confirmar el borrado de la cuenta.
 */
export function PasswordField({
  value,
  onChangeText,
  placeholder,
  isNew = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType={isNew ? 'newPassword' : 'password'}
        autoComplete={isNew ? 'new-password' : 'current-password'}
      />
      <Pressable
        style={styles.toggle}
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          visible ? t('Ocultar contraseña') : t('Mostrar contraseña')
        }
      >
        <MaterialCommunityIcons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={22}
          color={theme.colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    row: { justifyContent: 'center' },
    input: {
      backgroundColor: theme.colors.backgroundElevated,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      paddingRight: 48,
      paddingVertical: 12,
      color: theme.colors.text,
      fontSize: 16,
    },
    toggle: {
      position: 'absolute',
      right: 0,
      width: 48,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
