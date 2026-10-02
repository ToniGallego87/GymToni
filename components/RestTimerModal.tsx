import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { formatRestTime } from '@lib/utils';
import {
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
  stepRestDuration,
  useRestDuration,
} from '@lib/restTimerStore';
import { AppModal } from './AppModal';
import { Button } from './Button';
import { ValueStepper } from './ValueStepper';

interface RestTimerModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * El descanso por defecto entre series desde el ⋯ del registro, que es donde se
 * nota que se queda corto. Es un ajuste de la PERSONA (lib/restTimerStore), el
 * MISMO que Configuración, y se toca con el MISMO control: flechas ‹ 2:30 › a
 * saltos de 30 s entre 0:00 y 5:00, que cambian el valor al momento. Antes era
 * un campo de texto en segundos con "Guardar": otro editor con otras reglas, y
 * obligaba a convertir minutos a segundos de cabeza en mitad de una serie.
 *
 * No toca el descanso en curso (para eso están +30s y la ×): ajusta el de las
 * próximas series.
 */
export function RestTimerModal({ visible, onClose }: RestTimerModalProps) {
  const restDuration = useRestDuration();

  return (
    <AppModal
      visible={visible}
      onRequestClose={onClose}
      title={t('Temporizador de descanso')}
      icon="timer-sand"
      footer={
        <Button
          title={t('Hecho')}
          onPress={onClose}
          variant="primary"
          size="medium"
        />
      }
    >
      <ValueStepper
        label={t('Temporizador de descanso')}
        value={formatRestTime(restDuration)}
        atMin={restDuration <= MIN_REST_SECONDS}
        atMax={restDuration >= MAX_REST_SECONDS}
        onDecrement={() => stepRestDuration(-1)}
        onIncrement={() => stepRestDuration(1)}
      />
      <Text style={styles.hint}>
        {t('Entre series, en saltos de 30 s (de 0:00 a 5:00)')}
      </Text>
    </AppModal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    hint: {
      marginTop: 10,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
