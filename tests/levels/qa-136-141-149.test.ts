import { afterEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL6 } from '../../tools/sim-runner/l6Bots';
import { loadL5 } from '../../tools/sim-runner/l5Bots';
import { loadLevel } from '../../tools/sim-runner/levels';
import { crossing } from '../../src/levels/L9/district';
import { emptyInput } from '../../src/input/InputFrame';
import { vehiclePresentationDecay } from '../../src/render/VehicleView';

const worlds: SimWorld[] = [];
afterEach(() => worlds.splice(0).forEach(w => w.dispose()));
async function level(id: 'L8' | 'L9' | 'L10') {
  const w = new SimWorld(); await w.init(); worlds.push(w);
  w.loadComposition(compositions[id], compositions[id].districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
  const m = w.loadMission(resolveCampaignMission(id, w.districts!)); m.begin(); return { w, m };
}

test('Q-138 headlamp remains at its authored E-only pickup while companion updates', async () => {
  const { world: w } = await loadL6(1); worlds.push(w);
  const lamp = [...w.entities.iterate()].find(e => e.archetype === 'pickup.headlamp')!;
  const authored = { x: lamp.transform.x, z: lamp.transform.z };
  const dog = [...w.entities.iterate()].find(e => e.companion)!;
  Object.assign(w.entities.get(1)!.transform, { x: authored.x + 2, z: authored.z });
  Object.assign(dog.transform, { x: authored.x, z: authored.z, y: .3 }); dog.hidden = false;
  dog.companion!.state = 'fetch'; dog.companion!.pickup = lamp.id; w.npcs!.companion.forceSafe = false;
  w.update();
  for (let i = 0; i < 7200; i++) w.update();
  expect({ x: lamp.transform.x, z: lamp.transform.z }).toEqual(authored);
  expect(dog.companion!.state).not.toBe('fetch');
});

test('Q-137 L9 corgi is hidden as soon as it boards and cannot render inside APC hull', async () => {
  const { w } = await level('L9');
  const dog = [...w.entities.iterate()].find(e => e.companion)!;
  expect(dog.hidden).toBe(true);
  expect(w.entities.get(dog.id)!.passengerOf).toBe(w.missions!.l9!.state.carId);
});

test('Q-140 L5 Sam search ring is on the visible side of the Lakeshore bus', async () => {
  const { world: w, mission: m } = await loadL5(1); worlds.push(w);
  const ring = m.def.anchors['l5-ring-sam'];
  const bus = w.districts!.districts[0].layout.placements.find(p => p.id === 'l5-bus-68')!;
  expect(Math.hypot(ring.x - bus.position[0], ring.z - bus.position[2])).toBeGreaterThan(4);
  expect(ring.z).toBeGreaterThan(bus.position[2] + 5);
});

test('Q-139 every authored L9 road and detour centerline clears a 1.6 m APC radius', async () => {
  const w = await loadLevel('L9', 1); worlds.push(w);
  const car = w.missions!.l9!.state.carId;
  const blocked: string[] = [];
  for (const route of crossing.routes) for (const points of [route.points, route.detour]) for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], length = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d <= length; d += 2) {
      const x = ax + (bx - ax) * d / length, z = az + (bz - az) * d / length;
      if (!w.solids.clear({ x, y: 0, z }, 1.6, car)) blocked.push(`${route.id} ${x.toFixed(1)},${z.toFixed(1)}`);
    }
  }
  expect(w.solids.clear({ x: 402, y: 0, z: -16.8 }, 1.6, car), 'reported debug-entry stop pose').toBe(true);
  expect(blocked.slice(0, 20)).toEqual([]);
});

test('Q-136 L9 APC stays intact through scripted fall; body and all wheels share the same pose', async () => {
  const { w } = await level('L9'); const crash = w.missions!.l9!, car = w.entities.get(crash.state.carId)!;
  car.vehicle!.decay = 'wrecked'; // An incoming L8 transfer can already carry this shell state.
  const approach = w.missions!.def.anchors['crash-approach'];
  w.vehicles!.scriptPose(car.id, { ...car.transform, ...approach, x: approach.x + 1 });
  crash.update();
  for (let i = 0; i < 180; i++) { w.tick++; crash.update(); }
  expect(crash.state.phase).toBe('fall');
  expect(car.vehicle!.damage).not.toBe('exploded');
  expect(car.vehicle!.scripted).toBe(true);
  expect(car.vehicle!.decay).toBe('wrecked'); // renderer must defer this variant while scripted
  expect(car.transform.y).toBeGreaterThan(0);
  for (let i = 0; i < 120; i++) { w.tick++; crash.update(); }
  expect(crash.state.phase).toBe('impact');
  expect(car.vehicle!.scripted).toBe(false); // only now may the wreck shell replace the complete APC
});

test('Q-136 a scripted collapse defers the damaged vehicle shell until the fall ends', () => {
  expect(vehiclePresentationDecay(true, 'wrecked')).toBeUndefined();
  expect(vehiclePresentationDecay(false, 'wrecked')).toBe('wrecked');
});

test('Q-149 L10 console infected takes player attack damage instead of remaining invulnerable', async () => {
  const { w, m } = await level('L10');
  const console = m.def.anchors['cure-console'];
  const player = w.entities.get(1)!;
  Object.assign(player.transform, { x: console.x + 1, z: console.z + 1.5 });
  w.physics.playerBody!.setTranslation(player.transform, true); w.physics.playerBody!.setNextKinematicTranslation(player.transform);
  const id = w.infected!.spawn('infected.runner', { x: console.x + 2.1, z: console.z + 1.5 }, { offNav: true });
  const target = w.entities.get(id)!; target.combat!.staggerUntil = w.tick + 900;
  const initial = target.health.current;
  const frame = emptyInput(); frame.left = { down: true, held: true, up: false }; frame.activeAttack = true;
  frame.attackTarget = { id, side: 'LEFT' }; frame.aimPoint = { x: target.transform.x, z: target.transform.z };
  for (let i = 0; i < 480; i++) { w.applyInput(frame, 'keyboard'); w.update(); }
  expect(target.health.current, `target #${id}, before=${initial}, after=${target.health.current}`).toBeLessThan(initial);
});
