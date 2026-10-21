import { readFileSync } from 'node:fs';
import { afterEach, expect, test } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { completeCampaignLevel } from '../../src/sim/progression/carryover';
import { decodeSave, validateSave } from '../../src/sim/progression/Save';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL5 } from '../../tools/sim-runner/l5Bots';
import { ObjectiveMarker } from '../../src/render/ObjectiveMarker';

/**
 * P0 10-20 (PO, PROD): "Seems like I cannot finsish L5. THe yellow circle isn't working and whe I go down the subway, I see the subway
 * shorty, but then the firgure walks back out...." Root causes: the ring stood on the street where nothing triggers; the station
 * camera flipped the keyboard axes (tests/e2e/levels/l5-finish.spec.ts), which pushed the courier sideways off the 1.2 m landing onto
 * the flush shaft plinth, where she walked north past the shaft and was stranded outside the station box.
 */
let world: SimWorld | undefined, next: SimWorld | undefined;
afterEach(() => { world?.dispose(); next?.dispose(); world = next = undefined; });
const drive = (w: SimWorld, x: number, z: number, n: number) => { for (let i = 0; i < n; i++) { const f = emptyInput(); f.move.x = x; f.move.z = z; w.applyInput(f, 'keyboard'); w.update(); } };

test('@E23 @E23-AC15 P0 the Metro ring marks the arrival, the plinths beside the landing cannot be walked on, the HUD says what is missing', async () => {
  const { world: w, mission: m } = await loadL5(1); world = w;
  for (const e of [...w.infected!.active]) w.infected!.release(e);
  m.completeObjective('emerge'); m.completeObjective('look');
  const metro = m.def.steps.find(s => s.id === 'metro')!, ring = m.def.anchors[metro.anchor];
  expect(m.state.steps.metro.status).toBe('active');
  // The ring the player sees is where the arrival starts: its whole radius lies behind the shutter line.
  for (const [dx, dz] of [[0, 0], [ring.radius, 0], [-ring.radius, 0], [0, ring.radius], [0, -ring.radius]]) expect(m.l5!.insideStation({ x: ring.x + dx, z: ring.z + dz }), `${dx},${dz}`).toBe(true);
  expect(m.l5!.metroStatus()).toBe('Survivors in 0/5');
  const p = w.entities.get(1)!;
  Object.assign(p.transform, { x: 37.8, z: -45 });
  w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setNextKinematicTranslation(p.transform); Object.assign(w.previousPlayer!, p.transform); w.spatial.set(1, 37.8, -45);
  for (let i = 0; i < 30; i++) w.update();
  // Up the street steps onto the landing, then the flipped-axis push (south-west), then north again: the measured PROD input.
  drive(w, -.12, -1, 40);
  drive(w, -.707, .707, 40);
  const door = m.def.anchors['l5-metro-shutter'];
  expect(Math.abs(p.transform.x - door.x), 'the courier stays on the landing and the street steps, never on the plinth top').toBeLessThanOrEqual(1.2);
  drive(w, 0, -1, 120);
  expect(m.l5!.insideStation(p.transform), JSON.stringify(p.transform)).toBe(true);
  expect(m.state.l5!.metroAt).toBeGreaterThan(0);
  expect(m.l5!.metroStatus()).toMatch(/^Stay on the stairs · [1-3] s · Survivors in \d\/5$/);
  w.clearInput();for(let i=0;i<180;i++)w.update();
  expect(m.l5!.metroStatus()).toMatch(/^Wait for the survivors · \d\/5 in$/);
  const marker = new ObjectiveMarker(w); marker.update(); expect(marker.visible).toBe(true);
  m.state.l5!.shutterAt = w.tick; marker.update();
  expect(m.l5!.metroStatus()).toBe('Everyone is in · shutter closing');
  expect(marker.visible).toBe(false); marker.dispose();
}, 120_000);

test('@E23 @E24 P1 finishing L5 holding the basement shotgun starts L6 with it, in session and after a reload from the menu', async () => {
  // PO 10-20 (verbatim): "now I am in L6, but I lost the shotgun.... that's bad". L6 racks are 3 wide; L5's shotgun is the 4th RIGHT slot.
  const { world: w, mission: m } = await loadL5(1); world = w;
  const save = preset('L5-default');
  w.events.on('pickup.collected', e => { if (e.type === 'pickup.collected' && 'actionId' in e && !save.ownedActions.includes(e.actionId)) save.ownedActions.push(e.actionId); });
  const pickup = [...w.entities.iterate()].find(e => e.pickup && 'actionId' in e.pickup && e.archetype === 'weapon.shotgun')!;
  for (let i = 0; i < 60; i++) w.update();
  const p = w.entities.get(1)!; Object.assign(p.transform, { x: pickup.transform.x + .95, z: pickup.transform.z });
  w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setNextKinematicTranslation(p.transform); Object.assign(w.previousPlayer!, p.transform); w.spatial.set(1, p.transform.x, p.transform.z);
  w.setInput({ interact: true }); w.update(); w.clearInput(); for (let i = 0; i < 40; i++) w.update();
  const held = p.weapons!.RIGHT.rack.map(r => r.id), left = p.weapons!.LEFT.rack.map(r => r.id);
  expect(held).toContain('weapon.shotgun');
  m.completeObjective('emerge'); m.completeObjective('look'); m.completeObjective('metro');
  expect(m.state.phase).toBe('progression');
  completeCampaignLevel(save, 5, m.state.result!, w);
  expect(save.racks.RIGHT).toEqual(held);
  expect(validateSave(save)).toBe(true);
  const reloaded = decodeSave(JSON.stringify(save));
  expect(reloaded.status, 'reload from the menu').toBe('ok');
  for (const campaign of [save, reloaded.status === 'ok' ? reloaded.save : save]) {
    next?.dispose(); next = new SimWorld(); await next.init();
    next.loadComposition(compositions.L6, [JSON.parse(readFileSync('public/assets/layouts/D-SUBWAY.layout.json', 'utf8'))], 7);
    applyCampaign(next, campaign);
    next.loadMission(resolveCampaignMission('L6', next.districts!)).begin();
    for (let i = 0; i < 2; i++) next.update();
    const racks = next.entities.get(1)!.weapons!;
    expect(racks.RIGHT.rack.map(r => r.id)).toEqual(held);
    expect(racks.LEFT.rack.map(r => r.id)).toEqual(left);
  }
}, 180_000);
