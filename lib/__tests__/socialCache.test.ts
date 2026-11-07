const store = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
  },
}));

type SocialCache = typeof import('../socialCache');

// Estado de módulo (la cuenta dueña): un módulo limpio por test.
function freshModule(): SocialCache {
  let mod!: SocialCache;
  jest.isolateModules(() => {
    mod = require('../socialCache');
  });
  return mod;
}

const SESSION_KEY = 'sb-ccckuubzyixlbbjmrjak-auth-token';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => store.clear());

describe('copias sociales por cuenta', () => {
  it('sin cuenta resuelta, solo lee la copia de la sesión guardada', async () => {
    const cache = freshModule();
    store.set(
      'gymbro_social_board',
      JSON.stringify({ savedAt: Date.now(), owner: 'a', value: 1 })
    );
    // Sin sesión guardada: nada.
    await expect(cache.readSocialCache('board')).resolves.toBeNull();

    // Arranque con el token caducado: la sesión de "a" sigue guardada.
    store.set(SESSION_KEY, JSON.stringify({ user: { id: 'a' } }));
    await expect(cache.readSocialCache('board')).resolves.toBe(1);
    // Sin red se resuelve a null y la copia sigue valiendo.
    cache.setSocialCacheOwner(null);
    await expect(cache.readSocialCache('board')).resolves.toBe(1);

    // La de otra cuenta, nunca.
    store.set(SESSION_KEY, JSON.stringify({ user: { id: 'b' } }));
    await expect(cache.readSocialCache('board')).resolves.toBeNull();
  });

  it('no vacía la memoria al resolverse la cuenta de la que se leyó', async () => {
    const cache = freshModule();
    const clear = jest.fn();
    cache.registerSocialMemoryCache(clear);
    store.set(SESSION_KEY, JSON.stringify({ user: { id: 'a' } }));
    store.set(
      'gymbro_social_board',
      JSON.stringify({ savedAt: Date.now(), owner: 'a', value: 1 })
    );
    await cache.readSocialCache('board');
    cache.setSocialCacheOwner('a');
    expect(clear).not.toHaveBeenCalled();
  });

  it('lee la copia de la misma cuenta y no la de otra', async () => {
    const cache = freshModule();
    cache.setSocialCacheOwner('a');
    cache.writeSocialCache('board', { n: 1 }, 'a');
    await flush();
    await expect(cache.readSocialCache('board')).resolves.toEqual({ n: 1 });

    cache.setSocialCacheOwner('b');
    await expect(cache.readSocialCache('board')).resolves.toBeNull();
  });

  it('ignora las copias sin dueño de versiones anteriores', async () => {
    const cache = freshModule();
    cache.setSocialCacheOwner('a');
    store.set(
      'gymbro_social_board',
      JSON.stringify({ savedAt: Date.now(), value: 1 })
    );
    await expect(cache.readSocialCache('board')).resolves.toBeNull();
  });

  it('no guarda lo cargado para una cuenta que ya no mira', async () => {
    const cache = freshModule();
    cache.setSocialCacheOwner(null);
    cache.writeSocialCache('board', { n: 1 }, 'a');
    await flush();
    expect(store.size).toBe(0);
  });

  it('vacía las copias en memoria al cambiar de cuenta, no si sigue la misma', () => {
    const cache = freshModule();
    const clear = jest.fn();
    cache.registerSocialMemoryCache(clear);

    cache.setSocialCacheOwner('a');
    expect(clear).toHaveBeenCalledTimes(1);
    cache.setSocialCacheOwner('a');
    expect(clear).toHaveBeenCalledTimes(1);
    cache.setSocialCacheOwner(null);
    expect(clear).toHaveBeenCalledTimes(2);
    expect(cache.isSocialCacheOwner(null)).toBe(true);
    expect(cache.isSocialCacheOwner('a')).toBe(false);
  });
});
