// QA drivers used by every pre-deploy check: the real-input playtest driver (tools/playtest) and Scene Lab specs.
// A broken stuck detector or spec validator silently turns the PO-style QA green.
import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { validateSpec, type SceneSpec } from '../../src/debug/scenelab/spec';
import { frameInterval, type FrameState } from '../../tools/playtest/frames';
import { PlaytestProgress, type ProgressSample } from '../../tools/playtest/progress';
import { campaignEndingComplete, observeWithin } from '../../tools/playtest/startup';

const sample = (seconds: number, fields: Partial<ProgressSample> = {}): ProgressSample => ({ context: 'L6|retreat', text: 'Cover the retreat · 12 m', distance: 12, player: { x: 0, z: 15 }, marker: { x: 12, z: 15 }, tick: seconds * 60, nowMs: seconds * 1000, ...fields });

test('playtest stuck detection: following a moving ring is progress; a parked courier, a 30 s loop or a static zero-distance objective is not', () => {
  const follow = new PlaytestProgress(); follow.update(sample(0));
  for (let t = 1; t <= 45; t++) expect(follow.update(sample(t, { player: { x: t * 2.2, z: 15 }, marker: { x: t * 2.2 + 12, z: 15 } })).seconds).toBeLessThan(2);
  const parked = new PlaytestProgress(); parked.update(sample(0));
  expect(parked.update(sample(31, { marker: { x: 80, z: 15 } })).seconds).toBe(31);
  const loop = new PlaytestProgress(); loop.update(sample(0)); loop.update(sample(1, { player: { x: 3, z: 15 }, marker: { x: 15, z: 15 } }));
  for (let t = 2; t <= 35; t++) loop.update(sample(t, { player: { x: t % 2 ? 3 : 0, z: 15 }, marker: { x: t % 2 ? 15 : 12, z: 15 } }));
  expect(loop.update(sample(36)).seconds).toBeGreaterThan(30);
  const bring = new PlaytestProgress(); bring.update(sample(0, { text: 'Wait for the breach · 42 s' }));
  expect(bring.update(sample(10, { text: 'Wait for the breach · 32 s' })).seconds).toBe(0);
  bring.update(sample(11, { text: 'Bring the injured survivor · 0 m', distance: 0 }));
  expect(bring.update(sample(42, { text: 'Bring the injured survivor · 0 m', distance: 0 })).seconds).toBe(31);
  const respawn = new PlaytestProgress(); respawn.update(sample(0, { player: { x: 50, z: 15 }, marker: { x: 62, z: 15 } }));
  expect(respawn.update(sample(.1, { player: { x: 2, z: 15 }, marker: { x: 14, z: 15 } })).reason).toBe('view-change');
});

test('playtest session: success only after real credits; an unresponsive renderer fails in budget; frame stalls are guarded outside loading', async () => {
  const done = { level: 'L10', phase: 'progression', creditsFinished: true, endingPhase: 'done', completedLevels: 10 };
  expect(campaignEndingComplete(done)).toBe(true);
  for (const partial of [{ creditsFinished: false }, { endingPhase: 'credits' }, { completedLevels: 9 }, { phase: 'playing' }]) expect(campaignEndingComplete({ ...done, ...partial })).toBe(false);
  vi.useFakeTimers();
  try {
    const failure = expect(observeWithin(new Promise<never>(() => {}), 100)).rejects.toThrow('browser renderer is unresponsive');
    await vi.advanceTimersByTimeAsync(100); await failure;
    expect(vi.getTimerCount()).toBe(0);
    expect(await observeWithin(Promise.resolve('frame'))).toBe('frame');
  } finally { vi.useRealTimers(); }
  const playing = (at: number): FrameState => ({ at, level: 'L10', tick: 0, phase: 'playing', loading: false, x: 547, z: 0 });
  const loading = { ...playing(100), loading: true };
  expect(frameInterval(playing(0), loading, null)).toMatchObject({ loading: true, playMs: 0 });
  expect(frameInterval(loading, playing(3000), 2990).playMs).toBe(10);
  expect(frameInterval(playing(3300), { ...playing(4170), tick: 2965 }, 3000).playMs).toBe(870);
});

test('Scene Lab: readable validation errors, and every shipped spec validates against the manifest', () => {
  const assets = new Map((manifest as AssetDef[]).map(a => [a.id, a]));
  const errors = validateSpec({ props: [{ asset: 'prop.nope', at: [0, 0] }], actors: [{ kind: 'courier' }, { kind: 'courier' }], ground: 'district' }, assets).join('\n');
  expect(errors).toMatch(/unknown manifest id prop\.nope/); expect(errors).toMatch(/at most one courier/); expect(errors).toMatch(/needs layout\.district/);
  for (const file of readdirSync('specs/scenes').filter(f => f.endsWith('.json')))
    expect(validateSpec(JSON.parse(readFileSync(`specs/scenes/${file}`, 'utf8')) as SceneSpec, assets), file).toEqual([]);
});
