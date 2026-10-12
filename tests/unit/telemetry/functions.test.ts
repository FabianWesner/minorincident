import { describe, expect, it } from 'vitest';
import { getReplays, getStats, limits, postEvents, postReplay } from '../../../functions/_lib/telemetry';
import { gzip } from '../../../src/telemetry/gzip';
import { localEnv } from './d1';

const NOW = Date.parse('2026-10-12T12:00:00Z');
const player = '11111111-1111-4111-8111-111111111111', session = '22222222-2222-4222-8222-222222222222', attempt = '33333333-3333-4333-8333-333333333333';
const context = { d: 'desktop', q: 'high', b: 'webgl', v: 'abc1234', vp: '1600x960' };
const post = (body: unknown, extra: Record<string, unknown> = {}) => new Request('https://x/api/t', { method: 'POST', body: JSON.stringify({ v: 1, p: player, s: session, c: context, dur: 120, act: 100, e: [], ...(body as object), ...extra }) });
const event = (t: string, rest: Record<string, unknown> = {}) => ({ t, ts: NOW - 1000, ...rest });
const get = (path: string, token = 'test-token-0123456789abcdef') => new Request(`https://x/api/${path}${path.includes('?') ? '&' : '?'}token=${token}`);
const stats = async (env: ReturnType<typeof localEnv>, query = '') => (await (await getStats(get(`stats${query ? '?' + query : ''}`), env, NOW)).json()) as Record<string, any>;

describe('POST /api/t', () => {
  it('stores a session and its events, and extends it with later batches', async () => {
    const env = localEnv();
    const first = await postEvents(post({ e: [event('session_start'), event('level_start', { l: 'L1', k: 0, d: { seed: 1, tier: 'high', attempt } })] }), env, NOW);
    expect(first.status).toBe(200); expect(await first.json()).toEqual({ ok: true, n: 2 });
    const later = await postEvents(post({ dur: 600, act: 500, e: [event('death', { l: 'L1', k: 900, x: 12.5, z: -3, d: { cause: 'infected.walker', attempt } })] }), env, NOW + 600_000);
    expect(later.status).toBe(200);
    const row = env.sqlite.prepare('SELECT * FROM sessions').get() as Record<string, number | string>;
    expect(row).toMatchObject({ session_id: session, player_id: player, day: '2026-10-12', dur_s: 600, active_s: 500, device: 'desktop', backend: 'webgl', build: 'abc1234', events: 3, reqs: 2 });
    expect(env.sqlite.prepare('SELECT COUNT(*) AS n FROM events').get()).toEqual({ n: 3 });
  });

  it('rejects malformed payloads', async () => {
    const env = localEnv();
    const bad = async (body: unknown, extra?: Record<string, unknown>) => (await postEvents(post(body, extra), env, NOW)).status;
    expect(await bad({}, { v: 2 })).toBe(400);
    expect(await bad({}, { p: 'not-a-uuid' })).toBe(400);
    expect(await bad({}, { c: { ...context, d: 'toaster' } })).toBe(400);
    expect(await bad({}, { c: { ...context, ua: 'Mozilla/5.0' } })).toBe(400); // no extra context fields
    expect(await bad({ e: [event('hack')] })).toBe(400);
    expect(await bad({ e: [event('death', { l: 'L1', name: 'bob' })] })).toBe(400); // unknown field
    expect(await bad({ e: [event('death', { x: 1e9 })] })).toBe(400);
    expect(await bad({ e: [event('death', { d: { cause: '<script>alert(1)</script>' } })] })).toBe(400);
    expect(await bad({ e: [event('death', { d: { text: 'free text is not allowed here but short words are fine'.repeat(2) } })] })).toBe(400);
    expect(await bad({ e: [event('perf', { d: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, i])) })] })).toBe(400);
    expect(await bad({ e: Array.from({ length: limits.eventsPerRequest + 1 }, () => event('heartbeat')) })).toBe(400);
    expect(await postEvents(new Request('https://x/api/t', { method: 'POST', body: '{nope' }), env, NOW).then(r => r.status)).toBe(400);
    expect(await postEvents(new Request('https://x/api/t', { method: 'POST', body: 'x'.repeat(limits.eventBody + 1) }), env, NOW).then(r => r.status)).toBe(413);
    expect(env.sqlite.prepare('SELECT COUNT(*) AS n FROM events').get()).toEqual({ n: 0 });
  });

  it('enforces per-session event and request quotas and per-player session count', async () => {
    const env = localEnv();
    const batch = () => post({ e: Array.from({ length: 100 }, () => event('heartbeat')) });
    let accepted = 0, status = 200;
    for (let i = 0; i < 70 && status === 200; i++) { status = (await postEvents(batch(), env, NOW)).status; if (status === 200) accepted += 100; }
    expect(status).toBe(429); expect(accepted).toBe(limits.eventsPerSession);
    // Another session of the same player is fine until the daily cap.
    for (let i = 0; i < limits.sessionsPerPlayerDay - 1; i++) {
      const id = `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`;
      expect((await postEvents(post({ e: [] }, { s: id }), env, NOW)).status).toBe(200);
    }
    expect((await postEvents(post({ e: [] }, { s: 'bbbbbbbb-0000-4000-8000-000000000000' }), env, NOW)).status).toBe(429);
    // Session ids cannot be taken over by another player.
    expect((await postEvents(post({ e: [] }, { p: '99999999-9999-4999-8999-999999999999' }), env, NOW)).status).toBe(403);
  });

  it('clamps timestamps and answers 503 without bindings (QA deploys)', async () => {
    const env = localEnv();
    await postEvents(post({ e: [event('heartbeat', { ts: NOW + 10 * 86400_000 }), event('heartbeat', { ts: 1.7e12 })] }), env, NOW);
    const stamps = env.sqlite.prepare('SELECT ts FROM events ORDER BY id').all() as { ts: number }[];
    expect(stamps[0].ts).toBeLessThanOrEqual(NOW + limits.maxFuture); expect(stamps[1].ts).toBeGreaterThanOrEqual(NOW - limits.maxPast);
    expect((await postEvents(post({}), {} as never, NOW)).status).toBe(503);
  });
});

describe('POST /api/replay', () => {
  const chunk = async (text = 'replay-chunk-bytes'.repeat(5)) => await gzip(new TextEncoder().encode(text));
  const replay = async (env: ReturnType<typeof localEnv>, n: number, extra = '', body?: Uint8Array, id = attempt) => postReplay(new Request(`https://x/api/replay?a=${id}&p=${player}&s=${session}&n=${n}&l=L1&b=abc1234${extra}`, { method: 'POST', body: (body ?? await chunk()) as BodyInit }), env, NOW);

  it('stores chunks in R2 under day/attempt/seq and tracks them in D1; retries are idempotent', async () => {
    const env = localEnv();
    expect((await replay(env, 0)).status).toBe(403); // unknown session
    await postEvents(post({ e: [event('session_start')] }), env, NOW);
    expect((await replay(env, 0)).status).toBe(200); expect((await replay(env, 0)).status).toBe(200);
    expect((await replay(env, 1, '&f=1&o=complete&t=7200')).status).toBe(200);
    expect([...env.objects.keys()]).toEqual([`2026-10-12/${attempt}/0000.gz`, `2026-10-12/${attempt}/0001.gz`]);
    const row = env.sqlite.prepare('SELECT * FROM replays').get() as Record<string, number | string>;
    expect(row).toMatchObject({ attempt_id: attempt, level: 'L1', chunks: 2, final: 1, outcome: 'complete', ticks: 7200, build: 'abc1234' });
    const size = [...env.objects.values()].reduce((n, v) => n + v.length, 0);
    expect(row.bytes).toBe(size);
    expect((env.sqlite.prepare('SELECT replay_bytes FROM sessions').get() as { replay_bytes: number }).replay_bytes).toBe(size);
  });

  it('rejects non-gzip, oversized and foreign-attempt chunks and enforces the session byte quota', async () => {
    const env = localEnv(); await postEvents(post({ e: [] }), env, NOW);
    expect((await replay(env, 0, '', new TextEncoder().encode('plain text, definitely not gzip'))).status).toBe(400);
    expect((await replay(env, 0, '', new Uint8Array(limits.replayChunk + 1).fill(0x1f))).status).toBe(413);
    expect((await replay(env, 0, '&o=hax')).status).toBe(400);
    expect((await replay(env, 999)).status).toBe(400);
    await replay(env, 0);
    const other = '44444444-4444-4444-8444-444444444444';
    env.sqlite.prepare('UPDATE replays SET session_id = ?').run(other);
    expect((await replay(env, 1)).status).toBe(403);
    env.sqlite.prepare('UPDATE replays SET session_id = ?').run(session);
    env.sqlite.prepare('UPDATE sessions SET replay_bytes = ?').run(limits.replayBytesPerSession - 10);
    expect((await replay(env, 5)).status).toBe(429);
  });
});

describe('read endpoints', () => {
  async function seeded() {
    const env = localEnv();
    const days = ['2026-10-10', '2026-10-11', '2026-10-12'];
    for (let i = 0; i < 6; i++) {
      const p = `aaaaaaaa-0000-4000-8000-00000000000${i % 4}`, s = `bbbbbbbb-0000-4000-8000-00000000000${i}`, at = NOW - (2 - i % 3) * 86400_000;
      const attemptId = `cccccccc-0000-4000-8000-00000000000${i}`;
      await postEvents(post({ p, s, dur: 120 * (i + 1), act: 100, e: [
        event('session_start', { ts: at }), event('level_start', { l: 'L1', k: 0, ts: at, d: { attempt: attemptId, seed: 1 } }),
        ...(i % 2 === 0 ? [event('death', { l: 'L1', k: 1000 + i, x: 12 + i * 0.4, z: -30, ts: at, d: { cause: 'infected.walker', attempt: attemptId } })] : []),
        ...(i < 3 ? [event('level_complete', { l: 'L1', k: 9000, ts: at, d: { attempt: attemptId, secs: 300 + i * 60, deaths: 1 } })] : [event('quit', { l: 'L1', k: 2000, x: 40, z: 8, ts: at, d: { why: 'home', attempt: attemptId } })]),
        event('perf', { ts: at, d: { p50: 16.7, p95: 24 + i, sim: 1.5, dc: 400, n: 3000 } }),
      ] }, { c: { ...context, d: i < 4 ? 'desktop' : 'phone', q: i < 4 ? 'high' : 'low' } }), env, at);
    }
    return { env, days };
  }

  it('requires the token', async () => {
    const env = localEnv();
    expect((await getStats(get('stats', 'wrong-token-0123456789abcdef'), env, NOW)).status).toBe(401);
    expect((await getStats(new Request('https://x/api/stats'), env, NOW)).status).toBe(401);
    expect((await getStats(get('stats'), { ...env, TELEMETRY_READ_TOKEN: undefined }, NOW)).status).toBe(401);
    expect((await getReplays(get('replays', 'nope'), env)).status).toBe(401);
    expect((await getStats(new Request('https://x/api/stats', { headers: { authorization: 'Bearer test-token-0123456789abcdef' } }), env, NOW)).status).toBe(200);
  });

  it('reports players per day, session length, level funnel, deaths and quits with positions, and perf per device', async () => {
    const { env } = await seeded();
    const s = await stats(env);
    expect(s.totals).toMatchObject({ players: 4, sessions: 6 });
    expect(s.players_per_day.map((d: { day: string }) => d.day)).toEqual(['2026-10-10', '2026-10-11', '2026-10-12']);
    expect(s.session_length.median_s).toBeGreaterThan(0); expect(Object.values(s.session_length.buckets as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(6);
    expect(s.level_funnel).toEqual([{ level: 'L1', starts: 6, completes: 3, restarts: 0, quits: 3, completion_rate: 0.5, median_clear_s: 360 }]);
    expect(s.deaths[0]).toMatchObject({ level: 'L1', deaths: 3, by_cause: { 'infected.walker': 3 } });
    expect(s.deaths[0].hot_spots[0]).toMatchObject({ x: 15, z: -30, n: 2 });
    expect(s.quits[0].hot_spots[0]).toMatchObject({ x: 40, z: 10, n: 3 });
    expect(s.perf.map((p: { device: string; quality: string; samples: number }) => [p.device, p.quality, p.samples])).toEqual([['desktop', 'high', 4], ['phone', 'low', 2]]);
    expect(s.perf[0]).toMatchObject({ frame_p50_ms: 16.7, draw_calls: 400 });
    expect(s.devices).toHaveLength(2);
  });

  it('lists replays and streams chunks', async () => {
    const env = localEnv(); await postEvents(post({ e: [] }), env, NOW);
    const body = await gzip(new TextEncoder().encode('chunk payload that is long enough'));
    const send = (n: number, extra = '') => postReplay(new Request(`https://x/api/replay?a=${attempt}&p=${player}&s=${session}&n=${n}&l=L1&b=abc1234${extra}`, { method: 'POST', body: body as BodyInit }), env, NOW);
    await send(0); await send(1, '&f=1&o=home&t=50');
    const list = (await (await getReplays(get('replays?level=L1'), env)).json()) as { replays: Record<string, unknown>[] };
    expect(list.replays).toHaveLength(1); expect(list.replays[0]).toMatchObject({ attempt_id: attempt, outcome: 'home', chunks: 2 });
    const detail = (await (await getReplays(get(`replays?id=${attempt}`), env)).json()) as { chunks: { n: number }[] };
    expect(detail.chunks.map(c => c.n)).toEqual([0, 1]);
    const raw = new Uint8Array(await (await getReplays(get(`replays?id=${attempt}&chunk=1`), env)).arrayBuffer());
    expect([...raw]).toEqual([...body]);
    expect((await getReplays(get('replays?id=nope'), env)).status).toBe(400);
    expect((await getReplays(get(`replays?id=${attempt.replace('3', '4')}`), env)).status).toBe(404);
  });
});
