/** Static crowd-grid pockets versus courier capsule clearance, over each complete campaign level.
 * node --expose-gc --import tsx/esm tools/qa/nav-pocket-audit.ts [output.json]
 */
import { writeFileSync } from 'node:fs';
import { loadLevel, runnerLevels } from '../sim-runner/levels';
import { NavGrid, type Wall } from '../../src/sim/ai/NavGrid';
import { survivor } from '../../src/data/survivor';
import type { SimWorld } from '../../src/sim/world/SimWorld';

interface Component { seed: number; cells: number }
function components(nav: NavGrid): Component[] {
  const seen = new Uint8Array(nav.blocked.length), queue = new Int32Array(nav.blocked.length), result: Component[] = [];
  for (let seed = 0; seed < seen.length; seed++) {
    if (nav.blocked[seed] || seen[seed]) continue;
    let read = 0, write = 1; queue[0] = seed; seen[seed] = 1;
    while (read < write) {
      const cell = queue[read++], x = cell % nav.width;
      for (let direction = 0; direction < 4; direction++) {
        const next = direction === 0 ? x ? cell - 1 : -1 : direction === 1 ? x + 1 < nav.width ? cell + 1 : -1 : direction === 2 ? cell - nav.width : cell + nav.width;
        if (next < 0 || next >= seen.length || seen[next] || nav.blocked[next]) continue;
        seen[next] = 1; queue[write++] = next;
      }
    }
    result.push({ seed, cells: write });
  }
  return result.sort((a, b) => b.cells - a.cells);
}
/** Streamed levels must include colliders beyond the initially resident window. */
function fullWalls(world: SimWorld): readonly Wall[] {
  if (!world.chunks) return world.infected!.nav.walls;
  return world.districts!.districts.flatMap(d => d.decay.colliders.filter(c => !c.walkable).map(c => c.aabb).concat(d.blockers)
    .filter(a => !a.physicsOnly).map(a => ({
      x: (a.min[0] + a.max[0]) / 2 + d.origin[0], z: (a.min[2] + a.max[2]) / 2 + d.origin[1],
      y: (a.min[1] + a.max[1]) / 2, halfY: (a.max[1] - a.min[1]) / 2,
      halfX: (a.max[0] - a.min[0]) / 2, halfZ: (a.max[2] - a.min[2]) / 2, navBlocker: a.navBlocker,
      ...(a.navFootprint ? { navFootprint: { ...a.navFootprint, x: a.navFootprint.x + d.origin[0], z: a.navFootprint.z + d.origin[1] } } : {}),
    })));
}
function audit(world: SimWorld, oriented: boolean) {
  const source = world.infected!.nav, bounds = world.districts!.nav;
  const ground = world.chunks ? { width: bounds.max[0] - bounds.min[0], depth: bounds.max[1] - bounds.min[1] } : source.ground;
  const center = world.chunks ? { x: (bounds.max[0] + bounds.min[0]) / 2, z: (bounds.max[1] + bounds.min[1]) / 2 } : source.center;
  const walls = fullWalls(world).map(w => { const copy = { ...w }; if (!oriented) delete copy.navFootprint; return copy; });
  const mask = world.chunks ? null : source.mask;
  const crowd = new NavGrid(ground, walls, .5, center, mask), groups = components(crowd);
  const capsule = new NavGrid(ground, walls, survivor.radius, center, mask), reachable = capsule.reachableFrom(groups[0].seed);
  const pockets = groups.slice(1).filter(group => reachable[group.seed]).map(group => ({
    cells: group.cells, x: crowd.x(group.seed), z: crowd.z(group.seed),
  }));
  return { width: crowd.width, depth: crowd.depth, mainCells: groups[0].cells,
    components: groups.length, pockets: pockets.length, pocketCells: pockets.reduce((sum, group) => sum + group.cells, 0), locations: pockets };
}
const results = [];
for (const level of runnerLevels) {
  const world = await loadLevel(level, 1, undefined, 0, { quality: 'low' });
  try {
    const before = audit(world, false); global.gc?.();
    const after = audit(world, true); global.gc?.();
    results.push({ level, before, after });
    console.log(JSON.stringify({ level, before: { pockets: before.pockets, cells: before.pocketCells }, after: { pockets: after.pockets, cells: after.pocketCells } }));
  } finally { world.dispose(); }
  global.gc?.();
}
writeFileSync(process.argv[2] ?? 'test-results/nav-pockets.json', JSON.stringify({ seed: 1, gridStep: .5, crowdRadius: .5, capsuleRadius: survivor.radius, scope: 'complete static level, including nonresident streamed terrain; excludes the largest component', results }, null, 2) + '\n');
