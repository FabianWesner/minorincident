/* eslint-disable @typescript-eslint/no-explicit-any -- instrumentation for a production simulation */
// Replays high seed 0, samples one arrival at each finale cluster for 120 ticks.
// Run against 3de46811 to inspect the original sleep; run against HEAD for the fix.
// Usage: node --import tsx tools/qa/diag/s249-finale.ts > /private/tmp/s249-finale-trace.jsonl
import { runLevel } from '../../sim-runner/levels';
const clusters = [{ name: 'service', x: 4002, z: -7 }, { name: 'south', x: 4003, z: -48 }, { name: 'west', x: 3977, z: -27 }];
const selected = new Map<string, { id: number; start: number; last?: { x: number; z: number } }>();
const traces = new Map<number, any[]>();
const record = (id: number, value: unknown) => { const rows = traces.get(id) ?? []; rows.push(value); traces.set(id, rows); };
await runLevel('L10', 'complete', 0, 1600, 'auto', undefined, undefined, 0, {
  quality: 'high',
  beforeBegin: world => {
    const ai: any = world.infected!;
    for (const name of ['heldOrDead', 'pursuitOrVault', 'farCrowdSlot', 'followScript', 'perceiveTargets', 'roarOrPinHold', 'updateArchetype', 'chase', 'chaseL1', 'steerL1', 'seek']) {
      const original = ai[name];
      ai[name] = function (...args: any[]) {
        const e = args[0], result = original.apply(this, args);
        if ([...selected.values()].some(s => s.id === e?.id && world.tick < s.start + 120))
          record(e.id, { path: name, consumed: typeof result === 'boolean' ? result : undefined, goal: name === 'steerL1' ? args[2] : name === 'seek' ? args[1] : undefined });
        return result;
      };
    }
  },
  onTick: world => {
    const nav: any = world.infected!.infectedNav;
    // The streamed grid can be replaced as the courier travels; wrap each new grid.
    if (!nav.s249Wrapped) {
      const move = nav.move.bind(nav); nav.s249Wrapped = true;
      nav.move = (p: any, dx: number, dz: number, radius: number, capsule?: boolean) => {
        const e = world.infected!.active.find(a => a.transform === p && [...selected.values()].some(s => s.id === a.id));
        const x = p.x, z = p.z; move(p, dx, dz, radius, capsule);
        if (e) record(e.id, { desired: [dx * 60, dz * 60], resolved: [(p.x - x) * 60, (p.z - z) * 60] });
      };
    }
    if (!world.missions!.state.states['cure-installed']) return;
    for (const cluster of clusters) if (!selected.has(cluster.name)) {
      const e = world.infected!.active.find(a => a.health.current > 0 && Math.hypot(a.transform.x - cluster.x, a.transform.z - cluster.z) < 3 && ![...selected.values()].some(s => s.id === a.id));
      if (e) selected.set(cluster.name, { id: e.id, start: world.tick });
    }
    const district = world.districts!.districts.find(d => d.id === 'D-CURE')!;
    for (const [cluster, s] of selected) {
      if (world.tick >= s.start + 120) continue;
      const e = world.entities.get(s.id);
      if (!e?.infected) { console.log(JSON.stringify({ tick: world.tick, cluster, id: s.id, absent: true, trace: traces.get(s.id) ?? [] })); traces.delete(s.id); continue; }
      const r = e.combat!.radius, p = e.transform;
      const colliders = district.layout.colliders.filter(c => p.x + r >= c.aabb.min[0] + district.origin[0] && p.x - r <= c.aabb.max[0] + district.origin[0] && p.z + r >= c.aabb.min[2] + district.origin[1] && p.z - r <= c.aabb.max[2] + district.origin[1]).map(c => c.id);
      console.log(JSON.stringify({ tick: world.tick, cluster, id: s.id, position: [p.x, p.z], displacement: s.last && [p.x - s.last.x, p.z - s.last.z], state: e.infected.state, l1: e.infected.l1?.mode, motion: e.motion?.speed, locomotion: e.locomotion, pending: !!e.pendingAdmission, hidden: e.hidden, held: world.npcs?.civilians.holds(e.id), cell: nav.cell(p.x, p.z), colliders, trace: traces.get(s.id) ?? [] }));
      s.last = { x: p.x, z: p.z }; traces.delete(s.id);
    }
  },
});
for (const cluster of clusters) if (!selected.has(cluster.name)) console.error(`No arrival sampled for ${cluster.name}`);
