import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  AppModal,
  Button,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  HeroWeightCard,
  StretchScrollView,
  TrendDelta,
} from '@components';
import {
  currentBodyWeight,
  daysSinceWeightUpdate,
  loadBodyWeight,
  saveBodyWeight,
  STALE_WEIGHT_DAYS,
  useBodyWeight,
} from '@lib/bodyWeight';
import { theme } from '@lib/theme';
import {
  t,
  dateLocale,
  fmtNum,
  localizeDecimals,
  parseTypedNumber,
} from '@lib/i18n';

interface BodyWeightScreenProps {
  onBack: () => void;
}

/**
 * Peso corporal: anotarlo y ver cómo ha ido.
 *
 * Vive en Perfil, con el resto de datos personales, y no en el carrusel de
 * Cardio: se toca una vez cada varias semanas y allí ocupaba media hero —el
 * sitio de la acción que sí se usa a diario, apuntar cardio—. A cambio el
 * histórico deja de ser una línea de ocho puntos en una miniatura y se ve
 * entero.
 *
 * El peso se guarda por TRAMOS (ver lib/bodyWeight): cada cardio ya registrado
 * conserva las kcal calculadas con el peso que tenías entonces.
 */
export function BodyWeightScreen({ onBack }: BodyWeightScreenProps) {
  const insets = useSafeAreaInsets();
  const segments = useBodyWeight();
  const [showEditor, setShowEditor] = useState(false);
  const [weightInput, setWeightInput] = useState('');

  useEffect(() => {
    void loadBodyWeight();
  }, []);

  const current = currentBodyWeight(segments);
  const daysSince = daysSinceWeightUpdate(segments);
  const isStale = daysSince != null && daysSince >= STALE_WEIGHT_DAYS;

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { bottom: backBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

  const openEditor = () => {
    // Se teclea con el separador del idioma; parseTypedNumber lo lee igual.
    setWeightInput(current != null ? localizeDecimals(String(current)) : '');
    setShowEditor(true);
  };

  const handleSave = async () => {
    const value = parseTypedNumber(weightInput);
    if (!Number.isFinite(value) || value <= 0) return;
    setShowEditor(false);
    await saveBodyWeight(value);
  };

  // Del más reciente al más antiguo, con el cambio respecto al anterior: es el
  // orden en el que se lee un histórico ("¿cómo voy?", no "¿cómo empecé?").
  const rows = [...segments]
    .map((segment, index) => ({
      segment,
      delta: index > 0 ? segment.weight - segments[index - 1].weight : null,
    }))
    .reverse();

  const longDate = (ts: number) =>
    new Date(ts).toLocaleDateString(dateLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

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
          { paddingTop: topBarHeight + 28, paddingBottom: scrollBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* La misma tarjeta que ocupaba media hero de Cardio: aquí es la
            cabecera de su propia pantalla. Trae el peso vigente, el cambio
            respecto al anterior, la evolución y —en palabras, no en un gesto
            adivinado— que pulsándola se actualiza. */}
        <HeroWeightCard
          weight={current}
          history={segments.map((segment) => segment.weight)}
          onPress={openEditor}
        />

        {/* Cuándo se anotó por última vez. En ámbar a partir de dos semanas: es
            cuando las kcal del cardio empiezan a calcularse con un peso que ya
            no es el tuyo. */}
        <View style={styles.metaRow}>
          <MaterialCommunityIcons
            name={isStale ? 'alert-circle-outline' : 'clock-outline'}
            size={16}
            color={isStale ? theme.colors.warning : theme.colors.textSecondary}
          />
          <Text style={[styles.metaText, isStale && styles.metaTextStale]}>
            {daysSince == null
              ? t('Aún no has anotado tu peso')
              : daysSince === 0
              ? t('Actualizado hoy')
              : daysSince === 1
              ? t('Actualizado ayer')
              : t('Actualizado hace {n} días', { n: daysSince })}
          </Text>
        </View>

        {/* Para qué sirve el dato. No es curiosidad: es lo que hace que las kcal
            del cardio signifiquen algo. */}
        <View style={styles.noteCard}>
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.noteText}>
            {t(
              'Con tu peso se estiman las kcal del cardio. Los cardios ya registrados conservan el peso que tenías entonces.'
            )}
          </Text>
        </View>

        {rows.length > 0 && (
          <View style={styles.historyCard}>
            <GradientFill accent={theme.colors.accentLine} />
            <View style={styles.historyTitleRow}>
              <MaterialCommunityIcons
                name="history"
                size={18}
                color={theme.colors.text}
                style={styles.historyTitleIcon}
              />
              <Text style={styles.historyTitle}>{t('Histórico')}</Text>
            </View>

            {rows.map(({ segment, delta }) => (
              <View key={segment.setAt} style={styles.historyRow}>
                <View style={styles.historyTextWrap}>
                  <Text style={styles.historyWeight}>
                    {fmtNum(segment.weight)} kg
                  </Text>
                  <Text style={styles.historyDate}>
                    {longDate(segment.setAt)}
                  </Text>
                </View>
                {/* Subir de peso no es "mejorar" ni bajar "empeorar": es un dato
                    que cada uno lee según lo que busque, así que el color va
                    apagado y solo se marca el sentido del cambio. */}
                {delta != null && delta !== 0 && (
                  <TrendDelta
                    value={delta}
                    suffix=" kg"
                    color={theme.colors.textSecondary}
                  />
                )}
              </View>
            ))}
          </View>
        )}
      </StretchScrollView>

      <GlassTopBar
        title={t('Peso corporal')}
        icon="scale-bathroom"
        subtitle={t('Tu peso y cómo ha ido cambiando')}
        topInset={insets.top}
      />

      <FloatingBackButton onPress={onBack} bottom={backBottom} />

      <AppModal
        visible={showEditor}
        onRequestClose={() => setShowEditor(false)}
        title={t('Tu peso')}
        icon="scale-bathroom"
        message={t(
          'Se usa para estimar las kcalorías del cardio. Se aplica a los próximos; los cardios ya registrados mantienen el peso que tenías entonces.'
        )}
        footer={
          <View style={styles.modalButtonRow}>
            <Button
              title={t('Cancelar')}
              onPress={() => setShowEditor(false)}
              variant="secondary"
              size="medium"
              style={styles.modalButton}
            />
            <Button
              title={t('Guardar')}
              onPress={handleSave}
              variant="primary"
              size="medium"
              style={styles.modalButton}
            />
          </View>
        }
      >
        <View style={styles.weightInputRow}>
          <TextInput
            style={styles.weightInput}
            value={weightInput}
            onChangeText={setWeightInput}
            keyboardType="decimal-pad"
            placeholder="70"
            placeholderTextColor={theme.colors.textSecondary}
            maxLength={5}
            autoFocus
          />
          <Text style={styles.weightUnit}>kg</Text>
        </View>
      </AppModal>
    </View>
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
      gap: 12,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    metaText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 17,
    },
    // Dos semanas o más sin tocarlo: el mismo ámbar de "atención" que el resto
    // de la app, porque a partir de ahí las kcal del cardio empiezan a mentir.
    metaTextStale: {
      color: theme.colors.warning,
      fontWeight: '700',
    },
    noteCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingHorizontal: theme.spacing.sm,
    },
    noteText: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    historyCard: {
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    historyTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    // Centra el icono (18) en la línea del título Anton (lineHeight 30).
    historyTitleIcon: {
      marginTop: 4,
    },
    historyTitle: {
      fontSize: 21,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.4,
      color: theme.colors.text,
      lineHeight: 30,
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    historyTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    historyWeight: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 22,
      fontVariant: ['tabular-nums'],
    },
    historyDate: {
      marginTop: 1,
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },
    modalButtonRow: {
      flexDirection: 'row',
      gap: 10,
    },
    modalButton: {
      flex: 1,
    },
    weightInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 8,
    },
    weightInput: {
      minWidth: 110,
      textAlign: 'center',
      fontSize: 40,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.5,
      color: theme.colors.text,
      lineHeight: 56,
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.primaryLine,
      padding: 0,
    },
    weightUnit: {
      marginBottom: 10,
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
