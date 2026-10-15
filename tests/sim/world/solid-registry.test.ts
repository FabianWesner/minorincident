import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { loadLevel } from '../../../tools/sim-runner/levels';
import { LevelFourBot } from '../../../src/debug/bot/LevelFourBot';
import { followFrustum } from '../../../tools/sim-runner/l3Bots';

async function arena() { const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 1); return w; }
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };

test.each(['vehicle.sedan', 'vehicle.school-bus'])('collision admission: parked %s excludes an Alpha', async vehicle => {
  const w = await arena();
  try {
    const car = w.vehicles!.cars.get(w.vehicles!.spawn(vehicle, { x: 10, z: 0 }))!;
    const id = w.infected!.spawn('infected.alpha', { x: 12, z: 0 }, { state: 'idle' });
    step(w, 60); const e = w.entities.get(id)!;
    expect(e.health.current).toBeGreaterThan(0);
    expect(e.attachedTo).toBeUndefined(); expect(e.hidden).not.toBe(true);
    expect(car.physics.hullDistance(e.transform.x, e.transform.z)).toBeGreaterThanOrEqual(e.combat!.radius - .02);
    expect(w.infected!.active).toHaveLength(1);
  } finally { w.dispose(); }
});
test('collision commit: full Alpha radius survives thin nav blocker knockback', async () => {
  const w = await arena();
  try {
    w.infected!.nav.setBlocker(987654, { x: 10, z: 0, y: .7, halfX: .1, halfZ: 3, halfY: .7 }, true);
    const e = w.entities.get(w.infected!.spawn('infected.alpha', { x: 9, z: 0 }, { state: 'idle' }))!;
    w.knockback(e, { x: 1, z: 0 }, .6);
    expect(e.transform.x + e.combat!.radius).toBeLessThanOrEqual(9.9 + .02);
    w.update(); expect(e.transform.x + e.combat!.radius).toBeLessThanOrEqual(9.9 + .02);
  } finally { w.dispose(); }
});
test('collision admission: eight coincident Alphas keep all eight encounters without a committed stack', async () => {
  const w = await arena();
  try {
    const ids = Array.from({ length: 8 }, () => w.infected!.spawn('infected.alpha', { x: 12, z: 0 }, { state: 'idle' }));
    w.update(); expect(w.infected!.active).toHaveLength(8);
    for (const a of ids) for (const b of ids) if (a < b) {
      const ea = w.entities.get(a)!, eb = w.entities.get(b)!;
      expect(ea.hidden).not.toBe(true); expect(eb.hidden).not.toBe(true);
      expect(ea.combat!.radius + eb.combat!.radius - Math.hypot(ea.transform.x - eb.transform.x, ea.transform.z - eb.transform.z)).toBeLessThanOrEqual(.02);
    }
  } finally { w.dispose(); }
});
test('collision natural L4: tank excludes every living Alpha through audit tick 15662', async () => {
  const w = await loadLevel('L4', 1);
  try {
    const bot = new LevelFourBot(w, 'idle'); let samples = 0;
    for (let i = 0; i < 15700; i++) {
      followFrustum(w); w.applyInput(bot.sample(), 'keyboard'); w.update();
      const tank = w.entities.values().find(e => e.archetype === 'veh.tank' && !e.hidden);
      if (!tank) continue;
      for (const e of w.infected!.active) if (e.archetype === 'infected.alpha' && e.health.current > 0 && !e.hidden && e.attachedTo === undefined) {
        const dx = e.transform.x - tank.transform.x, dz = e.transform.z - tank.transform.z, c = Math.cos(tank.transform.yaw), s = Math.sin(tank.transform.yaw);
        const x = dx * c - dz * s + .05, z = dx * s + dz * c;
        const gap = Math.hypot(Math.max(0, Math.abs(x) - 3.5), Math.max(0, Math.abs(z) - 1.65));
        expect(gap, `tick ${w.tick} Alpha ${e.id}`).toBeGreaterThanOrEqual(e.combat!.radius - .02); samples++;
      }
    }
    expect(samples).toBeGreaterThan(0);
  } finally { w.dispose(); }
}, 180_000);
