import React, { useState, useEffect, useReducer } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  FlatList,
  SectionList,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';

// ============= TEMA =============
const theme = {
  fontFamily: 'System',
  colors: {
    primary: '#F7CC3D',
    primarySoft: '#F9D85A',
    primaryMuted: 'rgba(247, 204, 61, 0.14)',
    background: '#0F1115',
    backgroundElevated: '#13161C',
    surface: '#171A21',
    surfaceAlt: '#1C2029',
    gray: '#1E232D',
    mediumGray: '#232734',
    lightGray: '#8A90A2',
    text: '#F5F7FA',
    textSecondary: '#98A0AE',
    textMuted: '#697180',
    current: '#52C878',
    previous: '#FFB347',
    error: '#F06A6A',
    success: '#52C878',
    darkGray: '#101318',
    shadow: '#000000',
    overlay: 'rgba(6, 8, 12, 0.72)',
    push: '#6F8FDF',
    pull: '#CE7686',
    legs: '#67B58C',
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
  },
  radius: {
    sm: 10,
    md: 16,
    lg: 22,
    pill: 999,
  },
  typography: {
    hero: 30,
    title: 24,
    section: 18,
    body: 15,
    caption: 13,
    micro: 12,
  },
  shadow: {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
    soft: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.13,
      shadowRadius: 12,
      elevation: 6,
    },
  },
};

// ============= TIPOS =============
// Definiciones para TypeScript (comentadas en Snack, pero referenciadas)
// ParsedSet: { weight: number, reps: number }
// WorkoutDay: { id, dayNumber, name, emoji, exercises }
// Exercise: { id, name, order, targetReps, targetSets }
// ExerciseLog: { id, exerciseId, exerciseName, rawInput, parsedSets, notes }
// WorkoutLog: { id, routineId, dayId, date, exercises, cardio }

// ============= DATOS - 3 RUTINAS =============
const WORKOUT_ROUTINES = [
  {
    id: 'routine2',
    name: 'Rutina 1',
    description: 'Push/Pull/Legs con variantes',
    isActive: false,
    days: [
      {
        id: 'r2-day1',
        dayNumber: 1,
        name: 'Día 1 - Push (Pesado)',
        emoji: '🔵',
        exercises: [
          { id: 'r2-d1-ex1', name: 'Press banca declinado con barra', order: 1, targetReps: '6-8', targetSets: 4 },
          { id: 'r2-d1-ex2', name: 'Press militar multipower', order: 2, targetReps: '6-8', targetSets: 4 },
          { id: 'r2-d1-ex3', name: 'Aperturas planas con mancuernas', order: 3, targetReps: '12-15', targetSets: 3 },
          { id: 'r2-d1-ex4', name: 'Elevaciones frontales con mancuernas', order: 4, targetReps: '12-15', targetSets: 3 },
          { id: 'r2-d1-ex5', name: 'Extensión polea barra V', order: 5, targetReps: '12-15', targetSets: 2 },
        ],
      },
      {
        id: 'r2-day2',
        dayNumber: 2,
        name: 'Día 2 - Pull (Pesado)',
        emoji: '🔴',
        exercises: [
          { id: 'r2-d2-ex1', name: 'Dominadas supinas', order: 1, targetReps: '6-8', targetSets: 4 },
          { id: 'r2-d2-ex2', name: 'Tirón bajo sentado agarre estrecho', order: 2, targetReps: '6-8', targetSets: 4 },
          { id: 'r2-d2-ex3', name: 'Serratos en polea', order: 3, targetReps: '8-10', targetSets: 3 },
          { id: 'r2-d2-ex4', name: 'Curl alterno con mancuernas', order: 4, targetReps: '8-10', targetSets: 3 },
          { id: 'r2-d2-ex5', name: 'Martillo con mancuernas', order: 5, targetReps: '12-15', targetSets: 3 },
        ],
      },
      {
        id: 'r2-day3',
        dayNumber: 3,
        name: 'Día 3 - Pierna + Core',
        emoji: '🟢',
        exercises: [
          { id: 'r2-d3-ex1', name: 'Sentadilla en multipower', order: 1, targetReps: '8', targetSets: 4 },
          { id: 'r2-d3-ex2', name: 'Peso muerto sumo', order: 2, targetReps: '6-8', targetSets: 3 },
          { id: 'r2-d3-ex3', name: 'Extensiones sentado', order: 3, targetReps: '10-12', targetSets: 3 },
          { id: 'r2-d3-ex4', name: 'Femoral sentado', order: 4, targetReps: '12', targetSets: 3 },
          { id: 'r2-d3-ex5', name: 'Gemelos sentado', order: 5, targetReps: '15-20', targetSets: 3 },
          { id: 'r2-d3-ex6', name: 'Elevación de piernas vertical', order: 6, targetReps: '12-15', targetSets: 3 },
          { id: 'r2-d3-ex7', name: 'Plancha lateral + elevación de cadera', order: 7, targetReps: '10-12/lado', targetSets: 3 },
        ],
      },
      {
        id: 'r2-day4',
        dayNumber: 4,
        name: 'Día 4 - Push (Ligero/Bombeo)',
        emoji: '🔵',
        exercises: [
          { id: 'r2-d4-ex1', name: 'Press plano con mancuernas', order: 1, targetReps: '10-12', targetSets: 3 },
          { id: 'r2-d4-ex2', name: 'Aperturas inclinadas en máquina', order: 2, targetReps: '12-15', targetSets: 3 },
          { id: 'r2-d4-ex3', name: 'Arnold press con mancuernas', order: 3, targetReps: '10-12', targetSets: 3 },
          { id: 'r2-d4-ex4', name: 'Pájaros inversos en máquina', order: 4, targetReps: '12-15', targetSets: 3 },
          { id: 'r2-d4-ex5', name: 'Fondos en máquina', order: 5, targetReps: '12-15', targetSets: 3 },
          { id: 'r2-d4-ex6', name: 'Extensión tras nuca con mancuerna', order: 6, targetReps: '12-15', targetSets: 2 },
        ],
      },
      {
        id: 'r2-day5',
        dayNumber: 5,
        name: 'Día 5 - Pull (Ligero/Bombeo) + Core',
        emoji: '🔴',
        exercises: [
          { id: 'r2-d5-ex1', name: 'Jalón agarre neutro con agarre supino', order: 1, targetReps: '10-12', targetSets: 3 },
          { id: 'r2-d5-ex2', name: 'Remo sentado en hammer', order: 2, targetReps: '10-12', targetSets: 3 },
          { id: 'r2-d5-ex3', name: 'Face pull con cuerda', order: 3, targetReps: '12-15', targetSets: 3 },
          { id: 'r2-d5-ex4', name: 'Curl bíceps concentrado', order: 4, targetReps: '10-12', targetSets: 3 },
          { id: 'r2-d5-ex5', name: 'Curl martillo en banco inclinado', order: 5, targetReps: '12-15', targetSets: 3 },
          { id: 'r2-d5-ex6', name: 'Plank con brazos extendidos + toque hombro', order: 6, targetReps: '30-45s', targetSets: 3 },
          { id: 'r2-d5-ex7', name: 'Crunch oblicuo tumbado', order: 7, targetReps: '12-15', targetSets: 3 },
        ],
      },
    ],
  },
  {
    id: 'routine3',
    name: 'Rutina 2',
    description: 'Push/Pull/Legs con piernas en frecuencia 2',
    isActive: true,
    days: [
      {
        id: 'day1',
        dayNumber: 1,
        name: 'Día 1 - Push pesado',
        emoji: '🔵',
        exercises: [
          { id: 'day1-ex1', name: 'Press banca plano con barra', order: 1, targetReps: '5-8', targetSets: 3 },
          { id: 'day1-ex2', name: 'Aperturas declinadas en polea', order: 2, targetReps: '12-15', targetSets: 2 },
          { id: 'day1-ex3', name: 'Press inclinado mancuernas', order: 3, targetReps: '8-10', targetSets: 3 },
          { id: 'day1-ex4', name: 'Press militar barra o mancuernas', order: 4, targetReps: '6-8', targetSets: 3 },
          { id: 'day1-ex5', name: 'Elevaciones laterales mancuernas', order: 5, targetReps: '12-15', targetSets: 3 },
          { id: 'day1-ex6', name: 'Extensión tríceps polea barra', order: 6, targetReps: '10-12', targetSets: 3 },
          { id: 'day1-ex7', name: 'Extensión tras nuca cuerda', order: 7, targetReps: '12-15', targetSets: 2 },
        ],
      },
      {
        id: 'day2',
        dayNumber: 2,
        name: 'Día 2 - Pull pesado',
        emoji: '🔴',
        exercises: [
          { id: 'day2-ex1', name: 'Dominadas prono', order: 1, targetReps: '6-8', targetSets: 4 },
          { id: 'day2-ex2', name: 'Remo con barra', order: 2, targetReps: '6-8', targetSets: 4 },
          { id: 'day2-ex3', name: 'Pullover polea alta', order: 3, targetReps: '10-12', targetSets: 3 },
          { id: 'day2-ex4', name: 'Face pull pesado', order: 4, targetReps: '12-15', targetSets: 3 },
          { id: 'day2-ex5', name: 'Curl barra recta', order: 5, targetReps: '8-10', targetSets: 3 },
          { id: 'day2-ex6', name: 'Curl martillo alterno', order: 6, targetReps: '12', targetSets: 3 },
        ],
      },
      {
        id: 'day3',
        dayNumber: 3,
        name: 'Día 3 - Pierna A',
        emoji: '🟢',
        exercises: [
          { id: 'day3-ex1', name: 'Sentadilla libre o hack', order: 1, targetReps: '6-8', targetSets: 4 },
          { id: 'day3-ex2', name: 'Prensa inclinada', order: 2, targetReps: '8-10', targetSets: 3 },
          { id: 'day3-ex3', name: 'Extensión cuádriceps unilateral', order: 3, targetReps: '12', targetSets: 3 },
          { id: 'day3-ex4', name: 'Gemelos de pie', order: 4, targetReps: '12-20', targetSets: 4 },
          { id: 'day3-ex5', name: 'Elevación piernas tumbado', order: 5, targetReps: '12-15', targetSets: 3 },
          { id: 'day3-ex6', name: 'Plancha lateral', order: 6, targetReps: '30-45s', targetSets: 3 },
        ],
      },
      {
        id: 'day4',
        dayNumber: 4,
        name: 'Día 4 - Torso mixto',
        emoji: '🔵🔴',
        exercises: [
          { id: 'day4-ex1', name: 'Press pecho en máquina convergente', order: 1, targetReps: '10-12', targetSets: 3 },
          { id: 'day4-ex2', name: 'Remo hammer o pecho apoyado', order: 2, targetReps: '10-12', targetSets: 3 },
          { id: 'day4-ex3', name: 'Arnold press', order: 3, targetReps: '10', targetSets: 3 },
          { id: 'day4-ex4', name: 'Pájaros en peck-deck', order: 4, targetReps: '12-15', targetSets: 4 },
          { id: 'day4-ex5', name: 'Curl inclinado mancuernas', order: 5, targetReps: '12', targetSets: 2 },
          { id: 'day4-ex6', name: 'Fondos máquina o polea tríceps', order: 6, targetReps: '12', targetSets: 2 },
        ],
      },
      {
        id: 'day5',
        dayNumber: 5,
        name: 'Día 5 - Pierna B',
        emoji: '🟢',
        exercises: [
          { id: 'day5-ex1', name: 'Peso muerto rumano', order: 1, targetReps: '6-8', targetSets: 4 },
          { id: 'day5-ex2', name: 'Hip thrust barra', order: 2, targetReps: '8-10', targetSets: 3 },
          { id: 'day5-ex3', name: 'Curl femoral sentado o tumbado', order: 3, targetReps: '10-12', targetSets: 3 },
          { id: 'day5-ex4', name: 'Zancadas con mancuernas', order: 4, targetReps: '12', targetSets: 3 },
          { id: 'day5-ex5', name: 'Gemelos sentado', order: 5, targetReps: '15-20', targetSets: 3 },
          { id: 'day5-ex6', name: 'Crunch oblicuo', order: 6, targetReps: '15', targetSets: 3 },
          { id: 'day5-ex7', name: 'Crunch encogimiento', order: 7, targetReps: '15', targetSets: 3 },
        ],
      },
    ],
  },
];

// ============= PARSERS =============
function parseSeriesString(input) {
  if (!input || !input.trim()) return [];
  const sets = [];
  const seriesArray = input.split(',');
  for (const series of seriesArray) {
    const match = series.trim().match(/^([\d.]+)\s*x\s*([\d.]+)/i);
    if (match) {
      const weight = parseFloat(match[1]);
      const reps = parseFloat(match[2]);
      if (!isNaN(weight) && !isNaN(reps)) {
        sets.push({ weight, reps });
      }
    }
  }
  return sets;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getDisplayDayName(name) {
  return name ? name.replace(/^Día\s+\d+\s*-\s*/i, '') : '';
}

function getRoutineDayTitle(name) {
  if (!name) return '';
  return name
    .replace(/^Día\s+\d+\s*-\s*/i, '')
    .replace(/^(Lunes|Martes|Miércoles|Miercoles|Jueves|Viernes|Sábado|Sabado|Domingo)\s*-\s*/i, '');
}

function getDayAccentColor(day) {
  if (!day) return theme.colors.primary;
  if (day.emoji === '🔵🔴') return theme.colors.primary;
  if (day.emoji?.includes('🟡')) return '#F2C94C';
  if (day.emoji?.includes('🟣')) return '#9B6BFF';
  if (day.emoji?.includes('🔵') || /push/i.test(day.name)) return theme.colors.push;
  if (day.emoji?.includes('🔴') || /pull/i.test(day.name)) return theme.colors.pull;
  if (day.emoji?.includes('🟢') || /pierna|leg/i.test(day.name)) return theme.colors.legs;
  return theme.colors.primary;
}

// ============= ALMACENAMIENTO =============
function useStorage() {
  const [logs, setLogs] = useState([]);
  const saveLogs = (newLogs) => {
    setLogs(newLogs);
  };

  return { logs, saveLogs };
}

function ExerciseInputField({
  exerciseId,
  repetitions,
  addedSets,
  targetSets,
  onAddSet,
  onRemoveLastSet,
  onFinishExercise,
  exerciseNote,
  lastResultPlaceholder,
}) {
  const [weightValue, setWeightValue] = useState('');
  const [repsValue, setRepsValue] = useState('');
  const hasAddedSets = addedSets && addedSets.length > 0;
  const isMaxSetsReached = addedSets && addedSets.length >= targetSets;

  const handleAddSet = () => {
    const weight = parseFloat(weightValue.trim());
    const reps = parseFloat(repsValue.trim());
    if (!isNaN(weight) && !isNaN(reps)) {
      onAddSet(exerciseId, { weight, reps });
      setWeightValue('');
      setRepsValue('');
    }
  };

  return (
    <View style={styles.exerciseFieldContainer}>
      <View style={styles.inputRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Peso (kg)</Text>
          <TextInput
            style={styles.splitInput}
            placeholder="0"
            placeholderTextColor={theme.colors.textSecondary}
            value={weightValue}
            keyboardType="decimal-pad"
            maxLength={6}
            editable={!isMaxSetsReached}
            onChangeText={setWeightValue}
          />
        </View>
        <Text style={styles.separator}>×</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Reps</Text>
          <TextInput
            style={styles.splitInput}
            placeholder="0"
            placeholderTextColor={theme.colors.textSecondary}
            value={repsValue}
            keyboardType="decimal-pad"
            maxLength={4}
            editable={!isMaxSetsReached}
            onChangeText={setRepsValue}
          />
        </View>
      </View>

      {hasAddedSets && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.exerciseFieldTags}
        >
          {addedSets.map((set, idx) => (
            <View key={idx} style={styles.exerciseFieldTag}>
              <Text style={styles.exerciseFieldTagText}>
                {set.weight}x{set.reps}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {hasAddedSets && (
        <Text style={styles.exerciseFieldCounter}>
          Series: {addedSets.length}/{targetSets}
        </Text>
      )}

      {isMaxSetsReached && (
        <Text style={styles.exerciseFieldMaxReached}>
          ✅ Máximo de series alcanzado
        </Text>
      )}

      {hasAddedSets && exerciseNote && (
        <Text style={styles.exerciseFieldNote}>
          📝 {exerciseNote}
        </Text>
      )}

      <View style={styles.exerciseFieldButtons}>
        {!isMaxSetsReached && (
          <Pressable
            style={[styles.exerciseFieldButton, styles.exerciseFieldAddButton]}
            onPress={handleAddSet}
          >
            <Text style={styles.exerciseFieldButtonText}>➕ Añadir</Text>
          </Pressable>
        )}

        {hasAddedSets && (
          <Pressable
            style={[styles.exerciseFieldButton, styles.exerciseFieldDeleteButton]}
            onPress={() => onRemoveLastSet(exerciseId)}
          >
            <Text style={styles.exerciseFieldButtonText}>➖ Borrar</Text>
          </Pressable>
        )}

        {!isMaxSetsReached && (
          <Pressable
            style={[styles.exerciseFieldButton, styles.exerciseFieldFinishButton]}
            onPress={() => onFinishExercise(exerciseId, addedSets.length, targetSets)}
          >
            <Text style={styles.exerciseFieldButtonText}>✅ Terminar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ============= APP PRINCIPAL =============
export default function App() {
  const DAY_COLOR_SEQUENCE = ['blue', 'red', 'green', 'yellow', 'purple'];
  const DAY_COLOR_EMOJI = {
    blue: '🔵',
    red: '🔴',
    green: '🟢',
    yellow: '🟡',
    purple: '🟣',
  };

  const [screen, setScreen] = useState('home');
  const [showRoutineSelector, setShowRoutineSelector] = useState(false);
  const [showDaySelector, setShowDaySelector] = useState(false);
  const [routines, setRoutines] = useState(WORKOUT_ROUTINES);
  const [activeRoutineId, setActiveRoutineId] = useState('routine3');
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedRoutineForDetails, setSelectedRoutineForDetails] = useState(null);
  const [newRoutineDays, setNewRoutineDays] = useState([
    { id: generateId(), title: '', exercisesText: '' },
  ]);
  const createExerciseLog = (id, name, order, rawInput, notes = '') => ({
    id,
    name,
    order,
    rawInput,
    parsedSets: parseSeriesString(rawInput),
    notes,
    timestamp: Date.now(),
  });

  const createLogFromDayInputs = (id, routineId, dayId, date, setInputs, cardioRawInput = null) => {
    const routine = routines.find((item) => item.id === routineId);
    const day = routine?.days?.find((item) => item.id === dayId);
    const exercises = (day?.exercises || []).map((exercise, idx) => (
      createExerciseLog(
        exercise.id,
        exercise.name,
        exercise.order,
        (setInputs[idx] || '-').toString()
      )
    ));

    return {
      id,
      routineId,
      dayId,
      date,
      exercises,
      cardio: cardioRawInput ? { rawInput: cardioRawInput } : null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  };

  const routine2HistoryData = [
    { id: 'log201', dayId: 'r2-day1', date: '2026-01-03', sets: ['50x8, 60x8, 60x8, 65x5', '30x8, 40x8, 40x8, 40x6', '20x15, 22x14, 22x10', '10x15, 10x15, 10x15', '25x15, 30x15', '15x12, 17.5x12, 17.5x10'], cardio: 'Cinta 15 mins 10km/h' },
    { id: 'log202', dayId: 'r2-day2', date: '2026-01-04', sets: ['0x8, 0x6, 0x5, 0x4', '60x8, 65x8, 70x8, 70x8', '20x10, 25x10, 30x9', '14x11, 16x10, 16x9', '14x15, 14x14, 14x12'], cardio: 'Cinta hiit 17mins 6-13km/h' },
    { id: 'log203', dayId: 'r2-day3', date: '2026-01-06', sets: ['20x8, 30x8, 40x8, 45x8', '16x8, 24x8, 30x8, 34x8', '40x12, 50x12, 60x12', '40x12, 50x12, 50x10', '20x14, 20x18, 20x15', '0x15, 0x12, 0x7', '0x12, 0x12, 0x10'] },
    { id: 'log204', dayId: 'r2-day4', date: '2026-01-07', sets: ['30x12, 30x12, 30x8', '15x13, 15x12, 15x8', '12x12, 16x8, 16x7', '12x15, 14x15, 14x15', '80x15, 80x15, 80x', '16x15, 20x15, 20x12'], cardio: 'Cinta: 20mins 10/10.6km/h' },
    { id: 'log205', dayId: 'r2-day5', date: '2026-01-09', sets: ['65x8, 70x10, 70x10', '40x12, 50x12, 50x10', '20x12, 25x12, 25x12', '18x12, 20x12, 20x12', '12x15, 12x15, 12x12', '0x30, 0x35, 0x30', '0x15, 0x15, 0x15'] },
    { id: 'log206', dayId: 'r2-day1', date: '2026-01-11', sets: ['60x8, 65x8, 65x6, 65x6', '30x8, 40x8, 40x8, 40x6', '22x15, 22x13, 22x12', '10x15, 10x15, 10x15', '30x15, 32.5x12', '17.5x12, 17.5x12, 20x11'], cardio: 'Cinta: 20mins 10.3/10.6kmh' },
    { id: 'log207', dayId: 'r2-day2', date: '2026-01-12', sets: ['0x9, 0x7, 0x5, -', '65x8, 70x8, 75x8, 80x8', '25x10, 30x10, 30x10', '14x12, 16x12, 16x12', '14x15, 14x15, 14x13'], cardio: 'Cinta: hiit 20mins 6/13kmh' },
    { id: 'log208', dayId: 'r2-day3', date: '2026-01-13', sets: ['30x8, 40x8, 45x8, 50x5', '26x8, 30x8, 34x8, 34x8', '50x12, 55x12, 60x10', '50x7, 40x12, 40x10', '0x15, 0x15, 0x', '0x15, 0x15, 0x15', '0x12, 0x12, 0x12'] },
    { id: 'log209', dayId: 'r2-day4', date: '2026-01-14', sets: ['30x12, 34x10, 34x9', '15x15, 15x13, 15x10', '14x11, 14x9, 14x8', '20x12, 20x11, 20x10', '80x12, 90x15, 100x15', '18x15, 18x15, 20x14'], cardio: 'Cinta: 12mins, 10.8kmh' },
    { id: 'log210', dayId: 'r2-day5', date: '2026-01-16', sets: ['65x12, 70x8, 70x9', '40x12, 50x11, 50x11', '22.5x15, 25x15, 27.5x15', '20x12, 20x12, 22x12', '14x13, 14x13, 14x11', '0x30, 0x30, 0x35', '0x15, 0x15, 0x'] },
    { id: 'log211', dayId: 'r2-day1', date: '2026-01-18', sets: ['60x8, 65x8, 65x5, -', '35x8, 40x8, 40x8, 40x7', '22x15, 22x15, 22x13', '10x15, 10x15, 12x12', '32.5x15, 35x12', '17.5x12, 20x12, 20x12'], cardio: 'Cinta: 20mins 10.6kmh' },
    { id: 'log212', dayId: 'r2-day2', date: '2026-01-19', sets: ['0x9, 0x8, 0x6, 0x5', '70x8, 75x8, 80x8, 80x8', '27.5x12, 30x10, 32.5x10', '16x10, 18x10, 18x9', '14x15, 16x15, 16x12'], cardio: 'Cinta: hiit 19mins 6/13kmh' },
    { id: 'log213', dayId: 'r2-day3', date: '2026-01-21', sets: ['35x8, 40x8, 45x8, 50x7', '30x8, 34x8, 36x8', '55x12, 60x12, 60x11', '40x12, 45x12, 50x12', '20x15, 20x20, 25x18', '0x15, 0x15, 0x15', '0x12, 0x12, 0x12'] },
    { id: 'log214', dayId: 'r2-day4', date: '2026-01-22', sets: ['30x12, 34x12, 34x9', '15x14, 15x13, 15x12', '14x11, 14x10, 14x9', '20x12, 20x15, 20x12', '90x15, 100x15, 100x12', '18x15, 20x15, 20x15'] },
    { id: 'log215', dayId: 'r2-day5', date: '2026-01-23', sets: ['65x12, 70x9, 70x10', '40x12, 50x12, 55x12', '25x15, 27.5x15, 30x15', '22.5x12, 22.5x12, 22.5x12', '14x13, 14x13, 14x10', '0x38, 0x27, 0x32', '0x15, 0x15, 0x15'] },
    { id: 'log216', dayId: 'r2-day1', date: '2026-01-25', sets: ['60x8, 65x8, 65x8, 70x5', '35x8, 40x8, 40x8, 45x7', '22x15, 22x15, 22x15', '10x15, 12x13, 12x13', '35x15, 35x11', '20x12, 20x12, 20x12'], cardio: 'Cinta: 20mins 10.7kmh' },
    { id: 'log217', dayId: 'r2-day2', date: '2026-01-26', sets: ['0x10, 0x8, 0x6, 0x5', '75x8, 80x8, 80x8, 85x6', '30x10, 32.5x10, 35x9', '18x10, 18x10, 18x10', '16x15, 16x15, 16x'], cardio: 'Cinta: hiit 19mins 6/13kmh' },
    { id: 'log218', dayId: 'r2-day3', date: '2026-01-28', sets: ['40x8, 45x8, 50x8, 50x8', '34x8, 36x8, 40x8', '60x12, 60x11, 60x10', '45x13, 50x12, 50x11', '20x20, 20x20, 25x16', '0x15, 0x15, 0x15', '0x12, 0x12, 0x12'] },
    { id: 'log219', dayId: 'r2-day4', date: '2026-01-29', sets: ['34x12, 34x11, 34x8', '15x15, 15x15, 15x13', '14x12, 14x11, 14x7', '20x15, 20x15, 20x', '100x15, 100x15, 100x13', '20x15, 22x13'], cardio: 'Cinta: 20mins 10.8kmh' },
    { id: 'log220', dayId: 'r2-day5', date: '2026-01-30', sets: ['65x12, 70x11, 70x8', '50x12, 50x12, 55x9', '27.5x15, 27.5x15, 32.5x15', '22x12, 24x10, 24x9', '14x14, 14x14, 14x12', '-', '-'] },
    { id: 'log221', dayId: 'r2-day1', date: '2026-02-01', sets: ['60x8, 65x8, 65x8, 70x5', '40x8, 40x8, 45x7, 45x7', '22x15, 22x15, 22x15', '10x15, 12x14, 12x13', '35x15, 35x13', '20x12, 22x12, 24x12'], cardio: 'Cinta: 20mins 10.8/11/11.2kmh' },
    { id: 'log222', dayId: 'r2-day2', date: '2026-02-02', sets: ['0x10, 0x8, 0x7, 0x6', '75x8, 80x8, 85x8, 85x8', '33x10, 36x9, 36x5', '18x10, 18x10, 20x7', '16x15, 16x15, 16x'], cardio: 'Cinta: hiit 21mins 6/13kmh' },
    { id: 'log223', dayId: 'r2-day3', date: '2026-02-03', sets: ['45x8, 50x8, 50x8, 52.5x6', '36x8, 38x8, 40x8', '60x12, 60x12, 60x10', '50x12, 52.5x12, 55x10', '0x15, 0x13, 0x12', '0x20, 0x20, 0x20', '0x12, 0x12, 0x12'] },
    { id: 'log224', dayId: 'r2-day4', date: '2026-02-05', sets: ['34x12, 34x12, 34x8', '15x15, 17.5x14, 17.5x11', '14x10, 14x10, 14x10', '20x15, 22.5x12, 22.5x10', '90x15, 100x15, 100x12', '22x15, 22x15'], cardio: 'Cinta: 22mins 11/11.3kmh' },
    { id: 'log225', dayId: 'r2-day5', date: '2026-02-06', sets: ['65x12, 70x12, 70x10', '50x12, 50x12, 55x10', '27.5x12, 32.5x15, 35x15', '22x12, 24x12, 24x12', '14x14, 14x12, 14x10', '0x35, 0x35, 0x25', '0x15, 0x15, 0x13'] },
    { id: 'log226', dayId: 'r2-day1', date: '2026-02-08', sets: ['60x8, 65x8, 65x6, 65x7', '40x8, 45x8, 45x8, 50x6', '22x15, 22x15, 24x15', '12x12, 14x14, 14x14', '35x15, 35x13', '22.5x11, 22.5x11, 22.5x10'], cardio: 'Cinta: 20mins 11.2/11.4kmh' },
    { id: 'log227', dayId: 'r2-day2', date: '2026-02-09', sets: ['0x8, 0x8, 0x8, 0x6', '80x10, 80x8, 85x8, 85x8', '32.5x10, 35x10, 35x10', '18x10, 18x10, 20x7', '16x15, 16x15, 16x14'], cardio: 'Cinta: 15mins 11.5kmh' },
  ];

  const initialLogs = [
    {
      id: 'log001', routineId: 'routine3', dayId: 'day1', date: '2026-02-15',
      exercises: [
        createExerciseLog('day1-ex1', 'Press banca plano con barra', 1, '60x8, 65x6, 65x4'),
        createExerciseLog('day1-ex2', 'Aperturas declinadas en polea', 2, '12.5x15, 15x15'),
        createExerciseLog('day1-ex3', 'Press inclinado mancuernas', 3, '28x10, 30x10, 32x9'),
        createExerciseLog('day1-ex4', 'Press militar barra o mancuernas', 4, '18x8, 22x8, 22x6'),
        createExerciseLog('day1-ex5', 'Elevaciones laterales mancuernas', 5, '7.5x13, 7.5x12, 7.5x14', 'En polea'),
        createExerciseLog('day1-ex6', 'Extensión tríceps polea barra', 6, '30x12, 32.5x12, 35x12'),
        createExerciseLog('day1-ex7', 'Extensión tras nuca cuerda', 7, '22.5x12, 22.5x12'),
      ],
      cardio: { rawInput: 'Cinta: 22.5mins, 11.5/11.7kmh' }, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log002', routineId: 'routine3', dayId: 'day2', date: '2026-02-16',
      exercises: [
        createExerciseLog('day2-ex1', 'Dominadas prono', 1, '0x6, 0x7, 0x5, 0x5'),
        createExerciseLog('day2-ex2', 'Remo con barra o T-bar', 2, '45x8, 55x8, 65x8, 70x6', 'Peso + barra'),
        createExerciseLog('day2-ex3', 'Pullover polea alta', 3, '30x12, 32.5x12, 35x10'),
        createExerciseLog('day2-ex4', 'Face pull pesado', 4, '27.5x15, 30x15, 32x12'),
        createExerciseLog('day2-ex5', 'Curl barra recta o EZ', 5, '30x10, 30x10, 35x8'),
        createExerciseLog('day2-ex6', 'Curl martillo alterno', 6, '14x12, 16x11'),
      ],
      cardio: { rawInput: 'Cinta: 18mins 11.8kmh' }, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log003', routineId: 'routine3', dayId: 'day3', date: '2026-02-17',
      exercises: [
        createExerciseLog('day3-ex1', 'Sentadilla libre o hack', 1, '20x8, 20x8, 30x8, 35x7'),
        createExerciseLog('day3-ex2', 'Prensa inclinada', 2, '40x10, 80x10, 90x10'),
        createExerciseLog('day3-ex3', 'Extensión cuádriceps unilateral', 3, '25x12, 27.5x11, 27.5x10'),
        createExerciseLog('day3-ex4', 'Gemelos de pie', 4, '0x12, 0x12, 0x12'),
        createExerciseLog('day3-ex5', 'Elevación piernas tumbado', 5, '0x20, 0x15, 0x15'),
        createExerciseLog('day3-ex6', 'Plancha lateral', 6, '0x30, 0x35, 0x30'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log004', routineId: 'routine3', dayId: 'day4', date: '2026-02-18',
      exercises: [
        createExerciseLog('day4-ex1', 'Press pecho en máquina convergente', 1, '30x12, 50x12, 50x10', 'Kg por brazo'),
        createExerciseLog('day4-ex2', 'Remo hammer o pecho apoyado', 2, '50x12, 52.5x11, 52.5x8', 'Kg por brazo'),
        createExerciseLog('day4-ex3', 'Arnold press', 3, '14x10, 14x10, 14x10'),
        createExerciseLog('day4-ex4', 'Pájaros en peck-deck', 4, '20x15, 22.5x13, 22.5x10, -'),
        createExerciseLog('day4-ex5', 'Curl inclinado mancuernas', 5, '14x12, 14x12'),
        createExerciseLog('day4-ex6', 'Fondos máquina o polea tríceps', 6, '100x12, 120x12'),
      ],
      cardio: { rawInput: 'Cinta: 12m 5kmh 9p, 10mins 12kmh' }, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log005', routineId: 'routine3', dayId: 'day5', date: '2026-02-19',
      exercises: [
        createExerciseLog('day5-ex1', 'Peso muerto rumano', 1, '55x8, 65x8, 70x8, 70x8', 'Peso con barra'),
        createExerciseLog('day5-ex2', 'Hip thrust barra', 2, '40x10, 40x10, 40x7'),
        createExerciseLog('day5-ex3', 'Curl femoral sentado o tumbado', 3, '40x10, 40x9, 40x8'),
        createExerciseLog('day5-ex4', 'Zancadas con mancuernas', 4, '8+8x11, 8+8x9', 'Peso por mancuerna'),
        createExerciseLog('day5-ex5', 'Gemelos sentado', 5, '20x20, 20x18, 20x15'),
        createExerciseLog('day5-ex6', 'Crunch oblicuo', 6, '0x20, 0x20, 0x20'),
        createExerciseLog('day5-ex7', 'Crunch encogimiento', 7, '0x15, 0x15, 0x15'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log006', routineId: 'routine3', dayId: 'day1', date: '2026-02-22',
      exercises: [
        createExerciseLog('day1-ex1', 'Press banca plano con barra', 1, '60x8, 65x6, 65x6'),
        createExerciseLog('day1-ex2', 'Aperturas declinadas en polea', 2, '15x15, 15x14'),
        createExerciseLog('day1-ex3', 'Press inclinado mancuernas', 3, '30x10, 32x10, 34x8'),
        createExerciseLog('day1-ex4', 'Press militar barra o mancuernas', 4, '20x11, 24x6, 24x5'),
        createExerciseLog('day1-ex5', 'Elevaciones laterales mancuernas', 5, '7.5x12, 7.5x12, 7.5x12'),
        createExerciseLog('day1-ex6', 'Extensión tríceps polea barra', 6, '32.5x12, 35x12, 37.5x11'),
        createExerciseLog('day1-ex7', 'Extensión tras nuca cuerda', 7, '22.5x12, 22.5x10'),
      ],
      cardio: { rawInput: 'Cinta: 22mins, 11.8/12/12.2kmh' }, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log007', routineId: 'routine3', dayId: 'day2', date: '2026-02-23',
      exercises: [
        createExerciseLog('day2-ex1', 'Dominadas prono', 1, '0x8, 0x7, 0x6, 0x5'),
        createExerciseLog('day2-ex2', 'Remo con barra o T-bar', 2, '60x8, 65x8, 70x8, 70x8', 'Peso + barra'),
        createExerciseLog('day2-ex3', 'Pullover polea alta', 3, '31.5x12, 34.5x12, 34.5x11'),
        createExerciseLog('day2-ex4', 'Face pull pesado', 4, '28.5x15, 31.5x15, 34.5x14'),
        createExerciseLog('day2-ex5', 'Curl barra recta o EZ', 5, '30x12, 30x12, 30x11'),
        createExerciseLog('day2-ex6', 'Curl martillo alterno', 6, '14x12, 16x11'),
      ],
      cardio: { rawInput: 'Cinta: 20mins 10p 5kmh' }, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log008', routineId: 'routine3', dayId: 'day3', date: '2026-02-24',
      exercises: [
        createExerciseLog('day3-ex1', 'Sentadilla libre o hack', 1, '25x8, 30x8, 30x8, 35x8'),
        createExerciseLog('day3-ex2', 'Prensa inclinada', 2, '80x10, 100x10, 110x10'),
        createExerciseLog('day3-ex3', 'Extensión cuádriceps unilateral', 3, '25x12, 27.5x12, 27.5x12'),
        createExerciseLog('day3-ex4', 'Gemelos de pie', 4, '0x20, 0x20, 0x20'),
        createExerciseLog('day3-ex5', 'Elevación piernas tumbado', 5, '0x15, 0x15, 0x15'),
        createExerciseLog('day3-ex6', 'Plancha lateral', 6, '0x30, 0x30, 0x30'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log009', routineId: 'routine3', dayId: 'day4', date: '2026-02-26',
      exercises: [
        createExerciseLog('day4-ex1', 'Press pecho en máquina convergente', 1, '40x12, 50x12, 50x12', 'Kg por brazo'),
        createExerciseLog('day4-ex2', 'Remo hammer o pecho apoyado', 2, '50x12, 52.5x12, -', 'Kg por brazo'),
        createExerciseLog('day4-ex3', 'Arnold press', 3, '14x10, 14x10, 16x10'),
        createExerciseLog('day4-ex4', 'Pájaros en peck-deck', 4, '22.5x14, 22.5x11, 22.5x10'),
        createExerciseLog('day4-ex5', 'Curl inclinado mancuernas', 5, '14x12, 16x9'),
        createExerciseLog('day4-ex6', 'Fondos máquina o polea tríceps', 6, '120x12, 120x12'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log010', routineId: 'routine3', dayId: 'day5', date: '2026-02-27',
      exercises: [
        createExerciseLog('day5-ex1', 'Peso muerto rumano', 1, '55x8, 65x8, 70x8, 75x8', 'Peso con barra'),
        createExerciseLog('day5-ex2', 'Hip thrust barra', 2, '40x10, 40x10, 40x10'),
        createExerciseLog('day5-ex3', 'Curl femoral sentado o tumbado', 3, '20x5, 10x12, 15x10', 'Por pierna, hammer'),
        createExerciseLog('day5-ex4', 'Zancadas con mancuernas', 4, '10x11, 10x10', 'Peso por mancuerna'),
        createExerciseLog('day5-ex5', 'Gemelos sentado', 5, '20x20, 20x19, 20x17'),
        createExerciseLog('day5-ex6', 'Crunch oblicuo', 6, '0x15, 0x15, 0x15'),
        createExerciseLog('day5-ex7', 'Crunch encogimiento', 7, '0x20, 0x15, 0x15', 'Encogimiento'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log011', routineId: 'routine3', dayId: 'day1', date: '2026-03-01',
      exercises: [
        createExerciseLog('day1-ex1', 'Press banca plano con barra', 1, '60x8, 65x8, 70x7'),
        createExerciseLog('day1-ex2', 'Aperturas declinadas en polea', 2, '15x15, 17.5x12'),
        createExerciseLog('day1-ex3', 'Press inclinado mancuernas', 3, '32x10, 34x8, 34x6'),
        createExerciseLog('day1-ex4', 'Press militar barra o mancuernas', 4, '22x8, 22x7, 22x6'),
        createExerciseLog('day1-ex5', 'Elevaciones laterales mancuernas', 5, '12x15, 14x15, 14x13', 'Mancuernas'),
        createExerciseLog('day1-ex6', 'Extensión tríceps polea barra', 6, '35x12, 37.5x11, 37.5x10'),
        createExerciseLog('day1-ex7', 'Extensión tras nuca cuerda', 7, '22.5x14, 22.5x12'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log012', routineId: 'routine3', dayId: 'day2', date: '2026-03-02',
      exercises: [
        createExerciseLog('day2-ex1', 'Dominadas prono', 1, '0x8, 0x7, 0x6, 0x6'),
        createExerciseLog('day2-ex2', 'Remo con barra o T-bar', 2, '65x8, 70x8, 75x8, 75x7', 'Peso + barra'),
        createExerciseLog('day2-ex3', 'Pullover polea alta', 3, '31.5x12, 31.5x12, 34.5x12'),
        createExerciseLog('day2-ex4', 'Face pull pesado', 4, '31.5x12, 34.5x15, 36x14'),
        createExerciseLog('day2-ex5', 'Curl barra recta o EZ', 5, '30x10, 35x10, 35x9'),
        createExerciseLog('day2-ex6', 'Curl martillo alterno', 6, '14x12, 16x12'),
      ],
      cardio: { rawInput: 'Cinta: 14mins, 12kmh' }, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log013', routineId: 'routine3', dayId: 'day3', date: '2026-03-03',
      exercises: [
        createExerciseLog('day3-ex1', 'Sentadilla libre o hack', 1, '25x8, 30x8, 35x8, 35x7'),
        createExerciseLog('day3-ex2', 'Prensa inclinada', 2, '90x10, 110x10, 120x10'),
        createExerciseLog('day3-ex3', 'Extensión cuádriceps unilateral', 3, '25x12, 27.5x12, 30x12'),
        createExerciseLog('day3-ex4', 'Gemelos de pie', 4, '0x20, 0x20, 0x20, 0x20'),
        createExerciseLog('day3-ex5', 'Elevación piernas tumbado', 5, '0x15, 0x15, -'),
        createExerciseLog('day3-ex6', 'Plancha lateral', 6, '0x40, -'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log014', routineId: 'routine3', dayId: 'day4', date: '2026-03-05',
      exercises: [
        createExerciseLog('day4-ex1', 'Press pecho en máquina convergente', 1, '40x12, 50x12, 52.5x10', 'Kg por brazo'),
        createExerciseLog('day4-ex2', 'Remo hammer o pecho apoyado', 2, '50x12, 52.5x12, 55x10', 'Kg por brazo'),
        createExerciseLog('day4-ex3', 'Arnold press', 3, '14x10, 16x10, 16x8'),
        createExerciseLog('day4-ex4', 'Pájaros en peck-deck', 4, '20x15, 22.5x12, 22.5x10'),
        createExerciseLog('day4-ex5', 'Curl inclinado mancuernas', 5, '14x12, 16x11'),
        createExerciseLog('day4-ex6', 'Fondos máquina o polea tríceps', 6, '120x12, 130x12'),
      ],
      cardio: { rawInput: 'Cinta: 10m 10.5p 5.5kmh, 10m 12kmh' }, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log015', routineId: 'routine3', dayId: 'day5', date: '2026-03-06',
      exercises: [
        createExerciseLog('day5-ex1', 'Peso muerto rumano', 1, '65x8, 70x8, 75x8, 80x8', 'Peso con barra'),
        createExerciseLog('day5-ex2', 'Hip thrust barra', 2, '40x10, 40x10, 40x9'),
        createExerciseLog('day5-ex3', 'Curl femoral sentado o tumbado', 3, '35x12, 37.5x11, 37.5x10'),
        createExerciseLog('day5-ex4', 'Zancadas con mancuernas', 4, '10x12, 10x11', 'Peso por mancuerna'),
        createExerciseLog('day5-ex5', 'Gemelos sentado', 5, '20x20, 20x19, 20x18'),
        createExerciseLog('day5-ex6', 'Crunch oblicuo', 6, '0x15, 0x15, 0x15'),
        createExerciseLog('day5-ex7', 'Crunch encogimiento', 7, '0x15, 0x15, 0x15', 'Encogimiento'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log016', routineId: 'routine3', dayId: 'day1', date: '2026-03-08',
      exercises: [
        createExerciseLog('day1-ex1', 'Press banca plano con barra', 1, '65x8, 70x7, 70x6'),
        createExerciseLog('day1-ex2', 'Aperturas declinadas en polea', 2, '15x15, 15x14'),
        createExerciseLog('day1-ex3', 'Press inclinado mancuernas', 3, '32x10, 32x9, 32x6'),
        createExerciseLog('day1-ex4', 'Press militar barra o mancuernas', 4, '22x10, 22x8, 22x8'),
        createExerciseLog('day1-ex5', 'Elevaciones laterales mancuernas', 5, '14x15, 14x14, 14x15', 'Mancuernas'),
        createExerciseLog('day1-ex6', 'Extensión tríceps polea barra', 6, '35x12, 35x12, 37.5x9'),
        createExerciseLog('day1-ex7', 'Extensión tras nuca cuerda', 7, '22.5x11, 22.5x10'),
      ],
      cardio: { rawInput: 'Cinta: 22mins 11.8/12kmh' }, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log017', routineId: 'routine3', dayId: 'day2', date: '2026-03-09',
      exercises: [
        createExerciseLog('day2-ex1', 'Dominadas prono', 1, '0x8, 0x8, 0x7, 0x6'),
        createExerciseLog('day2-ex2', 'Remo con barra o T-bar', 2, '70x8, 70x8, 75x7, 75x6', 'Peso + barra'),
        createExerciseLog('day2-ex3', 'Pullover polea alta', 3, '32.5x12, 35x12, 37.5x10'),
        createExerciseLog('day2-ex4', 'Face pull pesado', 4, '32.5x15, 35x15, 37.5x15'),
        createExerciseLog('day2-ex5', 'Curl barra recta o EZ', 5, '30x10, 35x10, 35x10'),
        createExerciseLog('day2-ex6', 'Curl martillo alterno', 6, '16x12, 16x12'),
      ],
      cardio: { rawInput: 'Cinta: 15mins 10.5p 5.5kmh' }, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log018', routineId: 'routine3', dayId: 'day3', date: '2026-03-11',
      exercises: [
        createExerciseLog('day3-ex1', 'Sentadilla libre o hack', 1, '25x8, 30x8, 35x8, 35x8'),
        createExerciseLog('day3-ex2', 'Prensa inclinada', 2, '100x10, 120x10, 130x10'),
        createExerciseLog('day3-ex3', 'Extensión cuádriceps unilateral', 3, '27.5x12, 27.5x12, 30x12'),
        createExerciseLog('day3-ex4', 'Gemelos de pie', 4, '0x20, 0x20, 0x20, 0x20'),
        createExerciseLog('day3-ex5', 'Elevación piernas tumbado', 5, '0x15, 0x15, 0x15'),
        createExerciseLog('day3-ex6', 'Plancha lateral', 6, '0x40, 0x30, 0x30'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log019', routineId: 'routine3', dayId: 'day4', date: '2026-03-12',
      exercises: [
        createExerciseLog('day4-ex1', 'Press pecho en máquina convergente', 1, '45x12, 50x12, 52.5x12', 'Kg por brazo'),
        createExerciseLog('day4-ex2', 'Remo hammer o pecho apoyado', 2, '50x12, 52.5x12, 52.5x10', 'Kg por brazo'),
        createExerciseLog('day4-ex3', 'Arnold press', 3, '14x10, 16x10, 16x9'),
        createExerciseLog('day4-ex4', 'Pájaros en peck-deck', 4, '20x15, 22.5x13, 22.5x11'),
        createExerciseLog('day4-ex5', 'Curl inclinado mancuernas', 5, '14x12, 16x12'),
        createExerciseLog('day4-ex6', 'Fondos máquina o polea tríceps', 6, '120x12, 130x12'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log020', routineId: 'routine3', dayId: 'day5', date: '2026-03-13',
      exercises: [
        createExerciseLog('day5-ex1', 'Peso muerto rumano', 1, '70x8, 75x8, 80x8, 85x7', 'Peso con barra'),
        createExerciseLog('day5-ex2', 'Hip thrust barra', 2, '40x10, 40x10, 42.5x8'),
        createExerciseLog('day5-ex3', 'Curl femoral sentado o tumbado', 3, '35x12, 37.5x12, 37.5x10'),
        createExerciseLog('day5-ex4', 'Zancadas con mancuernas', 4, '10x10, -', 'Peso por mancuerna'),
        createExerciseLog('day5-ex5', 'Gemelos sentado', 5, '20x20, 20x18, 20x18'),
        createExerciseLog('day5-ex6', 'Crunch oblicuo', 6, '0x15, 0x15, 0x15'),
        createExerciseLog('day5-ex7', 'Crunch encogimiento', 7, '0x15, 0x15, 0x15', 'Encogimiento'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log021', routineId: 'routine3', dayId: 'day1', date: '2026-03-15',
      exercises: [
        createExerciseLog('day1-ex1', 'Press banca plano con barra', 1, '65x6, 65x7, 65x6'),
        createExerciseLog('day1-ex2', 'Aperturas declinadas en polea', 2, '15x15, 15x14'),
        createExerciseLog('day1-ex3', 'Press inclinado mancuernas', 3, '32x10, 32x8, 32x8'),
        createExerciseLog('day1-ex4', 'Press militar barra o mancuernas', 4, '22x9, 22x8, 22x6'),
        createExerciseLog('day1-ex5', 'Elevaciones laterales mancuernas', 5, '14x15, 15x14, -', 'Mancuernas'),
        createExerciseLog('day1-ex6', 'Extensión tríceps polea barra', 6, '35x12, 35x12, 37.5x10'),
        createExerciseLog('day1-ex7', 'Extensión tras nuca cuerda', 7, '22.5x12, 22.5x14'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log022', routineId: 'routine3', dayId: 'day2', date: '2026-03-16',
      exercises: [
        createExerciseLog('day2-ex1', 'Dominadas prono', 1, '0x8, 0x8, 0x6, 0x6'),
        createExerciseLog('day2-ex2', 'Remo con barra o T-bar', 2, '80x6, 70x8, 75x8, 75x8', 'Peso + barra'),
        createExerciseLog('day2-ex3', 'Pullover polea alta', 3, '35x15, 37.5x12, 37.5x10'),
        createExerciseLog('day2-ex4', 'Face pull pesado', 4, '35x15, 37.5x15, 37.5x15'),
        createExerciseLog('day2-ex5', 'Curl barra recta o EZ', 5, '30x10, 35x10, 35x10'),
        createExerciseLog('day2-ex6', 'Curl martillo alterno', 6, '16x12, 18x9'),
      ],
      cardio: { rawInput: 'Cinta: 20mins 10p 5.5kmh' }, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log023', routineId: 'routine3', dayId: 'day3', date: '2026-03-17',
      exercises: [
        createExerciseLog('day3-ex1', 'Sentadilla libre o hack', 1, '25x8, 30x8, 35x8, 40x7'),
        createExerciseLog('day3-ex2', 'Prensa inclinada', 2, '120x10, 130x10, 140x10'),
        createExerciseLog('day3-ex3', 'Extensión cuádriceps unilateral', 3, '27.5x12, 30x11, 30x11'),
        createExerciseLog('day3-ex4', 'Gemelos de pie', 4, '0x20, 0x20, 0x20, 0x20'),
        createExerciseLog('day3-ex5', 'Elevación piernas tumbado', 5, '0x15, 0x15, 0x15'),
        createExerciseLog('day3-ex6', 'Plancha lateral', 6, '0x45, 0x40, 0x30'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log024', routineId: 'routine3', dayId: 'day4', date: '2026-03-19',
      exercises: [
        createExerciseLog('day4-ex1', 'Press pecho en máquina convergente', 1, '45x12, 45x11, 45x9', 'Kg por brazo, menos incl.'),
        createExerciseLog('day4-ex2', 'Remo hammer o pecho apoyado', 2, '50x12, 52.5x11, 52.5x9', 'Kg por brazo'),
        createExerciseLog('day4-ex3', 'Arnold press', 3, '16x10, 16x9, 16x7'),
        createExerciseLog('day4-ex4', 'Pájaros en peck-deck', 4, '20x15, 22.5x13, 22.5x9'),
        createExerciseLog('day4-ex5', 'Curl inclinado mancuernas', 5, '16x12, 18x10'),
        createExerciseLog('day4-ex6', 'Fondos máquina o polea tríceps', 6, '130x12, 130x12'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log025', routineId: 'routine3', dayId: 'day5', date: '2026-03-21',
      exercises: [
        createExerciseLog('day5-ex1', 'Peso muerto rumano', 1, '70x8, 80x8, 80x8, 85x7', 'Peso con barra'),
        createExerciseLog('day5-ex2', 'Hip thrust barra', 2, '40x10, 40x10, 40x9'),
        createExerciseLog('day5-ex3', 'Curl femoral sentado o tumbado', 3, '35x12, 37.5x12, 37.5x12'),
        createExerciseLog('day5-ex4', 'Zancadas con mancuernas', 4, '10x12, 10x11', 'Peso por mancuerna'),
        createExerciseLog('day5-ex5', 'Gemelos sentado', 5, '20x20, 20x17, 20x15'),
        createExerciseLog('day5-ex6', 'Crunch oblicuo', 6, '0x15, 0x15, -'),
        createExerciseLog('day5-ex7', 'Crunch encogimiento', 7, '0x15, 0x15, -', 'Encogimiento'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log026', routineId: 'routine3', dayId: 'day1', date: '2026-03-22',
      exercises: [
        createExerciseLog('day1-ex1', 'Press banca plano con barra', 1, '60x8, 65x7, 65x6'),
        createExerciseLog('day1-ex2', 'Aperturas declinadas en polea', 2, '15x15, 15x15'),
        createExerciseLog('day1-ex3', 'Press inclinado mancuernas', 3, '30x9, 30x10, 30x9'),
        createExerciseLog('day1-ex4', 'Press militar barra o mancuernas', 4, '22x8, 22x8, 22x8'),
        createExerciseLog('day1-ex5', 'Elevaciones laterales mancuernas', 5, '14x15, 15x15, 15x14', 'Mancuernas'),
        createExerciseLog('day1-ex6', 'Extensión tríceps polea barra', 6, '35x12, 35x12, 37.5x12'),
        createExerciseLog('day1-ex7', 'Extensión tras nuca cuerda', 7, '22.5x15, 22.5x15'),
      ],
      cardio: { rawInput: 'Cinta: 16mins, 11.8kmh' }, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log027', routineId: 'routine3', dayId: 'day2', date: '2026-03-23',
      exercises: [
        createExerciseLog('day2-ex1', 'Dominadas prono', 1, '0x8, 0x8, 0x7, 0x7'),
        createExerciseLog('day2-ex2', 'Remo con barra o T-bar', 2, '70x8, 75x8, 75x8, 80x6', 'Peso + barra'),
        createExerciseLog('day2-ex3', 'Pullover polea alta', 3, '35x12, 37.5x12, 37.5x10'),
        createExerciseLog('day2-ex4', 'Face pull pesado', 4, '35x15, 37.5x15, 40x13'),
        createExerciseLog('day2-ex5', 'Curl barra recta o EZ', 5, '35x10, 35x10, 35x10'),
        createExerciseLog('day2-ex6', 'Curl martillo alterno', 6, '16x12, 18x10'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log028', routineId: 'routine3', dayId: 'day3', date: '2026-03-24',
      exercises: [
        createExerciseLog('day3-ex1', 'Sentadilla libre o hack', 1, '30x8, 35x8, 35x8, 40x6'),
        createExerciseLog('day3-ex2', 'Prensa inclinada', 2, '80x12, 100x10, 120x10', 'Technogym'),
        createExerciseLog('day3-ex3', 'Extensión cuádriceps unilateral', 3, '25x12, 30x12, 32.5x11', 'Technogym'),
        createExerciseLog('day3-ex4', 'Gemelos de pie', 4, '0x20, 10x20, 15x18, 15x18'),
        createExerciseLog('day3-ex5', 'Elevación piernas tumbado', 5, '-'),
        createExerciseLog('day3-ex6', 'Plancha lateral', 6, '-'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log029', routineId: 'routine3', dayId: 'day4', date: '2026-03-26',
      exercises: [
        createExerciseLog('day4-ex1', 'Press pecho en máquina convergente', 1, '45x12, 47.5x12, 50x10', 'Kg por brazo'),
        createExerciseLog('day4-ex2', 'Remo hammer o pecho apoyado', 2, '50x12, 52.5x12, 55x11', 'Kg por brazo'),
        createExerciseLog('day4-ex3', 'Arnold press', 3, '16x10, 16x9, 16x8'),
        createExerciseLog('day4-ex4', 'Pájaros en peck-deck', 4, '20x15, 22.5x12, 22.5x11'),
        createExerciseLog('day4-ex5', 'Curl inclinado mancuernas', 5, '16x12, 18x10'),
        createExerciseLog('day4-ex6', 'Fondos máquina o polea tríceps', 6, '130x12, 140x10'),
      ],
      cardio: { rawInput: 'Cinta: 13mins, 11.8/11kmh' }, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log030', routineId: 'routine3', dayId: 'day5', date: '2026-03-27',
      exercises: [
        createExerciseLog('day5-ex1', 'Peso muerto rumano', 1, '70x8, 80x8, 85x8, 90x8', 'Peso con barra'),
        createExerciseLog('day5-ex2', 'Hip thrust barra', 2, '35x10, 37.5x10, 37.5x10'),
        createExerciseLog('day5-ex3', 'Curl femoral sentado o tumbado', 3, '35x12, 37.5x12, 37.5x10'),
        createExerciseLog('day5-ex4', 'Zancadas con mancuernas', 4, '10x12, 10x11', 'Peso por mancuerna'),
        createExerciseLog('day5-ex5', 'Gemelos sentado', 5, '-'),
        createExerciseLog('day5-ex6', 'Crunch oblicuo', 6, '0x15, 0x15, 0x15'),
        createExerciseLog('day5-ex7', 'Crunch encogimiento', 7, '0x15, 0x15, 0x15', 'Encogimiento'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log031', routineId: 'routine3', dayId: 'day1', date: '2026-03-29',
      exercises: [
        createExerciseLog('day1-ex1', 'Press banca plano con barra', 1, '75x8, 80x8, 85x6', 'Peso + barra'),
        createExerciseLog('day1-ex2', 'Aperturas declinadas en polea', 2, '15x15, 16.5x15'),
        createExerciseLog('day1-ex3', 'Press inclinado mancuernas', 3, '30x9, 30x8, 30x7'),
        createExerciseLog('day1-ex4', 'Press militar barra o mancuernas', 4, '22x8, 22x8, 22x8'),
        createExerciseLog('day1-ex5', 'Elevaciones laterales mancuernas', 5, '14x15, 14x15, 14x14', 'Mancuernas'),
        createExerciseLog('day1-ex6', 'Extensión tríceps polea barra', 6, '35x12, 37.5x12, 37.5x12'),
        createExerciseLog('day1-ex7', 'Extensión tras nuca cuerda', 7, '22.5x15, 22.5x12'),
      ],
      cardio: { rawInput: 'Cinta: 25mins 10p 5kmh' }, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log032', routineId: 'routine3', dayId: 'day2', date: '2026-03-30',
      exercises: [
        createExerciseLog('day2-ex1', 'Dominadas prono', 1, '0x8, 0x8, 0x8, 0x6'),
        createExerciseLog('day2-ex2', 'Remo con barra o T-bar', 2, '70x8, 75x8, 75x8, 80x7', 'Peso + barra'),
        createExerciseLog('day2-ex3', 'Pullover polea alta', 3, '34.5x12, 37.5x11, 37.5x11'),
        createExerciseLog('day2-ex4', 'Face pull pesado', 4, '34.5x15, 34.5x15, 37.5x14'),
        createExerciseLog('day2-ex5', 'Curl barra recta o EZ', 5, '35x10, 35x10, 35x10'),
        createExerciseLog('day2-ex6', 'Curl martillo alterno', 6, '16x12, 18x10'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    {
      id: 'log033', routineId: 'routine3', dayId: 'day3', date: '2026-03-31',
      exercises: [
        createExerciseLog('day3-ex1', 'Sentadilla libre o hack', 1, '30x8, 35x8, 35x8, 35x7'),
        createExerciseLog('day3-ex2', 'Prensa inclinada', 2, '130x10, 130x10, 130x9'),
        createExerciseLog('day3-ex3', 'Extensión cuádriceps unilateral', 3, '20x12, 25x12, 27.5x11', 'Hammer'),
        createExerciseLog('day3-ex4', 'Gemelos de pie', 4, '10x20, 15x20, 15x20, 20x20'),
        createExerciseLog('day3-ex5', 'Elevación piernas tumbado', 5, '0x15, 0x15, 0x15'),
        createExerciseLog('day3-ex6', 'Plancha lateral', 6, '0x45, 0x35, 0x35'),
      ],
      cardio: null, createdAt: Date.now(), updatedAt: Date.now(),
    },
    ...routine2HistoryData.map((item) => (
      createLogFromDayInputs(
        item.id,
        'routine2',
        item.dayId,
        item.date,
        item.sets,
        item.cardio || null
      )
    )),
  ];
  const [logs, setLogs] = useState(initialLogs);
  const [exerciseSets, setExerciseSets] = useState({});
  const [finishedExercises, setFinishedExercises] = useState(new Set());
  const [cardioInput, setCardioInput] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(null);
  const [notesText, setNotesText] = useState('');
  const [exerciseNotes, setExerciseNotes] = useState({});
  const [toast, setToast] = useState(null);
  const [logToDelete, setLogToDelete] = useState(null);
  const [showDeleteRoutineModal, setShowDeleteRoutineModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [previousScreen, setPreviousScreen] = useState('home');
  const [detailBackScreen, setDetailBackScreen] = useState('home');
  const [expandedWeekBlocks, setExpandedWeekBlocks] = useState({});

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(theme.colors.background);
      StatusBar.setTranslucent(false);
    }
  }, []);

  const actualActiveRoutine = routines.find((r) => r.isActive) || routines[0];
  const actualActiveRoutineId = actualActiveRoutine?.id;
  const activeRoutine = routines.find(r => r.id === activeRoutineId);
  const hasNoRoutines = routines.length === 0;
  const activeDays = activeRoutine?.days || [];
  const routineLogs = logs.filter(log => log.routineId === activeRoutineId);

  const getDay = (dayId) => {
    for (const routine of routines) {
      const day = routine.days.find(d => d.id === dayId);
      if (day) return day;
    }
    return null;
  };

  const getLastExerciseResult = (dayId, exerciseId) => {
    const logsForDay = logs.filter(log => log.dayId === dayId).sort((a, b) => new Date(b.date) - new Date(a.date));
    if (logsForDay.length === 0) return null;
    const lastLog = logsForDay[0];
    const exercise = lastLog.exercises.find(ex => ex.id === exerciseId);
    return exercise?.rawInput || null;
  };

  const getWeekNumber = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00Z');
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  const getDayName = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00Z');
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[date.getUTCDay()];
  };

  const formatDateWithDay = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    return `${getDayName(dateStr)}, ${day}-${month}-${year}`;
  };

  const buildWeekDataForLogs = (sourceLogs) => {
    const sortedByDateAsc = [...sourceLogs].sort((a, b) => new Date(a.date) - new Date(b.date));
    const groupedByBlock = {};
    const logToBlockMap = {};

    let block = 1;
    let currentWeekLogs = [];
    let seenDays = new Set();

    sortedByDateAsc.forEach((log) => {
      const day = getDay(log.dayId);
      const dayNumber = day?.dayNumber;

      // Si se repite un día en la semana en curso, cerramos y abrimos nueva semana.
      if (dayNumber && seenDays.has(dayNumber) && currentWeekLogs.length > 0) {
        groupedByBlock[block] = currentWeekLogs;
        currentWeekLogs.forEach((item) => {
          logToBlockMap[item.id] = block;
        });
        block += 1;
        currentWeekLogs = [];
        seenDays = new Set();
      }

      currentWeekLogs.push(log);
      if (dayNumber) seenDays.add(dayNumber);

      if (seenDays.size === 5) {
        groupedByBlock[block] = currentWeekLogs;
        currentWeekLogs.forEach((item) => {
          logToBlockMap[item.id] = block;
        });
        block += 1;
        currentWeekLogs = [];
        seenDays = new Set();
      }
    });

    if (currentWeekLogs.length > 0) {
      groupedByBlock[block] = currentWeekLogs;
      currentWeekLogs.forEach((item) => {
        logToBlockMap[item.id] = block;
      });
    }

    return { groupedByBlock, logToBlockMap };
  };

  const getWeekAlternatingColor = (blockNumber) => {
    return blockNumber % 2 === 0 ? 'rgba(103, 181, 140, 0.2)' : 'rgba(219, 176, 74, 0.2)';
  };

  const handleAddSet = (exerciseId, set) => {
    setExerciseSets((prev) => ({
      ...prev,
      [exerciseId]: [...(prev[exerciseId] || []), set],
    }));
  };

  const handleRemoveLastSet = (exerciseId) => {
    setExerciseSets((prev) => ({
      ...prev,
      [exerciseId]: (prev[exerciseId] || []).slice(0, -1),
    }));
  };

  const handleFinishExercise = (exerciseId, currentSetCount, targetSetCount) => {
    const remainingSets = Math.max(0, targetSetCount - currentSetCount);
    for (let i = 0; i < remainingSets; i++) {
      handleAddSet(exerciseId, { weight: '-', reps: '-' });
    }
    setFinishedExercises((prev) => new Set([...prev, exerciseId]));
  };

  const getNormalizedDayType = (dayTitle) => {
    const normalized = (dayTitle || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    if (!normalized) return '';
    if (normalized.includes('push')) return 'push';
    if (normalized.includes('pull')) return 'pull';
    if (normalized.includes('pierna') || normalized.includes('leg')) return 'pierna';

    const token = normalized.split(/\s|-|\//).find(Boolean);
    return token || normalized;
  };

  const parseExerciseLine = (line, routineId, dayNumber, order) => {
    const parsed = line.match(/^(.+?)\s*\[(\d+)\s*x\s*([^\]]+)\]\s*$/i);
    if (parsed) {
      return {
        id: `${routineId}-d${dayNumber}-ex${order}`,
        name: parsed[1].trim(),
        order,
        targetSets: parseInt(parsed[2], 10),
        targetReps: parsed[3].trim(),
      };
    }

    return {
      id: `${routineId}-d${dayNumber}-ex${order}`,
      name: line,
      order,
      targetSets: 3,
      targetReps: '10-12',
    };
  };

  const buildDaysFromForm = (routineId) => {
    if (!newRoutineDays.length) throw new Error('Añade al menos un día');

    const typeColorMap = {};
    const days = [];

    newRoutineDays.forEach((entry, index) => {
      const dayTitle = (entry.title || '').trim();
      if (!dayTitle) throw new Error(`Falta el título del Día ${index + 1}`);

      const exerciseLines = (entry.exercisesText || '')
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      if (!exerciseLines.length) throw new Error(`Faltan ejercicios en el Día ${index + 1}`);

      const dayType = getNormalizedDayType(dayTitle) || `day-${index + 1}`;
      if (!typeColorMap[dayType]) {
        const colorIndex = Object.keys(typeColorMap).length % DAY_COLOR_SEQUENCE.length;
        typeColorMap[dayType] = DAY_COLOR_SEQUENCE[colorIndex];
      }
      const colorKey = typeColorMap[dayType];

      const dayNumber = index + 1;
      const exercises = exerciseLines.map((line, exerciseIndex) => (
        parseExerciseLine(line, routineId, dayNumber, exerciseIndex + 1)
      ));

      days.push({
        id: `${routineId}-day${dayNumber}`,
        dayNumber,
        name: `Día ${dayNumber} - ${dayTitle}`,
        emoji: DAY_COLOR_EMOJI[colorKey] || '⚪',
        exercises,
      });
    });

    return days;
  };

  const handleUpdateNewRoutineDay = (dayId, key, value) => {
    setNewRoutineDays((prev) => prev.map((item) => (
      item.id === dayId ? { ...item, [key]: value } : item
    )));
  };

  const handleAddNewRoutineDay = () => {
    if (newRoutineDays.length >= 7) {
      setToast('⚠️ Máximo 7 días por rutina');
      setTimeout(() => setToast(null), 1800);
      return;
    }
    setNewRoutineDays((prev) => ([
      ...prev,
      { id: generateId(), title: '', exercisesText: '' },
    ]));
  };

  const handleRemoveNewRoutineDay = () => {
    if (newRoutineDays.length <= 1) return;
    setNewRoutineDays((prev) => prev.slice(0, -1));
  };

  const resetNewRoutineForm = () => {
    setNewRoutineDays([{ id: generateId(), title: '', exercisesText: '' }]);
  };

  const handleCreateNewRoutine = () => {
    try {
      const routineId = `routine-${Date.now()}`;
      const days = buildDaysFromForm(routineId);
      const newRoutine = {
        id: routineId,
        name: `Rutina ${routines.length + 1}`,
        description: `Rutina personalizada (${days.length} días)`,
        isActive: true,
        isCustom: true,
        days,
      };

      const updatedRoutines = routines.map((routine) => ({ ...routine, isActive: false }));
      updatedRoutines.push(newRoutine);

      setRoutines(updatedRoutines);
      setActiveRoutineId(newRoutine.id);
  resetNewRoutineForm();
      setScreen('home');
      setToast('✅ Nueva rutina creada y activada');
      setTimeout(() => setToast(null), 1800);
    } catch (error) {
      setToast(`❌ ${error.message}`);
      setTimeout(() => setToast(null), 2600);
    }
  };

  const handleDeleteCurrentRoutine = () => {
    if (!activeRoutine || activeRoutineId !== actualActiveRoutineId) return;
    if (routineLogs.length > 0 || !activeRoutine.isCustom || routines.length <= 1) return;

    const activeIndex = routines.findIndex((routine) => routine.id === activeRoutineId);
    if (activeIndex <= 0) return;

    const remaining = routines.filter((routine) => routine.id !== activeRoutineId);
    const newActiveIndex = Math.max(0, activeIndex - 1);
    const reactivatedId = remaining[newActiveIndex]?.id || remaining[0]?.id;
    const normalized = remaining.map((routine) => ({
      ...routine,
      isActive: routine.id === reactivatedId,
    }));

    setRoutines(normalized);
    setActiveRoutineId(reactivatedId);
    setLogs((prev) => prev.filter((log) => log.routineId !== activeRoutineId));
  };

  const canDeleteCurrentRoutine = (
    activeRoutineId === actualActiveRoutineId &&
    !!activeRoutine?.isCustom &&
    routineLogs.length === 0 &&
    routines.length > 1
  );

  const canAddNewRoutineDay = newRoutineDays.every((day) => (
    day.title.trim().length > 0 && day.exercisesText.trim().length > 0
  ));

  const getLogTimestamp = (workoutLog) => {
    if (!workoutLog) return 0;
    if (typeof workoutLog.createdAt === 'number') return workoutLog.createdAt;
    if (workoutLog.date) return new Date(`${workoutLog.date}T00:00:00Z`).getTime();
    return 0;
  };

  const getWorkoutVolumeScore = (workoutLog) => {
    if (!workoutLog?.exercises?.length) return 0;

    return workoutLog.exercises.reduce((total, exercise) => {
      const parsedSets = Array.isArray(exercise?.parsedSets) && exercise.parsedSets.length > 0
        ? exercise.parsedSets
        : parseSeriesString(exercise?.rawInput || '');

      const exerciseScore = parsedSets.reduce((sum, set) => {
        const weight = Number(set?.weight);
        const reps = Number(set?.reps);
        if (!Number.isFinite(weight) || !Number.isFinite(reps)) return sum;
        if (weight <= 0 || reps <= 0) return sum;
        return sum + (weight * reps);
      }, 0);

      return total + exerciseScore;
    }, 0);
  };

  const getExerciseVolumeScore = (exerciseLog) => {
    if (!exerciseLog) return 0;
    const parsedSets = Array.isArray(exerciseLog?.parsedSets) && exerciseLog.parsedSets.length > 0
      ? exerciseLog.parsedSets
      : parseSeriesString(exerciseLog?.rawInput || '');

    return parsedSets.reduce((sum, set) => {
      const weight = Number(set?.weight);
      const reps = Number(set?.reps);
      if (!Number.isFinite(weight) || !Number.isFinite(reps)) return sum;
      if (weight <= 0 || reps <= 0) return sum;
      return sum + (weight * reps);
    }, 0);
  };

  const getWorkoutRepsScore = (workoutLog) => {
    if (!workoutLog?.exercises?.length) return 0;

    return workoutLog.exercises.reduce((total, exercise) => {
      const parsedSets = Array.isArray(exercise?.parsedSets) && exercise.parsedSets.length > 0
        ? exercise.parsedSets
        : parseSeriesString(exercise?.rawInput || '');

      const repsScore = parsedSets.reduce((sum, set) => {
        const reps = Number(set?.reps);
        if (!Number.isFinite(reps) || reps <= 0) return sum;
        return sum + reps;
      }, 0);

      return total + repsScore;
    }, 0);
  };

  const getExerciseRepsScore = (exerciseLog) => {
    if (!exerciseLog) return 0;
    const parsedSets = Array.isArray(exerciseLog?.parsedSets) && exerciseLog.parsedSets.length > 0
      ? exerciseLog.parsedSets
      : parseSeriesString(exerciseLog?.rawInput || '');

    return parsedSets.reduce((sum, set) => {
      const reps = Number(set?.reps);
      if (!Number.isFinite(reps) || reps <= 0) return sum;
      return sum + reps;
    }, 0);
  };

  const buildImprovementFromScores = (currentScore, previousScore, currentRepsScore = 0, previousRepsScore = 0) => {
    if (!Number.isFinite(currentScore) || !Number.isFinite(previousScore)) return null;

    if (previousScore <= 0 && currentScore > 0) {
      return {
        isImproved: true,
        percent: 30,
      };
    }

    if (previousScore <= 0 && currentScore <= 0) {
      if (!Number.isFinite(currentRepsScore) || !Number.isFinite(previousRepsScore)) return null;

      if (previousRepsScore <= 0 && currentRepsScore > 0) {
        return {
          isImproved: true,
          percent: 30,
        };
      }

      if (previousRepsScore <= 0 && currentRepsScore <= 0) return null;

      const repsDeltaPct = ((currentRepsScore - previousRepsScore) / previousRepsScore) * 100;
      return {
        isImproved: repsDeltaPct > 0,
        percent: Math.abs(repsDeltaPct),
      };
    }

    const deltaPct = ((currentScore - previousScore) / previousScore) * 100;
    return {
      isImproved: deltaPct > 0,
      percent: Math.abs(deltaPct),
    };
  };

  const getPreviousFilledLogForSameDay = (currentLog) => {
    const currentTs = getLogTimestamp(currentLog);
    if (!currentLog?.dayId || currentTs <= 0) return null;

    const previousLogs = routineLogs
      .filter((log) => log.dayId === currentLog.dayId && log.id !== currentLog.id)
      .filter((log) => {
        const logTs = getLogTimestamp(log);
        return logTs > 0 && logTs < currentTs;
      })
      .sort((a, b) => getLogTimestamp(b) - getLogTimestamp(a));

    return previousLogs[0] || null;
  };

  const getLogImprovement = (currentLog) => {
    const currentScore = getWorkoutVolumeScore(currentLog);
    const previousLog = getPreviousFilledLogForSameDay(currentLog);
    if (!previousLog) return null;

    const previousScore = getWorkoutVolumeScore(previousLog);
    const currentRepsScore = getWorkoutRepsScore(currentLog);
    const previousRepsScore = getWorkoutRepsScore(previousLog);
    return buildImprovementFromScores(currentScore, previousScore, currentRepsScore, previousRepsScore);
  };

  const getWeekScores = (weekLogs, options = {}) => {
    const { restrictToDayIds = null, applyMissingPenalty = true } = options;
    if (!Array.isArray(weekLogs) || weekLogs.length === 0) {
      return { volume: 0, reps: 0 };
    }

    const latestByDayId = {};
    [...weekLogs]
      .sort((a, b) => getLogTimestamp(b) - getLogTimestamp(a))
      .forEach((log) => {
        if (!log?.dayId) return;
        if (!latestByDayId[log.dayId]) {
          latestByDayId[log.dayId] = log;
        }
      });

    const selectedDayIds = restrictToDayIds ? new Set(restrictToDayIds) : null;
    const selectedLogs = Object.values(latestByDayId).filter((log) => (
      !selectedDayIds || selectedDayIds.has(log.dayId)
    ));

    const rawVolume = selectedLogs.reduce((sum, log) => sum + getWorkoutVolumeScore(log), 0);
    const rawReps = selectedLogs.reduce((sum, log) => sum + getWorkoutRepsScore(log), 0);

    if (!applyMissingPenalty) {
      return { volume: rawVolume, reps: rawReps };
    }

    const expectedCount = selectedDayIds
      ? selectedDayIds.size
      : Math.max(1, activeDays.length || 5);
    const missingDays = Math.max(0, expectedCount - selectedLogs.length);
    const penaltyFactor = Math.max(0, 1 - (missingDays * 0.2));

    return {
      volume: rawVolume * penaltyFactor,
      reps: rawReps * penaltyFactor,
    };
  };

  const getWeekImprovement = (groupedByBlock, blockNumber, latestBlockNumber) => {
    const previousBlockNumber = blockNumber - 1;
    const currentWeekLogs = groupedByBlock[blockNumber] || [];
    const previousWeekLogs = groupedByBlock[previousBlockNumber] || [];

    if (!currentWeekLogs.length || !previousWeekLogs.length) return null;

    if (blockNumber === latestBlockNumber) {
      const completedDayIds = new Set(
        currentWeekLogs
          .map((log) => log?.dayId)
          .filter(Boolean)
      );

      if (completedDayIds.size === 0) return null;

      const currentScores = getWeekScores(currentWeekLogs, {
        restrictToDayIds: completedDayIds,
        applyMissingPenalty: false,
      });
      const previousScores = getWeekScores(previousWeekLogs, {
        restrictToDayIds: completedDayIds,
        applyMissingPenalty: true,
      });

      return buildImprovementFromScores(
        currentScores.volume,
        previousScores.volume,
        currentScores.reps,
        previousScores.reps,
      );
    }

    const currentScores = getWeekScores(currentWeekLogs, { applyMissingPenalty: true });
    const previousScores = getWeekScores(previousWeekLogs, { applyMissingPenalty: true });

    return buildImprovementFromScores(
      currentScores.volume,
      previousScores.volume,
      currentScores.reps,
      previousScores.reps,
    );
  };

  const toggleWeekBlock = (blockId) => {
    setExpandedWeekBlocks((prev) => ({
      ...prev,
      [blockId]: !prev[blockId],
    }));
  };

  const restoreUiAfterDataLoad = () => {
    setScreen('home');
    setShowRoutineSelector(false);
    setShowDaySelector(false);
    setSelectedDay(null);
    setSelectedLog(null);
    setSelectedRoutineForDetails(null);
    setLogToDelete(null);
    setShowDeleteRoutineModal(false);
    setShowClearDataModal(false);
    setExpandedWeekBlocks({});
  };

  const applyImportedData = (payload) => {
    const importedRoutines = Array.isArray(payload?.routines) ? payload.routines : null;
    const importedLogs = Array.isArray(payload?.logs) ? payload.logs : null;

    if (!importedRoutines || !importedLogs) {
      throw new Error('El fichero no tiene el formato esperado');
    }

    setRoutines(importedRoutines);
    setLogs(importedLogs);

    const importedActive = importedRoutines.find((routine) => routine.isActive)?.id;
    const fallback = importedRoutines[0]?.id || null;
    setActiveRoutineId(importedActive || fallback);
    restoreUiAfterDataLoad();
  };

  const handleExportData = async () => {
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        routines,
        logs,
      };

      const fileName = `gymtrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const json = JSON.stringify(payload, null, 2);

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        Alert.alert('No disponible', 'En Snack, exporta desde la vista Web para descargar el backup.');
        return;
      }

      setToast('✅ Datos exportados correctamente');
      setTimeout(() => setToast(null), 1800);
    } catch (error) {
      setToast(`❌ Error al exportar: ${error.message}`);
      setTimeout(() => setToast(null), 2600);
    }
  };

  const handleImportData = async () => {
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const raw = await new Promise((resolve, reject) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json,text/json';
          input.style.display = 'none';

          input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) {
              reject(new Error('No se seleccionó archivo'));
              return;
            }

            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
            reader.readAsText(file);
          };

          document.body.appendChild(input);
          input.click();
          setTimeout(() => {
            if (document.body.contains(input)) {
              document.body.removeChild(input);
            }
          }, 0);
        });

        const payload = JSON.parse(raw);
        applyImportedData(payload);
      } else {
        Alert.alert('No disponible', 'En Snack, importa desde la vista Web seleccionando un backup JSON.');
        return;
      }

      setToast('✅ Datos importados correctamente');
      setTimeout(() => setToast(null), 1800);
    } catch (error) {
      setToast(`❌ Error al importar: ${error.message}`);
      setTimeout(() => setToast(null), 2600);
    }
  };

  const handleClearAllData = () => {
    setRoutines([]);
    setLogs([]);
    setActiveRoutineId(null);
    restoreUiAfterDataLoad();
    setToast('✅ Datos eliminados');
    setTimeout(() => setToast(null), 1800);
  };

  // ===== NEW ROUTINE SCREEN =====
  if (screen === 'new-routine') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>➕ Nueva rutina</Text>
          <Text style={styles.subtitle}>Define cada día con su título y ejercicios</Text>
        </View>

        <ScrollView style={styles.scrollView}>
          {newRoutineDays.map((day, index) => (
            <View key={day.id} style={styles.newRoutineDayCard}>
              <Text style={styles.newRoutineDayTitle}>Día {index + 1}</Text>
              <TextInput
                style={styles.newRoutineDayInput}
                placeholder="Ej: Push pesado"
                placeholderTextColor={theme.colors.textSecondary}
                value={day.title}
                onChangeText={(value) => handleUpdateNewRoutineDay(day.id, 'title', value)}
              />

              <Text style={styles.newRoutineLabel}>Ejercicios</Text>
              <TextInput
                style={styles.newRoutineExercisesInput}
                placeholder={'Un ejercicio por línea\nOpcional: Press banca [4x6-8]'}
                placeholderTextColor={theme.colors.textSecondary}
                value={day.exercisesText}
                onChangeText={(value) => handleUpdateNewRoutineDay(day.id, 'exercisesText', value)}
                multiline
                textAlignVertical="top"
              />
            </View>
          ))}

          <View style={styles.newRoutineActionRow}>
            {newRoutineDays.length < 7 && (
              <Pressable
                style={[
                  styles.addDayBtn,
                  !canAddNewRoutineDay && styles.addDayBtnDisabled,
                ]}
                onPress={handleAddNewRoutineDay}
                disabled={!canAddNewRoutineDay}
              >
                <Text style={styles.addDayBtnText}>+ Añadir día</Text>
              </Pressable>
            )}

            {newRoutineDays.length > 1 && (
              <Pressable style={styles.removeDayBtn} onPress={handleRemoveNewRoutineDay}>
                <Text style={styles.removeDayBtnText}>- Quitar día</Text>
              </Pressable>
            )}
          </View>

          <Pressable style={styles.saveBtn} onPress={handleCreateNewRoutine}>
            <Text style={styles.saveBtnText}>Crear rutina</Text>
          </Pressable>
        </ScrollView>

        {toast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        <Pressable
          style={styles.backButton}
          onPress={() => {
            setScreen('home');
            resetNewRoutineForm();
          }}
        >
          <Text style={styles.backButtonText}>← Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ===== ROUTINE SELECTOR SCREEN =====
  if (screen === 'home' && showRoutineSelector) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📋 Selecciona una rutina</Text>
          <Text style={styles.subtitle}>Elige la que deseas consultar</Text>
        </View>

        <ScrollView contentContainerStyle={styles.routineListContainer}>
          {routines.map(routine => (
            <Pressable
              key={routine.id}
              style={[
                styles.routineCard,
                routine.id === activeRoutineId && styles.routineCardActive,
              ]}
              onPress={() => {
                setActiveRoutineId(routine.id);
                setShowRoutineSelector(false);
              }}
            >
              <View style={styles.routineCardContent}>
                <Text style={styles.routineCardName}>{routine.name}</Text>
                <Text style={styles.routineCardDesc}>{routine.description}</Text>
                <Text style={styles.routineCardDays}>
                  {routine.days.length} días de entrenamiento
                </Text>
              </View>
              {routine.id === actualActiveRoutineId && (
                <Text style={styles.routineCardActiveIndicator}>✅ Activa</Text>
              )}
            </Pressable>
          ))}

          <Pressable
            style={styles.newRoutineCard}
            onPress={() => {
              setShowRoutineSelector(false);
              setScreen('new-routine');
            }}
          >
            <Text style={styles.newRoutineCardText}>+ Nueva rutina</Text>
          </Pressable>
        </ScrollView>

        <Pressable
          style={styles.backButton}
          onPress={() => setShowRoutineSelector(false)}
        >
          <Text style={styles.backButtonText}>← Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ===== DAY SELECTOR SCREEN =====
  if (screen === 'home' && showDaySelector) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.daySelectorHeaderRow}>
            <Text style={styles.title}>📅 Elige la sesión</Text>
            <View style={styles.routineHighlightBadge}>
              <Text style={styles.routineHighlightText}>{activeRoutine?.name}</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.dayListContainer}>
          {activeDays.map(day => (
            <Pressable
              key={day.id}
              style={styles.daySelectCard}
              onPress={() => {
                setSelectedDay(day);
                setShowDaySelector(false);
                setScreen('workout-log');
                setExerciseSets({});
                setFinishedExercises(new Set());
                setCardioInput('');
                setExerciseNotes({});
              }}
            >
              <View style={styles.daySelectLeading}>
                <Text style={styles.daySelectEmoji}>{day.emoji}</Text>
              </View>
              <View style={styles.daySelectContent}>
                <Text style={styles.daySelectName}>{getDisplayDayName(day.name)}</Text>
              </View>
              <Text style={styles.dayBadge}>Día {day.dayNumber}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable
          style={styles.backButton}
          onPress={() => setShowDaySelector(false)}
        >
          <Text style={styles.backButtonText}>← Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ===== ROUTINE DETAILS SCREEN =====
  if (screen === 'routine-details' && selectedRoutineForDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{selectedRoutineForDetails.name}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.dayListContainer}>
          {selectedRoutineForDetails.days.map(day => (
            <View key={day.id}>
              <View style={[styles.daySelectCard, styles.daySelectCardCompact]}>
                <View style={styles.daySelectLeading}>
                  <Text style={styles.daySelectEmoji}>{day.emoji}</Text>
                </View>
                <View style={styles.daySelectContent}>
                  <Text style={styles.daySelectName}>{getRoutineDayTitle(day.name)}</Text>
                </View>
                <Text style={styles.dayBadge}>Día {day.dayNumber}</Text>
              </View>
              <View style={styles.routineExerciseList}>
                {day.exercises.map(exercise => (
                  <View key={exercise.id} style={styles.routineExerciseItem}>
                    <View style={[styles.routineExerciseDot, { backgroundColor: getDayAccentColor(day) }]} />
                    <Text style={styles.routineExerciseText}>
                      {exercise.name} - {exercise.targetSets}x{exercise.targetReps}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        <Pressable
          style={styles.backButton}
          onPress={() => {
            setSelectedRoutineForDetails(null);
            setShowRoutineSelector(false);
            setScreen('home');
          }}
        >
          <Text style={styles.backButtonText}>← Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ===== DATA SCREEN =====
  if (screen === 'data') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🗂️ Datos</Text>
          <Text style={styles.subtitle}>Importa, exporta o limpia la información de la app</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.dataScreenContent}>
          {!hasNoRoutines && (
            <View style={styles.dataSummaryCard}>
              <Text style={styles.dataSummaryTitle}>Resumen actual</Text>
              <View style={styles.dataSummaryRow}>
                <View style={styles.dataSummaryItem}>
                  <Text style={styles.dataSummaryValue}>{routines.length}</Text>
                  <Text style={styles.dataSummaryLabel}>Rutinas</Text>
                </View>
                <View style={styles.dataSummaryDivider} />
                <View style={styles.dataSummaryItem}>
                  <Text style={styles.dataSummaryValue}>{logs.length}</Text>
                  <Text style={styles.dataSummaryLabel}>Entrenamientos</Text>
                </View>
              </View>
            </View>
          )}

          <Pressable style={styles.dataActionButton} onPress={handleImportData}>
            <Text style={styles.dataActionTitle}>Importar</Text>
            <Text style={styles.dataActionSubtitle}>Cargar un fichero exportado previamente</Text>
          </Pressable>

          {!hasNoRoutines && (
            <>
              <Pressable style={styles.dataActionButton} onPress={handleExportData}>
                <Text style={styles.dataActionTitle}>Exportar</Text>
                <Text style={styles.dataActionSubtitle}>Descargar un fichero con rutinas e histórico</Text>
              </Pressable>

              <Pressable style={[styles.dataActionButton, styles.dataDangerAction]} onPress={() => setShowClearDataModal(true)}>
                <Text style={[styles.dataActionTitle, styles.dataDangerTitle]}>Limpiar</Text>
                <Text style={[styles.dataActionSubtitle, styles.dataDangerSubtitle]}>Eliminar todos los datos de la app</Text>
              </Pressable>
            </>
          )}
        </ScrollView>

        <Modal visible={showClearDataModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>⚠️ Limpiar datos</Text>
              <Text style={styles.deleteModalText}>
                Esta opción borrará todos los datos, ¿estás seguro?
              </Text>
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                  onPress={() => setShowClearDataModal(false)}
                >
                  <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnDanger]}
                  onPress={() => {
                    setShowClearDataModal(false);
                    handleClearAllData();
                  }}
                >
                  <Text style={styles.modalBtnDangerText}>Limpiar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {toast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        <Pressable
          style={styles.backButton}
          onPress={() => setScreen('home')}
        >
          <Text style={styles.backButtonText}>← Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ===== HOME SCREEN =====
  if (screen === 'home') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>🏋️ GymToni</Text>
          </View>
          {!hasNoRoutines && (
            <Text style={styles.subtitle}>
              Tu rutina optimizada
            </Text>
          )}
        </View>

        <View style={styles.mainContent}>
          {/* BOTÓN PRINCIPAL */}
          {activeRoutineId === actualActiveRoutineId && !hasNoRoutines ? (
            <Pressable
              style={({ pressed }) => [
                styles.startButton,
                pressed && styles.startButtonPressed,
              ]}
              onPress={() => setShowDaySelector(true)}
            >
              <View style={styles.startButtonGlow} />
              <View style={styles.startButtonIconWrap}>
                <Text style={styles.startButtonEmoji}>💪</Text>
              </View>
              <Text style={styles.startButtonText}>Empezar entrenamiento</Text>
            </Pressable>
          ) : hasNoRoutines ? (
            <Pressable
              style={({ pressed }) => [
                styles.closedRoutineButton,
                styles.addRoutineButton,
                pressed && styles.addRoutineButtonPressed,
              ]}
              onPress={() => setScreen('new-routine')}
            >
              <Text style={[styles.closedRoutineButtonText, styles.addRoutineButtonText]}>Añade una rutina</Text>
            </Pressable>
          ) : (
            <View style={styles.closedRoutineButton}>
              <Text style={styles.closedRoutineButtonText}>Rutina cerrada</Text>
            </View>
          )}

          {/* HISTORIAL DE LA RUTINA ACTIVA */}
          {!hasNoRoutines && (
            <View style={styles.historialSection}>
              <View style={styles.historialHeaderRow}>
                <Pressable
                  style={styles.homeRoutineSelectorButton}
                  onPress={() => setShowRoutineSelector(true)}
                >
                  <Text style={styles.homeRoutineSelectorText}>
                    {(activeRoutine?.name || 'Sin rutina').split('(')[0].trim()} ▼
                  </Text>
                </Pressable>
                {!!activeRoutine && (
                  <Pressable
                    style={styles.homeConsultButton}
                    onPress={() => {
                      setSelectedRoutineForDetails(activeRoutine);
                      setScreen('routine-details');
                    }}
                  >
                    <Text style={styles.homeConsultButtonText}>Consultar ejercicios</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.homeRoutineDescription}>
                {activeRoutine?.description || ''}
              </Text>

              {canDeleteCurrentRoutine && (
                <Pressable
                  style={styles.deleteRoutineButton}
                  onPress={() => setShowDeleteRoutineModal(true)}
                >
                  <Text style={styles.deleteRoutineButtonText}>🗑️ Borrar rutina</Text>
                </Pressable>
              )}

              {routineLogs.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <Text style={styles.emptyHistoryText}>
                    Sin entrenamientos aún en esta rutina
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 400 }}>
                {(() => {
                  const { groupedByBlock } = buildWeekDataForLogs(routineLogs);

                  const blocks = Object.keys(groupedByBlock)
                    .map(Number)
                    .sort((a, b) => b - a);
                  const currentWeekBlock = blocks[0];
                  return blocks.map((block) => {
                    const weekLogs = groupedByBlock[block].slice().reverse();
                    const isExpanded = (expandedWeekBlocks[block] ?? (block === currentWeekBlock));
                    const weekImprovement = getWeekImprovement(groupedByBlock, block, currentWeekBlock);

                    return (
                      <View key={block}>
                        <Pressable
                          style={styles.weekHeaderButton}
                          onPress={() => toggleWeekBlock(block)}
                        >
                          <View style={styles.weekTitleRow}>
                            <Text style={styles.weekTitle}>Semana {block}</Text>
                            {!!weekImprovement && (
                              <Text
                                style={[
                                  styles.weekImprovementText,
                                  weekImprovement.isImproved ? styles.weekImprovementUp : styles.weekImprovementDown,
                                ]}
                              >
                                {weekImprovement.isImproved ? '↑' : '↓'} {weekImprovement.percent.toFixed(1)}%
                              </Text>
                            )}
                          </View>
                          <Text style={styles.weekHeaderMeta}>
                            {weekLogs.length} día{weekLogs.length === 1 ? '' : 's'} {isExpanded ? '▲' : '▼'}
                          </Text>
                        </Pressable>

                        {isExpanded && weekLogs.map((log) => {
                          const day = getDay(log.dayId);
                          const isCurrentWeek = block === currentWeekBlock;
                          const improvement = getLogImprovement(log);
                          return (
                            <Pressable
                              key={log.id}
                              style={({ pressed }) => [
                                styles.historialCard,
                                pressed && styles.historialCardPressed,
                              ]}
                              onPress={() => {
                                setSelectedDay(day);
                                setSelectedLog(log);
                                setDetailBackScreen('home');
                                setScreen('detail');
                              }}
                              onLongPress={() => {
                                if (isCurrentWeek) {
                                  setLogToDelete(log);
                                }
                              }}
                              delayLongPress={2000}
                            >
                              <View style={styles.historialCardTop}>
                                <View style={styles.historialCardLeft}>
                                  <Text style={styles.historialEmoji}>{day?.emoji}</Text>
                                  <View>
                                    <View style={styles.historialNameRow}>
                                      <Text style={styles.historialDayName}>
                                        {getDisplayDayName(day?.name)}
                                      </Text>
                                      {!!improvement && (
                                        <Text
                                          style={[
                                            styles.historialImprovementText,
                                            improvement.isImproved ? styles.historialImprovementUp : styles.historialImprovementDown,
                                          ]}
                                        >
                                          {improvement.isImproved ? '↑' : '↓'} {improvement.percent.toFixed(1)}%
                                        </Text>
                                      )}
                                    </View>
                                    <Text style={styles.historialDate}>{formatDateWithDay(log.date)}</Text>
                                  </View>
                                </View>
                                <Text style={styles.historialExCount}>
                                  Día {day?.dayNumber}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    );
                  });
                })()}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        <Modal visible={!!logToDelete} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🗑️ Eliminar día</Text>
              <Text style={styles.deleteModalText}>
                ¿Deseas eliminar este entrenamiento de la semana en curso?
              </Text>
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                  onPress={() => setLogToDelete(null)}
                >
                  <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnDanger]}
                  onPress={() => {
                    if (logToDelete) {
                      setLogs((prev) => prev.filter((item) => item.id !== logToDelete.id));
                    }
                    setLogToDelete(null);
                  }}
                >
                  <Text style={styles.modalBtnDangerText}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showDeleteRoutineModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>⚠️ Borrar rutina</Text>
              <Text style={styles.deleteModalText}>
                ¿Seguro que quieres borrar esta rutina?
              </Text>
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                  onPress={() => setShowDeleteRoutineModal(false)}
                >
                  <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnDanger]}
                  onPress={() => {
                    setShowDeleteRoutineModal(false);
                    handleDeleteCurrentRoutine();
                  }}
                >
                  <Text style={styles.modalBtnDangerText}>Borrar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.bottomNav}>
          {!hasNoRoutines && (
            <NavItem
              emoji="📅"
              label="Calendario"
              active
              onPress={() => {
                setPreviousScreen(screen);
                setCalendarMonthOffset(0);
                setScreen('all-history');
              }}
            />
          )}
          <NavItem
            emoji="🗂️"
            label="Datos"
            onPress={() => {
              setScreen('data');
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ===== WORKOUT LOG SCREEN (v1.1) =====
  if (screen === 'workout-log' && selectedDay) {
    const handleSaveWorkout = () => {
      const exercises = selectedDay.exercises.map((ex) => {
        const sets = exerciseSets[ex.id] || [];
        return {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          exerciseId: ex.id,
          exerciseName: ex.name,
          order: ex.order,
          rawInput: sets.length > 0
            ? sets.map(s => `${s.weight}x${s.reps}`).join(', ')
            : '',
          parsedSets: sets,
          notes: exerciseNotes[ex.id] || '',
          timestamp: Date.now(),
        };
      });

      const newLog = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        routineId: activeRoutineId,
        dayId: selectedDay.id,
        date: new Date().toISOString().split('T')[0],
        exercises,
        cardio: cardioInput.trim() ? { rawInput: cardioInput } : null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setLogs([...logs, newLog]);
      setToast('✅ ¡Entrenamiento guardado!');
      setTimeout(() => {
        setScreen('home');
        setToast(null);
      }, 1500);
    };

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {selectedDay.emoji} {selectedDay.name}
          </Text>
        </View>

        <ScrollView style={styles.scrollView}>
          <Text style={styles.sectionTitle}>Ejercicios</Text>
          {selectedDay.exercises.map((ex) => (
            <View key={ex.id} style={styles.exerciseBox}>
              <View style={styles.exerciseHeader}>
                <View>
                  <Text style={styles.exerciseName}>
                    {ex.order}. {ex.name}
                  </Text>
                  <Text style={styles.targetReps}>
                    Series: {ex.targetSets}x{ex.targetReps}
                  </Text>
                  {!!getLastExerciseResult(selectedDay.id, ex.id) && (
                    <Text style={styles.targetPreviousResult}>
                      Anterior: {getLastExerciseResult(selectedDay.id, ex.id)}
                    </Text>
                  )}
                </View>
                <Pressable
                  style={styles.noteButton}
                  onPress={() => {
                    setShowNotesModal(ex.id);
                    setNotesText(exerciseNotes[ex.id] || '');
                  }}
                >
                  <Text style={styles.noteButtonText}>✏️</Text>
                </Pressable>
              </View>

              <ExerciseInputField
                exerciseId={ex.id}
                repetitions={ex.targetReps}
                addedSets={exerciseSets[ex.id] || []}
                targetSets={ex.targetSets}
                onAddSet={handleAddSet}
                onRemoveLastSet={handleRemoveLastSet}
                onFinishExercise={handleFinishExercise}
                exerciseNote={exerciseNotes[ex.id] || ''}
                lastResultPlaceholder={getLastExerciseResult(selectedDay.id, ex.id)}
              />
            </View>
          ))}

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Cardio</Text>
          <TextInput
            style={[styles.input, { minHeight: 50 }]}
            placeholder="Ej: Cinta: 22.5mins, 11.5kmh"
            value={cardioInput}
            onChangeText={setCardioInput}
            multiline
          />

          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && styles.saveBtnPressed,
            ]}
            onPress={handleSaveWorkout}
          >
            <Text style={styles.saveBtnText}>💾 Guardar</Text>
          </Pressable>
        </ScrollView>

        {/* MODAL NOTAS */}
        <Modal visible={showNotesModal !== null} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>📝 Nota</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Escribe una nota..."
                value={notesText}
                onChangeText={setNotesText}
                multiline
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                  onPress={() => {
                    setShowNotesModal(null);
                  }}
                >
                  <Text style={styles.modalBtnSecondaryText}>← Atrás</Text>
                </Pressable>
                <Pressable
                  style={styles.modalBtn}
                  onPress={() => {
                    if (showNotesModal) {
                      setExerciseNotes((prev) => ({
                        ...prev,
                        [showNotesModal]: notesText,
                      }));
                    }
                    setShowNotesModal(null);
                  }}
                >
                  <Text style={styles.modalBtnText}>Guardar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {toast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        <Pressable
          style={styles.backButton}
          onPress={() => setScreen('home')}
        >
          <Text style={styles.backButtonText}>← Volver</Text>
        </Pressable>

      </SafeAreaView>
    );
  }

  // ===== ALL HISTORY SCREEN =====
  if (screen === 'all-history') {
    const now = new Date();
    const viewDate = new Date(now.getFullYear(), now.getMonth() + calendarMonthOffset, 1);
    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    const monthLogs = logs.filter((log) => {
      const date = new Date(log.date + 'T00:00:00');
      return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
    });

    const logsByRoutine = logs.reduce((acc, log) => {
      if (!acc[log.routineId]) acc[log.routineId] = [];
      acc[log.routineId].push(log);
      return acc;
    }, {});

    const weekByLogId = {};
    Object.keys(logsByRoutine).forEach((routineId) => {
      const { logToBlockMap } = buildWeekDataForLogs(logsByRoutine[routineId]);
      Object.assign(weekByLogId, logToBlockMap);
    });

    const logsByDate = monthLogs.reduce((acc, log) => {
      if (!acc[log.date]) acc[log.date] = [];
      acc[log.date].push(log);
      return acc;
    }, {});

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const firstWeekDay = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const dayCells = [
      ...Array(firstWeekDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, idx) => idx + 1),
    ];

    while (dayCells.length % 7 !== 0) {
      dayCells.push(null);
    }

    const toDateKey = (dayNumber) => (
      `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
    );
    const todayKey = new Date().toISOString().split('T')[0];

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📅 Calendario</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.calendarContentContainer}>
          <View style={styles.calendarHeaderCard}>
            <View style={styles.calendarMonthHeaderRow}>
              <Pressable
                style={styles.calendarNavButton}
                onPress={() => setCalendarMonthOffset((prev) => prev - 1)}
              >
                <Text style={styles.calendarNavButtonText}>⬅️</Text>
              </Pressable>
              <Text style={styles.calendarMonthTitle}>
                {monthNames[currentMonth]} {currentYear}
              </Text>
              <Pressable
                style={styles.calendarNavButton}
                onPress={() => setCalendarMonthOffset((prev) => prev + 1)}
              >
                <Text style={styles.calendarNavButtonText}>➡️</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.calendarWeekHeader}>
            {weekDays.map((label) => (
              <Text key={label} style={styles.calendarWeekDayText}>{label}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {dayCells.map((dayNumber, index) => {
              if (!dayNumber) {
                return <View key={`empty-${index}`} style={[styles.calendarDayCell, styles.calendarDayCellEmpty]} />;
              }

              const dateKey = toDateKey(dayNumber);
              const dayLogs = logsByDate[dateKey] || [];
              const hasLogs = dayLogs.length > 0;
              const dayWeekBlocks = [...new Set(dayLogs.map((log) => weekByLogId[log.id]).filter(Boolean))];
              const activeCellColor = dayWeekBlocks.length > 0
                ? getWeekAlternatingColor(Math.min(...dayWeekBlocks))
                : theme.colors.primary;
              const isToday = dateKey === todayKey;
              const primaryLog = dayLogs[0] || null;
              const primaryDay = primaryLog ? getDay(primaryLog.dayId) : null;

              return (
                <Pressable
                  key={dateKey}
                  disabled={!hasLogs || !primaryLog}
                  onPress={() => {
                    if (!hasLogs || !primaryLog) return;
                    setSelectedDay(primaryDay);
                    setSelectedLog(primaryLog);
                    setDetailBackScreen('all-history');
                    setScreen('detail');
                  }}
                  style={[
                    styles.calendarDayCell,
                    hasLogs && styles.calendarDayCellActive,
                    hasLogs && { backgroundColor: activeCellColor, borderColor: activeCellColor },
                    isToday && styles.calendarDayCellToday,
                  ]}
                >
                  <Text style={[styles.calendarDayNumber, hasLogs && styles.calendarDayNumberActive]}>{dayNumber}</Text>
                  {hasLogs && primaryLog && (
                    <View style={styles.calendarDayMetaButton}>
                      <Text style={[styles.calendarRoutineMetaText, hasLogs && styles.calendarDayMetaTextActive]}>
                        R{(primaryLog.routineId || '').replace('routine', '') || '-'}
                      </Text>
                      <Text style={[styles.calendarDayMetaText, hasLogs && styles.calendarDayMetaTextActive]}>
                        Día {primaryDay?.dayNumber || '-'}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <Pressable
          style={styles.calendarBackButton}
          onPress={() => {
            setCalendarMonthOffset(0);
            setScreen(previousScreen || 'home');
          }}
        >
          <Text style={styles.calendarBackButtonText}>← Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ===== DETAIL SCREEN =====
  if (screen === 'detail' && selectedDay) {
    const currentLog = selectedLog || logs.find(log => log.dayId === selectedDay.id && log.routineId === activeRoutineId) || logs.find(log => log.dayId === selectedDay.id);
    const previousLog = logs
      .filter(log =>
        currentLog &&
        log.dayId === selectedDay.id &&
        log.routineId === currentLog.routineId &&
        getLogTimestamp(log) < getLogTimestamp(currentLog)
      )
      .sort((a, b) => getLogTimestamp(b) - getLogTimestamp(a))[0];

    const detailImprovement = (() => {
      if (!currentLog || !previousLog) return null;
      const currentScore = getWorkoutVolumeScore(currentLog);
      const previousScore = getWorkoutVolumeScore(previousLog);
      const currentRepsScore = getWorkoutRepsScore(currentLog);
      const previousRepsScore = getWorkoutRepsScore(previousLog);
      return buildImprovementFromScores(currentScore, previousScore, currentRepsScore, previousRepsScore);
    })();

    const formatSets = (parsedSets) => {
      if (!parsedSets || parsedSets.length === 0) return '-';
      return parsedSets.map(s => `${s.weight}x${s.reps}`).join(', ');
    };

    const getExerciseFromLog = (sourceLog, exercise) => {
      if (!sourceLog) return null;
      return sourceLog.exercises.find(e =>
        e.exerciseId === exercise.id ||
        e.id === exercise.id ||
        e.exerciseName === exercise.name ||
        e.name === exercise.name
      ) || null;
    };
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.detailTitleRow}>
            <Text style={styles.headerTitle}>
              {selectedDay.emoji} {getDisplayDayName(selectedDay.name)} - Día {selectedDay.dayNumber}
            </Text>
            {!!detailImprovement && (
              <Text
                style={[
                  styles.detailImprovementText,
                  detailImprovement.isImproved ? styles.detailImprovementUp : styles.detailImprovementDown,
                ]}
              >
                {detailImprovement.isImproved ? '↑' : '↓'} {detailImprovement.percent.toFixed(1)}%
              </Text>
            )}
          </View>
          <Text style={styles.subtitle}>
            {currentLog ? formatDateWithDay(currentLog.date) : ''}
          </Text>
        </View>
        <ScrollView>
          {selectedDay.exercises.map((exercise) => {
            const currentEx = getExerciseFromLog(currentLog, exercise);
            const prevEx = getExerciseFromLog(previousLog, exercise);
            const currentNote = currentEx?.notes?.trim() || '-';
            const previousNote = prevEx?.notes?.trim() || '-';
            const exerciseImprovement = (() => {
              if (!currentEx || !prevEx) return null;
              const currentScore = getExerciseVolumeScore(currentEx);
              const previousScore = getExerciseVolumeScore(prevEx);
              const currentRepsScore = getExerciseRepsScore(currentEx);
              const previousRepsScore = getExerciseRepsScore(prevEx);
              return buildImprovementFromScores(currentScore, previousScore, currentRepsScore, previousRepsScore);
            })();

            return (
              <View key={exercise.id} style={styles.resultBox}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultName}>{exercise.name} - {exercise.targetSets || '-'}x{exercise.targetReps || '-'}</Text>
                  {!!exerciseImprovement && (
                    <Text
                      style={[
                        styles.resultImprovementText,
                        exerciseImprovement.isImproved ? styles.resultImprovementUp : styles.resultImprovementDown,
                      ]}
                    >
                      {exerciseImprovement.isImproved ? '↑' : '↓'} {exerciseImprovement.percent.toFixed(1)}%
                    </Text>
                  )}
                </View>
                <View style={styles.resultRow}>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Realizado</Text>
                    <Text style={[styles.resultValue, styles.currentResult]}>
                      {formatSets(currentEx?.parsedSets)}
                    </Text>
                  </View>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Anterior</Text>
                    <Text style={[styles.resultValue, styles.previousResult]}>
                      {formatSets(prevEx?.parsedSets)}
                    </Text>
                  </View>
                </View>
                {(currentEx?.notes || prevEx?.notes) && (
                  <View style={styles.notesContainer}>
                    <View style={styles.notesRow}>
                      <Text style={[styles.notes, styles.currentResult]}>{currentNote}</Text>
                      <Text style={[styles.notes, styles.previousResult]}>{previousNote}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
          {currentLog?.cardio?.rawInput && (
            <View style={styles.resultBox}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultName}>Cardio</Text>
              </View>
              <Text style={styles.cardioText}>{currentLog.cardio.rawInput}</Text>
            </View>
          )}
        </ScrollView>
        <Pressable
          style={styles.backButton}
          onPress={() => setScreen(detailBackScreen || 'home')}
        >
          <Text style={styles.backButtonText}>← Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }
}

// ===== NAV ITEM =====
function NavItem({ emoji, label, active = false, onPress = () => {} }) {
  return (
    <Pressable
      style={[styles.navItem, active && styles.navItemActive]}
      onPress={onPress}
    >
      <Text style={[styles.navEmoji, active && styles.navEmojiActive]}>{emoji}</Text>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
      {active && <View style={styles.navIndicator} />}
    </Pressable>
  );
}

// ===== ESTILOS =====
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  header: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  daySelectorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  routineHighlightBadge: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'rgba(247, 204, 61, 0.35)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    maxWidth: 180,
    ...theme.shadow.soft,
  },
  routineHighlightText: {
    color: theme.colors.primarySoft,
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    fontSize: theme.typography.hero,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  routineButton: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    maxWidth: 180,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
  },
  routineButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: theme.colors.text,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailImprovementText: {
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 0,
  },
  detailImprovementUp: {
    color: theme.colors.success,
  },
  detailImprovementDown: {
    color: theme.colors.error,
  },
  // ===== BOTÓN PRINCIPAL =====
  startButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 24,
    paddingHorizontal: 24,
    marginBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  startButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  startButtonGlow: {
    position: 'absolute',
    top: -42,
    right: -18,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  startButtonIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16, 19, 24, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 19, 24, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  startButtonEmoji: {
    fontSize: 30,
  },
  startButtonText: {
    color: theme.colors.darkGray,
    fontSize: 23,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.6,
  },
  startButtonSubtext: {
    color: theme.colors.darkGray,
    fontSize: 13,
    opacity: 0.72,
    fontWeight: '600',
  },
  // ===== SELECTOR DE DÍAS =====
  dayListContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  daySelectCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    ...theme.shadow.soft,
  },
  daySelectCardCompact: {
    marginBottom: 10,
  },
  daySelectLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  dayAccentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
  },
  daySelectEmoji: {
    fontSize: 26,
  },
  daySelectContent: {
    flex: 1,
  },
  daySelectName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    flexShrink: 1,
  },
  daySelectExercises: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  dayBadge: {
    color: theme.colors.primarySoft,
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: 'rgba(15, 17, 21, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(247, 204, 61, 0.24)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  daySelectArrow: {
    fontSize: 20,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  // ===== HISTORIAL =====
  historialSection: {
    flex: 1,
  },
  historialTitle: {
    fontSize: theme.typography.section,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 0,
    paddingHorizontal: 0,
    letterSpacing: -0.3,
  },
  historialHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  homeRoutineSelectorButton: {
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: 'rgba(138, 144, 162, 0.28)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...theme.shadow.soft,
  },
  homeRoutineSelectorText: {
    color: '#E9ECF2',
    fontSize: 14,
    fontWeight: '800',
  },
  closedRoutineButton: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.radius.lg,
    paddingVertical: 26,
    paddingHorizontal: 24,
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  closedRoutineButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  addRoutineButton: {
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(247, 204, 61, 0.7)',
    marginTop: 20,
  },
  addRoutineButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  addRoutineButtonText: {
    color: theme.colors.darkGray,
  },
  homeConsultButton: {
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: 'rgba(138, 144, 162, 0.24)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
    ...theme.shadow.soft,
  },
  homeConsultButtonText: {
    color: '#DEE3EC',
    fontSize: 12,
    fontWeight: '600',
  },
  homeRoutineDescription: {
    fontSize: 13,
    color: '#9098A8',
    marginTop: 2,
    marginBottom: 14,
  },
  deleteRoutineButton: {
    alignSelf: 'center',
    backgroundColor: 'rgba(240, 106, 106, 0.14)',
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  deleteRoutineButtonText: {
    color: theme.colors.error,
    fontSize: 12,
    fontWeight: '800',
  },
  emptyHistory: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  historialCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(35, 39, 52, 0.95)',
    ...theme.shadow.soft,
  },
  historialCardPressed: {
    opacity: 0.9,
  },
  historialCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historialCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
  },
  historialEmoji: {
    fontSize: 21,
    marginRight: 11,
  },
  historialDayName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F2F5FA',
    letterSpacing: -0.2,
  },
  historialNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  historialImprovementText: {
    fontSize: 12,
    fontWeight: '800',
  },
  historialImprovementUp: {
    color: theme.colors.success,
  },
  historialImprovementDown: {
    color: theme.colors.error,
  },
  historialDate: {
    fontSize: 11,
    color: '#7D8594',
    marginTop: 4,
  },
  historialExCount: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primarySoft,
    backgroundColor: 'rgba(15, 17, 21, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(247, 204, 61, 0.24)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  list: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  weekHeaderButton: {
    marginHorizontal: theme.spacing.md,
    marginTop: 18,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekHeaderRight: {
    alignItems: 'flex-end',
  },
  weekTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekImprovementText: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 0,
  },
  weekImprovementUp: {
    color: theme.colors.success,
  },
  weekImprovementDown: {
    color: theme.colors.error,
  },
  weekHeaderMeta: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  weekTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.primary,
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  routineListContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  routineCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    ...theme.shadow.soft,
  },
  routineCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceAlt,
  },
  newRoutineCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: 18,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newRoutineCardText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  routineCardContent: {
    flex: 1,
  },
  routineCardName: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  routineCardDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  routineCardDays: {
    fontSize: 12,
    color: theme.colors.lightGray,
  },
  routineCardActiveIndicator: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '800',
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  backButton: {
    marginHorizontal: theme.spacing.md,
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    flexDirection: 'row',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emoji: {
    fontSize: 32,
    marginRight: 12,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  dayDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.section,
    fontWeight: '800',
    color: theme.colors.text,
    marginVertical: 14,
    letterSpacing: -0.3,
  },
  exerciseBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    ...theme.shadow.soft,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    maxWidth: 260,
  },
  targetReps: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontWeight: '700',
  },
  targetPreviousResult: {
    fontSize: 13,
    color: theme.colors.previous,
    marginTop: 4,
    fontStyle: 'italic',
  },
  noteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.gray,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteButtonText: {
    fontSize: 16,
  },
  dataScreenContent: {
    paddingBottom: 26,
  },
  dataSummaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    padding: 16,
    marginBottom: 12,
    ...theme.shadow.soft,
  },
  dataSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 10,
  },
  dataSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dataSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  dataSummaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.primarySoft,
    marginBottom: 4,
  },
  dataSummaryLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  dataSummaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.mediumGray,
    marginHorizontal: 10,
  },
  dataActionButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    padding: 16,
    marginBottom: 12,
    ...theme.shadow.soft,
  },
  dataActionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 6,
  },
  dataActionSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  dataDangerAction: {
    borderColor: 'rgba(240, 106, 106, 0.45)',
    backgroundColor: 'rgba(240, 106, 106, 0.08)',
  },
  dataDangerTitle: {
    color: '#F9B4B4',
  },
  dataDangerSubtitle: {
    color: '#DA9B9B',
  },
  // ===== EXERCISE INPUT FIELD (v1.1) =====
  exerciseFieldContainer: {
    marginBottom: 4,
  },
  exerciseFieldInput: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 14,
    gap: 8,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  splitInput: {
    backgroundColor: theme.colors.gray,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    borderRadius: theme.radius.sm,
    padding: 12,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  separator: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  exerciseFieldTextInput: {
    flex: 1,
    backgroundColor: theme.colors.gray,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    borderRadius: 6,
    padding: 10,
    fontSize: 12,
    fontFamily: 'monospace',
    color: theme.colors.text,
  },
  exerciseFieldTags: {
    marginBottom: 8,
    maxHeight: 50,
  },
  exerciseFieldTag: {
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 212, 59, 0.22)',
  },
  exerciseFieldTagText: {
    color: theme.colors.primarySoft,
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseFieldCounter: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  exerciseFieldMaxReached: {
    fontSize: 11,
    color: theme.colors.success,
    fontWeight: '600',
    marginBottom: 8,
  },
  exerciseFieldButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  exerciseFieldLastResult: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    fontStyle: 'italic',
    paddingHorizontal: 4,
  },
  exerciseFieldButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
  },
  exerciseFieldAddButton: {
    backgroundColor: theme.colors.primary,
  },
  exerciseFieldDeleteButton: {
    backgroundColor: theme.colors.error,
  },
  exerciseFieldFinishButton: {
    backgroundColor: theme.colors.success,
  },
  exerciseFieldButtonText: {
    color: theme.colors.darkGray,
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseFieldNote: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginVertical: 8,
    paddingLeft: 4,
  },
  input: {
    backgroundColor: theme.colors.gray,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    borderRadius: theme.radius.md,
    padding: 14,
    fontSize: 13,
    fontFamily: 'monospace',
    color: theme.colors.text,
  },
  newRoutineDayCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 12,
  },
  newRoutineDayTitle: {
    color: theme.colors.primarySoft,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  newRoutineLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  newRoutineDayInput: {
    backgroundColor: theme.colors.gray,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    borderRadius: theme.radius.sm,
    padding: 12,
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: 12,
  },
  newRoutineExercisesInput: {
    minHeight: 120,
    backgroundColor: theme.colors.gray,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    borderRadius: theme.radius.sm,
    padding: 12,
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  addDayBtn: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    flex: 1,
    marginTop: 6,
  },
  addDayBtnDisabled: {
    opacity: 0.45,
  },
  addDayBtnText: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  newRoutineActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  removeDayBtn: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    flex: 1,
    marginTop: 6,
  },
  removeDayBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  newRoutineInput: {
    minHeight: 380,
    backgroundColor: theme.colors.gray,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    borderRadius: theme.radius.md,
    padding: 14,
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    marginVertical: 22,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  saveBtnPressed: {
    opacity: 0.8,
  },
  saveBtnText: {
    color: theme.colors.darkGray,
    fontWeight: '800',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    borderTopWidth: 1,
    borderTopColor: theme.colors.mediumGray,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
    color: theme.colors.text,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    borderRadius: theme.radius.md,
    padding: 14,
    minHeight: 110,
    marginBottom: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.gray,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  modalBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    padding: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  modalBtnSecondary: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
  },
  modalBtnText: {
    color: theme.colors.darkGray,
    fontWeight: '800',
  },
  modalBtnSecondaryText: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  modalBtnDanger: {
    backgroundColor: theme.colors.error,
  },
  modalBtnDangerText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  deleteModalText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  toast: {
    backgroundColor: theme.colors.success,
    padding: 14,
    margin: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  toastText: {
    color: theme.colors.darkGray,
    fontWeight: '800',
  },
  logCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    ...theme.shadow.soft,
  },
  logCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  logAccentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logCardContent: {
    gap: 4,
  },
  logCardPressed: {
    opacity: 0.92,
  },
  logDayName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  logRoutineName: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '800',
  },
  logDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  logExercises: {
    fontSize: 11,
    color: theme.colors.primarySoft,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  logMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  calendarContentContainer: {
    paddingBottom: 26,
  },
  calendarHeaderCard: {
    backgroundColor: '#151922',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(35, 39, 52, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
    ...theme.shadow.soft,
  },
  calendarMonthTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#EEF2F8',
    letterSpacing: -0.3,
    textAlign: 'center',
    flex: 1,
  },
  calendarMonthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(138, 144, 162, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavButtonText: {
    color: '#D7DDE8',
    fontSize: 15,
    fontWeight: '700',
  },
  calendarWeekHeader: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  calendarWeekDayText: {
    flex: 1,
    textAlign: 'center',
    color: '#8A91A0',
    fontSize: 10,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    paddingHorizontal: 2,
  },
  calendarDayCell: {
    width: '14.2857%',
    minHeight: 86,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(35, 39, 52, 0.9)',
    paddingHorizontal: 6,
    paddingTop: 7,
    paddingBottom: 5,
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  calendarDayCellActive: {
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  calendarDayCellToday: {
    borderColor: 'rgba(247, 204, 61, 0.9)',
    shadowColor: '#F7CC3D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  calendarDayCellEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  calendarDayNumber: {
    color: '#F2F5FA',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
    marginLeft: 1,
  },
  calendarDayNumberActive: {
    color: '#F7FAFF',
  },
  calendarDayMetaButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  calendarDayMetaText: {
    color: '#AAB2C2',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 11,
    letterSpacing: 0.1,
  },
  calendarRoutineMetaText: {
    color: '#98A0AE',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 1,
    letterSpacing: 0.15,
  },
  calendarDayMetaTextActive: {
    color: '#E9EEF7',
  },
  calendarBackButton: {
    marginHorizontal: theme.spacing.md,
    marginBottom: 16,
    backgroundColor: 'transparent',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(138, 144, 162, 0.26)',
  },
  calendarBackButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#BDC5D3',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  resultBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.mediumGray,
    ...theme.shadow.soft,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  resultImprovementText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
    flexShrink: 0,
  },
  resultImprovementUp: {
    color: theme.colors.success,
  },
  resultImprovementDown: {
    color: theme.colors.error,
  },
  resultNotes: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginLeft: 8,
    maxWidth: 100,
  },
  resultParsed: {
    fontSize: 11,
    color: theme.colors.current,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultPrevious: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.mediumGray,
  },
  resultPreviousLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  resultPreviousRaw: {
    fontSize: 11,
    color: theme.colors.previous,
    fontFamily: 'monospace',
    flex: 1,
    fontWeight: '600',
  },
  resultPreviousNotes: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginLeft: 8,
    maxWidth: 80,
  },
  resultRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  resultItem: {
    flex: 1,
  },
  resultLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  currentResult: {
    color: theme.colors.push,
  },
  previousResult: {
    color: theme.colors.previous,
  },
  notesContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.mediumGray,
  },
  notesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  notesLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  notes: {
    flex: 1,
    fontSize: 11,
    fontStyle: 'italic',
  },
  cardioText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 16,
  },
  navItemActive: {
    backgroundColor: '#141922',
    borderWidth: 1,
    borderColor: 'rgba(247, 204, 61, 0.24)',
  },
  navEmoji: {
    fontSize: 19,
    marginBottom: 3,
    opacity: 0.72,
  },
  navEmojiActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  navLabelActive: {
    color: '#F1F4FA',
  },
  navIndicator: {
    width: 16,
    height: 2,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    marginTop: 5,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#151922',
    borderTopWidth: 1,
    borderTopColor: 'rgba(138, 144, 162, 0.16)',
    marginHorizontal: 12,
    marginBottom: 10,
    marginTop: 10,
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingVertical: 9,
    ...theme.shadow.soft,
  },
  routineExerciseList: {
    paddingLeft: 18,
    paddingRight: 10,
    paddingBottom: 10,
  },
  routineExerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  routineExerciseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  routineExerciseText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
});