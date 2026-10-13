import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { applyCampaign } from '../../src/sim/progression/apply';
import { preset } from '../../src/sim/progression/Campaign';
import { decodeSave } from '../../src/sim/progression/Save';
import { emptyInput } from '../../src/input/InputFrame';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import type { DistrictLayout } from '../../src/levels/districts/types';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CROSSING.layout.json', 'utf8')) as DistrictLayout;
async function load(hp = 1000, z = 0, x = 470) {
  const w = new SimWorld(); await w.init(); w.loadComposition(compositions.L9, [layout], 31);
  const m = w.loadMission(resolveCampaignMission('L9', w.districts!)); m.begin();
  const id = m.l9!.state.carId, car = w.vehicles!.cars.get(id)!;
  w.vehicles!.damage(id, 1000 - hp);
  car.physics.body.setTranslation({ x, y: 1, z }, true);
  return w;
}
function advance(w: SimWorld, n: number) { for (let i = 0; i < n; i++) w.update(); }
for (const hp of [1000, 0]) test(`T-E31-15-crash @E31-AC01 @E31-AC10 @E31-AC15 one forced crash at ${hp} durability`, async () => {
  const w = await load(hp); const events: string[] = [];
  try {
    for (const type of ['vehicle.exploded', 'level.completed', 'mission.signal', 'vehicle.sound'] as const) w.events.on(type, e => { events.push(e.type === 'mission.signal' ? e.name : e.type === 'vehicle.sound' ? `vehicle.sound:${e.phase}` : e.type); });
    advance(w, 1); expect(w.missions!.l9!.state.phase).toBe('approach');
    expect(w.missions!.l9!.state.preCrashDurability).toBe(hp);
    w.setInput({ ...emptyInput(), move: { x: -1, z: 1 }, interact: true });
    advance(w, 300); expect(w.missions!.l9!.state.phase).toBe('impact');
    expect(w.missions!.state.subtitle?.text).toContain('bridge gave way');
    const car = w.entities.get(w.missions!.l9!.state.carId)!;
    expect(car.vehicle!.damage).toBe('exploded'); expect(car.vehicle!.driver).toBeNull(); expect(car.vehicle!.floor).toBe(false);
    expect(w.vehicles!.active).toBeNull(); expect(w.entities.get(1)!.health.current).toBeGreaterThanOrEqual(1);
    expect(events.filter(e => e === 'vehicle.exploded')).toHaveLength(1); expect(events.filter(e => e === 'vehicle.sound:stop')).toHaveLength(1); expect(events.filter(e => e === 'vehicle.sound:crash')).toHaveLength(1); expect(events).not.toContain('level.completed');
    advance(w, 180); expect(w.missions!.l9!.state.phase).toBe('crawl'); expect(w.entities.get(1)!.survivor!.scriptedClip).toBe('crawl');
    advance(w, 360); expect(w.missions!.l9!.state.phase).toBe('done');
    expect(w.entities.get(1)!.transform.x).toBeCloseTo(547);
    expect(events.filter(e => e === 'level.completed')).toHaveLength(1); expect(w.storyLock).toBeNull();
    advance(w, 120); expect(events.filter(e => e === 'vehicle.exploded')).toHaveLength(1);
  } finally { w.dispose(); }
});
for (const [x, z] of [[470, 100], [550, 0], [550, -100], [470, -390], [470, 390]]) test(`T-E31-10-bypass @E31-AC10 outskirts bypass ${x},${z} still crashes`, async () => {
  const w = await load(1000, z, x);
  try { advance(w, 1); expect(w.missions!.l9!.state.phase).toBe('approach'); expect(w.missions!.state.steps['reach-outskirts'].status).not.toBe('completed'); advance(w, 841); expect(w.missions!.l9!.state.finished).toBe(true); }
  finally { w.dispose(); }
});
for (const tick of [60, 240, 330, 600]) test(`T-E31-14-crash @E31-AC14 checkpoint restore at crash tick ${tick} resumes without another explosion`, async () => {
  const w = await load(); let explosions = 0;
  try {
    w.events.on('vehicle.exploded', () => explosions++); advance(w, tick);
    const m = w.missions!, phase = m.l9!.state.phase;
    m.checkpoint('crossing-start'); advance(w, 30); m.restore('crossing-start');
    expect(m.l9!.state.phase).toBe(phase); expect(w.storyLock).not.toBeNull();
    advance(w, 900); expect(m.l9!.state.finished).toBe(true); expect(explosions).toBe(1);
    expect(w.entities.get(m.l9!.state.carId)!.vehicle!.damage).toBe('exploded');
  } finally { w.dispose(); }
});
test('T-E31-10-fallback @E31-AC10 blocked primary crawl anchor uses authored fallback', async () => {
  const w = await load();
  try {
    w.physics.addBlocker({ x: 527.5, y: 1, z: 2.6, halfX: .8, halfY: 1, halfZ: .8 });
    advance(w, 301); expect(w.missions!.l9!.state.crawlAnchor).toBe('crawl-fallback'); advance(w, 540); expect(w.missions!.l9!.state.finished).toBe(true);
  } finally { w.dispose(); }
});

for (const tick of [60, 240, 330, 600, 841]) test(`T-E31-14-load @E31-AC14 serialized campaign resumes crash at tick ${tick}`, async () => {
  const w = await load(0), restored = new SimWorld();
  try {
    advance(w, tick);
    const save = { ...preset('L8-default'), unlockedLevel: 9 as const, completedLevels: 8, l9Crash: w.missions!.l9!.save() };
    const decoded = decodeSave(JSON.stringify(save)); expect(decoded.status).toBe('ok');
    await restored.init(); restored.loadComposition(compositions.L9, [layout], 31);
    applyCampaign(restored, save);
    const m = restored.loadMission(resolveCampaignMission('L9', restored.districts!)); m.begin();
    expect(m.l9!.state.phase).toBe(w.missions!.l9!.state.phase);
    expect(restored.entities.get(m.l9!.state.carId)!.health.current).toBe(0);
    let blasts = 0, completions = 0; restored.events.on('vehicle.exploded', () => blasts++); restored.events.on('level.completed', () => completions++);
    advance(restored, 900); expect(m.l9!.state.finished).toBe(true); expect(blasts).toBe(tick < 301 ? 1 : 0); expect(completions).toBe(tick < 841 ? 1 : 0);
    expect(restored.vehicles!.cars.size).toBe(1); expect(restored.entities.get(1)!.health.current).toBeGreaterThanOrEqual(1);
  } finally { w.dispose(); restored.dispose(); }
});

test('T-E31-16-dress @E31-AC16 L9 uses dry light wind with clear moonlit sightlines', async () => {
  const w = await load(1000, 0, -550);
  try {
    advance(w, 300);
    expect(w.weather!.kind).toBe('wind'); expect(w.weather!.windStrength).toBe(.2);
    expect(w.weather!.rain).toBe(0); expect(w.weather!.flakes).toBe(0);
    expect(w.weather!.wetness).toBe(0); expect(w.weather!.fog).toBe(0);
    expect(w.weather!.modifiers.vehicleGrip).toBe(1);
    expect(compositions.L9.timeOfDay).toBe('L9-crossing');
  } finally { w.dispose(); }
});
