import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  ATTRIBUTION,
  getCatalogExercise,
  gifUrl,
  exerciseName,
  targetLabel,
  equipmentLabel,
} from '@data/exerciseCatalog';
import { AppModal } from './AppModal';
import { Button } from './Button';

interface GifViewerModalProps {
  visible: boolean;
  onRequestClose: () => void;
  /** Id del catálogo del ejercicio a mostrar. */
  catalogId?: string;
  /** Nombre a mostrar si el ejercicio no está en el catálogo. */
  fallbackName?: string;
  /**
   * Si se indica, muestra un botón **Asignar** que fija este GIF al ejercicio de
   * la rutina (guarda su `catalogId`). Se usa al consultar un ejercicio tecleado
   * a mano para dejarle el play directo la próxima vez.
   */
  onAssign?: (catalogId: string) => void;
}

/**
 * Visor del GIF de referencia de un ejercicio del catálogo. El GIF NO va
 * empaquetado: se descarga bajo demanda del CDN (jsDelivr). La media es
 * © Gym Visual, por eso se muestra la atribución. Si el ejercicio no tiene
 * catálogo asociado, avisa de que no hay GIF.
 */
export function GifViewerModal({
  visible,
  onRequestClose,
  catalogId,
  fallbackName,
  onAssign,
}: GifViewerModalProps) {
  const exercise = getCatalogExercise(catalogId);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Contador de intentos: cambia la `key` de la Image para volver a pedir el
  // GIF al pulsar "Reintentar" (sin remontar, RN no repite una carga fallida).
  const [attempt, setAttempt] = useState(0);

  // El visor queda montado (se abre y cierra con `visible`) y el selector del
  // catálogo lo reutiliza cambiando `catalogId`: sin esto, un fallo de red se
  // quedaba pegado y el error salía en cada apertura y en cualquier otro
  // ejercicio que se previsualizara después.
  useEffect(() => {
    if (!visible) return;
    setFailed(false);
    setLoading(true);
  }, [visible, catalogId]);

  const retry = () => {
    setFailed(false);
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  const title = exercise
    ? exerciseName(exercise)
    : fallbackName ?? t('Ejercicio');

  return (
    <AppModal
      visible={visible}
      onRequestClose={onRequestClose}
      title={title}
      icon="play-box-outline"
      footer={
        onAssign && exercise ? (
          <View style={styles.footerRow}>
            <Button
              title={t('Cerrar')}
              onPress={onRequestClose}
              variant="secondary"
              size="medium"
              style={styles.footerButton}
            />
            <Button
              title={t('Asignar')}
              onPress={() => {
                onAssign(exercise.id);
                onRequestClose();
              }}
              variant="primary"
              size="medium"
              style={styles.footerButton}
            />
          </View>
        ) : (
          <Button
            title={t('Cerrar')}
            onPress={onRequestClose}
            variant="secondary"
            size="medium"
          />
        )
      }
    >
      {exercise ? (
        <>
          <View style={styles.stage}>
            {loading && !failed && (
              <ActivityIndicator
                style={styles.spinner}
                color={theme.colors.primary}
              />
            )}
            {failed ? (
              // Error con salida: el aviso dice qué pasó y el botón lo repite
              // sin cerrar el visor.
              <View style={styles.errorBox}>
                <MaterialCommunityIcons
                  name="cloud-off-outline"
                  size={28}
                  color={theme.colors.textSecondary}
                />
                <Text style={[styles.errorText, styles.errorTextInBox]}>
                  {t('No se pudo cargar el GIF (¿sin conexión?)')}
                </Text>
                <Button
                  title={t('Reintentar')}
                  onPress={retry}
                  variant="secondary"
                  size="small"
                />
              </View>
            ) : (
              <Image
                key={attempt}
                source={{ uri: gifUrl(exercise) }}
                style={styles.gif}
                resizeMode="contain"
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
              />
            )}
          </View>
          <Text style={styles.meta}>
            {targetLabel(exercise.target)} ·{' '}
            {equipmentLabel(exercise.equipment)}
          </Text>
          <Text style={styles.attribution}>{ATTRIBUTION}</Text>
        </>
      ) : (
        <Text style={styles.errorText}>
          {t('Este ejercicio no tiene GIF de referencia.')}
        </Text>
      )}
    </AppModal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    footerRow: {
      flexDirection: 'row',
      gap: 10,
    },
    footerButton: {
      flex: 1,
    },
    stage: {
      marginTop: 12,
      aspectRatio: 1,
      width: '100%',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    gif: {
      width: '100%',
      height: '100%',
    },
    spinner: {
      position: 'absolute',
    },
    meta: {
      marginTop: 12,
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    attribution: {
      marginTop: 6,
      fontSize: 11,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      opacity: 0.8,
    },
    // Error dentro del recuadro del GIF: icono, texto y botón apilados.
    errorBox: {
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
    },
    errorTextInBox: {
      marginTop: 0,
    },
    errorText: {
      marginTop: 16,
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
