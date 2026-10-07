import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { InfectedMoves, flinchSeconds } from '../../../src/render/characters/InfectedMoves';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { drive, metrics, scenarios } from '../../../tools/crowdfoot/harness';

/** Crowd footwork regression: planted feet must not slide (≤ 3 cm per contact) or yaw (≤ 8°) near the camera. */
test('pedestrian footwork: planted feet ≤ 3 cm slide, ≤ 8° yaw drift, steps through turns @E07', { timeout: 120_000 }, async () => {
  const results: Record<string, unknown>[] = [];
  for (const [asset, scale] of [['npc.civilian-man-a', 1], ['npc.civilian-woman-a', 1], ['npc.civilian-man-a', .7]] as const) {
    for (const [name, plan] of Object.entries(scenarios.civilian)) {
      const after = metrics(await drive(asset, { kind: 'civilian' }, name.startsWith('wander') ? 10 : 4, plan, true, scale));
      const before = metrics(await drive(asset, { kind: 'civilian' }, name.startsWith('wander') ? 10 : 4, plan, false, scale));
      results.push({ asset, scale, scenario: name, after, before });
    }
  }
  mkdirSync('test-results/crowd-footwork', { recursive: true });
  writeFileSync('test-results/crowd-footwork/metrics-pedestrians.json', JSON.stringify(results, null, 2));
  console.table(results.map(r => ({ asset: `${r.asset}@${r.scale}`, scenario: r.scenario, ...(r.after as object), beforeSlide: (r.before as { slideMaxCm: number }).slideMaxCm, beforeYaw: (r.before as { yawDriftMaxDeg: number }).yawDriftMaxDeg })));
  for (const { asset, scale, scenario, after } of results as { asset: string; scale: number; scenario: string; after: ReturnType<typeof metrics> }[]) {
    expect(after.slideMaxCm, `${asset} ${scale} ${scenario} slide`).toBeLessThanOrEqual(3);
    expect(after.yawDriftMaxDeg, `${asset} ${scale} ${scenario} yaw`).toBeLessThanOrEqual(8);
    expect(after.contacts, `${asset} ${scenario} contacts`).toBeGreaterThan(1);
  }
});

test('zombie move set: drag-foot shamble, lurch, lunge-grab and flinch keep planted feet @E08', { timeout: 120_000 }, async () => {
  const results: Record<string, unknown>[] = [];
  for (const asset of ['inf.common-worker.lod1', 'npc.civilian-woman-b']) for (const [name, plan] of Object.entries(scenarios.infected)) {
    const after = metrics(await drive(asset, { kind: 'infected', tier: 'infected-lurch' }, name.startsWith('wander') ? 10 : 4, plan, true));
    const before = metrics(await drive(asset, { kind: 'infected', tier: 'infected-lurch' }, name.startsWith('wander') ? 10 : 4, plan, false));
    results.push({ asset, scenario: name, after, before });
  }
  mkdirSync('test-results/crowd-footwork', { recursive: true });
  writeFileSync('test-results/crowd-footwork/metrics-zombies.json', JSON.stringify(results, null, 2));
  console.table(results.map(r => ({ asset: r.asset, scenario: r.scenario, ...(r.after as object), beforeSlide: (r.before as { slideMaxCm: number }).slideMaxCm, beforeYaw: (r.before as { yawDriftMaxDeg: number }).yawDriftMaxDeg })));
  for (const { asset, scenario, after } of results as { asset: string; scenario: string; after: ReturnType<typeof metrics> }[]) {
    expect(after.slideMaxCm, `${asset} ${scenario} slide`).toBeLessThanOrEqual(3);
    expect(after.yawDriftMaxDeg, `${asset} ${scenario} yaw`).toBeLessThanOrEqual(8);
  }
});

test('flinch reads within 0.25 s per hit and restarts on every fast click', () => {
  const e = (started: number, until: number) => ({ id: 1, health: { current: 5 }, combat: { reaction: { index: 0, started, until, direction: { x: 1, z: 0 }, from: { x: 0, z: 0 }, to: { x: 0, z: 0 }, heavy: false } } }) as unknown as EntitySnapshot;
  expect(InfectedMoves.flinch(e(0, 15), 4)).toBeGreaterThan(.8);
  expect(InfectedMoves.flinch(e(0, 60), flinchSeconds * 60)).toBe(0);
  expect(InfectedMoves.flinch(e(0, 15), 15)).toBe(0);
  expect(InfectedMoves.flinch(e(18, 33), 22)).toBeGreaterThan(.8);
  const heavy = e(0, 80); heavy.combat!.reaction!.heavy = true;
  expect(InfectedMoves.flinch(heavy, 5)).toBe(0);
});
