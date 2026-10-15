import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluate, readSpec, type SceneSession } from '../../../tools/scenelab/session';
import { catalogFlag } from '../../../tools/scenelab/catalog-args';
import { validateSpec } from '../../../src/debug/scenelab/spec';
import { animalInfected } from '../../../src/data/infected';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';

const names = ['l10-cure-install-defend', 'l10-cure-mist', 'l10-region-seam', 'qa-l10-charge-radius', 'qa-l10-final-release', 'qa-l10-epilogue', 'qa-l10-title-credits'];
const scenes = names.map(name => readSpec(`tests/scenes/catalog/${name}.json`));
const assets = new Map((manifest as AssetDef[]).map(a => [a.id, a]));
// The evaluator reads these existing probes even when a fixture does not gate them.
const baseline = {
  propPenetration: { framesMax: 0 }, convoyOverlapFrames: 0, heldProps: { holds: {}, samples: 0 }, bodies: [],
  props: { sinkMaxCm: 0 }, vehicles: {}, actors: {}, clicks: { misses: 0 }, variety: { infected: {}, pedestrian: {} },
  perf: { drawCalls: { max: 0 }, triangles: { max: 0 } }, appearance: [], lodPlaceholders: { frames: 0 },
  grounding: { corpses: 6, corpseOffMaxCm: 0, pickupOffMaxCm: 0 },
};
const clipping = { static: [], actors: [], heldProps: [], gunBodies: [] } as unknown as Awaited<ReturnType<SceneSession['clipping']>>;
const check = (index: number, cure: Record<string, number>, actors = {}) => evaluate(scenes[index], { ...baseline, cure, actors } as unknown as Awaited<ReturnType<SceneSession['metrics']>>, clipping, []);

describe('L10-Q2 finale Scene Lab @E32', () => {
  it('T-E32-Q2-matrix-options lets npm script callers select WebGL2 and the Q2 subset', () => {
    const args = ['--backend', 'webgpu', '--filter', 'seat-*,l10-q1-*', '--backend', 'webgl2', '--filter', 'qa-l10-*'];
    expect(catalogFlag(args, 'backend')).toBe('webgl2');
    expect(catalogFlag(args, 'filter')).toBe('qa-l10-*');
    expect(catalogFlag(args, 'tier')).toBeUndefined();
  });
  it('T-E32-Q2-catalog @E32-AC30 reuses shipped fixtures and resolves all numeric gates in the matrix', () => {
    const matrix = JSON.parse(readFileSync('package.json', 'utf8')).scripts['scene:matrix'];
    for (const scene of scenes) {
      expect(validateSpec(scene, assets), scene.name).toEqual([]);
      expect(['game', 'follow']).toContain(scene.camera?.mode);
      expect(scene.expect?.lodPlaceholderFramesMax).toBe(0);
      expect(scene.expect?.drawCallsMax).toBeLessThanOrEqual(300);
      expect(scene.expect?.trianglesMax).toBeLessThanOrEqual(500000);
      expect(matrix).toContain(scene.name?.startsWith('qa-l10-') ? 'qa-l10-*' : scene.name);
    }
    expect(matrix).toContain('l10-minigun-heat');
    for (const existing of ['seat-*', 'ped-*', 'corgi-*', 'area-grove-*', 'l10-q1-*', 'seethrough-*']) expect(matrix).toContain(existing);
  });
  it('T-E32-Q2-mist @E32-AC08 @E32-AC23 rejects an unreleased front, a surviving species and a harmed control', () => {
    const mist = scenes[1], cure = { releaseCount: 1, radius: 75, fanFrames: 300, mistPuffs: 80, smokeOverBudget: 0, healthyDamage: 0, lateDeaths: 0 };
    const actors = Object.fromEntries(mist.actors!.map(a => [a.id!, { health: a.kind === 'infected' ? 0 : 100, motion: {}, missedInViewFrames: 0 }]));
    expect(mist.actors!.filter(a => a.kind === 'infected').map(a => a.archetype)).toEqual(expect.arrayContaining(['infected.lion', 'infected.gorilla', 'infected.elephant', 'infected.zebra', 'infected.flamingo', 'infected.dog', 'infected.alpha', 'infected.runner', ...animalInfected.map(a => a.id)]));
    expect(check(1, cure, actors).pass).toBe(true);
    expect(check(1, { ...cure, releaseCount: 0, radius: 0 }, actors).pass).toBe(false);
    expect(check(1, { ...cure, mistPuffs: 0 }, actors).pass).toBe(false);
    expect(check(1, { ...cure, smokeOverBudget: 1 }, actors).pass).toBe(false);
    expect(check(1, { ...cure, healthyDamage: 1 }, actors).pass).toBe(false);
    for (const id of ['lion', 'gorilla', 'elephant', 'zebra', 'flamingo', 'dog', 'cat', 'crow', 'alpha']) expect(check(1, cure, { ...actors, [id]: { ...actors[id], health: 100 } }).pass, id).toBe(false);
    for (const id of ['courier', 'corgi', 'healthy', 'healthy-zebra']) expect(check(1, cure, { ...actors, [id]: { ...actors[id], health: 0 } }).pass, id).toBe(false);
  });
  it('T-E32-Q2-heat-hud @E32-AC19 rejects an absent heat HUD or a stale heat value', () => {
    const spec = { minigun: { at: [0, 0] as [number, number] }, hud: true };
    const gate = (hudFrames: number, hudHeatErrorMax: number, mountedFrames = 20) => evaluate(spec, { ...baseline, minigun: { mountedFrames, hudFrames, hudHeatErrorMax } } as unknown as Awaited<ReturnType<SceneSession['metrics']>>, clipping, []).pass;
    expect(gate(20, .5)).toBe(true);
    expect(gate(0, 0)).toBe(false);
    expect(gate(20, 2)).toBe(false);
    expect(gate(0, 0, 0)).toBe(true); // Decorative gun in the charge/ending fixtures.
  });
  it('T-E32-Q2-seam @E32-AC28 rejects a courier that never crosses the terrain seam', () => {
    const courier = { health: 100, motion: {}, travelM: 116, maxX: 817, missedInViewFrames: 0 };
    expect(check(2, {}, { courier }).pass).toBe(true);
    expect(check(2, {}, { courier: { ...courier, travelM: 0, maxX: 737 } }).pass).toBe(false);
  });
  it('T-E32-Q2-charge @E32-AC20 rejects missing boundary coverage, lost charge and advance outside the radius', () => {
    const cure = { chargeTicks: 880, boundaryFrames: 180, outsideFrames: 420, outsideAdvance: 0, releaseCount: 0, insideMisses: 0 };
    expect(check(3, cure).pass).toBe(true);
    for (const broken of [{ boundaryFrames: 0 }, { chargeTicks: 0 }, { outsideAdvance: 1 }, { insideMisses: 1 }]) expect(check(3, { ...cure, ...broken }).pass).toBe(false);
    expect(check(3, {}).pass).toBe(false);
  });
});
