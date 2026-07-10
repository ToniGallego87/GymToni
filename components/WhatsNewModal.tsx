import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import type { ChangelogEntry } from '@data/changelog';

interface WhatsNewModalProps {
  visible: boolean;
  entry: ChangelogEntry | null;
  onClose: () => void;
}

export function WhatsNewModal({ visible, entry, onClose }: WhatsNewModalProps) {
  if (!entry) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons
              name="party-popper"
              size={28}
              color={theme.colors.primary}
            />
          </View>
          <Text style={styles.title}>
            Novedades de la versión {entry.version}
          </Text>
          <View style={styles.list}>
            {entry.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Entendido</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  content: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 18,
  },
  list: {
    width: '100%',
    marginBottom: 22,
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
  closeButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonPressed: {
    opacity: 0.85,
  },
  closeButtonText: {
    color: theme.colors.darkGray,
    fontSize: 15,
    fontWeight: '800',
  },
});
