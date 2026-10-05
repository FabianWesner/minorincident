import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { stateHash } from '../../../src/sim/world/stateHash';
import { Vfx, type Gore } from '../../../src/render/vfx/Vfx';

const targets = () => ({ flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} });

test('T-E15-01 @E15 @E15-AC01 60s combat hash is identical with all visual settings', async () => {
  const hashes: string[] = [];
  for (const gore of ['Full', 'Reduced', 'Off'] as Gore[]) for (const enabled of [true, false]) {
    const world = new SimWorld(); await world.init(); world.loadScenario('combat-arena', 21);
    const fx = new Vfx(world, targets()); fx.set({ gore, vfx: enabled });
    try {
      world.combat!.setLoadout(['weapon.machete'], ['weapon.grenade']);
      for (let t = 0; t < 3600; t++) {
        if (t % 60 === 0) world.spawnDummy('infected.dummy', { x: 1, z: 0 }, { hp: 50 });
        world.setInput({ aim: { x: 1, z: 0 }, left: { down: t % 60 === 0, held: t % 60 < 10, up: t % 60 === 10 } });
        world.update(); fx.advance(1 / 60);
      }
      expect(world.events.events().filter(e => e.type === 'combat.kill').length).toBeGreaterThan(20);
      hashes.push(stateHash(world.getState()));
    } finally { fx.dispose(); world.dispose(); }
  }
  expect(new Set(hashes).size).toBe(1);
});

test('T-E15-09 @E15 @E15-AC09 seeded 200 machete kills detach 35% ±5%; gore never changes kills or sim hash', async () => {
  const hashes: string[] = [], results: number[] = [];
  for (const gore of ['Full', 'Reduced', 'Off'] as Gore[]) {
    const world = new SimWorld(); await world.init(); world.loadScenario('gore-probe', 1);
    const fx = new Vfx(world, targets()); fx.set({ gore });
    try {
      for (let i = 0; i < 200; i++) {
        const targetId = world.spawnDummy('infected.dummy', { x: 1, z: 0 }, { hp: 50 });
        world.combat!.damage.apply({ attackId: i + 1, actionId: 'weapon.machete', sourceId: 1, targetId, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 60, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
      }
      fx.advance(0); expect(fx.kills).toBe(200); hashes.push(stateHash(world.getState())); results.push(fx.dismemberedKills);
      if (gore === 'Full') { expect(fx.dismemberedKills).toBeGreaterThanOrEqual(60); expect(fx.dismemberedKills).toBeLessThanOrEqual(80); expect(fx.gibs.count).toBe(fx.detached); }
      else { expect(fx.detached).toBe(0); expect(fx.gibs.count).toBe(0); }
      for (let i = 0; i < 30; i++) fx.advance(1);
      expect(fx.gibs.count).toBe(0);
      const targetId = world.spawnDummy('infected.dummy', { x: 1, z: 0 }, { hp: 50 });
      const before = fx.detached;
      world.combat!.damage.apply({ attackId: 201, actionId: 'weapon.grenade', sourceId: 1, targetId, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 100, multiplier: 1, type: 'explosive', knockback: 0, stagger: 0 });
      expect(fx.detached - before).toBe(gore === 'Full' ? 5 : 0);
    } finally { fx.dispose(); world.dispose(); }
  }
  expect(new Set(hashes).size).toBe(1); expect(results.slice(1)).toEqual([0, 0]);
});

test('T-E15-events @E15 @E15-AC04 tells persist until their resolution event; settings reset pooled gore', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('vfx-showcase');
  const fx = new Vfx(world, targets());
  try {
    world.events.emit({ tick: 0, type: 'telegraph', attackId: 1, kind: 'charge', position: { x: 2, z: 1 }, radius: 3, angle: 0 });
    for (let i = 0; i < 20; i++) fx.advance(1);
    expect(fx.snapshot().telegraphs).toHaveLength(1); expect(fx.telegraphs.count).toBe(1);
    world.events.emit({ tick: 1, type: 'attack.resolved', attackId: 1 }); expect(fx.telegraphs.count).toBe(0);
    fx.effect('explosion', 0, 0, 3); expect(fx.decals.count).toBe(1);
    fx.set({ gore: 'Off' }); expect(fx.decals.count).toBe(0); expect(fx.coverage).toBe(0);
  } finally { fx.dispose(); world.dispose(); }
});
