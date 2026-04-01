import { useContext } from 'react';
import { WorkoutContext } from '@features/workout/WorkoutContext';

export function useWorkout() {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkout must be used within WorkoutProvider');
  }
  return context;
}
