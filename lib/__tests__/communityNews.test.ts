import {
  buildCommunityNews,
  capSeenCounts,
  COMMENT_READS_EPOCH,
  hasCommunityNews,
  mergeSeenCounts,
  planSeenRefresh,
  NO_COMMUNITY_NEWS,
  pickNewComments,
  readCommentThread,
  sameSeenCounts,
} from '../communityNews';

describe('buildCommunityNews', () => {
  it('mide contra lo visto y solo deja las rutinas con novedades', () => {
    const news = buildCommunityNews(
      { followers: 5, routineLikes: { a: 4, b: 2, c: 1 } },
      { followers: 3, routineLikes: { a: 1, b: 2, c: 1 } },
      new Map([['c', 2]])
    );
    expect(news).toEqual({
      followers: 2,
      routines: [
        { id: 'a', likes: 3, comments: 0 },
        { id: 'c', likes: 0, comments: 2 },
      ],
    });
  });

  it('una rutina recién publicada mide desde cero', () => {
    const news = buildCommunityNews(
      { followers: 0, routineLikes: { nueva: 2 } },
      { followers: 0, routineLikes: {} },
      new Map()
    );
    expect(news.routines).toEqual([{ id: 'nueva', likes: 2, comments: 0 }]);
  });
});

describe('capSeenCounts', () => {
  it('una baja no tapa la siguiente novedad', () => {
    const current = { followers: 4, routineLikes: { a: 1 } };
    const seen = capSeenCounts(
      { followers: 6, routineLikes: { a: 3, retirada: 9 } },
      current
    );
    expect(seen).toEqual({ followers: 4, routineLikes: { a: 1 } });
  });
});

describe('hasCommunityNews', () => {
  it('hay avisos con seguidores o con alguna rutina', () => {
    expect(hasCommunityNews(NO_COMMUNITY_NEWS)).toBe(false);
    expect(hasCommunityNews({ followers: 1, routines: [] })).toBe(true);
    expect(
      hasCommunityNews({
        followers: 0,
        routines: [{ id: 'a', likes: 0, comments: 1 }],
      })
    ).toBe(true);
  });
});

describe('pickNewComments', () => {
  it('solo cuenta lo ajeno posterior a lo leído', () => {
    const fresh = { user_id: 'otra', created_at: 200 };
    expect(
      pickNewComments(
        [
          { user_id: 'otra', created_at: 100 },
          { user_id: 'yo', created_at: 300 },
          fresh,
        ],
        'yo',
        100
      )
    ).toEqual([fresh]);
  });
});

describe('readCommentThread', () => {
  const before = { user_id: 'otra', created_at: COMMENT_READS_EPOCH - 10 };
  const after = { user_id: 'otra', created_at: COMMENT_READS_EPOCH + 10 };
  const mine = { user_id: 'yo', created_at: COMMENT_READS_EPOCH + 20 };
  const now = COMMENT_READS_EPOCH + 100;

  it('con marca, resalta lo posterior y avanza hasta ello', () => {
    expect(
      readCommentThread(
        [before, after, mine],
        'yo',
        COMMENT_READS_EPOCH,
        false,
        now
      )
    ).toEqual({ fresh: [after], readAt: after.created_at });
  });

  it('con todo leído no toca la marca', () => {
    expect(
      readCommentThread([after], 'yo', after.created_at, true, now)
    ).toEqual({ fresh: [], readAt: null });
  });

  it('tu rutina sin marca: lo nuevo desde el inicio de la cuenta', () => {
    expect(
      readCommentThread([before, after], 'yo', undefined, true, now)
    ).toEqual({ fresh: [after], readAt: after.created_at });
  });

  it('rutina ajena por primera vez: nada es nuevo, pero queda marcada', () => {
    expect(
      readCommentThread([before, after], 'yo', undefined, false, now)
    ).toEqual({ fresh: [], readAt: after.created_at });
    expect(readCommentThread([], 'yo', undefined, false, now)).toEqual({
      fresh: [],
      readAt: now,
    });
  });
});

describe('mergeSeenCounts', () => {
  it('se queda con lo más visto de la nube y de lo pendiente del móvil', () => {
    const cloud = { followers: 5, routineLikes: { a: 3, b: 1 } };
    const pending = { followers: 4, routineLikes: { a: 7, c: 2 } };
    expect(mergeSeenCounts(cloud, pending)).toEqual({
      followers: 5,
      routineLikes: { a: 7, b: 1, c: 2 },
    });
  });

  it('con una sola versión, esa; sin ninguna, null', () => {
    const only = { followers: 1, routineLikes: {} };
    expect(mergeSeenCounts(only, null)).toBe(only);
    expect(mergeSeenCounts(null, only)).toBe(only);
    expect(mergeSeenCounts(null, null)).toBeNull();
  });
});

describe('sameSeenCounts', () => {
  it('compara seguidores y cada rutina, sin mirar el orden', () => {
    expect(
      sameSeenCounts(
        { followers: 2, routineLikes: { a: 1, b: 2 } },
        { followers: 2, routineLikes: { b: 2, a: 1 } }
      )
    ).toBe(true);
    expect(
      sameSeenCounts(
        { followers: 2, routineLikes: { a: 1 } },
        { followers: 2, routineLikes: { a: 1, b: 0 } }
      )
    ).toBe(false);
    expect(sameSeenCounts(null, { followers: 0, routineLikes: {} })).toBe(
      false
    );
    expect(sameSeenCounts(null, null)).toBe(true);
  });
});

describe('planSeenRefresh', () => {
  const measured = { followers: 10, routineLikes: { a: 5 } };

  it('sin poder leer la nube ni nada pendiente, no siembra ni sube', () => {
    expect(planSeenRefresh(undefined, null, measured)).toEqual({
      seen: null,
      write: 'none',
    });
  });

  it('sin poder leer la nube, no avisa ni escribe aunque haya algo pendiente', () => {
    // Lo pendiente suele ser solo lo atendido: medir contra ello haría salir
    // como nuevo todo lo demás (37 seguidores "nuevos").
    const patch = { followers: 0, routineLikes: { a: 5 } };
    expect(planSeenRefresh(undefined, patch, measured)).toEqual({
      seen: null,
      write: 'none',
    });
  });

  it('la primera vez en la nube siembra con lo medido y lo sube', () => {
    expect(planSeenRefresh(null, null, measured)).toEqual({
      seen: measured,
      write: 'cloud',
    });
  });

  it('con la nube al día y nada pendiente, no escribe', () => {
    const cloud = { followers: 7, routineLikes: { a: 2 } };
    expect(planSeenRefresh(cloud, null, measured)).toEqual({
      seen: cloud,
      write: 'none',
    });
  });

  it('funde lo pendiente con la nube y lo sube', () => {
    const cloud = { followers: 7, routineLikes: { a: 2 } };
    const pending = { followers: 9, routineLikes: {} };
    expect(planSeenRefresh(cloud, pending, measured)).toEqual({
      seen: { followers: 9, routineLikes: { a: 2 } },
      write: 'cloud',
    });
  });
});
