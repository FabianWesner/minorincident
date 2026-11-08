/** Fresh E25 lamp-state measurements; a manual QA probe, outside the per-change test suite. */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { missionSandbox } from '../../tests/fixtures/scenarios/mission-sandbox';
import { Perception } from '../../src/sim/ai/Perception';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { LampPowerView } from '../../src/render/lighting/LampPowerView';
import { readGltfJson, buildLightTable } from '../assets/lights';
import { anchorsFor } from '../../src/data/placedLights';

const out = process.argv[2] ?? 'test-results/epics/E25/sim-audit.json';
const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as { glb?: string; status: string }[];
const missing: { glb: string; node: string }[] = [], absent: string[] = [];
let exports = 0, named = 0;
for (const glb of new Set(manifest.flatMap(a => a.glb?.endsWith('.glb') ? [a.glb] : []))) {
  if (!existsSync(glb)) { absent.push(glb); continue; }
  exports++;
  for (const node of readGltfJson(glb).nodes ?? []) if (node.name?.startsWith('light:')) {
    named++; if (node.extras?.ss_light === undefined) missing.push({ glb, node: node.name });
  }
}
const { table, errors } = buildLightTable();
const world = new SimWorld(); await world.init(); world.loadScenario('combat-arena', 1);
const mission = missionSandbox(); mission.actors = {}; mission.groups = {}; mission.onStart = [{ kind: 'timeOfDay', value: 'night' }];
world.scenario = 'mission-sandbox'; world.loadMission(mission); world.missions!.begin();
const perception = new Perception(world), enemy = world.entities.get(world.spawnDummy('infected.dummy', { x: -15, z: 0 }, { hp: 100 }))!;
function sightRange() { let low = 0, high = 32; for (let i = 0; i < 40; i++) { const distance = (low + high) / 2; enemy.transform.x = 3 - distance; enemy.transform.yaw = 0; if (perception.inCone(enemy, { x: 3, z: 0 })) low = distance; else high = distance; } return low; }
const power = world.lightPower!, anchors = anchorsFor('prop.light-tower-trailer');
const lamps = anchors.map((anchor, i) => power.register({ id: `trailer:${anchor.name}`, group: 'trailer', x: 3, y: 1, z: i * 30, range: 24, breakable: true }, false));
const view = new LampPowerView(); view.state = power; view.base(lamps[0].id, anchors);
const generator = world.interactables!.spawn('generator', { x: 0, z: 0 }, { holdTime: .1, fuel: 100, powerGroup: 'trailer' });
world.setInput({ interact: true }); world.update(); world.clearInput();
const started = lamps[0].startedAt, states: { age: number; emissives: number[]; on: boolean[] }[] = [];
for (let i = 0; i < 121; i++) {
  view.update(); states.push({ age: world.tick - started, emissives: view.snapshot().map(l => l.emissive), on: lamps.map(l => power.isOn(l.id)) }); world.update();
}
const transitions = states.slice(1).filter((s, i) => s.emissives[0] !== states[i].emissives[0]).map(s => s.age);
const sightBefore = power.sightMultiplier({ x: 3, z: 0 }); const rangeBefore = sightRange();
// A real pistol attack through the combat hit query, rather than a synthetic light.broken event.
world.combat!.setLoadout(['weapon.pistol'], ['weapon.grenade']);
world.setInput({ aim: { x: 1, z: 0 }, aimPoint: { x: 3, z: 0 }, left: { down: true, held: false, up: true } });
world.update(); world.clearInput(); for (let i = 0; i < 30; i++) world.update();
const hitEvents = world.events.events().filter(e => e.type === 'combat.hit' && e.targetId === lamps[0].entityId);
const broken = lamps[0].broken;
world.update(); const sightAfter = power.sightMultiplier({ x: 3, z: 0 }); const rangeAfter = sightRange();
power.setGroup('trailer', false); view.update();
const result = {
  at: new Date().toISOString(), anchors: { exports, named, parsed: Object.values(table).flat().length, missing, absent, errors, tableCurrent: readFileSync('src/data/lightAnchors.json', 'utf8') === JSON.stringify(table) + '\n' },
  startup: { generator, started, powerOn: world.events.events().filter(e => e.type === 'power.on'), transitions, states, steadyOn: states.filter(s => s.age >= 90).every(s => s.emissives.every(v => v === 1)) },
  breakage: { hitEvents, broken, brokenEvents: world.events.events().filter(e => e.type === 'light.broken'), sparks: world.events.events().filter(e => e.type === 'vfx.effect' && e.kind === 'electric'), sightBefore, sightAfter, rangeBefore, rangeAfter, measuredRangeDrop: 1 - rangeAfter / rangeBefore, sightDrop: 1 - sightAfter / sightBefore },
  off: { event: world.events.events().filter(e => e.type === 'power.off'), on: lamps.map(l => power.isOn(l.id)), emissives: view.snapshot().map(l => l.emissive) },
};
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, startup: { ...result.startup, states: `${states.length} samples in ${out}` } }, null, 2));
view.dispose(); world.dispose();
