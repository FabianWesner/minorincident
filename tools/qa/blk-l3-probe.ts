/* eslint-disable @typescript-eslint/no-explicit-any -- debug probe reads private nav/npcs state */
/** blk-l3: put the corgi at the recorded G-27 stall pose and walk the courier past it. */
import { emptyInput } from '../../src/input/InputFrame';
import { preset } from '../../src/sim/progression/Campaign';
import { LevelThreeBot } from '../../src/debug/bot/LevelThreeBot';
import { missionControls } from '../../src/sim/missions/controls';
import { loadLevel } from '../sim-runner/levels';
import { followFrustum } from '../sim-runner/l3Bots';
const tier = (process.argv[2] ?? 'low') as 'low' | 'high';
const dogAt = (process.argv[3] ?? '-72.5633,23.4243').split(',').map(Number);
const world = await loadLevel('L3', 1, preset('L3-default'), 0, { quality: tier });
world.player!.damage = () => 0;
const grid = (label: string, d: { x: number; z: number }) => { const nav = world.infected!.nav as any; console.log(label, 'clearance', nav.clearance, 'rev', nav.revision); for (let dz = 6; dz >= -4; dz--) { let row = ''; for (let dx = -10; dx <= 10; dx++) { const c = nav.cell(d.x + dx * .5, d.z + dz * .5); row += nav.blocked[c] ? '#' : '.'; } console.log(row); } };
for (const w of (world.infected!.nav as any).walls) if (Math.abs(w.x + 72) < 8 + w.halfX && Math.abs(w.z - 25) < 4 + w.halfZ) console.log('wall', JSON.stringify(w));
for (const d of world.districts!.districts) for (const pl of d.layout.placements) { const x = pl.position[0] + d.origin[0], z = pl.position[2] + d.origin[1]; if (Math.abs(x + 72) < 4 && Math.abs(z - 26.8) < 3) console.log('placement', d.id, pl.assetId, pl.id, x, z, pl.yaw); }
for (const e of world.entities.iterate()) if (Math.abs(e.transform.x + 72) < 4 && Math.abs(e.transform.z - 26.8) < 3) console.log('entity', e.id, e.kind, e.archetype);
grid('load', { x: -72.56, z: 23.42 });
const mission = world.missions!, bot = new LevelThreeBot(world, 'complete', 'auto');
for (let t = 0; t < 6000 && !mission.state.l3!.fallbackAt; t++) { followFrustum(world); world.applyInput(bot.sample(), 'keyboard'); world.update(); }
grid('fallback', { x: -72.56, z: 23.42 });
const dog = [...world.entities.iterate()].find(e => e.companion)!;
const c = missionControls(world);
c.teleport('player', { x: -82, z: 23.7 }); for (let k = 0; k < 160; k++) { const f = emptyInput(); f.move = { x: 1, z: 0 }; world.applyInput(f, 'keyboard'); world.update(); }
c.teleport(dog.id, { x: dogAt[0], z: dogAt[1] });
console.log('placed', dog.transform, world.entities.get(1)!.transform);
const route = [[-60, 23.7], [-55, 21], [-51, 9], [-46, 1.7], [-30, -2]];
let i = 0;
for (let t = 0; t < 1800; t++) {
  const p = world.entities.get(1)!.transform; const f = emptyInput();
  if (i < route.length) { const [x, z] = route[i], dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < 1) i++; else f.move = { x: dx / d, z: dz / d }; }
  followFrustum(world); world.applyInput(f, 'keyboard'); world.update();
  if (t % 60 === 0) console.log(world.tick, 'p', p.x.toFixed(1), p.z.toFixed(1), 'dog', dog.transform.x.toFixed(2), dog.transform.z.toFixed(2), dog.transform.y.toFixed(2), dog.companion!.state, dog.companion!.following, !!dog.hidden, !!dog.pendingAdmission);
}
{ const nav = world.infected!.nav, { actorRadius } = await import('../../src/sim/world/SolidRegistry'); const r = actorRadius(dog);
  console.log('cell', nav.nearestCell(dog.transform.x, dog.transform.z, r), 'clear', nav.clear(dog.transform.x, dog.transform.z, r), 'ground', world.districts?.groundHeight(dog.transform.x, dog.transform.z), 'loco', JSON.stringify(dog.locomotion), 'vel', JSON.stringify(dog.companion!.velocity), 'path', dog.companion!.path.length, dog.companion!.goal);
  const npcs = world.npcs! as any; console.log('unreach', npcs.unreachable.get(dog.id), 'escape', npcs.escapes.get(dog.id));
  const before = { ...dog.transform }; const ok = npcs.move(dog, world.entities.get(1)!.transform, 4.5, dog.companion, 2); console.log('move ->', ok, 'wp', npcs.waypoint, before.x - dog.transform.x, before.z - dog.transform.z);
}
{ const nav = world.infected!.nav as any, d = dog.transform, P = world.entities.get(1)!.transform, r = .44;
  const from = nav.nearestCell(d.x, d.z, r), to = nav.nearestCell(P.x, P.z, r);
  console.log('from', from, nav.x(from), nav.z(from), 'to', to, nav.x(to), nav.z(to), 'visDogPlayer', nav.visible(d, P, r), 'visFrom', nav.visible(d, { x: nav.x(from), z: nav.z(from) }, r));
  const path: number[] = []; console.log('path', nav.path(from, to, path, 1600), path.length);
  for (let dz = 4; dz >= -4; dz--) { let row = ''; for (let dx = -6; dx <= 6; dx++) { const c = nav.cell(d.x + dx * .5, d.z + dz * .5); row += c === from ? 'F' : c === to ? 'T' : nav.blocked[c] ? '#' : '.'; } console.log(row); }
}
world.dispose();
