import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { infectedSpecialMoves, type InfectedSpecialMove } from '../../src/data/infected';
import type { MissionDef } from '../../src/sim/missions/types';
import { readSpec, SceneSession, stopServer } from '../../tools/scenelab/session';

const scenes: Record<InfectedSpecialMove, string> = {
  'alpha.charge': 'alpha-s2/qa-alpha-charge',
  'alpha.ground-slam': 'alpha-s2/qa-alpha-ground-slam',
  'alpha.grab-throw': 'alpha-s3/qa-alpha-grab-throw',
  'alpha.roar': 'alpha-s3/qa-alpha-roar',
  'lion.pounce': 'zoo-s1/qa-zoo-lion-pounce',
  'lion.flank': 'zoo-s1/qa-zoo-lion-flank',
  'gorilla.roar': 'zoo-s1/qa-zoo-gorilla-roar',
  'gorilla.pound': 'zoo-s1/qa-zoo-gorilla-pound',
  'gorilla.grab-throw': 'zoo-s2/qa-zoo-gorilla-throw',
  'elephant.charge': 'zoo-s2/qa-zoo-elephant-charge',
  'elephant.swipe': 'zoo-s2/qa-zoo-elephant-swipe',
  'zebra.kick': 'zoo-s3/qa-zoo-zebra-kick',
  'zebra.stampede': 'zoo-s3/qa-zoo-zebra-stampede',
  'flamingo.dive': 'zoo-s3/qa-zoo-flamingo-dive',
};
const checkpoint: MissionDef = {
  id: 'special-capture', briefing: 'Special checkpoint capture',
  anchors: { spawn: { x: 0, z: 0, radius: 2 } }, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [],
  checkpoints: ['windup'], cinematics: {},
  steps: [{ id: 'wait', type: 'custom', text: 'Wait', anchor: 'spawn', start: { kind: 'start' }, complete: { kind: 'timer', seconds: 1000 }, fail: [] }],
  finish: ['wait'], onStart: [], onComplete: [],
};

// Extends the authored Scene Lab fixtures through a real production checkpoint and
// the next legal activation. No tick jumps, shortened cooldowns or effect mocks.
for (const move of Object.keys(scenes) as InfectedSpecialMove[]) {
  test(`T-E07-move-boundary-${move} @E07-AC05 @E07-AC06 @E07-AC19 activation, checkpoint restore and exact second activation captures`, async () => {
    test.setTimeout(180_000);
    const s = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 1280, height: 720 } });
    const out = `test-results/epics/E07/move-boundaries/${move}`;
    mkdirSync(out, { recursive: true });
    const spec = readSpec(`tests/scenes/${scenes[move]}.json`);
    // The complete herd/elephant and locked corridor need the wide game-camera
    // zoom. The original close crops cut off the rear zebra and the courier.
    if (move === 'zebra.stampede' || move === 'elephant.charge') spec.camera = { ...spec.camera, mode: 'game', zoom: .65 };
    // Keep corpse/prop setup; invoke each special explicitly so the same fixture
    // can probe the scheduler's rejected and accepted start boundaries.
    spec.script = (spec.script ?? []).filter(row => 'actor' in row && (typeof row.do === 'string' || !('special' in row.do)));
    const source = move.startsWith('alpha.') ? 'alpha' : 'animal';
    const timing = infectedSpecialMoves[move];
    const proof: unknown[] = [];
    try {
      await s.open(); await s.load(spec); await s.step(1);
      await s.screenshot(`${out}/00-pre-start.png`);
      const initial = await s.page.evaluate(({ checkpoint, source, move }) => {
        const lab = window.__SCENE__!, game = (lab as unknown as { game: Game }).game, w = game.world;
        w.loadMission(checkpoint).begin();
        const id = lab.actors.get(source)!.entity;
        const positions = [...lab.actors.values()].map(a => ({ id: a.entity, x: w.entities.get(a.entity)!.transform.x, z: w.entities.get(a.entity)!.transform.z }));
        lab.command(source, { special: move, target: 'courier' });
        return { id, positions, attack: structuredClone(w.entities.get(id)!.infected!.specialAttack!) };
      }, { checkpoint, source, move });
      expect(initial.attack.move).toBe(move);
      expect(initial.attack.activeTick - initial.attack.startTick).toBe(timing.windup);
      const snapshot = () => s.page.evaluate(id => {
        const a = window.__SS__!, e = a.getEntity(id)!;
        const fx = ((window.__SCENE__ as unknown as { game: Game }).game.view as unknown as { vfx: import('../../src/render/vfx/Vfx').Vfx }).vfx;
        const markers = a.getState().render.vfx!.telegraphs.map(t => ({ ...t, opacity: fx.telegraphs.mesh.geometry.getAttribute('fxVisibility').getX(t.slot) }));
        return { tick: a.tick(), source: e, player: a.getEntity(1), events: a.events(), markers };
      }, initial.id);
      const shot = async (name: string) => { await s.ready(); const state = await snapshot(); proof.push({ name, ...state }); await s.screenshot(`${out}/${name}.png`); return state; };
      const started = await shot('00-start');
      expect(started.markers.some(t => t.attackId === initial.attack.attackId && t.opacity === 1)).toBe(true);
      await s.step(timing.windup - 1);
      const before = await shot('01-before-activation');
      expect(before.source.infected!.specialAttack!.stage).toBe('telegraph');
      expect(before.markers.some(t => t.attackId === initial.attack.attackId && t.opacity === 1)).toBe(true);
      expect(before.events.some(e => e.type === 'infected.special' && e.attackId === initial.attack.attackId && e.stage === 'active')).toBe(false);
      await s.page.evaluate(() => window.__SS__!.missions.checkpoint('windup'));
      await s.step(1); const active = await shot('02-activation');
      expect(active.tick).toBe(initial.attack.activeTick);
      expect(active.events.some(e => e.type === 'infected.special' && e.attackId === initial.attack.attackId && e.stage === 'active' && e.tick === active.tick)).toBe(true);
      await s.step(45); await shot('03-impact');
      await s.page.evaluate(() => window.__SS__!.missions.restore('windup'));
      const restored = await shot('04-restored-windup');
      expect(restored.source.infected!.specialAttack!.activeTick - restored.tick).toBe(1);
      expect(restored.source.infected!.specialAttack!.target).toEqual(initial.attack.target);
      expect(restored.source.infected!.specialAttack!.area).toEqual(initial.attack.area);
      expect(restored.source.infected!.specialAttack!.members).toEqual(initial.attack.members);
      expect(restored.markers.some(t => t.attackId === initial.attack.attackId && t.opacity === 1)).toBe(true);
      await s.step(1); const restoredActive = await shot('05-restored-activation');
      expect(restoredActive.events.some(e => e.type === 'infected.special' && e.attackId === initial.attack.attackId && e.stage === 'active' && e.tick === restoredActive.tick)).toBe(true);
      // Suppress unrelated reacquisition while the actual special/recovery finishes.
      // Restore fixture positions for the repeat (including the same thrown body),
      // retaining every live cooldown and recovery timer.
      await s.page.evaluate(() => { (window.__SCENE__ as unknown as { game: Game }).game.world.inspectionGhost = true; });
      await s.step(240);
      const cooldownSaved = await snapshot();
      await s.page.evaluate(() => window.__SS__!.missions.checkpoint('windup'));
      await s.step(7);
      await s.page.evaluate(() => window.__SS__!.missions.restore('windup'));
      const cooldownRestored = await shot('06-restored-cooldown');
      expect(cooldownRestored.source.infected!.specialCooldowns![move]! - cooldownRestored.tick).toBe(cooldownSaved.source.infected!.specialCooldowns![move]! - cooldownSaved.tick);
      const expiry = cooldownRestored.source.infected!.specialCooldowns![move]!;
      const remaining = expiry - timing.windup - 1 - await s.page.evaluate(() => window.__SS__!.tick());
      expect(remaining).toBeGreaterThanOrEqual(0);
      await s.page.evaluate(async n => { await window.__SS__!.step(n); }, remaining);
      await s.page.evaluate(positions => {
        const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        for (const p of positions) { a.teleport(p.id, p); const e = w.entities.get(p.id)!; if (e.infected && !e.corpse) { e.infected.state = 'idle'; delete e.noiseTarget; } }
      }, initial.positions);
      const attempt = () => s.page.evaluate(({ id, move }) => {
        const w = (window.__SCENE__ as unknown as { game: Game }).game.world, e = w.entities.get(id)!, p = w.entities.get(1)!;
        return w.infected!.startSpecial(id, move, { id: 1, x: p.transform.x, z: p.transform.z }, { x: e.transform.x, z: e.transform.z, radius: 1, dx: 1, dz: 0 });
      }, { id: initial.id, move });
      expect(await attempt()).toBe(false); await shot('07-cooldown-rejected');
      await s.step(1); expect(await attempt()).toBe(true);
      const second = await shot('08-second-windup');
      expect(second.markers.some(t => t.attackId === second.source.infected!.specialAttack!.attackId && t.opacity === 1)).toBe(true);
      expect(second.source.infected!.specialAttack!.activeTick).toBe(expiry);
      expect(second.source.infected!.specialAttack!.attackId).toBeGreaterThan(initial.attack.attackId);
      await s.step(timing.windup); const secondActive = await shot('09-second-activation');
      expect(secondActive.tick - restoredActive.tick - 7).toBe(timing.cooldown);
      expect(secondActive.events.some(e => e.type === 'infected.special' && e.attackId === second.source.infected!.specialAttack!.attackId && e.stage === 'active' && e.tick === expiry)).toBe(true);
      expect(s.errors).toEqual([]);
    } finally {
      writeFileSync(`${out}/proof.json`, JSON.stringify({ move, timing, proof, consoleErrors: s.errors }, null, 2));
      await s.close(); stopServer();
    }
  });
}
