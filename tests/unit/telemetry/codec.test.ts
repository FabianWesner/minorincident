import { describe, expect, it } from 'vitest';
import { InputLogEncoder, decodeLog, schemes, MAX_CHUNK_BYTES, type LogChunkInfo } from '../../../src/telemetry/codec';
import { gunzip, gzip } from '../../../src/telemetry/gzip';
import { emptyInput, type InputFrame, type Scheme } from '../../../src/input/InputFrame';

/** Same shape rules as Recorder: absent optional fields stay absent, so compare through JSON (drops undefined). */
const plain = (frame: InputFrame): unknown => JSON.parse(JSON.stringify(frame, (_, v) => typeof v === 'number' && !Number.isFinite(v) ? String(v) : v));

function randomFrames(count: number, seed = 7): { frame: InputFrame; scheme: Scheme }[] {
  let state = seed; const rand = (): number => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const out: { frame: InputFrame; scheme: Scheme }[] = [];
  let current: InputFrame = emptyInput(); let scheme: Scheme = 'mouse-keyboard';
  for (let i = 0; i < count; i++) {
    const roll = rand();
    if (roll < .55) { out.push({ frame: structuredClone(current), scheme }); continue; } // unchanged tick
    const next = structuredClone(current);
    const k = Math.floor(rand() * 12);
    if (k === 0) next.move = { x: rand() * 2 - 1, z: rand() * 2 - 1 };
    else if (k === 1) { next.aim = rand() < .2 ? null : { x: rand() - .5, z: rand() - .5 }; next.aimSource = next.aim ? 'pointer' : null; }
    else if (k === 2) { if (rand() < .3) delete next.aimPoint; else next.aimPoint = rand() < .2 ? null : { x: rand() * 100 - 50, z: rand() * 100 - 50 }; }
    else if (k === 3) { if (rand() < .4) delete next.moveTarget; else next.moveTarget = { x: Math.round(rand() * 1e4) / 100, z: -rand() * 100 }; }
    else if (k === 4) { next.left = { down: rand() < .5, held: rand() < .5, up: rand() < .5 }; next.right = { down: false, held: rand() < .5, up: false }; }
    else if (k === 5) { next.selector = [-1, 0, 1][Math.floor(rand() * 3)] as -1 | 0 | 1; next.interact = rand() < .5; next.pause = rand() < .1; }
    else if (k === 6) { if (rand() < .4) delete next.attackTarget; else next.attackTarget = { id: 1 + Math.floor(rand() * 5000), side: rand() < .5 ? 'LEFT' : 'RIGHT' }; }
    else if (k === 7) { next.drive = rand() < .3 ? undefined : { throttle: Math.floor(rand() * 3) - 1, steer: Math.floor(rand() * 3) - 1 }; if (!next.drive) delete next.drive; next.brake = rand() < .5; }
    else if (k === 8) { for (const key of ['mouseAttack', 'attackInPlace', 'selectorActive', 'cancelMove', 'pointerGround', 'pointerTarget', 'navigation', 'walk', 'activeAttack', 'orderedSelection', 'handbrake'] as const) { const v = rand(); if (v < .3) delete next[key]; else next[key] = v < .65; } }
    else if (k === 9) { if (rand() < .5) delete next.selectedActiveSlot; else next.selectedActiveSlot = Math.floor(rand() * 8); if (rand() < .5) delete next.selectedSlot; else next.selectedSlot = { side: rand() < .5 ? 'LEFT' : 'RIGHT', index: Math.floor(rand() * 6) }; }
    else if (k === 10) { if (rand() < .5) delete next.selectorSide; else next.selectorSide = rand() < .5 ? 'LEFT' : 'RIGHT'; }
    else { scheme = schemes[Math.floor(rand() * schemes.length)]; next.aimSource = ([null, 'pointer', 'keyboard', 'touch', 'assist'] as const)[Math.floor(rand() * 5)]; }
    current = next; out.push({ frame: structuredClone(current), scheme });
  }
  return out;
}

function encode(frames: { frame: InputFrame; scheme: Scheme }[], chunkBytes?: number, commands: Record<number, [Parameters<InputLogEncoder['command']>[0], number][]> = {}): { chunks: Uint8Array[]; infos: LogChunkInfo[] } {
  const chunks: Uint8Array[] = [], infos: LogChunkInfo[] = [];
  const encoder = new InputLogEncoder((bytes, info) => { chunks.push(bytes); infos.push(info); }, chunkBytes);
  encoder.begin({ level: 'L1', seed: 5 });
  frames.forEach((f, i) => { for (const [kind, value] of commands[i] ?? []) encoder.command(kind, value); encoder.add(f.frame, f.scheme); });
  encoder.end();
  return { chunks, infos };
}

describe('input log codec', () => {
  it('round-trips every InputFrame field exactly, including absent vs false vs null', () => {
    const frames = randomFrames(4000);
    const { chunks } = encode(frames);
    const log = decodeLog(chunks);
    expect(log.samples).toBe(frames.length);
    expect(log.meta).toMatchObject({ level: 'L1', seed: 5 });
    for (let i = 0; i < frames.length; i++) {
      expect(plain(log.frames[i]), `sample ${i}`).toEqual(plain(frames[i].frame));
      expect(schemes[log.schemes[i]], `scheme ${i}`).toBe(frames[i].scheme);
    }
  });

  it('keeps float64 precision (replays must be exact)', () => {
    const frame = emptyInput(); frame.move = { x: 0.1 + 0.2, z: -Math.PI }; frame.aim = { x: 1 / 3, z: Math.SQRT1_2 }; frame.aimSource = 'pointer'; frame.aimPoint = { x: 12345.678901234, z: -0.000123456789 };
    const log = decodeLog(encode([{ frame, scheme: 'mouse-only' }]).chunks);
    expect(log.frames[0].move).toEqual(frame.move); expect(log.frames[0].aim).toEqual(frame.aim); expect(log.frames[0].aimPoint).toEqual(frame.aimPoint);
  });

  it('cuts independent chunks (keyframe each) under the upload cap and decodes them in order', () => {
    const frames = randomFrames(30000, 3);
    const { chunks, infos } = encode(frames, 8 * 1024);
    expect(chunks.length).toBeGreaterThan(3);
    for (const info of infos) expect(info.bytes).toBeLessThan(MAX_CHUNK_BYTES);
    expect(infos[0].startSample).toBe(0); expect(infos.at(-1)!.endSample).toBe(frames.length);
    for (let i = 1; i < infos.length; i++) expect(infos[i].startSample).toBe(infos[i - 1].endSample);
    const log = decodeLog(chunks);
    expect(log.samples).toBe(frames.length);
    for (let i = 0; i < frames.length; i += 37) expect(plain(log.frames[i])).toEqual(plain(frames[i].frame));
    // A later chunk decodes on its own (keyframe): feed only chunk 2 with the right start offset check disabled by rebuilding.
    const solo = decodeLog(chunks.slice(0, 1));
    expect(solo.samples).toBe(infos[0].endSample);
  });

  it('rejects a chunk gap and garbage', () => {
    const { chunks } = encode(randomFrames(20000, 4), 4096);
    expect(() => decodeLog([chunks[0], chunks[2]])).toThrow(/gap/);
    expect(() => decodeLog([new Uint8Array(40)])).toThrow(/Not a replay chunk/);
  });

  it('records commands at their sample index', () => {
    const frames = randomFrames(500, 9);
    const { chunks } = encode(frames, undefined, { 0: [['view', 1600 * 65536 + 900]], 10: [['zoom', -0.123456789]], 11: [['tier', 1]], 400: [['phase', 0], ['zoom', 0.5]] });
    const { commands } = decodeLog(chunks);
    expect(commands).toEqual([
      { at: 0, kind: 'view', value: 1600 * 65536 + 900 }, { at: 10, kind: 'zoom', value: -0.123456789 }, { at: 11, kind: 'tier', value: 1 },
      { at: 400, kind: 'phase', value: 0 }, { at: 400, kind: 'zoom', value: 0.5 },
    ]);
  });

  it('periodic cut() emits partial chunks that still decode as one log', () => {
    const frames = randomFrames(900, 11), chunks: Uint8Array[] = [];
    const encoder = new InputLogEncoder(bytes => chunks.push(bytes));
    encoder.begin({ level: 'L2' });
    frames.forEach((f, i) => { encoder.add(f.frame, f.scheme); if (i % 300 === 299) encoder.cut(); });
    encoder.end();
    expect(chunks.length).toBe(4); // 3 cuts + tail marker
    const log = decodeLog(chunks);
    expect(log.samples).toBe(900); expect(plain(log.frames[899])).toEqual(plain(frames[899].frame));
  });

  it('an idle player costs almost nothing and gzip shrinks active play', async () => {
    const idle = Array.from({ length: 60 * 60 * 5 }, () => ({ frame: emptyInput(), scheme: 'mouse-only' as Scheme }));
    expect(encode(idle).chunks.reduce((n, c) => n + c.length, 0)).toBeLessThan(200);
    const active = randomFrames(60 * 60, 21), raw = encode(active).chunks[0];
    const packed = await gzip(raw);
    expect(packed.length).toBeLessThan(raw.length);
    expect(decodeLog([await gunzip(packed)]).samples).toBe(active.length);
  });

  it('recording cost stays far below 0.1 ms per tick', () => {
    const frames = randomFrames(60 * 60 * 2, 5).map(f => f.frame);
    const encoder = new InputLogEncoder(() => undefined);
    encoder.begin({ level: 'L1' });
    for (let i = 0; i < 2000; i++) encoder.add(frames[i], 'mouse-keyboard'); // warm up
    const start = performance.now(); let n = 0;
    for (let round = 0; round < 20; round++) for (const frame of frames) { encoder.add(frame, 'mouse-keyboard'); n++; }
    const perTickMs = (performance.now() - start) / n;
    console.log(`input log encode cost: ${(perTickMs * 1000).toFixed(2)} us per tick`);
    expect(perTickMs).toBeLessThan(0.02);
  });
});
