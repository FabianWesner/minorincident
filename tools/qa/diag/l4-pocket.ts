/** Orchestrator diagnostic (L4-07): ASCII of body-clear nav (.45 m) and solids around the courier's hold spot. */
import { loadL4, runL4 } from '../../sim-runner/l4Bots';
const tier = (process.argv[2] ?? 'high') as 'high' | 'low', stopTick = Number(process.argv[3] ?? 12049);
const { world: w, mission: m } = await loadL4(1, tier);
runL4(w, m, 'complete', { seed: 1, stopWhen: () => w.tick >= stopTick, maxSeconds: stopTick / 60 + 5 });
const p = w.entities.get(1)!.transform, nav = w.infected!.navigation.grid(p).withClearance(.45);
const reach = nav.reachableFrom(nav.nearestCell(-20, -6, .45));
let out = '';
for (let z = p.z - 10; z <= p.z + 10; z += .5) {
  let row = '';
  for (let x = p.x - 14; x <= p.x + 10; x += .5) {
    const c = nav.nearestCell(x, z, 0), here = Math.abs(x - p.x) < .26 && Math.abs(z - p.z) < .26;
    row += here ? '@' : !w.solids.clear({ x, y: .7, z, yaw: 0 }, .2, 0, false, .02) ? '#' : !nav.clear(x, z, .45) ? '+' : c >= 0 && reach[c] ? '.' : 'o';
  }
  out += `${z.toFixed(1).padStart(6)} ${row}\n`;
}
console.log(`x from ${(p.x - 14).toFixed(1)} to ${(p.x + 10).toFixed(1)}; @ courier; # solid; + not body-clear; . reachable from (-20,-6); o clear but unreachable`);
console.log(out);
for (const z of [-20, -16, -12.6, -9, -5]) console.log('solids at x=-11 z', z, JSON.stringify(w.solids.staticContacts({ x: -11, y: .7, z, yaw: 0 }, 1.5)));
for (const id of [30, 31, 32]) { const e = w.entities.get(id); console.log('entity', id, e?.archetype, e?.transform.x.toFixed(1), e?.transform.z.toFixed(1), e?.transform.yaw?.toFixed(2)); }
for (const e of w.entities.iterate()) if (e.vehicle && Math.abs(e.transform.x + 11) < 6 && Math.abs(e.transform.z + 12) < 14) console.log('vehicle', e.id, e.archetype, e.transform.x.toFixed(1), e.transform.z.toFixed(1), (e.transform.yaw ?? 0).toFixed(2));
process.exit(0);
