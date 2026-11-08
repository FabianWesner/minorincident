/** L8 story probe: where are the zoo animals relative to the walked route, and when/where do they turn? Passive player at the arrival. */
import { loadLevel } from '../../../tests/qa/invariants/world';
const tier = (process.argv[2] ?? 'high') as 'high' | 'low';
const w = await loadLevel('L8', 1, tier);
w.combat!.damage.god = true;
const l8 = w.missions!.l8!;
const ids = [...l8.state.animals];
const route = [{ x: 0, z: 70 }, { x: 0, z: 64 }, { x: 96, z: 64 }, { x: 96, z: 74 }];
const segDist = (p: { x: number; z: number }) => Math.min(...route.slice(1).map((b, i) => { const a = route[i], dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz); }));
for (const id of ids) { const e = w.entities.get(id)!; console.log(`animal ${id} ${e.civilian?.zooAnimal} at (${e.transform.x.toFixed(1)},${e.transform.z.toFixed(1)}) route-dist ${segDist(e.transform).toFixed(1)} m, start-dist ${Math.hypot(e.transform.x, e.transform.z - 70).toFixed(1)} m`); }
const seen = new Map<number, string>();
for (let t = 0; t < 60 * 240; t++) {
  w.update();
  for (const id of ids) {
    const e = w.entities.get(id);
    const st = !e ? 'gone' : e.infected ? `infected(${e.archetype})` : e.infection ? 'bitten' : e.health.current <= 0 ? 'dead' : 'healthy';
    if (seen.get(id) !== st) { seen.set(id, st); console.log(`t=${(w.tick / 60).toFixed(1)}s animal ${id} ${st}${e ? ` at (${e.transform.x.toFixed(1)},${e.transform.z.toFixed(1)}) route-dist ${segDist(e.transform).toFixed(1)}` : ''}`); }
  }
  if (t % 1800 === 0) { let inf = 0, an = 0; for (const e of w.entities.iterate()) { if (e.infected && e.health.current > 0) { inf++; if (/lion|gorilla|elephant|zebra|flamingo/.test(e.archetype)) an++; } } console.log(`t=${(t / 60).toFixed(0)}s infected ${inf}, animal-infected ${an}`); }
}
w.dispose();
