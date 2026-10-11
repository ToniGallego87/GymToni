import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { canonicalDecimals, fmtNum, localizeDecimals, t } from '@lib/i18n';
import {
  ASSUMED_WEIGHT_KG,
  CardioEntry,
  estimateEntryKcal,
  disciplineIconName,
  disciplineIdFromLabel,
  parseCardioEntry,
  hasIncline,
  formatEntryResults,
} from '@lib/cardio';
import { AppModal } from './AppModal';
import { Button } from './Button';
import {
  MENU_TILE_GAP,
  MENU_TILE_INSET,
  MENU_TILE_PADDING,
} from './menuTileTokens';

interface CardioInputFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  // Color de acento del día (push/pull/pierna). Tiñe el borde izquierdo.
  accent?: string;
  // Última entrada de cada disciplina (`lastCardioEntryByDiscipline`): sus
  // datos salen sugeridos al elegirla, como el peso de la última vez en fuerza.
  lastEntries?: Record<string, CardioEntry>;
  // Disciplinas propias usadas hace poco (`recentCustomDisciplines`): casilla
  // propia tras las fijas, para no volver a teclear su nombre en "Otro".
  customDisciplines?: string[];
  // Peso con el que se estiman las kcal que enseña el popup.
  weightKg?: number;
  // Rótulo del día en la cabecera de lo apuntado ("Hoy", o la fecha si se
  // corrige otro día).
  dateLabel?: string;
  // Se ha borrado una entrada; `undo` la devuelve a su sitio ("Deshacer").
  onEntryDeleted?: (undo: () => void) => void;
}

// Icono de MaterialCommunityIcons (los de las disciplinas salen de lib/cardio
// como texto).
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type CardioType =
  | 'treadmill'
  | 'treadmill-walk'
  | 'outdoor-run'
  | 'stationary-bike'
  | 'elliptical'
  | 'other'
  | null;

// Disciplinas de cinta: muestran el campo de pendiente.
const TREADMILL_TYPES: CardioType[] = ['treadmill', 'treadmill-walk'];

// Rótulos con getter: t() se evalúa al pintar, no al cargar el módulo, así
// que siguen al idioma en caliente (ver lib/i18n.ts).
const FIXED_CARDIO_OPTIONS = [
  {
    id: 'treadmill',
    get label() {
      return t('Correr en cinta');
    },
  },
  {
    id: 'treadmill-walk',
    get label() {
      return t('Andar en cinta');
    },
  },
  {
    id: 'outdoor-run',
    get label() {
      return t('Correr en exterior');
    },
  },
  {
    id: 'stationary-bike',
    get label() {
      return t('Bici estática');
    },
  },
  {
    id: 'elliptical',
    get label() {
      return t('Elíptica');
    },
  },
];
const OTHER_OPTION = {
  id: 'other',
  get label() {
    return t('Otro');
  },
};
// Prefijo del id de la casilla de una disciplina propia ("custom:Remo").
const CUSTOM_PREFIX = 'custom:';

// Icono de una opción del picker. Fuente única: disciplineIconName (la misma que
// la lista de disciplinas ya registradas y la vista de consulta), para que la
// misma disciplina no tenga dos iconos distintos. "Otro" no es una disciplina
// concreta, así que conserva su icono de affordance.
const optionIconName = (option: { id: string; label: string }): string =>
  option.id === 'other'
    ? 'dots-horizontal-circle-outline'
    : disciplineIconName(option.label);

// Número en la casilla del popup, en el separador del idioma.
const fieldOf = (n: number | null | undefined): string =>
  n == null ? '' : localizeDecimals(String(n));

// Las disciplinas van a la vista como casillas (icono + nombre, como el menú de
// Perfil): en "Insertar cardio" elegir disciplina es LA acción, así que la
// casilla abre directamente el popup de detalles.
export function CardioInputField({
  value,
  onChangeText,
  accent = theme.colors.primaryLine,
  lastEntries,
  customDisciplines = [],
  weightKg = ASSUMED_WEIGHT_KG,
  onEntryDeleted,
  dateLabel,
}: CardioInputFieldProps) {
  const [cardioEntries, setCardioEntries] = useState<string[]>(() => {
    if (!value) return [];
    return value.split(' | ').filter((e) => e.trim());
  });
  // La tarjeta solo existe cuando hay al menos un cardio guardado.
  const isExpanded = cardioEntries.length > 0;
  // Cada entrada con sus kcal estimadas (mismo cálculo que el popup) y el total
  // del día para la cabecera.
  const parsedEntries = cardioEntries.map((entry) => {
    const parsed = parseCardioEntry(entry);
    const kcal = estimateEntryKcal(
      { ...parsed, discipline: disciplineIdFromLabel(parsed.type) },
      weightKg
    );
    return { parsed, kcal };
  });
  const totals = parsedEntries.reduce(
    (acc, { parsed, kcal }) => ({
      minutes: acc.minutes + (parsed.minutes ?? 0),
      kcal: acc.kcal + kcal,
    }),
    { minutes: 0, kcal: 0 }
  );
  const [showCardioModal, setShowCardioModal] = useState(false);
  const [selectedCardioType, setSelectedCardioType] =
    useState<CardioType>(null);
  const [customCardioType, setCustomCardioType] = useState('');
  const [cardioMinutes, setCardioMinutes] = useState('');
  const [cardioSpeed, setCardioSpeed] = useState('');
  const [cardioPendiente, setCardioPendiente] = useState('');
  const [step, setStep] = useState<'type' | 'details'>('type');
  // Entrada que se está corrigiendo (índice en `cardioEntries`); null = nueva.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // Casillas: las cinco fijas, las propias recientes y "Otro" al final.
  const cardioOptions = [
    ...FIXED_CARDIO_OPTIONS,
    ...customDisciplines.map((name) => ({
      id: `${CUSTOM_PREFIX}${name}`,
      label: name,
    })),
    OTHER_OPTION,
  ];

  // Paso en el que está el asistente del modal.
  const isTypeStep = step === 'type' && !selectedCardioType;
  const isCustomTypeStep = step === 'type' && selectedCardioType === 'other';
  const isDetailsStep = step === 'details';
  const isTreadmill = TREADMILL_TYPES.includes(selectedCardioType);
  // Nombre de la disciplina elegida: el popup se titula con él, para que se vea
  // qué casilla se tocó antes de guardar.
  const selectedLabel =
    customCardioType.trim() ||
    FIXED_CARDIO_OPTIONS.find((o) => o.id === selectedCardioType)?.label ||
    '';
  // Lo de la última vez en esta disciplina (misma clave que
  // `cardioDisciplineKey`: el id fijo, o el nombre si es propia).
  // Al corregir una entrada no hay sugerencia: un campo vaciado es "sin dato",
  // no "lo de la última vez".
  const suggestion =
    isDetailsStep && editingIndex === null
      ? lastEntries?.[
          selectedCardioType && selectedCardioType !== 'other'
            ? selectedCardioType
            : `label:${customCardioType.trim().toLowerCase()}`
        ]
      : undefined;
  const suggested = (n: number | null | undefined): string =>
    n == null ? '' : String(n);
  // Lo tecleado manda; un campo vacío vale lo sugerido (igual que "Añadir
  // serie" acepta el peso sugerido). Ya con punto decimal, que es lo que se
  // guarda y lo que parsea lib/cardio.
  const effectiveMinutes =
    canonicalDecimals(cardioMinutes.trim()) || suggested(suggestion?.minutes);
  const effectiveSpeed =
    canonicalDecimals(cardioSpeed.trim()) || suggested(suggestion?.speed);
  const effectivePendiente = isTreadmill
    ? canonicalDecimals(cardioPendiente.trim()) ||
      suggested(suggestion?.pendiente)
    : '';
  const toNumber = (v: string): number | null => {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };
  // Kcal estimadas mientras se teclea. Sin velocidad no hay estimación (la
  // entrada vale 0 para retos y gráficas), y se dice aquí, donde se arregla.
  const kcalPreview = estimateEntryKcal(
    {
      type: selectedLabel,
      minutes: toNumber(effectiveMinutes),
      speed: toNumber(effectiveSpeed),
      pendiente: toNumber(effectivePendiente),
      raw: '',
      discipline:
        selectedCardioType && selectedCardioType !== 'other'
          ? selectedCardioType
          : null,
    },
    weightKg
  );
  // La sugerencia se lee en la casilla vacía, en el separador del idioma.
  const placeholderOf = (n: number | null | undefined): string =>
    n == null ? '0' : localizeDecimals(String(n));
  const modalTitle = isDetailsStep
    ? selectedLabel
    : isCustomTypeStep
    ? t('Especifica el tipo de ejercicio')
    : t('Selecciona el tipo de cardio');

  const closeCardioModal = () => {
    setShowCardioModal(false);
    setStep('type');
    setSelectedCardioType(null);
    setCustomCardioType('');
    // Los datos de una entrada que se corregía no pasan a la siguiente nueva.
    if (editingIndex !== null) {
      setEditingIndex(null);
      setCardioMinutes('');
      setCardioSpeed('');
      setCardioPendiente('');
    }
  };

  // Cerrar la tarjeta (back de Android, gesto de cierre o toque en el velo)
  // DESCARTA, como en cualquier otro modal de la app. Antes guardaba si había
  // minutos, que es lo contrario de lo que significa tocar fuera en el resto de
  // la app; confirmar es ahora el botón "Guardar" del pie (o el ✓ del teclado).
  const handleModalDismiss = () => closeCardioModal();

  // Con las casillas fuera del modal no hay paso de disciplina al que volver:
  // "Atrás" cierra y se elige otra casilla. Los datos ya tecleados (minutos,
  // velocidad, pendiente) se CONSERVAN: quien pulsa "Atrás" casi siempre se
  // equivocó de disciplina, no de números, y volver a teclearlos era un castigo
  // silencioso.
  const handleSelectCardioType = (typeId: string) => {
    setSelectedCardioType(typeId as CardioType);
    if (typeId === 'other') {
      setStep('type'); // Mostrar campo de texto para tipo personalizado
    } else {
      setStep('details');
    }
  };

  // Casilla de disciplina: abre el popup ya en su paso. La de una propia va
  // directa a sus datos, como si se hubiera tecleado su nombre en "Otro".
  const handleTilePress = (typeId: string) => {
    if (typeId.startsWith(CUSTOM_PREFIX)) {
      setSelectedCardioType('other');
      setCustomCardioType(typeId.slice(CUSTOM_PREFIX.length));
      setStep('details');
    } else {
      setCustomCardioType('');
      handleSelectCardioType(typeId);
    }
    setShowCardioModal(true);
  };

  // Tocar una entrada ya apuntada la corrige: el mismo popup con sus datos, y
  // "Guardar" la sustituye en su sitio (la × sigue siendo borrar).
  const handleEditEntry = (index: number) => {
    const { parsed } = parsedEntries[index];
    const fixedId = disciplineIdFromLabel(parsed.type);
    if (fixedId) {
      setSelectedCardioType(fixedId as CardioType);
      setCustomCardioType('');
    } else {
      setSelectedCardioType('other');
      setCustomCardioType(parsed.type);
    }
    setCardioMinutes(fieldOf(parsed.minutes));
    setCardioSpeed(fieldOf(parsed.speed));
    setCardioPendiente(fieldOf(parsed.pendiente));
    setEditingIndex(index);
    setStep('details');
    setShowCardioModal(true);
  };

  const optionRows: (typeof cardioOptions)[] = [];
  for (let i = 0; i < cardioOptions.length; i += 3) {
    optionRows.push(cardioOptions.slice(i, i + 3));
  }

  const handleCardioTypeConfirm = () => {
    if (customCardioType.trim()) {
      setStep('details');
    }
  };

  const handleSaveCardio = () => {
    if (!selectedCardioType || !effectiveMinutes) return;

    let cardioText = `${selectedLabel}: ${effectiveMinutes}min`;
    if (effectiveSpeed) {
      cardioText += `, ${effectiveSpeed}kmh`;
    }
    if (effectivePendiente) {
      cardioText += `, ${effectivePendiente}%`;
    }

    const newEntries =
      editingIndex !== null && editingIndex < cardioEntries.length
        ? cardioEntries.map((e, i) => (i === editingIndex ? cardioText : e))
        : [...cardioEntries, cardioText];
    setCardioEntries(newEntries);
    onChangeText(newEntries.join(' | '));

    setEditingIndex(null);
    setSelectedCardioType(null);
    setCustomCardioType('');
    setCardioMinutes('');
    setCardioSpeed('');
    setCardioPendiente('');
    setStep('type');
    setShowCardioModal(false);
  };

  const handleDeleteEntry = (index: number) => {
    const before = cardioEntries;
    const newEntries = cardioEntries.filter((_, i) => i !== index);
    setCardioEntries(newEntries);
    onChangeText(newEntries.join(' | '));
    // Se puede deshacer (el aviso lo pinta quien monta el campo).
    onEntryDeleted?.(() => {
      setCardioEntries(before);
      onChangeText(before.join(' | '));
    });
  };

  return (
    <>
      {/* Disciplinas como casillas (mismo dibujo que el menú de Perfil): un
          toque abre el popup de detalles de esa disciplina. Con su rótulo: la
          rejilla salía a pelo y no decía qué se esperaba de ella. */}
      <Text style={styles.pickerTitle}>{t('Selecciona la disciplina')}</Text>
      <View style={styles.tileGrid}>
        {optionRows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.tileRow}>
            {row.map((option) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [
                  styles.tile,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => handleTilePress(option.id)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
              >
                <MaterialCommunityIcons
                  name={optionIconName(option) as IconName}
                  size={34}
                  color={theme.colors.text}
                />
                <Text style={styles.tileLabel} numberOfLines={2}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {/* Lo apuntado va DEBAJO de las casillas: así guardar una disciplina no
          mueve la rejilla que se usa a continuación (el mismo criterio que las
          series de fuerza, que crecen bajo el botón). La cabecera dice el total
          del día en vez de repetir "Cardio", que ya lo dice la barra. */}
      {isExpanded && (
        <View style={[styles.container, { borderLeftColor: accent }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons
                name="run-fast"
                size={20}
                color={theme.colors.text}
                style={styles.icon}
              />
              <Text style={styles.title} numberOfLines={1}>
                {[
                  dateLabel ?? t('Hoy'),
                  `${fmtNum(totals.minutes)} min`,
                  ...(totals.kcal > 0
                    ? [`${Math.round(totals.kcal)} kcal`]
                    : []),
                ].join(' · ')}
              </Text>
            </View>
          </View>

          {/* Cada entrada se pinta como en la vista de consulta: icono real de la
              disciplina (cuesta incluida), nombre y resultados formateados
              (mismos helpers de lib/cardio), en vez del texto crudo guardado. */}
          {parsedEntries.map(({ parsed, kcal }, index) => {
            return (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.cardioEntryRow,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => handleEditEntry(index)}
                accessibilityRole="button"
                accessibilityLabel={`${t('Corregir')} ${parsed.type}`}
              >
                <MaterialCommunityIcons
                  name={
                    disciplineIconName(
                      parsed.type,
                      hasIncline(parsed.pendiente)
                    ) as IconName
                  }
                  size={26}
                  color={theme.colors.white}
                />
                <View style={styles.cardioEntryInfo}>
                  <Text style={styles.cardioEntryName} numberOfLines={1}>
                    {parsed.type}
                  </Text>
                  <Text style={styles.cardioEntryResults} numberOfLines={1}>
                    {formatEntryResults(parsed)}
                  </Text>
                </View>
                {kcal > 0 && (
                  <Text style={styles.cardioEntryKcal}>
                    {t('≈ {n} kcal', { n: Math.round(kcal) })}
                  </Text>
                )}
                {/* La misma marca de "quitar esto" que las series de fuerza:
                    disco lleno con la × recortada. */}
                <Pressable
                  style={({ pressed }) => [
                    styles.clearButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => handleDeleteEntry(index)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('Borrar')} ${parsed.type}`}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={24}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
              </Pressable>
            );
          })}
          {/* Añadir otra disciplina es pulsar otra casilla: sin botón propio. */}
        </View>
      )}

      {/* El popup de una casilla: nombrar la disciplina si es "Otro" y sus
          datos. El paso de datos se confirma con su botón "Guardar" (o con el
          ✓ del teclado, que hace lo mismo); antes no había botón y había que
          adivinarlo leyendo una nota. */}
      <AppModal
        visible={showCardioModal}
        onRequestClose={handleModalDismiss}
        onOverlayPress={handleModalDismiss}
        title={modalTitle}
        icon={
          (isDetailsStep
            ? disciplineIconName(
                selectedLabel,
                hasIncline(toNumber(effectivePendiente))
              )
            : 'run-fast') as IconName
        }
        align={isDetailsStep ? 'left' : 'center'}
        footer={
          isDetailsStep ? (
            <View style={styles.modalButtons}>
              <Button
                title={t('Atrás')}
                onPress={closeCardioModal}
                variant="secondary"
                size="medium"
                style={styles.modalButton}
              />
              <Button
                title={t('Guardar')}
                onPress={handleSaveCardio}
                disabled={!effectiveMinutes}
                variant="primary"
                size="medium"
                style={styles.modalButton}
              />
            </View>
          ) : (
            <>
              {isCustomTypeStep && (
                <Button
                  title={t('Continuar')}
                  onPress={handleCardioTypeConfirm}
                  disabled={!customCardioType}
                  size="medium"
                />
              )}
              <Button
                title={isTypeStep ? t('Cancelar') : t('Atrás')}
                onPress={closeCardioModal}
                variant="secondary"
                size="medium"
              />
            </>
          )
        }
      >
        {isCustomTypeStep && (
          <TextInput
            style={styles.customTypeInput}
            placeholder={t('Ej: Escalador, Remo, etc.')}
            placeholderTextColor={theme.colors.textSecondary}
            value={customCardioType}
            onChangeText={setCustomCardioType}
          />
        )}

        {isDetailsStep && (
          <View style={styles.inputRowCardio}>
            <View style={styles.inputGroupCardio}>
              <Text style={styles.labelCardio}>{t('Minutos')}</Text>
              <TextInput
                style={styles.inputCardio}
                placeholder={placeholderOf(suggestion?.minutes)}
                placeholderTextColor={theme.colors.textSecondary}
                value={cardioMinutes}
                onChangeText={setCardioMinutes}
                keyboardType="decimal-pad"
                maxLength={6}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveCardio}
              />
            </View>
            <View style={styles.inputGroupCardio}>
              <Text style={styles.labelCardio}>km/h</Text>
              <TextInput
                style={styles.inputCardio}
                placeholder={placeholderOf(suggestion?.speed)}
                placeholderTextColor={theme.colors.textSecondary}
                value={cardioSpeed}
                onChangeText={setCardioSpeed}
                keyboardType="decimal-pad"
                maxLength={5}
                returnKeyType="done"
                onSubmitEditing={handleSaveCardio}
              />
            </View>
            {isTreadmill && (
              <View style={styles.inputGroupCardio}>
                <Text style={styles.labelCardio}>{t('Pendiente %')}</Text>
                <TextInput
                  style={styles.inputCardio}
                  placeholder={placeholderOf(suggestion?.pendiente)}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={cardioPendiente}
                  onChangeText={setCardioPendiente}
                  keyboardType="decimal-pad"
                  maxLength={5}
                  returnKeyType="done"
                  onSubmitEditing={handleSaveCardio}
                />
              </View>
            )}
          </View>
        )}
        {/* Lo que vale la entrada, en el momento de apuntarla: las kcal son lo
            que mueve la hero, la gráfica y los retos de cardio. */}
        {isDetailsStep && !!effectiveMinutes && (
          <Text
            style={[
              styles.kcalPreview,
              !effectiveSpeed && styles.kcalPreviewWarning,
            ]}
          >
            {effectiveSpeed
              ? t('≈ {n} kcal', { n: Math.round(kcalPreview) })
              : t('Sin velocidad no se calculan kcal')}
          </Text>
        )}
      </AppModal>
    </>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      marginVertical: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderLeftWidth: 5,
      borderLeftColor: theme.colors.primaryLine,
      ...theme.shadow.soft,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    title: {
      flexShrink: 1,
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.text,
      lineHeight: 22,
    },
    icon: {
      marginRight: 8,
    },
    // Fila de una disciplina ya registrada: icono + nombre/resultados + borrar.
    // Mismo lenguaje visual que las filas de la vista de consulta; separadas por
    // una línea fina para leerlas como lista bajo la cabecera.
    cardioEntryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingTop: 12,
      marginTop: 12,
      borderTopWidth: 2,
      borderTopColor: theme.colors.border,
    },
    cardioEntryInfo: {
      flex: 1,
    },
    cardioEntryName: {
      fontSize: 17,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.3,
      color: theme.colors.text,
      lineHeight: 24,
      includeFontPadding: false,
      textAlignVertical: 'center',
      transform: [{ translateY: Platform.OS === 'android' ? 2 : 4 }],
    },
    // Kcal de una entrada, a la derecha de sus resultados.
    cardioEntryKcal: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    cardioEntryResults: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    clearButton: {
      padding: 6,
    },
    buttonPressed: {
      opacity: 0.8,
    },
    // Rótulo de la rejilla de disciplinas.
    pickerTitle: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    tileGrid: {
      gap: MENU_TILE_GAP,
      marginVertical: 12,
      marginHorizontal: MENU_TILE_INSET,
    },
    tileRow: {
      flexDirection: 'row',
      gap: MENU_TILE_GAP,
    },
    // Casillas de disciplina: copia del `menuTile` de Perfil (superficie,
    // borde, sombra suave, cuadradas). `flexBasis: 0` + `flexGrow: 1` para que
    // todas midan lo mismo tenga la etiqueta la longitud que tenga.
    tile: {
      flexGrow: 1,
      flexBasis: 0,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: MENU_TILE_PADDING,
      ...theme.shadow.soft,
    },
    tileLabel: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 16,
      textAlign: 'center',
    },
    customTypeInput: {
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.colors.text,
      marginBottom: 14,
    },
    inputRowCardio: {
      marginTop: 12,
      flexDirection: 'row',
      gap: 8,
    },
    // Pie del paso de datos: "Atrás" y "Guardar" a la par, como el resto de
    // modales de la app (ver AppModal / ConfirmModal).
    modalButtons: {
      flexDirection: 'row',
      gap: 10,
    },
    modalButton: {
      flex: 1,
    },
    inputGroupCardio: {
      flex: 1,
    },
    labelCardio: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    // Kcal estimadas bajo los campos del popup; en tono de aviso sin velocidad.
    kcalPreview: {
      marginTop: 10,
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    kcalPreviewWarning: {
      fontWeight: '700',
      color: theme.colors.warning,
    },
    inputCardio: {
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.colors.text,
      minHeight: 40,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
