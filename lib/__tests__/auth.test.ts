const signInWithPassword = jest.fn();
const getItem = jest.fn();

jest.mock('react-native', () => ({
  unstable_batchedUpdates: (fn: () => void) => fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: (key: string) => getItem(key) },
}));
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (args: unknown) => signInWithPassword(args),
    },
  },
}));

import {
  authErrorMessage,
  hasStoredSession,
  verifyCurrentPassword,
} from '../cloud/auth';

beforeEach(() => {
  signInWithPassword.mockReset();
  getItem.mockReset();
});

describe('verifyCurrentPassword', () => {
  it('da true si la contraseña es la de la cuenta', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    await expect(verifyCurrentPassword('a@b.c', 'bien')).resolves.toBe(true);
  });

  it('da false si la contraseña no es correcta', async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: 'invalid_credentials' },
    });
    await expect(verifyCurrentPassword('a@b.c', 'mal')).resolves.toBe(false);
  });

  it('no confunde un fallo de red con una contraseña mala', async () => {
    const error = { code: 'over_request_rate_limit' };
    signInWithPassword.mockResolvedValue({ error });
    await expect(verifyCurrentPassword('a@b.c', 'x')).rejects.toBe(error);
  });
});

describe('hasStoredSession', () => {
  it('mira la clave de sesión de supabase-js', async () => {
    getItem.mockResolvedValue('{"access_token":"x"}');
    await expect(hasStoredSession()).resolves.toBe(true);
    expect(getItem).toHaveBeenCalledWith('sb-ccckuubzyixlbbjmrjak-auth-token');
  });

  it('da false tras una salida de verdad', async () => {
    getItem.mockResolvedValue(null);
    await expect(hasStoredSession()).resolves.toBe(false);
  });
});

describe('authErrorMessage', () => {
  it('traduce por código y no enseña el mensaje original', () => {
    const message = authErrorMessage({
      code: 'same_password',
      message: 'New password should be different',
    });
    expect(message).not.toContain('New password should');
  });

  it('usa el texto de respaldo si no conoce el error', () => {
    expect(authErrorMessage(new Error('raro'), 'respaldo')).toBe('respaldo');
    expect(authErrorMessage(new Error('raro'))).toBe('raro');
  });

  it('reconoce la falta de red', () => {
    const message = authErrorMessage({ name: 'AuthRetryableFetchError' });
    expect(message).not.toBe('[object Object]');
  });
});
