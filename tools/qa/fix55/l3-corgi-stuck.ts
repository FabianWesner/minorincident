// fix55-l3 diagnostic: why the L3 corgi stops at x 143 in the high newbie fixture.
// Usage: node --import tsx/esm tools/qa/fix55/l3-corgi-stuck.ts [high|low] [seconds]
import { loadL3, runL3 } from '../../sim-runner/l3Bots';
const tier = (process.argv[2] ?? 'high') as 'low' | 'high', at = Number(process.argv[3] ?? 156);
const { world, mission } = await loadL3(1, tier);
runL3(world, mission, 'newbie', { maxSeconds: at, god: false });
const corgi = [...world.entities.iterate()].find(e => e.companion)!;
const nav = world.infected!.nav, t = corgi.transform;
console.log('corgi', corgi.id, t.x.toFixed(3), t.z.toFixed(3), 'y', t.y.toFixed(2), 'cell', nav.nearestCell(t.x, t.z, .3), 'clear.3', nav.clear(t.x, t.z, .3), 'loco', JSON.stringify(corgi.locomotion));
const n = nav as unknown as Record<string, unknown>;
console.log('nav keys', Object.keys(n).join(','));
for (let i = 0; i < 8; i++) {
  const a = i * Math.PI / 4, probe = { x: t.x, z: t.z, y: t.y, yaw: 0 };
  nav.move(probe as typeof t, Math.cos(a) * .1, Math.sin(a) * .1, .3);
  console.log(`dir ${i * 45}: moved ${(Math.hypot(probe.x - t.x, probe.z - t.z)).toFixed(3)} clearAt ${nav.clear(t.x + Math.cos(a) * .5, t.z + Math.sin(a) * .5, .3)}`);
}
const near = [...world.entities.iterate()].filter(o => o.id !== corgi.id && Math.hypot(o.transform.x - t.x, o.transform.z - t.z) < 3).map(o => `${o.id}:${o.archetype}${o.corpse ? '(corpse)' : ''} hp${o.health.current}@${o.transform.x.toFixed(2)},${o.transform.z.toFixed(2)}`);
console.log('near', near.join(' '));
type W = { x: number; z: number; halfX: number; halfZ: number };
const hit = (w: W) => Math.abs(w.x - t.x) < w.halfX + 1.5 && Math.abs(w.z - t.z) < w.halfZ + 1.5;
const blockers = (n.blockers as Map<number, W>);
for (const [id, w] of blockers) if (hit(w)) console.log('blocker', id, JSON.stringify(w));
const walls = n.walls as W[] | undefined;
if (Array.isArray(walls)) walls.forEach((w, i) => { if (hit(w)) console.log('wall', i, JSON.stringify(w), (n.wallIds as unknown[] | undefined)?.[i]); });
{
  const npcs = world.npcs! as unknown as { waypoint: { x: number; z: number } }, c = corgi.companion!;
  const p = world.entities.get(1)!.transform, x0 = t.x, z0 = t.z;
  const ok = world.npcs!.move(corgi, { x: p.x, z: p.z }, 6, c, 2);
  console.log('move ok', ok, 'waypoint', npcs.waypoint.x.toFixed(2), npcs.waypoint.z.toFixed(2), 'player', p.x.toFixed(1), p.z.toFixed(1), 'dist', Math.hypot(p.x - x0, p.z - z0).toFixed(1), 'cell', nav.nearestCell(x0, z0, .3), 'flowNext', nav.flowNext(nav.nearestCell(x0, z0, .3)), 'pi', c.pathIndex, c.path.slice(c.pathIndex, c.pathIndex + 4).map(k => `${nav.x(k).toFixed(2)},${nav.z(k).toFixed(2)}`).join(' '), 'radius', (corgi.combat?.radius));
}
{
  const npcs = world.npcs!, ms = npcs.moveStep.bind(npcs);
  npcs.moveStep = (e, dx, dz, nv) => { const x = e.transform.x, z = e.transform.z; ms(e, dx, dz, nv); if (e.id === corgi.id) console.log(`  moveStep cmd ${(dx * 60).toFixed(3)},${(dz * 60).toFixed(3)} moved ${((e.transform.x - x) * 60).toFixed(3)},${((e.transform.z - z) * 60).toFixed(3)} loco ${e.locomotion?.vx.toFixed(3)},${e.locomotion?.vz.toFixed(3)}`); };
  const sol = world.solids as unknown as { rejected?: unknown; offenders?: unknown };
  for (let i = 0; i < 6; i++) { world.update(); console.log(`  end tick ${world.tick} corgi ${t.x.toFixed(4)},${t.z.toFixed(4)} rejected=${JSON.stringify(sol.rejected)?.slice(0, 200)}`); }
}
// Compare with a fresh world: is the obstacle static (layout) or dynamic?
const fresh = await loadL3(1, tier);
const fn = fresh.world.infected!.nav;
console.log('fresh clear east', fn.clear(t.x + .5, t.z, .3), 'fresh blockers near', [...((fn as unknown as Record<string, unknown>).blockers as Map<number, W>)].filter(([, w]) => hit(w)).map(([id]) => id).join(','));
