import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { stateHash } from '../../../src/sim/world/stateHash';
import { Vfx } from '../../../src/render/vfx/Vfx';
import type { VehicleFeedbackEvent } from '../../../src/render/vfx/VehicleFeedback';
const targets = { flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} };

test('M1 E07/E15 @E15 actual infected windups produce tells and clear on interruption without sim writes', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 7); w.combat!.damage.god = true;
  const fx = new Vfx(w, targets);
  try {
    const id = w.infected!.spawn('infected.runner', { x: 1, z: 0 }, { state: 'chase' });
    for (let i = 0; i < 10 && fx.telegraphs.count === 0; i++) { w.update(); fx.advance(0); }
    expect(fx.snapshot().telegraphs.some(t => t.sourceId === id)).toBe(true);
    w.entities.get(id)!.combat!.staggerUntil = w.tick + 60; w.update(); const hash = stateHash(w.getState()); fx.advance(.1);
    expect(fx.snapshot().telegraphs.some(t => t.sourceId === id)).toBe(false); expect(stateHash(w.getState())).toBe(hash);
  } finally { fx.dispose(); w.dispose(); }
});

test('M1 E07/E15 @E15 actual Bloated death produces a three-metre blast and retires its tell', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 7); w.combat!.damage.god = true;
  const fx = new Vfx(w, targets);
  try {
    const id = w.infected!.spawn('infected.bloated', { x: 1, z: 0 }); w.entities.get(id)!.health.current = 0;
    w.update(); fx.advance(0); expect(fx.snapshot().telegraphs.some(t => t.kind === 'bloated')).toBe(true);
    for (let i = 0; i < 21; i++) { w.update(); fx.advance(1 / 60); }
    expect(fx.lastExplosionRadius).toBe(3); expect(fx.snapshot().telegraphs.some(t => t.sourceId === id)).toBe(false);
  } finally { fx.dispose(); w.dispose(); }
});

test('M1 E11/E15 @E15 actual propane blast drives pooled explosion feedback', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('interact-yard'); w.combat!.damage.god = true;
  const fx = new Vfx(w, targets);
  try {
    const id = w.hazards!.spawn('propane', { x: 15, z: 0 }, { radius: 4 }); w.hazards!.hit(id, 1000, 'bullet');
    for (let i = 0; i < 18; i++) w.update();
    expect(fx.lastExplosionRadius).toBe(4); expect(fx.particles.count).toBeGreaterThan(0);
  } finally { fx.dispose(); w.dispose(); }
});

test('M1 E09/E15 @E15 real ramming kills stain real vehicle feedback; render advance preserves hash', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('drive-course');
  const feedback = new Map<number, VehicleFeedbackEvent>();
  const fx = new Vfx(w, { ...targets, vehicle(event) { feedback.set(event.id, { ...event }); } });
  try {
    const car = [...w.vehicles!.cars.values()][0];
    const id = w.spawnDummy('infected.dummy', { x: car.entity.transform.x + 1, z: car.entity.transform.z }, { hp: 10 });
    car.physics.body.setLinvel({ x: 12, y: 0, z: 0 }, true); w.update();
    expect(w.entities.get(id)!.health.current).toBe(0); expect(fx.dismemberedKills).toBeGreaterThan(0);
    const hash = stateHash(w.getState()); fx.advance(.3); expect(stateHash(w.getState())).toBe(hash);
    expect(feedback.get(car.entity.id)?.blood).toBeGreaterThan(0); expect(feedback.get(car.entity.id)?.id).toBe(car.entity.id);
  } finally { fx.dispose(); w.dispose(); }
});

test('M1 E11/E15 @E15 prop destruction keeps debris feedback without infected blood or gibs', async () => {
  const w = new SimWorld(); await w.init(); w.loadScenario('interact-yard');
  const fx = new Vfx(w, targets);
  try {
    const id = w.hazards!.spawn('fence', { x: 15, z: 0 }); w.hazards!.hit(id, 1000, 'bullet');
    expect(w.entities.get(id)!.destructible!.broken).toBe(true); expect(w.hazards!.debris.snapshot()).toHaveLength(8);
    expect(fx.kills).toBe(0); expect(fx.decals.count).toBe(0); expect(fx.gibs.count).toBe(0);
  } finally { fx.dispose(); w.dispose(); }
});
