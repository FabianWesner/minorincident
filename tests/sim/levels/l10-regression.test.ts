import { expect, test } from 'vitest';
import { loadLevel } from '../../../tools/sim-runner/levels';
import { cure } from '../../../src/levels/L10/district';
import { preset } from '../../../src/sim/progression/Campaign';
import { applyCampaign } from '../../../src/sim/progression/apply';

for (const tier of ['high', 'low'] as const) {
  test(`T-E32-02-minute-${tier} @E32-AC02 @E32-AC05 first minute remains axe-only despite historical unlocks`, async () => {
    const w = await loadLevel('L10', 32);
    try {
      w.chunks!.setQuality(tier);
      const save = preset('L10-default');
      save.ownedActions.push('weapon.pistol', 'weapon.shotgun', 'weapon.army-mg', 'weapon.rocket-launcher');
      save.racks.RIGHT = [...save.ownedActions.filter(id => id.startsWith('weapon.'))];
      const abilities = save.ownedActions.filter(id => id.startsWith('ability.'));
      applyCampaign(w, save);
      for (let tick = 0; tick < 3600; tick++) {
        // Stay at the crash viewpoint: measure the authored opening, not a time-jump fixture.
        w.update();
        expect(w.infected!.director.count).toBeLessThanOrEqual(8);
        expect(w.infected!.active.every(e => e.archetype === 'infected.runner')).toBe(true);
      }
      expect(w.vehicles!.active).toBeNull();
      expect([...w.vehicles!.cars.values()].some(c => c.entity.health.current > 0)).toBe(false);
      expect(w.progression!.campaign!.ownedActions.filter(id => id.startsWith('weapon.'))).toEqual(['weapon.fire-axe']);
      expect(w.progression!.campaign!.ownedActions.filter(id => id.startsWith('ability.'))).toEqual(abilities);
      for (const side of ['LEFT', 'RIGHT'] as const) expect(w.entities.get(1)!.weapons![side].rack.map(s => s.id)).toEqual(['weapon.fire-axe']);
    } finally { w.dispose(); }
  });

  test(`T-E32-28-cure-${tier} @E32-AC28 D-CURE prefetch reversal and five revisits retain corpse/pickup/boss state`, async () => {
    const w = await loadLevel('L10', 32);
    try {
      w.chunks!.setQuality(tier);
      const focus = (x: number, z: number) => {
        Object.assign(w.entities.get(1)!.transform, { x, z });
        w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true);
        w.chunks!.update([x, z]);
      };
      for (const region of cure.regions) {
        const [x, z] = region.route[0];
        for (const speed of [-4.5, 4.5]) {
          w.chunks!.update([x, z], [speed, 0]);
          expect(w.chunks!.resident(x, z)).toBe(true);
          expect(w.chunks!.resident(x + speed * 2, z)).toBe(true);
          expect(w.chunks!.stats().resident).toBeLessThanOrEqual(tier === 'high' ? 25 : 9);
          expect(w.physics.floorHeight(x, z)).toBeGreaterThanOrEqual(0);
          expect(w.infected!.nav.clear(x, z, .3)).toBe(true);
        }
      }
      focus(...cure.start);
      const dead = w.infected!.spawn('infected.runner', { x: cure.start[0] + 8, z: cure.start[1] + 5 });
      const corpse = w.entities.get(dead)!; corpse.health.current = 0; w.infected!.settle(corpse);
      const pickup = w.pickups!.spawn('medkit', { x: cure.start[0] + 12, z: cure.start[1] + 5 });
      const pack = w.entities.get(pickup)!.pickup!; if ('kind' in pack) pack.collected = true;
      const bossId = w.megaPursuit!.introduce({ x: cure.start[0] - 80, z: cure.start[1] });
      w.entities.get(bossId)!.health.current = 2400;
      w.entities.get(bossId)!.infected!.specialCooldowns = { 'alpha.charge': w.tick + 300 };
      for (let visit = 0; visit < 5; visit++) {
        focus(...cure.anchors['cure-complex']);
        expect(w.entities.get(dead)).toBeUndefined(); expect(w.entities.get(pickup)).toBeUndefined();
        focus(...cure.start);
        expect(w.entities.get(dead)).toMatchObject({ health: { current: 0 }, corpse: true });
        expect(w.entities.get(pickup)!.pickup).toMatchObject({ collected: true });
        expect(w.entities.get(bossId)!.health.current).toBe(2400);
        expect(w.entities.get(bossId)!.infected!.specialCooldowns!['alpha.charge']).toBe(w.tick + 300);
        expect(w.infected!.active.filter(e => e.infected!.pursuit)).toHaveLength(1);
        expect(w.chunks!.stats().resident).toBeLessThanOrEqual(tier === 'high' ? 25 : 9);
      }
    } finally { w.dispose(); }
  });
}

for (const tier of ['high', 'low'] as const) test(`T-E32-28-seam-input-${tier} @E32-AC28 every D-CURE region seam supports live reversal, nav and persistent identities`, async () => {
  const w = await loadLevel('L10', 32);
  try {
    w.chunks!.setQuality(tier); w.combat!.damage.god = true;
    const boss = w.megaPursuit!.introduce({ x: cure.start[0] - 80, z: cure.start[1] });
    w.entities.get(boss)!.health.current = 2400;
    for (const region of cure.regions.slice(1)) {
      const [x, z] = region.route[0], p = w.entities.get(1)!;
      Object.assign(p.transform, { x: x - 4, z, y: .72 }); w.physics.playerBody!.setTranslation(p.transform, true); w.player!.locomotion.reset();
      w.chunks!.update([x - 4, z]);
      const dead = w.infected!.spawn('infected.runner', { x: x - 8, z: z + 5 });
      const corpse = w.entities.get(dead)!; corpse.health.current = 0; w.infected!.settle(corpse);
      const pickup = w.pickups!.spawn('medkit', { x: x - 10, z: z + 5 });
      const pack = w.entities.get(pickup)!.pickup!; if ('kind' in pack) pack.collected = true;
      for (const direction of [1, -1, 1]) {
        w.setInput({ move: { x: direction, z: 0 } });
        const before = p.transform.x;
        for (let i = 0; i < 150; i++) {
          w.update();
          const { x: px, z: pz, y } = p.transform;
          expect(y).toBeGreaterThanOrEqual(.65);
          expect(w.physics.floorHeight(px, pz)).toBeGreaterThanOrEqual(0);
          expect(w.infected!.nav.clear(px, pz, .3)).toBe(true);
          expect(w.chunks!.resident(px + direction * 9, pz)).toBe(true);
          expect(w.chunks!.stats().resident).toBeLessThanOrEqual(tier === 'high' ? 25 : 9);
          expect(w.infected!.active.filter(e => e.infected!.pursuit)).toHaveLength(1);
          expect(w.entities.get(boss)!.health.current).toBe(2400);
        }
        expect((p.transform.x - before) * direction, region.id).toBeGreaterThan(5);
      }
      w.clearInput();
      // Retire the region, advance its clock, then restore the same corpse and pickup.
      w.chunks!.update(cure.start);
      if (Math.abs(x - cure.start[0]) > 300) expect(w.entities.get(dead)).toBeUndefined();
      w.chunks!.update([x, z]);
      expect(w.entities.get(dead)).toMatchObject({ id: dead, health: { current: 0 }, corpse: true });
      expect(w.entities.get(pickup)!.pickup).toMatchObject({ collected: true });
    }
  } finally { w.dispose(); }
}, 120_000);
