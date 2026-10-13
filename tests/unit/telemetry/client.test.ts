import { describe, expect, it } from 'vitest';
import { EventClient, batchLimits, classifyDevice, viewportBucket, type SendResult, type Transport } from '../../../src/telemetry/client';
import { ReplayRecorder } from '../../../src/telemetry/replay';
import { decodeLog } from '../../../src/telemetry/codec';
import { gunzip, gzip } from '../../../src/telemetry/gzip';
import { emptyInput } from '../../../src/input/InputFrame';

const context = () => ({ d: 'desktop' as const, q: 'high' as const, b: 'webgl' as const, v: 'abc1234', vp: '1600x960' });
const ids = { playerId: '11111111-1111-4111-8111-111111111111', sessionId: '22222222-2222-4222-8222-222222222222' };
function rig(results: SendResult[] = []) {
  const sent: { url: string; body: { e: { t: string }[]; dur: number; act: number; c: unknown }; final: boolean }[] = [];
  const clock = { now: 1_800_000_000_000 };
  const transport: Transport = { send: async (url, body, final) => { sent.push({ url, body: JSON.parse(body), final }); return results.shift() ?? 'ok'; } };
  const client = new EventClient({ ...ids, context, transport, now: () => clock.now });
  return { client, sent, clock };
}

describe('event batching', () => {
  it('batches events into one request with durations and context', async () => {
    const { client, sent, clock } = rig();
    client.push('session_start'); clock.now += 30_000; client.push('heartbeat'); client.push('level_start', { l: 'L1', k: 0, d: { seed: 1 } });
    expect(await client.flush()).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/api/t'); expect(sent[0].body.e.map(e => e.t)).toEqual(['session_start', 'heartbeat', 'level_start']);
    expect(sent[0].body.dur).toBe(30); expect(sent[0].body.c).toEqual(context());
    expect(client.queued).toBe(0);
    expect(await client.flush()).toBe(true); expect(sent).toHaveLength(1); // nothing queued, nothing sent
  });

  it('splits large queues into requests of at most 100 events', async () => {
    const { client, sent } = rig();
    for (let i = 0; i < 250; i++) client.push('heartbeat');
    await client.flush();
    expect(sent.map(s => s.body.e.length)).toEqual([100, 100, 50]);
  });

  it('keeps events on failure and backs off exponentially, final flush ignores the back-off', async () => {
    const { client, sent, clock } = rig(['retry', 'retry']);
    client.push('heartbeat');
    expect(await client.flush()).toBe(false); expect(client.queued).toBe(1);
    expect(await client.flush()).toBe(false); expect(sent).toHaveLength(1); // still inside the back-off window
    clock.now += batchLimits.intervalMs * 2 + 1;
    expect(await client.flush()).toBe(false); expect(sent).toHaveLength(2);
    expect(await client.flush(true)).toBe(true); expect(sent.at(-1)!.final).toBe(true); expect(client.queued).toBe(0);
  });

  it('drops refused batches and stops completely when the endpoint is missing', async () => {
    const dropped = rig(['drop']); dropped.client.push('heartbeat');
    await dropped.client.flush(); expect(dropped.client.queued).toBe(0); expect(dropped.client.stopped).toBe(false);
    const missing = rig(['stop']); missing.client.push('heartbeat');
    await missing.client.flush(); expect(missing.client.stopped).toBe(true);
    missing.client.push('heartbeat'); expect(missing.client.queued).toBe(0);
  });

  it('caps queue length and events per session', async () => {
    const { client } = rig();
    for (let i = 0; i < 1000; i++) client.push('heartbeat');
    expect(client.queued).toBe(batchLimits.queue);
    const capped = rig();
    for (let i = 0; i < batchLimits.perSession + 50; i++) { capped.client.push('heartbeat'); if (i % 300 === 0) await capped.client.flush(); }
    await capped.client.flush();
    expect(capped.sent.reduce((n, s) => n + s.body.e.length, 0)).toBeLessThanOrEqual(batchLimits.perSession);
  });

  it('counts only visible time as active', () => {
    const { client, clock } = rig();
    clock.now += 60_000; client.setVisible(false); clock.now += 600_000; client.setVisible(true); clock.now += 30_000;
    expect(client.activeSeconds).toBe(90); expect(client.durationSeconds).toBe(690);
  });

  it('never sends anything that identifies the player beyond the random ids', async () => {
    const { client, sent } = rig();
    client.push('session_start'); await client.flush();
    const text = JSON.stringify(sent[0].body);
    expect(Object.keys(sent[0].body).sort()).toEqual(['act', 'c', 'dur', 'e', 'p', 's', 'v']);
    expect(text).not.toMatch(/Mozilla|AppleWebKit|userAgent|@/);
  });
});

describe('device classification', () => {
  it('maps user agents to a coarse class and buckets the viewport', () => {
    const phone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
    expect(classifyDevice({ userAgent: phone, touchPoints: 5, coarse: true, shortSide: 390 })).toBe('phone');
    expect(classifyDevice({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', touchPoints: 5, coarse: true, shortSide: 820 })).toBe('tablet');
    expect(classifyDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit', touchPoints: 5, coarse: true, shortSide: 820 })).toBe('tablet');
    expect(classifyDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7)', touchPoints: 5, coarse: true, shortSide: 412 })).toBe('phone');
    expect(classifyDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', touchPoints: 0, coarse: false, shortSide: 1080 })).toBe('desktop');
    expect(viewportBucket(1913, 947)).toBe('1920x960'); expect(viewportBucket(390, 844)).toBe('320x800');
  });
});

describe('replay recorder', () => {
  it('uploads ordered gzip chunks with a final marker and the attempt metadata', async () => {
    const posts: { url: URL; body: Uint8Array; final: boolean }[] = [];
    const recorder = new ReplayRecorder({ ...ids, build: 'abc1234' }, { post: async (url, body, final) => { posts.push({ url: new URL(url, 'https://x'), body, final }); return 'ok'; } }, gzip, { keep: true, chunkBytes: 2048 });
    recorder.begin('L1', { seed: 3, campaign: null }, '33333333-3333-4333-8333-333333333333');
    for (let i = 0; i < 4000; i++) { const f = emptyInput(); f.move = { x: Math.sin(i / 7), z: Math.cos(i / 5) }; recorder.sample(f, 'keyboard'); if (i === 1999) recorder.cut(1900); }
    recorder.end('complete', 3900);
    await recorder.idle();
    expect(posts.length).toBeGreaterThan(2);
    posts.forEach((p, i) => { expect(p.url.pathname).toBe('/api/replay'); expect(p.url.searchParams.get('n')).toBe(String(i)); expect(p.url.searchParams.get('a')).toBe('33333333-3333-4333-8333-333333333333'); expect(p.url.searchParams.get('l')).toBe('L1'); expect(p.body.length).toBeLessThan(256 * 1024); expect(p.body[0]).toBe(0x1f); });
    const last = posts.at(-1)!; expect(last.url.searchParams.get('f')).toBe('1'); expect(last.url.searchParams.get('o')).toBe('complete'); expect(last.url.searchParams.get('t')).toBe('3900'); expect(last.final).toBe(true);
    expect(posts.slice(0, -1).every(p => p.url.searchParams.get('f') === null)).toBe(true);
    const log = decodeLog(await Promise.all(posts.map(p => gunzip(p.body))));
    expect(log.samples).toBe(4000); expect(log.meta).toMatchObject({ seed: 3, level: 'L1', build: 'abc1234', attempt: '33333333-3333-4333-8333-333333333333' });
  });

  it('retries a failed chunk, then gives up without blocking later ones', async () => {
    let calls = 0;
    const recorder = new ReplayRecorder({ ...ids, build: 'x' }, { post: async () => (++calls <= 1 ? 'retry' : 'ok') }, async b => b);
    recorder.begin('L2', {}, '44444444-4444-4444-8444-444444444444'); recorder.sample(emptyInput(), 'touch'); recorder.end('home', 1);
    await recorder.idle();
    expect(calls).toBe(2); expect(recorder.dropped).toBe(0);
  });

  it('stops uploading when the server says the endpoint does not exist', async () => {
    let calls = 0;
    const recorder = new ReplayRecorder({ ...ids, build: 'x' }, { post: async () => { calls++; return 'stop'; } }, async b => b, { chunkBytes: 1024 });
    recorder.begin('L2', {}, '55555555-5555-4555-8555-555555555555');
    for (let i = 0; i < 5000; i++) { const f = emptyInput(); f.move = { x: i, z: -i }; recorder.sample(f, 'touch'); }
    recorder.end('close', 1); await recorder.idle();
    expect(calls).toBe(1); expect(recorder.stopped).toBe(true);
  });
});

describe('telemetry mode', () => {
  const mode = async (query: string, host: string, webdriver = false) => (await import('../../../src/telemetry/index')).telemetryMode(new URLSearchParams(query), host, webdriver);
  it('is on for real players of the live site and off for tests, automation and local dev', async () => {
    expect(await mode('', 'minor-incident.com')).toBe('live');
    expect(await mode('quality=high', 'minor-incident-abc.pages.dev')).toBe('live');
    expect(await mode('', 'minor-incident.com', true)).toBeNull();
    expect(await mode('test=1', 'minor-incident.com')).toBeNull();
    expect(await mode('scenelab=1', 'minor-incident.com')).toBeNull();
    // The PO plays PROD with ?debug=true (pause-menu build/tick panel): those sessions must count (telemetry-gap 10-13).
    expect(await mode('debug=true', 'minor-incident.com')).toBe('live');
    expect(await mode('debug=true', 'minor-incident.com', true)).toBeNull();
    expect(await mode('', 'localhost')).toBeNull(); expect(await mode('', '127.0.0.1')).toBeNull();
    expect(await mode('test=1&telemetry=record', '127.0.0.1', true)).toBe('record');
    expect(await mode('telemetry=live', '127.0.0.1', true)).toBe('live');
  });
});
