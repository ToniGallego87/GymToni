import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  GradientFill,
  StretchScrollView,
  useGlassTopBarHeight,
} from '@components';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { language } from '@lib/i18n';
import { getLegalDoc, LegalDocId } from '@data/legal';

interface LegalScreenProps {
  doc: LegalDocId;
  onBack: () => void;
}

/**
 * Política de privacidad o Términos de uso, dentro de la app: se leen sin red
 * y sin depender de que haya una web publicada. Arriba el resumen en una
 * tarjeta (lo que casi todo el mundo lee); debajo, el texto completo.
 *
 * Se abre en un modal a pantalla completa (`LegalModal`) y no como pantalla
 * de la navegación: desde el alta de la cuenta, salir a leerlos y volver
 * vaciaba el email y la contraseña ya escritos.
 */
export function LegalScreen({ doc, onBack }: LegalScreenProps) {
  const insets = useSafeAreaInsets();
  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { bottom: floatingBackBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);
  const content = getLegalDoc(doc, language);

  return (
    <View style={styles.container}>
      <StatusBar
        style={theme.statusBarStyle}
        translucent
        backgroundColor="transparent"
      />

      <StretchScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <GradientFill accent={theme.colors.primaryLine} />
          <Text style={styles.summary}>{content.summary}</Text>
        </View>

        {content.sections.map((section) => (
          <View key={section.h} style={styles.section}>
            <Text style={styles.heading}>{section.h}</Text>
            {section.p?.map((paragraph, i) => (
              <Text key={`p${i}`} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
            {section.li?.map((item, i) => (
              <View key={`li${i}`} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={[styles.paragraph, styles.bulletText]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </StretchScrollView>

      <GlassTopBar
        title={content.title}
        subtitle={content.updated}
        icon={
          doc === 'privacy' ? 'shield-account-outline' : 'file-document-outline'
        }
        topInset={insets.top}
        onLayout={onTopBarLayout}
      />

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />
    </View>
  );
}

/** `LegalScreen` encima de lo que haya, sin desmontarlo. `null` = cerrado. */
export function LegalModal({
  doc,
  onClose,
}: {
  doc: LegalDocId | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={doc !== null}
      animationType="slide"
      onRequestClose={onClose}
    >
      {doc && <LegalScreen doc={doc} onBack={onClose} />}
    </Modal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: theme.spacing.md,
      gap: 18,
    },
    summaryCard: {
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    summary: {
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 22,
      color: theme.colors.text,
    },
    section: {
      gap: 8,
    },
    heading: {
      fontSize: 17,
      fontWeight: '800',
      lineHeight: 22,
      color: theme.colors.text,
    },
    paragraph: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.textSecondary,
    },
    bulletRow: {
      flexDirection: 'row',
      gap: 8,
      paddingLeft: 4,
    },
    bullet: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.textSecondary,
    },
    bulletText: {
      flex: 1,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
