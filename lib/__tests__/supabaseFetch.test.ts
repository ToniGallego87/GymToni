const hasStoredSession = jest.fn();
const realFetch = jest.fn();

jest.mock('../cloud/storedSession', () => ({
  hasStoredSession: () => hasStoredSession(),
}));
jest.mock('../supabaseConfig', () => ({
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
}));

import { accountSafeFetch } from '../supabase';

beforeEach(() => {
  hasStoredSession.mockReset();
  realFetch.mockReset().mockResolvedValue('ok');
  (global as unknown as { fetch: typeof realFetch }).fetch = realFetch;
});

const rest = 'https://x.supabase.co/rest/v1/log_sets';

describe('accountSafeFetch', () => {
  it('corta como sin red lo que saldría como anónimo con una cuenta en el móvil', async () => {
    hasStoredSession.mockResolvedValue(true);
    await expect(
      accountSafeFetch(rest, { headers: { Authorization: 'Bearer anon' } })
    ).rejects.toThrow('Network request failed');
    await expect(accountSafeFetch(rest, {})).rejects.toThrow(
      'Network request failed'
    );
    expect(realFetch).not.toHaveBeenCalled();
  });

  it('deja pasar lo anónimo sin cuenta en el móvil', async () => {
    hasStoredSession.mockResolvedValue(false);
    await accountSafeFetch(rest, {
      headers: { Authorization: 'Bearer anon' },
    });
    expect(realFetch).toHaveBeenCalledTimes(1);
  });

  it('deja pasar lo que va con el token de la cuenta, y Auth siempre', async () => {
    hasStoredSession.mockResolvedValue(true);
    await accountSafeFetch(rest, {
      headers: { Authorization: 'Bearer token-de-verdad' },
    });
    await accountSafeFetch('https://x.supabase.co/auth/v1/token', {
      headers: { Authorization: 'Bearer anon' },
    });
    expect(realFetch).toHaveBeenCalledTimes(2);
  });
});
