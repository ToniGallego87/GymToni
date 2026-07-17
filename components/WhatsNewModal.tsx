import React from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import type { ChangelogEntry } from '@data/changelog';
import { AppModal } from './AppModal';
import { Button } from './Button';

interface WhatsNewModalProps {
  visible: boolean;
  entry: ChangelogEntry | null;
  onClose: () => void;
}

export function WhatsNewModal({ visible, entry, onClose }: WhatsNewModalProps) {
  if (!entry) return null;

  return (
    <AppModal
      visible={visible}
      onRequestClose={onClose}
      title={`${t('Novedades de la versión')} ${entry.version}`}
      icon="party-popper"
      footer={<Button title={t('Entendido')} onPress={onClose} size="medium" />}
    >
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {entry.items.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </ScrollView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 12,
    // La lista de novedades crece con cada versión: scrollea dentro de la
    // tarjeta en vez de desbordar la pantalla.
    maxHeight: Dimensions.get('window').height * 0.45,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  bullet: {
    color: theme.colors.primary,
    fontSize: 15,
    lineHeight: 21,
    marginRight: 8,
  },
  itemText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
});
