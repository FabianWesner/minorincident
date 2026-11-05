/** Actual snapped L5 placement and reachability receipt, without a browser or another registered test case. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { loadLevel } from '../../tests/qa/invariants/world';
import { l5, l5Wanderers } from '../../src/data/l5';

const receipt = [];
for (const tier of ['high', 'low'] as const) {
  const world = await loadLevel('L5', 1, tier);
  try {
    const mission = world.missions!, ids = mission.state.l5!.infectedIds, nav = world.infected!.nav;
    const reach = nav.reachableFrom(nav.startCell(mission.def.anchors['l5-out'], .45));
    const spreadStart = l5Wanderers.filter(g => !g.spread).reduce((n, g) => n + g.n, 0);
    const positions = ids.map((id, i) => { const e = world.entities.get(id)!; return { id, x: e.transform.x, z: e.transform.z, spread: i >= spreadStart, alpha: e.archetype === 'infected.alpha', reachable: !!reach[nav.startCell(e.transform, .45)] }; });
    receipt.push({ tier, cap: world.infected!.director.cap, positions });
    console.log(JSON.stringify({ tier, count: ids.length, unreachable: positions.filter(p => !p.reachable) }));
    assert.equal(ids.length, l5.infected.start[tier]); assert.equal(world.infected!.director.cap, 150);
    assert.deepEqual(positions.filter(p => !p.reachable), []);
    for (const p of positions.filter(p => p.spread)) for (const other of positions) if (p.id !== other.id) assert(Math.hypot(p.x - other.x, p.z - other.z) >= 4);
    for (const p of positions.filter(p => p.spread)) for (const survivor of mission.state.l5!.survivors) {
      const ring = mission.def.anchors[`l5-ring-${survivor.key}`]; assert(Math.hypot(p.x - ring.x, p.z - ring.z) >= 8);
    }
  } finally { world.dispose(); }
}
writeFileSync('test-results/l5-density/placement.json', JSON.stringify(receipt));
