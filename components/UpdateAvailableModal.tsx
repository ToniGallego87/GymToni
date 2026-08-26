import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { AppModal } from './AppModal';
import { Button } from './Button';

interface UpdateAvailableModalProps {
  visible: boolean;
  /** Versión instalada (app.json → expo.version). */
  currentVersion: string;
  /** Versión publicada en la tienda (tabla `app_releases`). */
  latestVersion: string;
  /** Abre la ficha de Google Play. */
  onUpdate: () => void;
  /** Cierra el aviso: no se repite hasta que se publique otra versión. */
  onDismiss: () => void;
}

/**
 * Aviso de "hay versión nueva" al arrancar. La app se distribuye por Google
 * Play sin expo-updates, así que la única vía es mandar al usuario a la ficha
 * de la tienda; el popup solo informa y enlaza.
 *
 * Nunca bloquea: "Ahora no" cierra y la app sigue igual (la versión instalada
 * funciona), y el aviso no vuelve hasta la siguiente versión publicada.
 */
export function UpdateAvailableModal({
  visible,
  currentVersion,
  latestVersion,
  onUpdate,
  onDismiss,
}: UpdateAvailableModalProps) {
  return (
    <AppModal
      visible={visible}
      onRequestClose={onDismiss}
      title={t('Hay una versión nueva')}
      icon="cloud-download-outline"
      message={t(
        'Ya está disponible en Google Play. Actualiza para tenerlo todo al día.'
      )}
      footer={
        <>
          <Button title={t('Actualizar')} onPress={onUpdate} size="medium" />
          <Button
            title={t('Ahora no')}
            onPress={onDismiss}
            variant="secondary"
            size="medium"
          />
        </>
      }
    >
      {/* Las dos versiones enfrentadas: deja claro de qué salto se habla sin
          tener que ir a buscar la versión instalada al pie de Perfil. */}
      <View style={styles.versionRow}>
        <Text style={styles.versionLabel}>{t('Tienes')}</Text>
        <Text style={styles.versionValue}>{currentVersion}</Text>
      </View>
      <View style={styles.versionRow}>
        <Text style={styles.versionLabel}>{t('Disponible')}</Text>
        <Text style={[styles.versionValue, styles.versionValueNew]}>
          {latestVersion}
        </Text>
      </View>
    </AppModal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    versionRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    versionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    versionValue: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.text,
    },
    versionValueNew: {
      color: theme.colors.primary,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
