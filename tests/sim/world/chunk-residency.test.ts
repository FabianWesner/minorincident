import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { compositions } from '../../../src/levels/compositions';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { MegaPursuit } from '../../../src/sim/ai/MegaPursuit';
import { megaAlpha } from '../../../src/data/megaAlpha';
import { installNpcSystems } from '../../../src/sim/npc/install';
import { captureSeams, restoreSeams } from '../../../src/sim/missions/l1Seams';

const layout = JSON.parse(readFileSync('public/assets/layouts/D-CROSSING.layout.json', 'utf8')) as DistrictLayout;
async function crossing(source = layout) { const w = new SimWorld(); await w.init(); w.loadComposition(compositions['D-CROSSING'], [source], 31); installNpcSystems(w); return w; }
function focus(w: SimWorld, x: number, z: number) { Object.assign(w.entities.get(1)!.transform, { x, z }); w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); w.chunks!.update([x, z]); }

for (const tier of ['high', 'low'] as const) {
  test(`T-E31-13-S4-${tier} @E31-AC12 @E31-AC13 @E31-AC14 revisit preserves HP, corpse/pickup IDs and remaining timers`, async () => {
    const w = await crossing();
    try {
      w.chunks!.setQuality(tier); focus(w, 0, -330);
      const ai = w.infected!; ai.director.levelCap = 200;
      const id = ai.spawn('infected.runner', { x: 8, z: -325 });
      const e = w.entities.get(id)!; e.health.current = 37; e.infected!.cooldown = w.tick + 90;
      const dead = ai.spawn('infected.runner', { x: 14, z: -325 }); w.entities.get(dead)!.health.current = 0; ai.settle(w.entities.get(dead)!);
      const pickup = w.pickups!.spawn('medkit', { x: 12, z: -325 });
      const pack = w.entities.get(pickup)!.pickup!; if ('kind' in pack) pack.collected = true;
      const car = w.vehicles!.spawn('vehicle.military-apc', { x: 0, z: -330 }); w.vehicles!.damage(car, 650);
      const hp = w.entities.get(car)!.health.current;
      const first = w.chunks!.stats(); expect(first.resident).toBeLessThanOrEqual(tier === 'high' ? 25 : 9);
      expect(first.navCells).toBeLessThanOrEqual((tier === 'high' ? 500 : 300) ** 2 * 4);
      focus(w, 450, 220);
      expect(w.entities.get(id)).toBeUndefined(); expect(w.entities.get(dead)).toBeUndefined(); expect(ai.active.some(e => e.id === id)).toBe(false);
      const seams = captureSeams(w); const serialized = JSON.parse(JSON.stringify(seams));
      const saved = JSON.parse(JSON.stringify(w.chunks!.save()));
      w.tick += 600; restoreSeams(w, serialized); focus(w, 0, -330);
      expect(w.entities.get(id)!.health.current).toBe(37); expect(w.entities.get(id)!.infected!.cooldown - w.tick).toBe(90);
      expect(w.entities.get(dead)!.corpse).toBe(true); expect(w.entities.get(dead)!.health.current).toBe(0);
      expect(w.entities.get(pickup)!.pickup).toMatchObject({ collected: true }); expect(w.entities.get(car)!.health.current).toBe(hp);
      for (let i = 0; i < 5; i++) { focus(w, 450, 220); focus(w, 0, -330); }
      w.chunks!.load(saved); focus(w, 0, -330);
      expect(ai.active.filter(e => e.id === id)).toHaveLength(1); expect(w.entities.get(id)!.health.current).toBe(37);
      expect(w.chunks!.stats()).toEqual(first);
      // Inactive ground still supports the retained physical vehicle when visuals are absent.
      focus(w, 450, 220);
      for (let tick = 0; tick < 120; tick++) w.update();
      expect(w.entities.get(car)!.transform.y).toBeGreaterThan(0);
    } finally { w.dispose(); }
  });
  test(`T-E31-12-S4-${tier} @E31-AC12 @E31-AC13 predictive support remains loaded on forward/reverse seams`, async () => {
    const w = await crossing();
    try {
      w.chunks!.setQuality(tier);
      for (let x = -450; x < 450; x += 9) for (const speed of [-18, 18]) {
        w.chunks!.update([x, 10], [speed, 0]);
        expect(w.chunks!.resident(x, 10)).toBe(true); expect(w.chunks!.resident(x + speed * 2, 10)).toBe(true);
        expect(w.chunks!.stats().resident).toBeLessThanOrEqual(tier === 'high' ? 25 : 9);
        expect(w.physics.floorHeight(x, 10)).toBe(0);
      }
    } finally { w.dispose(); }
  });
}

test('T-E32-28-S4 @E31-AC13 @E32-AC10 @E32-AC28 Mega crosses coarse/detailed residency without >0.5 m tick jumps', async () => {
  const w = await crossing();
  try {
    w.chunks!.setQuality('low'); focus(w, 50, 10); w.infected!.director.levelCap = 200; w.combat!.damage.god = true;
    const pursuit = w.megaPursuit = new MegaPursuit(w, { introduceTick: null, spawn: { x: -175, z: 10 } });
    const id = pursuit.introduce(); let previous = { ...w.entities.get(id)!.transform }, maxStep = 0; const modes = new Set<string>();
    for (let i = 0; i < 2700; i++) {
      w.update(); const e = w.entities.get(id)!;
      maxStep = Math.max(maxStep, Math.hypot(e.transform.x - previous.x, e.transform.z - previous.z)); previous = { ...e.transform }; modes.add(pursuit.state.mode);
    }
    mkdirSync('test-results/epics/E31', { recursive: true }); writeFileSync('test-results/epics/E31/residency-mega.json', JSON.stringify({ id, maxStep, modes: [...modes], hp: w.entities.get(id)!.health.current, radius: pursuit.radius }, null, 2));
    expect(modes.has('coarse')).toBe(true); expect(modes.has('detailed')).toBe(true); expect(maxStep).toBeLessThanOrEqual(.5);
    expect(w.infected!.active.filter(e => e.infected!.pursuit)).toHaveLength(1); expect(w.entities.get(id)!.health.current).toBe(megaAlpha.hp);
  } finally { w.dispose(); }
});

for (const [count, budget] of [[200, 4], [100, 6]] as const) test(`T-E31-19-S4-${count} @E31-AC19 @E18-AC02 resident crossing horde sim p95`, async () => {
  const w = await crossing();
  try {
    w.chunks!.setQuality(count === 100 ? 'low' : 'high'); focus(w, 0, -330); const ai = w.infected!; ai.director.levelCap = 200; ai.director.setTier(count === 100 ? 'low' : 'high'); w.combat!.damage.god = true;
    for (let i = 0; i < count; i++) ai.spawn('infected.runner', { x: 15 + (i % 20) * 2, z: -320 + Math.floor(i / 20) * 2 }, { state: 'chase' });
    const times: number[] = [];
    for (let tick = 0; tick < 900; tick++) { const at = performance.now(); w.update(); if (tick >= 120) times.push(performance.now() - at); }
    times.sort((a, b) => a - b); const p95 = times[Math.ceil(times.length * .95) - 1];
    mkdirSync('test-results/epics/E31', { recursive: true }); writeFileSync(`test-results/epics/E31/residency-perf-${count}.json`, JSON.stringify({ p95, budget, count, residency: w.chunks!.stats() }, null, 2));
    expect(ai.director.count).toBeLessThanOrEqual(count); expect(p95).toBeLessThanOrEqual(budget);
  } finally { w.dispose(); }
});


test('T-E31-12-colliders-S4 @E31-AC12 @E31-AC13 seam-spanning collider is shared, unloaded and restored with nav', async () => {
  const source = structuredClone(layout);
  source.colliders.push({ id: 'residency-fixture', minTier: 0, maxTier: 6, aabb: { min: [99, 0, 8], max: [101, 2, 12] } });
  const w = await crossing(source);
  try {
    w.chunks!.setQuality('low'); focus(w, 100, 10);
    const handles = () => { const out: number[] = []; w.physics.world!.colliders.forEach(c => { if (c.translation().x === 100 && c.translation().z === 10) out.push(c.handle); }); return out; };
    expect(handles()).toHaveLength(1); expect(w.infected!.nav.clear(100, 10, .35)).toBe(false);
    focus(w, 130, 10); expect(handles()).toHaveLength(1);
    focus(w, -450, -220); expect(handles()).toHaveLength(0); expect(w.chunks!.resident(100, 10)).toBe(false);
    focus(w, 100, 10); expect(handles()).toHaveLength(1); expect(w.infected!.nav.clear(100, 10, .35)).toBe(false);
  } finally { w.dispose(); }
});


test('T-E31-19-quality-S4 @E31-AC12 @E31-AC13 @E31-AC19 low cap serializes excess brains and high restores the same IDs/HP', async () => {
  const w = await crossing();
  try {
    focus(w, 0, -330); w.infected!.director.levelCap = 200;
    const ids = Array.from({ length: 200 }, (_, i) => w.infected!.spawn('infected.runner', { x: 15 + i % 20 * 2, z: -320 + Math.floor(i / 20) * 2 }));
    for (const id of ids) w.entities.get(id)!.health.current = 37;
    const checkpoint = w.chunks!.snapshot(), checkpointEntities = w.query({});
    w.chunks!.setQuality('low'); expect(w.infected!.director.count).toBe(100); expect(w.chunks!.stats().queued).toBe(100);
    w.entities.restore(checkpointEntities, w.entities.get(1)!); w.npcs!.restore(0);
    w.chunks!.restore(checkpoint); expect(w.chunks!.stats().resident).toBeLessThanOrEqual(9); expect(w.infected!.director.count).toBe(100);
    w.chunks!.setQuality('high'); expect(w.infected!.director.count).toBe(200); expect(w.chunks!.stats().queued).toBe(0);
    expect(w.infected!.active.map(e => e.id).sort((a,b)=>a-b)).toEqual(ids); expect(w.infected!.active.every(e => e.health.current === 37)).toBe(true);
  } finally { w.dispose(); }
});


test('T-E31-14-clock-S4 @E31-AC13 @E31-AC14 inactive recovery survives loading into a fresh tick-zero world', async () => {
  const w = await crossing(), restored = await crossing();
  try {
    w.tick = 900; focus(w, 0, -330);
    const id = w.infected!.spawn('infected.runner', { x: 8, z: -325 }); const e = w.entities.get(id)!;
    e.health.current = 0; e.infected!.state = 'dead'; e.infected!.deadAt = w.tick; e.infected!.recoverAt = w.tick + 180;
    e.infected!.cooldown = w.tick + 90; e.infected!.specialCooldowns = { 'alpha.ground-slam': w.tick + 300 };
    focus(w, 450, 220); w.tick += 600;
    restored.chunks!.load(JSON.parse(JSON.stringify(w.chunks!.save()))); focus(restored, 0, -330);
    const b = restored.entities.get(id)!.infected!;
    expect(b.recoverAt).toBe(180); expect(b.deadAt).toBe(0); expect(b.cooldown).toBe(90); expect(b.specialCooldowns!['alpha.ground-slam']).toBe(300);
    expect(restored.entities.get(id)!.health.current).toBe(0);
  } finally { w.dispose(); restored.dispose(); }
});


test('T-E31-13-prop-S4 @E31-AC12 @E31-AC13 inactive movable prop releases its body and restores pose, HP and ID', async () => {
  const w = await crossing();
  try {
    const item = w.props!.items[0]; expect(item).toBeDefined();
    const id = item.entityId; w.entities.get(id)!.health.current = 37;
    const at = item.pose.p; focus(w, at[0], at[2]);
    const savedPose = w.props!.chunkState(id)!; const bodyCount = w.physics.bodyCount;
    focus(w, 450, 220); expect(w.entities.get(id)).toBeUndefined(); expect(w.props!.items.some(p => p.entityId === id)).toBe(false);
    expect(w.physics.bodyCount).toBeLessThan(bodyCount);
    const save = JSON.parse(JSON.stringify(w.chunks!.save())); w.chunks!.load(save); focus(w, at[0], at[2]);
    expect(w.entities.get(id)!.health.current).toBe(37); expect(w.props!.chunkState(id)).toEqual(savedPose); expect(w.physics.bodyCount).toBe(bodyCount);
  } finally { w.dispose(); }
});
