import { readFileSync } from 'node:fs';
import { compositions } from '../../../src/levels/compositions';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { preset } from '../../../src/sim/progression/Campaign';
import { decodeSave, validateSave } from '../../../src/sim/progression/Save';
import { transactArsenal } from '../../../src/sim/progression/arsenal';
import { cureRegions, levelTenMission } from '../../../src/levels/L10/mission';
import { installMegaPursuit } from '../../../src/sim/ai/MegaPursuit';
let world: SimWorld;
beforeEach(async () => { world = new SimWorld(); await world.init(); world.loadScenario('combat-arena'); applyCampaign(world, preset('L10-default')); });
afterEach(() => world.dispose());
const mission = (position = { x: 0, z: 0 }) => world.loadMission(levelTenMission(() => ({ ...position, radius: 2 })));

test('T-E32-01 @E32 @E32-AC01 ordered graph prevents skipping arsenal, cure and release prerequisites', () => {
  const m = mission(); m.begin();
  m.setState('cure-carried', true); m.setState('cure-installed', true); m.setState('charge-ready', true); m.setState('mega-dead', true);
  world.update();
  expect(m.state.steps['residential-fringe'].status).toBe('active');
  expect(m.state.steps.release.status).toBe('pending');
  expect(m.state.steps.credits.status).toBe('pending');
  const checkpoints = m.def.steps.flatMap(s => s.onComplete ?? []).filter(a => a.kind === 'checkpoint').map(a => a.id);
  expect(cureRegions.every(r => m.def.checkpoints.includes(r.checkpoint))).toBe(true);
  expect(checkpoints).toEqual(['cure-residential','cure-industrial','cure-military','cure-research-entry','cure-research','cure-corridor','cure-complex','cure-disperse-ready']);
  expect(cureRegions.reduce((n, r) => n + r.routeMetres, 0)).toBe(4300);
  while (m.state.steps.hold.status !== 'active') m.completeObjective();
  m.state.counters['charge-ticks'] = 3600; m.setState('charge-active', true);
  m.setState('mega-dead', false); world.update(); expect(m.state.steps.hold.status).toBe('active');
  m.setState('mega-dead', true); world.update(); expect(m.state.steps.release.status).toBe('active');
  expect(m.state.steps.epilogue.status).toBe('pending');
  world.setInput({ interact: true }); world.update(); world.clearInput(); expect(m.state.steps.epilogue.status).toBe('active');
  m.setState('epilogue-finished', true); world.update(); expect(m.state.steps.credits.status).toBe('active');
  m.setState('credits-finished', true); world.update(); world.update();
  expect(world.events.events().filter(e => e.type === 'level.completed')).toHaveLength(1);
});

test('T-E32-27 @E32 @E32-AC27 every region retries with its arsenal, mission items, chunk and Mega seam', () => {
  world.reset(); world.loadScenario('mega-course'); applyCampaign(world, preset('L10-default'));
  const mega = installMegaPursuit(world, { introduceTick: null });
  const bossId = mega.introduce({ x: -80, z: 0 });
  const m = mission(); m.begin();
  for (const region of cureRegions) {
    if (region.checkpoint !== 'cure-crash') while (m.state.checkpoint !== region.checkpoint) m.completeObjective();
    const before = m.saveResume(), weapons = structuredClone(world.progression!.campaign!.ownedActions);
    expect(before.checkpoint.seams!.megaPursuit).toBeDefined();
    const boss = world.entities.get(bossId)!; const hp = boss.health.current;
    boss.health.current = hp - 20;
    m.setState('cure-carried', false); transactArsenal(world, ['weapon.smg'], []);
    m.restore();
    expect(m.state.checkpoint).toBe(region.checkpoint);
    expect(world.progression!.campaign!.ownedActions).toEqual(weapons);
    expect(world.entities.get(bossId)!.health.current).toBe(hp);
    expect(world.megaPursuit!.state.id).toBe(bossId);
    expect([...world.entities.iterate()].filter(e => e.infected?.pursuit === true)).toHaveLength(1);
    expect(m.state.items).toEqual(before.checkpoint.state.items);
  }
});

test('T-E32-05 @E32 @E32-AC05 arsenal additions/removals and retry checkpoint survive JSON SaveStore round trip', () => {
  const m = mission(); m.begin();
  const entities = world.query({}).map(e => e.id);
  m.completeObjective(); m.completeObjective();
  expect(world.query({}).map(e => e.id)).toEqual(entities);
  expect(world.events.events().filter(e => e.type === 'pickup.collected' && 'actionId' in e && e.actionId === 'weapon.pistol')).toHaveLength(1);
  expect(world.progression!.campaign!.ownedActions).toContain('weapon.pistol');
  expect(world.combat!.runner.loadout.state.selectedSide).toBe('RIGHT');
  expect(world.combat!.runner.loadout.current('RIGHT').id).toBe('weapon.pistol');
  m.completeObjective();
  transactArsenal(world, [], ['weapon.pistol']);
  m.checkpoint('cure-industrial');
  const save = structuredClone(world.progression!.campaign!); save.cureResume = m.saveResume();
  expect(validateSave(save)).toBe(true);
  const decoded = decodeSave(JSON.stringify(save)); expect(decoded.status).toBe('ok');
  if (decoded.status !== 'ok') return;
  m.completeObjective(); transactArsenal(world, ['weapon.pistol'], []);
  applyCampaign(world, decoded.save); m.loadResume(decoded.save.cureResume!);
  expect(world.progression!.campaign!.ownedActions).not.toContain('weapon.pistol');
  expect(world.progression!.campaign!.ownedActions).toContain('weapon.shotgun');
  expect(m.state.checkpoint).toBe('cure-industrial');
  transactArsenal(world, ['weapon.army-mg'], []); m.restore();
  expect(world.progression!.campaign!.ownedActions).not.toContain('weapon.army-mg');
  expect(world.combat!.runner.loadout.state.RIGHT.rack.map(s => s.id)).toEqual(['weapon.fire-axe','weapon.shotgun']);
});

test('T-E32-27b @E32 @E32-AC27 live progress reload retains the prior retry snapshot', () => {
  const m = mission(); m.begin(); m.completeObjective(); m.completeObjective();
  m.setState('terminal-read', true);
  world.entities.get(1)!.health.current = 73;
  m.state.stats.time = 12;
  m.state.counters['charge-ticks'] = 900;
  const saved = JSON.parse(JSON.stringify(m.saveResume()));
  m.loadResume(saved); expect(m.state.states['terminal-read']).toBe(true);
  expect(world.entities.get(1)!.health.current).toBe(73);
  expect(m.state.stats.time).toBe(12);
  expect(m.state.counters['charge-ticks']).toBe(900);
  m.restore(); expect(m.state.states['terminal-read']).toBe(false);
});

for (const quality of ['high','low'] as const) test(`T-E32-27-chunks-${quality} @E32 @E32-AC27 @E32-AC28 region retry and fresh reload restore inactive chunks and the same Mega`, () => {
  world.reset();
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-CROSSING.layout.json', 'utf8'));
  // This shared-streamer fixture deliberately uses Crossing geometry, under the L10 mission.
  const composition = { ...compositions.L10, districts: compositions['D-CROSSING'].districts };
  const start = { x: 0, z: -330 }, end = { x: 450, z: 220 };
  world.loadComposition(composition, [layout], 31);
  applyCampaign(world, preset('L10-default'));
  world.chunks!.setQuality(quality);
  const focus = (x: number, z: number) => { Object.assign(world.entities.get(1)!.transform, { x, z }); world.physics.playerBody!.setTranslation(world.entities.get(1)!.transform, true); world.chunks!.update([x,z]); };
  focus(start.x, start.z);
  const infected = world.infected!.spawn('infected.runner', { x: start.x + 8, z: start.z + 5 });
  world.entities.get(infected)!.health.current = 37;
  focus(end.x, end.z); expect(world.entities.get(infected)).toBeUndefined();
  const mega = installMegaPursuit(world, { introduceTick: null });
  const boss = mega.introduce({ x: end.x - 100, z: end.z });
  const m = mission(end); m.begin(); m.completeObjective(); m.completeObjective();
  // Live reload preserves a close boss position; only death/checkpoint retries apply the fairness gap.
  world.entities.get(boss)!.transform.x = end.x + 15; mega.state.x = end.x + 15;
  world.entities.get(boss)!.infected!.megaRocketIds = [21,22];
  const save = structuredClone(world.progression!.campaign!); save.cureResume = m.saveResume();
  expect(save.cureResume.checkpoint.seams!.chunks).toBeDefined();
  const decoded = decodeSave(JSON.stringify(save)); expect(decoded.status).toBe('ok');
  if (decoded.status !== 'ok') return;
  world.reset(); world.loadComposition(composition, [layout], 31);
  applyCampaign(world, decoded.save); world.chunks!.setQuality(quality);
  installMegaPursuit(world, { introduceTick: null });
  const restored = mission(end); restored.begin(); restored.loadResume(decoded.save.cureResume!);
  expect(world.megaPursuit!.state.id).toBe(boss);
  expect(world.entities.get(boss)!.health.current).toBe(3000);
  expect(world.entities.get(boss)!.transform.x).toBe(end.x + 15);
  expect(world.megaPursuit!.state.x).toBe(end.x + 15);
  expect(world.combat!.runner.lastAttackId).toBeGreaterThanOrEqual(22);
  expect(world.progression!.campaign!.ownedActions).toContain('weapon.pistol');
  focus(start.x, start.z); expect(world.entities.get(infected)!.health.current).toBe(37);
  focus(end.x, end.z); restored.restore();
  expect(world.chunks!.stats().resident).toBeLessThanOrEqual(quality === 'high' ? 25 : 9);
  expect(world.megaPursuit!.state.id).toBe(boss);
});

test('T-E32-27-death @E32 @E32-AC27 death returns to the reached industrial checkpoint with both acquired guns', () => {
  const m = mission(); m.begin();
  m.completeObjective(); m.completeObjective(); m.completeObjective();
  expect(m.state.checkpoint).toBe('cure-industrial');
  Object.assign(world.entities.get(1)!.transform, { x: 10, z: 10 });
  world.physics.playerBody!.setTranslation(world.entities.get(1)!.transform, true);
  world.player!.damage(1000, world.tick);
  for (let tick = 0; tick < 400 && world.entities.get(1)!.health.current === 0; tick++) world.update();
  expect(world.entities.get(1)!.health.current).toBeGreaterThan(0);
  expect(m.state.checkpoint).toBe('cure-industrial');
  expect(Math.hypot(world.entities.get(1)!.transform.x, world.entities.get(1)!.transform.z)).toBeLessThan(1.5);
  expect(world.progression!.campaign!.ownedActions).toContain('weapon.pistol');
  expect(world.progression!.campaign!.ownedActions).toContain('weapon.shotgun');
});

test('T-E32-27-death-save @E32 @E32-AC27 saving during death resumes at the retry checkpoint', () => {
  const m = mission(); m.begin(); m.completeObjective(); m.completeObjective(); m.completeObjective();
  m.setState('terminal-read', true); m.state.counters['charge-ticks'] = 900;
  Object.assign(world.entities.get(1)!.transform, { x: 10, z: 10 });
  world.player!.damage(1000, world.tick);
  const saved = JSON.parse(JSON.stringify(m.saveResume()));
  m.loadResume(saved);
  expect(world.entities.get(1)!.health.current).toBe(world.entities.get(1)!.health.max);
  expect(m.state.checkpoint).toBe('cure-industrial');
  expect(m.state.states['terminal-read']).toBe(false); expect(m.state.counters['charge-ticks']).toBe(0);
  expect(Math.hypot(world.entities.get(1)!.transform.x, world.entities.get(1)!.transform.z)).toBeLessThan(1.5);
});

test('T-E32-27-attack-ids @E32 @E32-AC27 fresh reload preserves attack IDs for the Mega rocket ledger', () => {
  const m = mission(); m.begin();
  world.setInput({ left: { down: true, held: false, up: false }, aim: { x: 1, z: 0 } }); world.update(); world.clearInput();
  const sequence = world.combat!.runner.lastAttackId; expect(sequence).toBeGreaterThan(0);
  const saved = JSON.parse(JSON.stringify(m.saveResume())), save = structuredClone(world.progression!.campaign!);
  world.reset(); world.loadScenario('combat-arena'); applyCampaign(world, save);
  const next = mission(); next.begin(); next.loadResume(saved);
  expect(world.combat!.runner.lastAttackId).toBe(sequence);
  world.setInput({ left: { down: true, held: false, up: false }, aim: { x: 1, z: 0 } });
  for (let tick = 0; tick < 120; tick++) world.update();
  expect(world.combat!.runner.lastAttackId).toBeGreaterThan(sequence);
});
