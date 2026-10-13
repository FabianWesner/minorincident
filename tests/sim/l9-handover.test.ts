import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { completeCampaignLevel } from '../../src/sim/progression/carryover';
import { decodeSave, validateSave } from '../../src/sim/progression/Save';
import type { DistrictLayout } from '../../src/levels/districts/types';
const cureLayout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CROSSING.layout.json', 'utf8')) as DistrictLayout;
for (const hp of [1000, 0]) test(`T-E31-15-handover @E31-AC14 @E31-AC15 ${hp} HP crash commits axe-only L10, save and retry`, async () => {
  const w = new SimWorld(), next = new SimWorld(); await w.init(); await next.init();
  const save = preset('L8-default'); save.completedLevels = 8; save.unlockedLevel = 9; if (!save.ownedActions.includes('ability.corgi-lure')) save.ownedActions.push('ability.corgi-lure');
  try {
    w.loadComposition(compositions.L9, [layout], 31); applyCampaign(w, save);
    const m = w.loadMission(resolveCampaignMission('L9', w.districts!)); m.begin();
    const car = w.vehicles!.cars.get(m.l9!.state.carId)!;
    w.vehicles!.damage(car.entity.id, 1000 - hp);
    const dog = w.npcs!.companion.spawn();
    const door = { x: car.entity.transform.x + car.physics.def.doorX, z: car.entity.transform.z + car.physics.def.width / 2 + .55 };
    const person = w.npcs!.civilians.spawn('civilian', door, { waypoints: [door] });
    expect(w.vehicles!.boardPassenger(car.entity.id, person)).toBe(true);
    for (let i = 0; i < 90; i++) w.update();
    save.transport = w.vehicles!.transfer(car.entity.id);
    car.physics.body.setTranslation({ x: 470, y: 1, z: 0 }, true);
    w.entities.get(1)!.health.current = 1;
    w.combat!.pickups.spawn('weapon.rocket-launcher', { x: 547, z: 0 }, true);
    let completed = 0;
    w.events.on('level.completed', e => { if (e.type === 'level.completed') { completed++; completeCampaignLevel(save, 9, e.result, w); } });
    for (let i = 0; i < 850; i++) w.update();
    expect(completed).toBe(1); expect(save.pending).toBeUndefined(); expect(save.transport).toBeUndefined(); expect(save.l9Crash).toBeUndefined();
    expect(save.crossingHandover!.shelteredPassengers.map(e => e.id)).toEqual([person]);
    expect(save.crossingHandover!.shelteredPassengers[0].health.current).toBeGreaterThan(0);
    expect(save.crossingHandover?.preCrashDurability).toBe(hp); expect(save.crossingHandover?.lostWeapons).toContain('weapon.rocket-launcher');
    expect(save.ownedActions).toEqual(['weapon.fire-axe', 'ability.corgi-lure']);
    expect(save.racks).toEqual({ LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.fire-axe'] });
    expect(w.entities.get(1)!.weapons!.LEFT.rack[0]).toMatchObject({ id: 'weapon.fire-axe', magazine: 0, charges: 0 });
    expect([...w.entities.iterate()].filter(e => e.pickup && 'actionId' in e.pickup)).toHaveLength(0);
    expect(validateSave(save)).toBe(true);
    const reloaded = decodeSave(JSON.stringify(save)); expect(reloaded.status).toBe('ok'); if (reloaded.status !== 'ok') throw new Error('reload');
    const legacy = decodeSave(JSON.stringify({ ...preset('L8-default'), completedLevels: 9, unlockedLevel: 9, l9Crash: m.l9!.save() }));
    expect(legacy.status).toBe('ok'); if (legacy.status === 'ok') { expect(legacy.save.unlockedLevel).toBe(10); expect(legacy.save.racks.RIGHT).toEqual(['weapon.fire-axe']); }
    const evidence = structuredClone(save.crossingHandover); completeCampaignLevel(save, 9, m.state.result!, w); expect(save.crossingHandover).toEqual(evidence);
    next.loadComposition(compositions.L10, [cureLayout], 31); applyCampaign(next, reloaded.save);
    const opening = next.loadMission(resolveCampaignMission('L10', next.districts!)); opening.begin(); next.update();
    expect(opening.state.checkpoint).toBe('cure-crash'); expect(next.vehicles!.active).toBeNull(); expect(next.vehicles!.cars.size).toBe(0);
    expect(next.entities.get(1)!.health.current).toBe(next.entities.get(1)!.health.max);
    expect([...next.entities.iterate()].filter(e => e.civilian || e.escort)).toHaveLength(0);
    expect(next.npcs!.companion.safe).toBe(true);
    expect(next.entities.get(1)!.transform.x).toBe(547);
    for (const side of ['LEFT','RIGHT'] as const) expect(next.entities.get(1)!.weapons![side].rack.map(s => s.id)).toEqual(['weapon.fire-axe']);
    const corgi = [...next.entities.iterate()].find(e => e.companion); expect(corgi?.health.current).toBeGreaterThan(0); expect(corgi?.id).toBe(dog);
    opening.restore('cure-crash'); expect(next.entities.get(1)!.weapons!.LEFT.rack.map(s => s.id)).toEqual(['weapon.fire-axe']);
    expect(validateSave({ ...save, transport: {} })).toBe(false);
    expect(validateSave({ ...save, crossingHandover: undefined })).toBe(false);
  } finally { w.dispose(); next.dispose(); }
});
test('T-E31-14-legacy @E31-AC14 broken pre-finale save migrates at its saved location to the driveable floor', async () => {
  const w = new SimWorld(); await w.init();
  try {
    w.loadComposition(compositions.L9, [layout], 31); const m = w.loadMission(resolveCampaignMission('L9', w.districts!)); m.begin();
    const crash = m.l9!.save(); crash.vehicle.health.current = 0; crash.vehicle.vehicle!.damage = 'exploded'; crash.vehicle.vehicle!.driver = null; crash.vehicle.transform.x = -123;
    const save = { ...preset('L8-default'), completedLevels: 8, unlockedLevel: 9, l9Crash: crash };
    const result = decodeSave(JSON.stringify(save)); expect(result.status).toBe('ok'); if (result.status !== 'ok') throw new Error('reload');
    expect(result.save.l9Crash!.vehicle.transform.x).toBe(-123); expect(result.save.l9Crash!.vehicle.vehicle).toMatchObject({ floor: true, damage: 'normal', driver: 1 });
  } finally { w.dispose(); }
});
