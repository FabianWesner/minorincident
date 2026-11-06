import { actorRadius, solidLargeCorpse } from '../../../src/sim/world/SolidRegistry';
import { formationSlot, leaderHeading } from '../../../src/sim/missions/missionHelpers';
import { probeLevel, provenance } from './probe';
import { atomicJson } from './report';
import { ThreatObserver, isWalkingSample } from '../threat/observer';
const identity = provenance(), samples: unknown[] = [];
const prototype = ThreatObserver.prototype as unknown as { observe: (speed: number) => void };
const original = prototype.observe;
prototype.observe = function (this: unknown, leaderSpeed: number) {
  const w = (this as { world: import('../../../src/sim/world/SimWorld').SimWorld }).world;
  const e = w.entities.get(51), p = w.entities.get(1)!;
  if (w.tick % 30 === 0 && w.missions!.state.steps.departure?.status === 'active' && e && !e.hidden && e.passengerOf === undefined) {
    const queue = (w.l7Departure as unknown as { queue: (slot: number) => { x: number; z: number } }).queue(e.civilian!.survivor!.slot);
    const goal = formationSlot(p.transform, leaderHeading(p.transform.yaw, p.survivor!.velocity), e.civilian!.survivor!.slot);
    const bodies = [...w.entities.iterate()].filter(solidLargeCorpse).map(b => ({ id: b.id, x: b.transform.x, z: b.transform.z, radius: actorRadius(b), distance: Math.hypot(e.transform.x - b.transform.x, e.transform.z - b.transform.z) })).sort((a,b) => a.distance - b.distance).slice(0, 3);
    const lagging = Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) > 6;
    samples.push({ tick: w.tick, leaderSpeed, speed: e.motion?.speed, phase: w.l7Departure!.state.phase,
      eligible: isWalkingSample(e.motion?.speed ?? 0, leaderSpeed, lagging, false),
      distanceQueue: Math.hypot(e.transform.x - queue.x, e.transform.z - queue.z),
      distanceLeader: Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z),
      position: { x: e.transform.x, z: e.transform.z }, queue, goal, bodies,
      clearStatic: w.solids.clear({ ...goal, y: e.transform.y }, actorRadius(e), e.id, false), clearAll: w.solids.clear({ ...goal, y: e.transform.y }, actorRadius(e), e.id),
      around: (w.l7Encounters as unknown as { approaches: Map<number, { around?: unknown }> }).approaches.get(51)?.around,
      navTarget: e.civilian?.l1?.target, pathIndex: e.civilian?.pathIndex, path: [...(e.civilian?.path ?? [])],
      state: e.civilian?.state, assisting: w.l7Departure!.state.assisting?.includes(e.id) ?? false });
  }
  original.call(this, leaderSpeed);
};
const receipt = await probeLevel('L7', 'high', 'complete', identity);
prototype.observe = original;
atomicJson('docs/reports/fix65-c/L7-09-pace-trace.json', { ...identity, samples, nativeStateHash: receipt.nativeStateHash,
  phases: receipt.threat?.phases.map(p => ({ phase: p.key, followers: p.followerSpeeds })) });
console.log(samples);
