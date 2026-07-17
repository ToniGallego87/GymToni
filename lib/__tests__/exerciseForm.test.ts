import {
  buildExercisesFromText,
  buildTargetReps,
  buildWorkoutExercises,
  createEmptyExercise,
  exerciseFormFromExercise,
  parseImportedExercise,
} from '../exerciseForm';
import { WorkoutExercise } from '../../types';

describe('parseImportedExercise', () => {
  it('lee el formato con corchetes', () => {
    const form = parseImportedExercise('Press banca [4x6-8]');
    expect(form).toMatchObject({
      name: 'Press banca',
      sets: 4,
      reps: '6-8',
      unit: 'reps',
    });
  });

  it('lee el formato plano', () => {
    expect(parseImportedExercise('Dominadas 4x8')).toMatchObject({
      name: 'Dominadas',
      sets: 4,
      reps: '8',
      unit: 'reps',
    });
  });

  it('detecta los segundos', () => {
    expect(parseImportedExercise('Plancha 3x30s')).toMatchObject({
      name: 'Plancha',
      sets: 3,
      reps: '30',
      unit: 'seg',
    });
  });

  it('acepta solo el nombre, con valores por defecto', () => {
    expect(parseImportedExercise('Remo')).toMatchObject({
      name: 'Remo',
      sets: 3,
      reps: '10-12',
      unit: 'reps',
    });
  });

  it('recorta las series al máximo permitido', () => {
    expect(parseImportedExercise('Curl [99x10]').sets).toBe(12);
  });
});

describe('buildExercisesFromText', () => {
  it('crea una fila por línea no vacía', () => {
    const forms = buildExercisesFromText('Press banca 4x8\n\nRemo 3x10\n');
    expect(forms.map((form) => form.name)).toEqual(['Press banca', 'Remo']);
  });

  it('devuelve una fila vacía si no hay nada que leer', () => {
    expect(buildExercisesFromText('   ')).toHaveLength(1);
    expect(buildExercisesFromText('   ')[0].name).toBe('');
  });
});

describe('buildTargetReps', () => {
  it('añade la unidad en los ejercicios por tiempo', () => {
    const form = { ...createEmptyExercise(), reps: '30', unit: 'seg' as const };
    expect(buildTargetReps(form)).toBe('30s');
  });

  it('deja las repeticiones tal cual', () => {
    const form = {
      ...createEmptyExercise(),
      reps: '6-8',
      unit: 'reps' as const,
    };
    expect(buildTargetReps(form)).toBe('6-8');
  });
});

describe('exerciseFormFromExercise', () => {
  const exercise: WorkoutExercise = {
    id: 'ex-1',
    name: 'Press banca',
    order: 1,
    targetSets: 4,
    targetReps: '6-8',
  };

  it('conserva el id del ejercicio guardado', () => {
    expect(exerciseFormFromExercise(exercise).id).toBe('ex-1');
  });

  it('separa la unidad del texto de reps', () => {
    expect(
      exerciseFormFromExercise({ ...exercise, targetReps: '30s' })
    ).toMatchObject({ reps: '30', unit: 'seg' });
  });

  it('rellena los valores que falten', () => {
    expect(
      exerciseFormFromExercise({
        id: 'ex-2',
        name: 'Remo',
        order: 2,
      })
    ).toMatchObject({ sets: 3, reps: '10', unit: 'reps' });
  });
});

describe('buildWorkoutExercises', () => {
  it('descarta las filas sin nombre y renumera el orden', () => {
    const forms = [
      { ...createEmptyExercise(), name: 'Press banca' },
      { ...createEmptyExercise(), name: '   ' },
      { ...createEmptyExercise(), name: 'Remo' },
    ];

    const exercises = buildWorkoutExercises(forms);
    expect(exercises).toHaveLength(2);
    expect(exercises.map((exercise) => exercise.order)).toEqual([1, 2]);
  });

  it('conserva los ids al reordenar (el historial los referencia)', () => {
    const saved: WorkoutExercise[] = [
      {
        id: 'ex-1',
        name: 'Press banca',
        order: 1,
        targetSets: 4,
        targetReps: '8',
      },
      { id: 'ex-2', name: 'Remo', order: 2, targetSets: 3, targetReps: '10' },
    ];

    // Editar el día dándole la vuelta al orden: cada ejercicio mantiene su id,
    // solo cambia `order`. Antes los ids se repartían por posición y las
    // comparaciones de progreso acababan cruzadas entre ejercicios.
    const forms = saved.map(exerciseFormFromExercise).reverse();
    const exercises = buildWorkoutExercises(forms);

    expect(exercises).toEqual([
      { id: 'ex-2', name: 'Remo', order: 1, targetSets: 3, targetReps: '10' },
      {
        id: 'ex-1',
        name: 'Press banca',
        order: 2,
        targetSets: 4,
        targetReps: '8',
      },
    ]);
  });

  it('sobrevive a un ida y vuelta sin cambios', () => {
    const saved: WorkoutExercise[] = [
      {
        id: 'ex-1',
        name: 'Plancha',
        order: 1,
        targetSets: 3,
        targetReps: '30s',
      },
    ];

    expect(buildWorkoutExercises(saved.map(exerciseFormFromExercise))).toEqual(
      saved
    );
  });
});
