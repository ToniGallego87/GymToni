const signInWithPassword = jest.fn();
const authSignOut = jest.fn();
const removeSession = jest.fn();
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
      signOut: (args: unknown) => authSignOut(args),
      _removeSession: () => removeSession(),
    },
  },
}));

import {
  authErrorMessage,
  hasStoredSession,
  signOut,
  verifyCurrentPassword,
} from '../cloud/auth';

beforeEach(() => {
  signInWithPassword.mockReset();
  authSignOut.mockReset();
  removeSession.mockReset();
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

describe('signOut', () => {
  it('no toca nada más si supabase-js cierra bien', async () => {
    authSignOut.mockResolvedValue({ error: null });
    await signOut();
    expect(removeSession).not.toHaveBeenCalled();
  });

  it('sin red y con el token caducado, cierra igualmente en este móvil', async () => {
    // supabase-js devuelve el error de renovar sin borrar la sesión guardada.
    authSignOut.mockResolvedValue({
      error: { name: 'AuthRetryableFetchError' },
    });
    getItem.mockResolvedValue('{"access_token":"x"}');
    await signOut();
    expect(removeSession).toHaveBeenCalledTimes(1);
  });

  it('con error pero la sesión ya borrada, no hace nada más', async () => {
    authSignOut.mockResolvedValue({ error: { status: 500 } });
    getItem.mockResolvedValue(null);
    await signOut();
    expect(removeSession).not.toHaveBeenCalled();
  });
});

describe('signOut con el cliente instalado', () => {
  it('el plan B (_removeSession, privado) sigue existiendo en auth-js', () => {
    // Si una subida de supabase-js lo renombra, "Cerrar sesión" sin red vuelve
    // a dejar dentro: este test lo dice antes de publicar.
    const { GoTrueClient } = jest.requireActual('@supabase/auth-js');
    expect(typeof GoTrueClient.prototype._removeSession).toBe('function');
  });
});
