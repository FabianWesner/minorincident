/** Native L8 authored-route walk and outward-shove proof. No browser or teleport-based correction. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { l8Route, l8YardGates, l8EncounterGates } from '../../src/data/l8Bosses';
import { emptyInput } from '../../src/input/InputFrame';
import { Walker } from '../../src/debug/bot/Walker';
import { loadLevel } from '../sim-runner/levels';

const world = await loadLevel('L8', 1), player = world.entities.get(1)!;
const rows: Record<string, unknown>[] = [];
const out = process.env.L8_CONFINEMENT_OUT ?? 'test-results/l8-route-confinement.json';
const distanceToSegment = (p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) => {
  const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / d2));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
};
const authoredEdges = l8Route.flatMap(stage => stage.nodes.slice(1).map((b, i) => ({ id: stage.id, edge: i, a: stage.nodes[i]!, b })));
const routeDistance = (p: { x: number; z: number }) => Math.min(...authoredEdges.map(e => distanceToSegment(p, e.a, e.b)));
const walker = new Walker();
try {
  const mission = world.missions!, zoo = mission.l8!;
  mission.state.states.breached = true; zoo.state.breachedAt = -1801; zoo.state.nextWave = Number.MAX_SAFE_INTEGER;
  mission.state.steps.sanctuary.status = 'completed'; mission.state.steps.escape.status = 'active';
  zoo.state.sealedAt = 1;
  const setProgress = (id: string) => {
    const stageIndex = l8Route.findIndex(stage => stage.id === id);
    zoo.state.arenas.forEach((arena, index) => { arena.phase = index < stageIndex ? 3 : 0; arena.armed = false; });
    zoo.bosses.updateGates();
  };
  // Keep the walk strictly about the authored route and static level geometry.
  for (const infected of world.infected!.active) infected.health.current = 0;

  for (const e of authoredEdges) {
    setProgress(e.id);
    assert(world.solids.relocate(player, { ...e.a, y: .7 }, `qa.l8-route-start.${e.id}.${e.edge}`, 3, false), `${e.id} edge ${e.edge}: route start setup`);
    const start = { x: player.transform.x, z: player.transform.z }, goal = e.b, samples: { tick: number; x: number; z: number }[] = [];
    const budget = Math.max(900, Math.ceil(Math.hypot(goal.x - start.x, goal.z - start.z) * 240 + 600));
    let reached = false;
    for (let tick = 0; tick < budget; tick++) {
      const frame = emptyInput(); frame.move = walker.step(world, goal, .5, `qa-l8-route-${e.id}-${e.edge}`) ?? frame.move;
      world.applyInput(frame, 'keyboard'); world.update();
      if (tick % 60 === 0) samples.push({ tick: world.tick, x: player.transform.x, z: player.transform.z });
      if (Math.hypot(player.transform.x - goal.x, player.transform.z - goal.z) <= 1.25) { reached = true; break; }
    }
    const maxDeviation = Math.max(0, ...samples.map(p => routeDistance(p) - 8));
    rows.push({ type: 'walk', edge: `${e.id}.${e.edge}`, reached, start, goal, samples, maxDeviation });
    assert(reached, `${e.id} edge ${e.edge}: walker did not reach endpoint (${player.transform.x.toFixed(2)},${player.transform.z.toFixed(2)})`);
    assert(maxDeviation <= 0, `${e.id} edge ${e.edge}: walked more than 8 m off the authored route`);
  }

  let testedShoves = 0;
  for (const stage of l8Route) {
    for (let i = 1; i < stage.nodes.length - 1; i++) {
      setProgress(stage.id);
      const prev = stage.nodes[i - 1]!, corner = stage.nodes[i]!, next = stage.nodes[i + 1]!;
      const inLen = Math.hypot(corner.x - prev.x, corner.z - prev.z) || 1, outLen = Math.hypot(next.x - corner.x, next.z - corner.z) || 1;
      const ux = (corner.x - prev.x) / inLen, uz = (corner.z - prev.z) / inLen;
      const vx = (next.x - corner.x) / outLen, vz = (next.z - corner.z) / outLen;
      const turn = ux * vz - uz * vx, sign = turn >= 0 ? -1 : 1;
      const nx = sign * (-uz - vz), nz = sign * (ux + vx), n = Math.hypot(nx, nz) || 1;
      const origin = { x: corner.x, z: corner.z };
      assert(world.solids.relocate(player, { ...origin, y: .7 }, `qa.l8-route-corner.${stage.id}.${i}`, 3, false), `${stage.id} corner ${i}: shove setup`);
      world.knockback(player, { x: nx / n, z: nz / n }, 6);
      const after = { x: player.transform.x, z: player.transform.z }, deviation = routeDistance(after);
      rows.push({ type: 'corner-shove', corner: `${stage.id}.${i}`, origin, after, deviation, escaped: deviation > 8 });
      assert(deviation <= 8, `${stage.id} corner ${i}: outward shove escaped authored route by ${deviation.toFixed(2)} m`);
      testedShoves++;
    }
  }
  // The final service-yard boundary is represented by the boarding-side gates, not an arena exit node.
  for (const [index, box] of [...l8YardGates, l8EncounterGates.elephantExit].entries()) {
    const horizontal = box.halfX > box.halfZ, axis: 'x' | 'z' = horizontal ? 'z' : 'x', tangent = horizontal ? 'x' : 'z';
    for (const side of [-1, 1]) {
      if (index === 2) {
        zoo.state.arenas.find(a => a.id === 'elephant')!.phase = 1;
      } else {
        zoo.state.arenas.find(a => a.id === 'gorilla')!.phase = 0;
      }
      zoo.bosses.updateGates();
      const at = { x: box.x, z: box.z, y: .7 };
      if (axis === 'x') at.x += side * 1.1; else at.z += side * 1.1;
      assert(world.solids.relocate(player, at, `qa.l8-boarding-boundary.${index}.${side}`, 2, false), `boarding boundary ${index} setup`);
      const before = { x: player.transform.x, z: player.transform.z };
      world.knockback(player, horizontal ? { x: 0, z: -side } : { x: -side, z: 0 }, 6);
      const after = { x: player.transform.x, z: player.transform.z };
      const crossed = (after[axis] - box[axis]) * side < .5;
      rows.push({ type: 'boarding-boundary-shove', index, side, tangent, before, after, escaped: crossed });
      assert(!crossed, `boarding boundary ${index}: outward shove crossed the closed yard gate`);
      testedShoves++;
    }
  }
  mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
  writeFileSync(out, JSON.stringify({ pass: true, escapeCount: rows.filter(r => r.escaped).length, walkedEdges: authoredEdges.length, cornerShoves: rows.filter(r => r.type === 'corner-shove').length, gateBoundaryShoves: testedShoves - rows.filter(r => r.type === 'corner-shove').length, method: 'Native Walker traverses every authored l8Route edge; six-metre outward shove at each polyline corner and both sides of the yard/boarding gates. Each route walk must stay within an 8 m authored-path envelope; no teleport correction or god mode.', rows }, null, 2));
  console.log(JSON.stringify({ pass: true, walkedEdges: authoredEdges.length, cornerShoves: rows.filter(r => r.type === 'corner-shove').length, totalShoves: testedShoves, escapeCount: 0, out }));
} finally { world.dispose(); }
