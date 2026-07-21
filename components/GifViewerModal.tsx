import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
}: GifViewerModalProps) {
  const exercise = getCatalogExercise(catalogId);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const title = exercise ? exerciseName(exercise) : fallbackName ?? t('Ejercicio');

  return (
    <AppModal
      visible={visible}
      onRequestClose={onRequestClose}
      title={title}
      icon="play-box-outline"
      footer={
        <Button
          title={t('Cerrar')}
          onPress={onRequestClose}
          variant="secondary"
          size="medium"
        />
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
              <Text style={styles.errorText}>
                {t('No se pudo cargar el GIF (¿sin conexión?)')}
              </Text>
            ) : (
              <Image
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
            {targetLabel(exercise.target)} · {equipmentLabel(exercise.equipment)}
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

const makeStyles = () => StyleSheet.create({
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
