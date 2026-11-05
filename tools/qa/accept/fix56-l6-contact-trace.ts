/** Read-only maintenance-cohort trace using the canonical complete policy. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stateHash } from '../../../src/sim/world/stateHash';
import { gzipSync } from 'node:zlib';
import { damageAmount } from '../../../src/sim/combat/Damage';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { observeAttackStarts } from '../threat/attackStarts';
import { provenance } from './probe';

const tier = process.argv[2] === 'high' ? 'high' : 'low';
const campaign = preset('L6-default'); campaign.settings.quality = tier;
const hits: unknown[] = [], hatchKills: unknown[] = [];
const weaponEvents: Record<string, number> = {};
let finalHash = "", shelterEnd: unknown[] = [], startingWeapons: unknown = null;
const realDowns = new Map<number, number>(), shelterFinishes = new Map<number, { tick: number; phase: string; downs: number; realDowns: number; corpseAt?: number }>();
const samples: unknown[] = [], attacks: unknown[] = [], announcements: unknown[] = [], events: unknown[] = [];
const warned = new Set<number>();
const identity = provenance();
const run = await runLevel('L6', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
  quality: tier,
  beforeBegin: world => {
    startingWeapons = structuredClone(world.entities.get(1)!.weapons);
    world.events.on('combat.attack', event => { if (event.type === 'combat.attack' && event.sourceId === 1) weaponEvents[event.actionId] = (weaponEvents[event.actionId] ?? 0) + 1; });
    world.events.on('combat.kill', event => {
      if (event.type === 'combat.kill' && world.missions!.state.l6?.spawnLog.some(q => q.wave === 4 && q.id === event.targetId)) hatchKills.push(structuredClone(event));
      if (event.type === 'combat.kill' && event.downed !== undefined && event.amount > 0) realDowns.set(event.targetId, (realDowns.get(event.targetId) ?? 0) + 1);
    });
    const damage = world.combat!.damage, apply = damage.apply.bind(damage);
    damage.apply = hit => {
      const target = world.entities.get(hit.targetId);
      if (target?.combat?.shield && world.missions!.state.l6?.spawnLog.some(q => q.wave === 4 && q.id === target.id)) {
        hits.push({ tick: world.tick, hit: structuredClone(hit), target: { ...target.transform },
          segmentAmount: damageAmount(hit, target), launchAmount: damageAmount(hit.shotOrigin ? { ...hit, origin: hit.shotOrigin } : hit, target) });
      }
      return apply(hit);
    };
    for (const type of ['player.damaged', 'player.died', 'checkpoint.restored'] as const) world.events.on(type, event => {
      events.push({ ...event, player: { ...world.entities.get(1)!.transform }, phase: world.missions!.state.l6?.phase });
    });
    observeAttackStarts(world, (id, target, tick) => {
      const entry = world.missions!.state.l6?.spawnLog.find(q => q.wave === 4 && q.id === id);
      if (entry) attacks.push({ tick, id, target, door: entry.door });
    });
    world.events.on('sim.tick', () => {
      const state = world.missions!.state.l6!, player = world.entities.get(1)!;
      if (world.tick % 3600 === 0) console.log('L6 trace', world.tick / 60, state.phase, player.health.current, player.transform.x);
      for (const q of state.spawnLog) if (q.wave <= 2) {
        const e = world.entities.get(q.id), b = e?.infected;
        if (!e || !b || e.health.current > 0 || b.recoverAt >= 0) continue;
        const row = shelterFinishes.get(q.id) ?? { tick: world.tick, phase: state.phase, downs: b.downs, realDowns: realDowns.get(q.id) ?? 0 };
        if (e.corpse) row.corpseAt ??= world.tick;
        shelterFinishes.set(q.id, row);
      }
      for (const entry of state.entries ?? []) if (entry.warnedAt && !warned.has(entry.door)) {
        warned.add(entry.door);
        const ai = world.infected!;
        announcements.push({ ...entry, player: { ...player.transform }, cap: ai.director.cap,
          occupied: ai.director.count, reserved: ai.director.reserved, pendingTurns: ai.director.pendingTurns,
          actors: ai.active.map(e => ({ id: e.id, hp: e.health.current, state: e.infected!.state,
            mode: e.infected!.l1?.mode, wave: state.spawnLog.find(q => q.id === e.id)?.wave,
            survivor: state.survivors.some(r => r.id === e.id),
            distance: Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z),
            offscreen: ai.director.offscreen(e.transform, e.transform.y - .7) })) });
      }
      if (world.tick % 60) return;
      for (const q of state.spawnLog) if (q.wave === 4 && world.tick - q.tick <= 30 * 60) {
        const e = world.entities.get(q.id), b = e?.infected, brain = b?.l1;
        samples.push({ tick: world.tick, born: q.tick, door: q.door, id: q.id,
          player: { ...player.transform }, position: e ? { ...e.transform } : null, hp: e?.health.current,
          archetype: e?.archetype, mode: brain?.mode, state: b?.state, scripted: b?.scripted,
          nativeTarget: b?.heardTargetId, pressure: b?.pressureTarget, focus: brain?.focusId, focusUntil: brain?.focusUntil, target: brain?.targetId,
          goal: brain ? { x: brain.goalX, z: brain.goalZ } : null, completeApproach: brain?.search.completeApproach,
          pending: !!e?.pendingAdmission, rising: !!e?.infectionRise });
      }
    }, 8);
  },
  beforeDispose: world => {
    finalHash = stateHash(world.getState());
    shelterEnd = [...shelterFinishes.keys()].map(id => { const e = world.entities.get(id); return { id, present: !!e, corpse: e?.corpse ?? false, hp: e?.health.current, knockdowns: e?.infected?.knockdowns }; });
  },
});
const output = process.argv[3] ?? `docs/reports/fix56-b/L6-${tier}-contact-trace.json.gz`;
writeFileSync(output, gzipSync(JSON.stringify({ ...identity, tier, producerSha256: createHash('sha256').update(readFileSync(new URL('./fix56-l6-contact-trace.ts', import.meta.url))).digest('hex'), method: 'Read-only 1Hz actor/AI trace for 30s after each maintenance birth, running the current canonical complete input policy. Damage wrappers preserve original arguments and results.', run, finalHash, startingWeapons, weaponEvents, hatchKills, shelterEnd, announcements, attacks, samples, events, hits, shelterFinishes: [...shelterFinishes].map(([id, row]) => ({ id, ...row })) })));
console.log(output, run.outcome);
