/** Independent counterexamples for L4's read-only attack-through-rail query. */
import assert from 'node:assert/strict';
import { NavGrid, type Wall } from '../../../src/sim/ai/NavGrid';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { PathProbe, ThreatObserver } from '../threat/observer';
import { provenance } from './probe';
import { atomicJson } from './report';

const entity = { id: 1, archetype: 'infected.runner', transform: { x: -4, z: 0 }, combat: { radius: .35 }, infected: {}, health: { current: 100 } } as EntitySnapshot;
const barrier = { id: 2, transform: { x: 0, z: 0 }, health: { current: 100 }, barricade: { intact: true, slot: { groupId: 'l4-wall', a: { x: 0, z: -9 }, b: { x: 0, z: 9 }, height: 1.12, depth: .7, hordeShare: .1 } } } as EntitySnapshot;
const wall: Wall = { x: 0, z: 0, y: .56, halfY: .56, halfX: .35, halfZ: 9.35 };
const goal = { x: 4, z: 0 }, source = new NavGrid({ width: 20, depth: 20 }, []);
source.setBlocker(2, wall, true);
const paths = new PathProbe();
const observer = Object.assign(Object.create(ThreatObserver.prototype), {
  world: { entities: { iterate: () => [barrier] } }, paths, barrierGrids: new WeakMap(),
}) as { barrierDistance(source: NavGrid, entity: EntitySnapshot, goal: { x: number; z: number }, limit: number): number };
const results: { name: string; accepted: boolean; distance: number | null }[] = [];
function check(name: string, grid: NavGrid, limit: number, expected: boolean) {
  const distance = observer.barrierDistance(grid, entity, goal, limit), accepted = Number.isFinite(distance);
  assert.equal(accepted, expected, name); results.push({ name, accepted, distance: accepted ? distance : null });
}
assert.equal(paths.query(source, entity, goal, 2.5), false);
const revision = source.revision, blocked = [...source.blocked];
check('damageable rail admits an independently clear attack-through path', source, 20, true);
check('unchanged short distance bound rejects the crossing', source, 7.9, false);
barrier.barricade!.slot.hordeShare = 0;
check('zero damage share cannot prove attack-through', source, 20, false);
barrier.barricade!.slot.hordeShare = .1;
const shed = new NavGrid({ width: 20, depth: 20 }, [{ ...wall, x: 2 }]); shed.setBlocker(2, wall, true);
check('an unbreakable shed beyond the rail still blocks the route', shed, 20, false);
assert.equal(source.revision, revision); assert.deepEqual([...source.blocked], blocked);
atomicJson('docs/reports/fix51-r4/l4-barrier-proof.json', { ...provenance(), method: 'Synthetic independent native grids; remove exactly one damageable rail in a clone; preserve every other blocker, clearance and distance bound; original grid unchanged.', results });
console.log('PASS: legal rail path accepted; short bound, zero damage and permanent geometry rejected; native grid unchanged.');
