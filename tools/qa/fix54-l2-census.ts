/** Focused native diagnostics for L2-09/L2-11; leaves all inputs to the production bots. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL2, runL2 } from '../sim-runner/l2Bots';
import { provenance } from './accept/probe';
const out = process.env.FIX54_OUT ?? 'test-results/fix54-a/census-before';
mkdirSync(out, { recursive: true });
const rows = [];
for (const tier of ['low', 'high'] as const) for (const profile of ['aggressive', 'no-axe'] as const) {
  const { world, mission } = await loadL2(1, tier);
  try {
    const samples: unknown[] = [], events: unknown[] = [];
    let peak = 0, peakSlots = 0, peakRecovering = 0, standingCapOverflowTicks = 0, recoveringPoolOverflowTicks = 0;
    let entry: unknown = null;
    for (const type of ['combat.kill', 'outbreak.bite', 'civilian.turned', 'outbreak.infection'] as const)
      world.events.on(type, event => { events.push(event); });
    world.events.on('sim.tick', () => {
      const s = mission.state.l2!;
      peak = Math.max(peak, world.infected!.active.filter(e => e.health.current > 0).length);
      peakSlots = Math.max(peakSlots, world.infected!.director.count);
      const recovering = world.infected!.active.filter(e => e.infected!.recoverAt >= 0).length;
      peakRecovering = Math.max(peakRecovering, recovering);
      if (world.infected!.director.count > world.infected!.director.cap) standingCapOverflowTicks++;
      if (recovering > world.infected!.director.cap) recoveringPoolOverflowTicks++;
      if (s.radioAt && !entry) entry = { tick: world.tick, player: { ...world.entities.get(1)!.transform }, pending: structuredClone(s.pending), actors: world.infected!.active.map(e => ({ id: e.id, hp: e.health.current, x: e.transform.x, z: e.transform.z, recoverAt: e.infected!.recoverAt })) };
      if (!s.doorsOpenAt || (world.tick - s.doorsOpenAt) % 60) return;
      samples.push({ seconds: (world.tick - s.doorsOpenAt) / 60, tick: world.tick, cap: world.infected!.director.cap, count: world.infected!.director.count, recovering, persistentCorpses: [...world.entities.iterate()].filter(e => e.corpse && e.infected).length, reserved: world.infected!.director.reserved,
        actors: world.infected!.active.map(e => ({ id: e.id, hp: e.health.current, recoverAt: e.infected!.recoverAt, x: e.transform.x, z: e.transform.z, home: [e.infected!.l1?.homeX, e.infected!.l1?.homeZ], mode: e.infected!.l1?.mode, target: e.infected!.l1?.targetId })),
        pending: structuredClone(s.pending) });
    });
    const report = runL2(world, mission, profile, { god: true, maxSeconds: 180,
      stopWhen: m => profile === 'aggressive' ? !!m.state.l2!.doorsOpenAt && world.tick - m.state.l2!.doorsOpenAt > 90 * 60 : !!m.state.l2!.radioAt && world.tick - m.state.l2!.radioAt > 1 });
    rows.push({ tier, profile, report, peak, peakSlots, peakRecovering, standingCapOverflowTicks, recoveringPoolOverflowTicks, entry, samples, events });
    console.log(JSON.stringify({ tier, profile, peak, infectedAt: report.infectedAt, radio: report.radio }));
  } finally { world.dispose(); }
}
writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), rows }, null, 2));
