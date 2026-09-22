import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { Award } from '@lib/awards';
import { AppModal } from './AppModal';
import { Button } from './Button';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface AwardModalProps {
  award: Award | null;
  onClose: () => void;
}

/**
 * Popup de premio: "¡Reto superado!", "¡Nuevo logro!" o "¡Nivel N!". Icono
 * grande en dorado (el mismo dibujo que el detalle de una insignia en
 * Logros), nombre, condición y los puntos que suma. Lo abre `App.tsx` con el
 * primero de la cola de `lib/awards`; al cerrarlo sale el siguiente.
 */
export function AwardModal({ award, onClose }: AwardModalProps) {
  if (!award) return null;

  const title =
    award.kind === 'challenge'
      ? t('¡Reto superado!')
      : award.kind === 'badge'
      ? t('¡Nuevo logro!')
      : t('¡Has subido de nivel!');
  const icon: IconName =
    award.kind === 'level' ? 'star-four-points' : (award.icon as IconName);
  const name =
    award.kind === 'level' ? t('Nivel {n}', { n: award.level }) : award.name;

  return (
    <AppModal
      visible
      onRequestClose={onClose}
      onOverlayPress={onClose}
      title={title}
      icon={award.kind === 'level' ? 'arrow-up-bold-circle' : 'trophy'}
      footer={<Button title={t('¡Genial!')} onPress={onClose} />}
    >
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons
            name={icon}
            size={44}
            color={theme.colors.primary}
          />
        </View>
        <Text style={styles.name}>{name}</Text>
        {award.kind !== 'level' && (
          <Text style={styles.description}>{award.description}</Text>
        )}
        <Text style={styles.xp}>
          {award.kind === 'level'
            ? t('Cada reto y logro te acerca al siguiente')
            : t('+{n} puntos', { n: award.xp })}
        </Text>
      </View>
    </AppModal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    body: { alignItems: 'center', gap: 6 },
    iconWrap: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryMuted,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
      marginBottom: 6,
    },
    name: {
      fontSize: 22,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.text,
      lineHeight: 30,
      textAlign: 'center',
    },
    description: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 19,
      textAlign: 'center',
    },
    xp: {
      marginTop: 6,
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.primary,
      textAlign: 'center',
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
