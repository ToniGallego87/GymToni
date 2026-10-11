// Sin expo-notifications en node: solo se prueba el plan (función pura).
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('../theme', () => ({ theme: { colors: {} } }));

import { planWorkoutReminders } from '../workoutReminder';
import { WorkoutLog, WorkoutRoutine } from '../../types';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-10-05T12:00:00').getTime();

function log(id: string, at: number, extra: Partial<WorkoutLog> = {}): WorkoutLog {
  const d = new Date(at);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    id,
    routineId: 'r1',
    dayId: 'd1',
    date,
    exercises: [],
    createdAt: at,
    updatedAt: at,
    ...extra,
  };
}

const routine: WorkoutRoutine = {
  id: 'r1',
  name: 'Rutina',
  days: [],
  isActive: true,
  createdAt: 0,
};

describe('planWorkoutReminders', () => {
  it('sin entrenos en la rutina activa no avisa', () => {
    expect(planWorkoutReminders([], routine, NOW)).toEqual([]);
    const other = log('a', NOW - DAY, { routineId: 'r2' });
    expect(planWorkoutReminders([other], routine, NOW)).toEqual([]);
  });

  it('avisa a la semana del entreno, una hora antes de su hora', () => {
    const trainedAt = NOW - 2 * DAY + 6 * HOUR; // hace 2 días a las 18:00
    const plan = planWorkoutReminders([log('a', trainedAt)], routine, NOW);
    expect(plan[0]).toEqual({
      at: trainedAt + 7 * DAY - HOUR,
      kind: 'weekly',
    });
  });

  it('añade el aviso de vuelta a los 14 días del último entreno', () => {
    const trainedAt = NOW - 2 * DAY;
    const plan = planWorkoutReminders([log('a', trainedAt)], routine, NOW);
    expect(plan[plan.length - 1]).toEqual({
      at: trainedAt + 14 * DAY - HOUR,
      kind: 'comeback',
    });
  });

  it('no programa avisos ya pasados ni el de un día ya entrenado', () => {
    const weekAgoMorning = NOW - 7 * DAY - 3 * HOUR; // su aviso ya pasó
    const weekAgoEvening = NOW - 7 * DAY + 6 * HOUR; // tocaría hoy a las 17:00
    const today = log('t', NOW - HOUR); // pero hoy ya se ha entrenado
    const plan = planWorkoutReminders(
      [log('a', weekAgoMorning), log('b', weekAgoEvening), today],
      routine,
      NOW
    );
    expect(plan.filter((r) => r.kind === 'weekly')).toHaveLength(1); // el de "today"
    expect(plan[0].at).toBe(NOW - HOUR + 7 * DAY - HOUR);
  });

  it('el cardio suelto no cuenta', () => {
    const cardio = log('c', NOW - DAY, { cardioOnly: true });
    expect(planWorkoutReminders([cardio], routine, NOW)).toEqual([]);
  });
});
