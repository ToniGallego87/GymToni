import { anonymizeLinkedRoutine } from '../routines';
import { ACCOUNT_DELETION_GRACE_DAYS, accountPurgeDateKey } from '../utils';
import { WorkoutRoutine } from '../../types';

const DELETED = 'cuenta-eliminada';

const linked = (patch: Partial<WorkoutRoutine> = {}): WorkoutRoutine => ({
  id: 'r1',
  name: 'Torso pierna',
  days: [],
  createdAt: 1,
  isActive: false,
  linkedOwnerId: 'autor',
  sourceOwnerId: 'autor',
  sourceAuthor: 'Ana',
  ...patch,
});

describe('accountPurgeDateKey', () => {
  it('cae a los días de gracia de pedirlo, en el huso del móvil', () => {
    const requested = new Date(2026, 9, 10, 23, 30).toISOString();
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(30);
    expect(accountPurgeDateKey(requested)).toBe('2026-11-09');
  });
});

describe('anonymizeLinkedRoutine', () => {
  it('quita el rastro del autor sin tocar el plan', () => {
    const result = anonymizeLinkedRoutine(linked(), DELETED);
    expect(result).toMatchObject({
      id: 'r1',
      name: 'Torso pierna',
      linkedOwnerId: DELETED,
      sourceOwnerId: DELETED,
    });
    expect(result?.sourceAuthor).not.toBe('Ana');
  });

  it('no repite el cambio si ya era anónima', () => {
    expect(
      anonymizeLinkedRoutine(linked({ linkedOwnerId: DELETED }), DELETED)
    ).toBeNull();
  });
});
