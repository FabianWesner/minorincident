/** No browser. Native crop/perception/scare/save evidence and source/runtime asset contracts. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadLevel } from '../sim-runner/levels';
import { inCorn, cornBlocksSight } from '../../src/levels/L10/farm';
import { applyFarmLandscape, farmLaneDistance } from '../../src/levels/L10/farmLayout';
import { missionControls } from '../../src/sim/missions/controls';
import { updateFarmScares, farmScareSites, type FarmScareState } from '../../src/sim/missions/FarmScares';
import { scoreFile } from '../../src/audio/StreamedMusic';
import { audioCues, stemBank } from '../../src/data/audioCues';
import { moveAgent } from '../../src/sim/locomotion/AgentMotion';
import { emptyInput } from '../../src/input/InputFrame';
import { timeOfDay } from '../../src/data/timeOfDay';
const world = await loadLevel('L10', 32);
try {
  const d = world.districts!.districts[0], crops = d.layout.placements.filter(p => p.assetId === 'veg.corn-block');
  assert(crops.length >= 100);
  const prepared = structuredClone(d.layout); applyFarmLandscape(prepared);
  assert.deepEqual(prepared.colliders, d.layout.colliders);
  for (const asset of ['prop.farm-tractor', 'prop.farm-combine', 'prop.farm-irrigator']) assert(d.layout.placements.some(p => p.assetId === asset));
  assert(!d.layout.placements.some(p => ['prop.tree', 'prop.street-tree', 'prop.street-tree-blossom'].includes(p.assetId)));
  assert(d.layout.placements.filter(p => p.assetId === 'bld.farm-barn-ruin').length >= 2);
  assert(d.layout.placements.filter(p => p.assetId === 'bld.farm-house-ruin').length >= 2);
  assert(crops.every(p => farmLaneDistance(p.position[0], p.position[2]) >= 11));
  assert(!d.decay.colliders.some(c => c.id.includes('decor-cure-corn')));
  const crop = crops.find(p => world.infected!.nav.clear(p.position[0], p.position[2], .7))!; assert(crop);
  const x = crop.position[0], z = crop.position[2];
  assert(inCorn(world, [x, z])); assert(!inCorn(world, [547, 0]));
  assert(cornBlocksSight(world, [x - 8, z], [x + 8, z]));
  const id = world.infected!.spawn('infected.runner', { x, z }, { perched: false, birds: 1 });
  const actor = world.entities.get(id)!; actor.transform.yaw = 0;
  assert.equal(world.infected!.hearing.sees(actor, { x: x + 4, z }), false);
  assert.equal(world.infected!.hearing.sees(actor, { x: x + 2, z }), true);
  assert.equal(world.infected!.hearing.tracks(actor, { x: x + 4, z }), false);
  assert.equal(world.infected!.hearing.hears(actor, { x: x + 1.5, z }), true);
  assert.equal(world.infected!.nav.movementCost!(x, z), 1 / .85);
  const walker = structuredClone(actor); delete walker.locomotion;
  // Measure settled intent in one clear terrain cell; response takes more than one second to settle.
  for (let tick = 1; tick <= 180; tick++) {
    walker.transform.x = x; walker.transform.z = z;
    moveAgent(walker, 4, 0, world.infected!.nav, 1000 + tick);
  }
  assert(Math.abs(walker.locomotion!.vx - 3.4) < .01);
  missionControls(world).teleport(1, { x: x + 4, z });
  const dog = [...world.entities.iterate()].find(e => e.companion)!; assert(dog);
  dog.companion!.barkAt = 0; delete dog.companion!.warn;
  Object.assign(dog.transform, { x: x + 4, z: z + 2 });
  let warned = false;
  const stopWarn = world.events.on('corgi.warn', e => { if (e.type === 'corgi.warn' && e.threatId === id) warned = true; });
  const visible = world.infected!.director.visible;
  world.infected!.director.visible = () => true; // Crop, rather than the camera edge, must conceal the threat.
  world.npcs!.companion.update();
  world.infected!.director.visible = visible; stopWarn(); assert(warned);
  missionControls(world).teleport(1, { x, z }); world.applyInput(emptyInput(), 'keyboard'); world.update();
  assert.equal(world.player!.locomotion.speedScale, .85);
  missionControls(world).teleport(1, { x: 547, z: 0 }); world.update(); assert.equal(world.player!.locomotion.speedScale, 1);
  // Drive the actual producer at every crop edge until its four authored sites have all sounded and emerged.
  const ledger: FarmScareState = {}; let stings = 0;
  const off = world.events.on('music.stinger', e => { if (e.type === 'music.stinger' && e.kind === 'scare') stings++; });
  const sites = farmScareSites(d.layout.placements);
  assert.equal(sites.length, 4);
  for (const p of sites) {
    world.chunks!.update([p.x, p.z]);
    missionControls(world).teleport(1, { x: p.x + 4, z: p.z });
    updateFarmScares(world, ledger);
  }
  assert.equal(stings, 4); assert.equal(Object.keys(ledger).length, 4);
  assert(Object.values(ledger).every(s => s.actor === undefined && s.due > world.tick));
  const checkpoint = structuredClone(ledger);
  // Retry the same ledger before the delay: no duplicate cue or actor.
  updateFarmScares(world, checkpoint); assert.equal(stings, 4);
  world.tick += 100;
  for (const p of sites) {
    world.chunks!.update([p.x, p.z]);
    missionControls(world).teleport(1, { x: p.x + 4, z: p.z });
    updateFarmScares(world, checkpoint);
    const id = checkpoint[p.id].actor; assert(id);
    assert.notEqual(world.entities.get(id)!.infected!.state, 'idle');
    assert.equal(world.infected!.nav.movementCost!(p.x, p.z), 1 / .85);
  }
  assert.equal(stings, 4);
  off();
  world.l10Encounters!.state.farmScares = checkpoint;
  const saved = world.l10Encounters!.snapshot(); world.l10Encounters!.restore(saved);
  assert.deepEqual(world.l10Encounters!.state.farmScares, checkpoint);
  assert.equal(stemBank('L10'), null);
  assert.equal(scoreFile('L10', 'combat'), 'combat-L10');
  assert.equal(scoreFile('L10', 'combat', true), 'tension-L7');
  assert.equal(scoreFile('L1', 'combat', true), 'combat');
  assert.equal(Object.values(audioCues).filter(c => /^l10\.scare\./.test(c.id)).length, 5);
  assert.equal(timeOfDay['L10-night'].look!.gradeSaturation, .55);
  const source = JSON.parse(readFileSync('docs/reports/eg-l10-farm/asset-budgets.json', 'utf8'));
  assert(source.every((s: {triangles:number;cap:number}) => s.triangles <= s.cap));
  const result = { status: 'PASS', cropTiles: crops.length, farmPieces: d.layout.placements.filter(p => p.id.startsWith('decor-cure-farm')).length, bareTrees: d.layout.placements.filter(p => p.assetId === 'prop.tree.dead').length,
    checks: ['walkable corn without colliders', '14/16m perception capped at 3m in crop', 'crop crossing breaks sight and tracking; close hearing retained', 'courier and shared NPC/sprinter locomotion 0.85 speed; mown lane 1.0', 'A* terrain cost 1/0.85', 'corgi warns about an on-screen crop-concealed threat', 'four checkpointed fair scare telegraphs', 'five distinct synthesized stingers', 'rock only during finale', 'all source LOD caps'], scares: checkpoint };
  writeFileSync('docs/reports/eg-l10-farm/native-audit.json', JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
} finally { world.dispose(); }
