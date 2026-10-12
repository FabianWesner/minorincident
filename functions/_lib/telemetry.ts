import type { Env } from './types';

/**
 * Anonymous play telemetry handlers (Cloudflare Pages Functions call these; tests call them against a local D1).
 * Nothing identifying is stored: random ids, device class, quality tier, backend, build commit, viewport bucket.
 */
export const limits = {
  eventBody: 48 * 1024, eventsPerRequest: 120, eventsPerSession: 6000, bytesPerSession: 1_500_000, requestsPerSession: 2500,
  sessionsPerPlayerDay: 120, replayChunk: 256 * 1024, replayBytesPerSession: 24 * 1024 * 1024, chunksPerAttempt: 600,
  dataKeys: 8, dataBytes: 320, maxFuture: 5 * 60_000, maxPast: 36 * 3600_000,
} as const;
export const eventTypes = ['session_start', 'heartbeat', 'session_end', 'level_start', 'level_complete', 'level_restart', 'death', 'quit', 'checkpoint', 'weapon_pickup', 'perf'] as const;
export type EventType = typeof eventTypes[number];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const level = /^[A-Za-z0-9_-]{1,24}$/, build = /^[A-Za-z0-9._-]{1,40}$/, word = /^[\w .:/-]{0,40}$/, key = /^[a-z][a-z0-9_]{0,15}$/;
const devices = ['desktop', 'phone', 'tablet'], tiers = ['high', 'low'], backends = ['webgl', 'webgpu'];

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
export const bad = (message: string, status = 400): Response => json({ ok: false, error: message }, status);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, min: number, max: number): number | null => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export interface CleanEvent { type: EventType; ts: number; level: string | null; tick: number | null; x: number | null; z: number | null; data: string | null }
function cleanData(raw: unknown): string | null | undefined {
  if (raw === undefined) return null;
  if (!isObject(raw)) return undefined;
  const entries = Object.entries(raw);
  if (entries.length > limits.dataKeys) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of entries) {
    if (!key.test(k)) return undefined;
    if (typeof v === 'number') { if (!Number.isFinite(v) || Math.abs(v) > 1e9) return undefined; out[k] = Math.round(v * 1000) / 1000; }
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') { if (!word.test(v)) return undefined; out[k] = v; }
    else return undefined;
  }
  if (!entries.length) return null;
  const text = JSON.stringify(out);
  return text.length <= limits.dataBytes ? text : undefined;
}
/** Strict validation: unknown types, extra fields or out-of-range values reject the whole request. */
export function cleanEvents(raw: unknown, now: number): CleanEvent[] | string {
  if (!Array.isArray(raw)) return 'e must be an array';
  if (raw.length > limits.eventsPerRequest) return 'too many events';
  const out: CleanEvent[] = [];
  for (const item of raw) {
    if (!isObject(item)) return 'event must be an object';
    for (const k of Object.keys(item)) if (!['t', 'ts', 'l', 'k', 'x', 'z', 'd'].includes(k)) return `unknown event field ${k}`;
    if (typeof item.t !== 'string' || !(eventTypes as readonly string[]).includes(item.t)) return 'unknown event type';
    const ts = item.ts === undefined ? now : num(item.ts, 1.6e12, 4e12);
    if (ts === null) return 'bad ts';
    if (item.l !== undefined && (typeof item.l !== 'string' || !level.test(item.l))) return 'bad level';
    const tick = item.k === undefined ? null : num(item.k, 0, 1e8), x = item.x === undefined ? null : num(item.x, -5000, 5000), z = item.z === undefined ? null : num(item.z, -5000, 5000);
    if (item.k !== undefined && tick === null || item.x !== undefined && x === null || item.z !== undefined && z === null) return 'bad number';
    const data = cleanData(item.d); if (data === undefined) return 'bad data';
    out.push({ type: item.t as EventType, ts: Math.min(now + limits.maxFuture, Math.max(now - limits.maxPast, ts)), level: (item.l as string | undefined) ?? null, tick: tick === null ? null : Math.round(tick), x, z, data });
  }
  return out;
}

/** POST /api/t */
export async function postEvents(request: Request, env: Env, now = Date.now()): Promise<Response> {
  if (!env.DB) return bad('telemetry not configured', 503);
  const text = await request.text();
  if (text.length > limits.eventBody) return bad('payload too large', 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return bad('invalid json'); }
  if (!isObject(body) || body.v !== 1) return bad('unsupported version');
  const { p, s, c } = body;
  if (typeof p !== 'string' || !uuid.test(p) || typeof s !== 'string' || !uuid.test(s)) return bad('bad ids');
  if (!isObject(c)) return bad('bad context');
  for (const k of Object.keys(c)) if (!['d', 'q', 'b', 'v', 'vp'].includes(k)) return bad('unknown context field');
  if (!devices.includes(c.d as string) || !tiers.includes(c.q as string) || !backends.includes(c.b as string)) return bad('bad context');
  if (typeof c.v !== 'string' || !build.test(c.v) || typeof c.vp !== 'string' || !/^[0-9]{3,4}x[0-9]{3,4}$/.test(c.vp)) return bad('bad context');
  const dur = num(body.dur, 0, 7 * 86400), act = num(body.act, 0, 7 * 86400);
  if (dur === null || act === null) return bad('bad durations');
  const events = cleanEvents(body.e, now);
  if (typeof events === 'string') return bad(events);
  const today = day(now);
  // New session: cap how many sessions one anonymous player can open per day.
  const known = await env.DB.prepare('SELECT player_id FROM sessions WHERE session_id = ?').bind(s).first<{ player_id: string }>();
  if (known && known.player_id !== p) return bad('session belongs to another player', 403);
  if (!known) {
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE player_id = ? AND day = ?').bind(p, today).first<{ n: number }>();
    if ((count?.n ?? 0) >= limits.sessionsPerPlayerDay) return bad('too many sessions', 429);
    await env.DB.prepare('INSERT OR IGNORE INTO sessions (session_id, player_id, day, started_at, last_seen, device, quality, backend, build, viewport) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(s, p, today, now, now, c.d, c.q, c.b, c.v, c.vp).run();
  }
  // Per-session caps are enforced in the UPDATE itself, so concurrent requests cannot overshoot them.
  const ended = events.some(e => e.type === 'session_end') ? 1 : 0;
  const update = await env.DB.prepare(
    'UPDATE sessions SET last_seen = ?, dur_s = MAX(dur_s, ?), active_s = MAX(active_s, ?), quality = ?, backend = ?, build = ?, events = events + ?, bytes = bytes + ?, reqs = reqs + 1, ended = MAX(ended, ?) WHERE session_id = ? AND player_id = ? AND events + ? <= ? AND bytes + ? <= ? AND reqs < ?')
    .bind(now, Math.round(dur), Math.round(act), c.q, c.b, c.v, events.length, text.length, ended, s, p, events.length, limits.eventsPerSession, text.length, limits.bytesPerSession, limits.requestsPerSession).run();
  if (!update.meta?.changes) return bad('session quota exceeded', 429);
  if (events.length) {
    const insert = 'INSERT INTO events (session_id, player_id, day, ts, type, level, tick, x, z, data) VALUES (?,?,?,?,?,?,?,?,?,?)';
    await env.DB.batch(events.map(e => env.DB.prepare(insert).bind(s, p, day(e.ts), e.ts, e.type, e.level, e.tick, e.x, e.z, e.data)));
  }
  return json({ ok: true, n: events.length });
}

/** POST /api/replay?a=<attempt>&p=&s=&n=<seq>&l=<level>&b=<build>&f=<1 if last>&o=<outcome>&t=<ticks>&m=<samples> with a gzip body. */
export async function postReplay(request: Request, env: Env, now = Date.now()): Promise<Response> {
  if (!env.DB || !env.REPLAYS) return bad('telemetry not configured', 503);
  const q = new URL(request.url).searchParams;
  const a = q.get('a') ?? '', p = q.get('p') ?? '', s = q.get('s') ?? '', l = q.get('l') ?? '', b = q.get('b') ?? '', o = q.get('o') ?? '';
  const n = Number(q.get('n')), ticks = Number(q.get('t') ?? 0), samples = Number(q.get('m') ?? 0), last = q.get('f') === '1';
  if (![a, p, s].every(v => uuid.test(v))) return bad('bad ids');
  if (!Number.isInteger(n) || n < 0 || n >= limits.chunksPerAttempt || !level.test(l) || !build.test(b)) return bad('bad parameters');
  if (!Number.isInteger(ticks) || ticks < 0 || ticks > 1e8 || !Number.isInteger(samples) || samples < 0 || samples > 1e8) return bad('bad counters');
  if (o && !['complete', 'restart', 'home', 'close', 'next', 'open'].includes(o)) return bad('bad outcome');
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > limits.replayChunk) return bad('chunk too large', 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > limits.replayChunk) return bad('chunk too large', 413);
  if (bytes.length < 20 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bad('chunk must be gzip');
  const session = await env.DB.prepare('SELECT player_id, replay_bytes FROM sessions WHERE session_id = ?').bind(s).first<{ player_id: string; replay_bytes: number }>();
  if (!session || session.player_id !== p) return bad('unknown session', 403);
  const owner = await env.DB.prepare('SELECT session_id, day FROM replays WHERE attempt_id = ?').bind(a).first<{ session_id: string; day: string }>();
  if (owner && owner.session_id !== s) return bad('attempt belongs to another session', 403);
  const today = day(now), objectKey = `${owner?.day ?? today}/${a}/${String(n).padStart(4, '0')}.gz`;
  // A retry of an already stored chunk is idempotent and not counted twice.
  const fresh = (await env.REPLAYS.head(objectKey)) === null;
  if (fresh) {
    const quota = await env.DB.prepare('UPDATE sessions SET replay_bytes = replay_bytes + ? WHERE session_id = ? AND replay_bytes + ? <= ?').bind(bytes.length, s, bytes.length, limits.replayBytesPerSession).run();
    if (!quota.meta?.changes) return bad('replay quota exceeded', 429);
    await env.REPLAYS.put(objectKey, bytes, { customMetadata: { level: l, build: b } });
  }
  if (owner) {
    await env.DB.prepare('UPDATE replays SET updated_at = ?, chunks = MAX(chunks, ?), bytes = bytes + ?, final = MAX(final, ?), outcome = CASE WHEN ? != \'\' THEN ? ELSE outcome END, ticks = MAX(ticks, ?), samples = MAX(samples, ?) WHERE attempt_id = ?')
      .bind(now, n + 1, fresh ? bytes.length : 0, last ? 1 : 0, o, o, ticks, samples, a).run();
  } else {
    await env.DB.prepare('INSERT OR IGNORE INTO replays (attempt_id, session_id, player_id, level, build, day, created_at, updated_at, chunks, bytes, final, outcome, ticks, samples) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(a, s, p, l, b, today, now, now, n + 1, bytes.length, last ? 1 : 0, o || 'open', ticks, samples).run();
  }
  return json({ ok: true });
}
function authorized(request: Request, env: Env): boolean {
  const expected = env.TELEMETRY_READ_TOKEN;
  if (!expected || expected.length < 16) return false;
  const url = new URL(request.url);
  const given = url.searchParams.get('token') ?? request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
const percentile = (sorted: number[], p: number): number => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
const round = (v: number | null | undefined, d = 1): number => Math.round((v ?? 0) * 10 ** d) / 10 ** d;

/** GET /api/stats?token=…&days=14 */
export async function getStats(request: Request, env: Env, now = Date.now()): Promise<Response> {
  if (!authorized(request, env)) return bad('unauthorized', 401);
  if (!env.DB) return bad('telemetry not configured', 503);
  const url = new URL(request.url);
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? 14) || 14));
  const since = day(now - (days - 1) * 86400_000);
  const all = async <T>(sql: string, ...args: unknown[]): Promise<T[]> => (await env.DB.prepare(sql).bind(...args).all<T>()).results;
  const perDay = await all<{ day: string; players: number; sessions: number; avg_min: number }>('SELECT day, COUNT(DISTINCT player_id) AS players, COUNT(*) AS sessions, ROUND(AVG(dur_s) / 60.0, 1) AS avg_min FROM sessions WHERE day >= ? GROUP BY day ORDER BY day', since);
  const totals = await env.DB.prepare('SELECT COUNT(DISTINCT player_id) AS players, COUNT(*) AS sessions, ROUND(AVG(dur_s) / 60.0, 1) AS avg_min, ROUND(AVG(active_s) / 60.0, 1) AS avg_active_min FROM sessions WHERE day >= ?').bind(since).first<Record<string, number>>();
  const returning = await env.DB.prepare('SELECT COUNT(*) AS n FROM (SELECT player_id FROM sessions WHERE day >= ? GROUP BY player_id HAVING COUNT(DISTINCT day) > 1)').bind(since).first<{ n: number }>();
  const durations = (await all<{ dur_s: number }>('SELECT dur_s FROM sessions WHERE day >= ? ORDER BY dur_s LIMIT 20000', since)).map(r => r.dur_s);
  const bucket = (lo: number, hi: number): number => durations.filter(d => d >= lo * 60 && d < hi * 60).length;
  const funnelRows = await all<{ level: string; type: string; n: number }>('SELECT level, type, COUNT(*) AS n FROM events WHERE day >= ? AND level IS NOT NULL AND type IN (\'level_start\',\'level_complete\',\'level_restart\',\'quit\') GROUP BY level, type', since);
  const clearTimes = await all<{ level: string; secs: number }>('SELECT level, json_extract(data, \'$.secs\') AS secs FROM events WHERE day >= ? AND type = \'level_complete\' AND json_extract(data, \'$.secs\') IS NOT NULL', since);
  const funnel = [...new Set(funnelRows.map(r => r.level))].sort().map(lv => {
    const n = (type: string): number => funnelRows.find(r => r.level === lv && r.type === type)?.n ?? 0;
    const times = clearTimes.filter(r => r.level === lv).map(r => r.secs).sort((a, b) => a - b);
    return { level: lv, starts: n('level_start'), completes: n('level_complete'), restarts: n('level_restart'), quits: n('quit'), completion_rate: n('level_start') ? round(n('level_complete') / n('level_start'), 3) : 0, median_clear_s: round(percentile(times, .5), 0) };
  });
  const spots = async (type: string) => all<{ level: string; gx: number; gz: number; n: number; avg_tick: number }>('SELECT level, CAST(ROUND(x / 5.0) * 5 AS INTEGER) AS gx, CAST(ROUND(z / 5.0) * 5 AS INTEGER) AS gz, COUNT(*) AS n, CAST(AVG(tick) AS INTEGER) AS avg_tick FROM events WHERE day >= ? AND type = ? AND level IS NOT NULL AND x IS NOT NULL GROUP BY level, gx, gz ORDER BY n DESC LIMIT 150', since, type);
  const deathCauses = await all<{ level: string; cause: string; n: number }>('SELECT level, COALESCE(json_extract(data, \'$.cause\'), \'unknown\') AS cause, COUNT(*) AS n FROM events WHERE day >= ? AND type = \'death\' AND level IS NOT NULL GROUP BY level, cause ORDER BY n DESC', since);
  const deathTotals = await all<{ level: string; n: number }>('SELECT level, COUNT(*) AS n FROM events WHERE day >= ? AND type = \'death\' AND level IS NOT NULL GROUP BY level', since);
  const deathSpots = await spots('death'), quitSpots = await spots('quit');
  const group = <T extends { level: string }>(rows: T[], lv: string): T[] => rows.filter(r => r.level === lv);
  const deaths = deathTotals.map(r => ({ level: r.level, deaths: r.n, by_cause: Object.fromEntries(group(deathCauses, r.level).map(c => [c.cause, c.n])), hot_spots: group(deathSpots, r.level).slice(0, 12).map(({ gx, gz, n, avg_tick }) => ({ x: gx, z: gz, n, avg_tick })) }));
  const quitLevels = [...new Set(quitSpots.map(r => r.level))];
  const quits = quitLevels.map(lv => ({ level: lv, hot_spots: group(quitSpots, lv).slice(0, 12).map(({ gx, gz, n, avg_tick }) => ({ x: gx, z: gz, n, avg_tick })) }));
  const perf = await all<Record<string, unknown>>('SELECT s.device AS device, s.backend AS backend, s.quality AS quality, COUNT(*) AS samples, ROUND(AVG(json_extract(e.data, \'$.p50\')), 2) AS frame_p50_ms, ROUND(AVG(json_extract(e.data, \'$.p95\')), 2) AS frame_p95_ms, ROUND(AVG(json_extract(e.data, \'$.sim\')), 2) AS sim_ms, ROUND(AVG(json_extract(e.data, \'$.dc\')), 0) AS draw_calls FROM events e JOIN sessions s ON s.session_id = e.session_id WHERE e.day >= ? AND e.type = \'perf\' GROUP BY s.device, s.backend, s.quality ORDER BY samples DESC', since);
  const devices = await all<{ device: string; backend: string; sessions: number }>('SELECT device, backend, COUNT(*) AS sessions FROM sessions WHERE day >= ? GROUP BY device, backend ORDER BY sessions DESC', since);
  const builds = await all<{ build: string; sessions: number }>('SELECT build, COUNT(*) AS sessions FROM sessions WHERE day >= ? GROUP BY build ORDER BY sessions DESC LIMIT 10', since);
  const replays = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS bytes FROM replays WHERE day >= ?').bind(since).first<{ n: number; bytes: number }>();
  return json({
    generated_at: new Date(now).toISOString(), days, since,
    totals: { players: totals?.players ?? 0, sessions: totals?.sessions ?? 0, returning_players: returning?.n ?? 0, avg_session_min: totals?.avg_min ?? 0, avg_active_min: totals?.avg_active_min ?? 0 },
    players_per_day: perDay,
    session_length: { median_s: percentile(durations, .5), p90_s: percentile(durations, .9), buckets: { 'under_1m': bucket(0, 1), '1_5m': bucket(1, 5), '5_15m': bucket(5, 15), '15_30m': bucket(15, 30), '30_60m': bucket(30, 60), 'over_60m': bucket(60, 1e9) } },
    level_funnel: funnel, deaths, quits, perf, devices, builds, replays: { count: replays?.n ?? 0, bytes: replays?.bytes ?? 0 },
  });
}

/** GET /api/replays?token=…[&limit=50&level=L1&outcome=quit] lists; &id=<attempt> shows its chunks; &id=…&chunk=<n> streams one gzip chunk. */
export async function getReplays(request: Request, env: Env): Promise<Response> {
  if (!authorized(request, env)) return bad('unauthorized', 401);
  if (!env.DB || !env.REPLAYS) return bad('telemetry not configured', 503);
  const q = new URL(request.url).searchParams, id = q.get('id');
  if (id) {
    if (!uuid.test(id)) return bad('bad id');
    const row = await env.DB.prepare('SELECT * FROM replays WHERE attempt_id = ?').bind(id).first<{ day: string }>();
    if (!row) return bad('not found', 404);
    const prefix = `${row.day}/${id}/`;
    const chunk = q.get('chunk');
    if (chunk !== null) {
      const n = Number(chunk); if (!Number.isInteger(n) || n < 0 || n >= limits.chunksPerAttempt) return bad('bad chunk');
      const object = await env.REPLAYS.get(`${prefix}${String(n).padStart(4, '0')}.gz`);
      return object ? new Response(await object.arrayBuffer(), { headers: { 'content-type': 'application/gzip', 'cache-control': 'no-store' } }) : bad('chunk not found', 404);
    }
    const listed = await env.REPLAYS.list({ prefix, limit: limits.chunksPerAttempt });
    return json({ replay: row, chunks: listed.objects.map(o => ({ n: Number(o.key.slice(prefix.length, -3)), bytes: o.size })).sort((x, y) => x.n - y.n) });
  }
  const limit = Math.max(1, Math.min(200, Number(q.get('limit') ?? 50) || 50)), lv = q.get('level'), outcome = q.get('outcome');
  const where = ['1=1'], args: unknown[] = [];
  if (lv && level.test(lv)) { where.push('level = ?'); args.push(lv); }
  if (outcome && /^[a-z]{1,10}$/.test(outcome)) { where.push('outcome = ?'); args.push(outcome); }
  const rows = (await env.DB.prepare(`SELECT attempt_id, session_id, level, build, day, created_at, updated_at, chunks, bytes, final, outcome, ticks, samples FROM replays WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT ?`).bind(...args, limit).all()).results;
  return json({ replays: rows });
}
