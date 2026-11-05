import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { emptyInput } from '../../../src/input/InputFrame';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { runLevel } from '../../sim-runner/levels';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson } from './report';

// Additional observations, without changing the canonical policies or evaluator.
const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) for (const policy of ['complete', 'stationary'] as const) {
  const campaign = preset('L8-default'); campaign.settings.quality = tier;
  const control = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L8-${tier}-${policy}.json`, 'utf8')) as NativeReceipt;
  assert.equal(control.sourceHash, identity.sourceHash);
  assert.equal(control.observerHash, identity.observerHash);
  const initial = new Map<number, { id: number; archetype: string; species: string | null; victimClass: string; variant: string | null }>();
  const turns = new Map<number, { id: number; startTick: number; endTick: number | null; seconds: number | null; initial: unknown; finalArchetype: string | null; finalVariant: string | null }>();
  const attacks: object[] = [], hits: object[] = [], arrivals: object[] = [], markers: object[] = [];
  const seen = new Set<number>(), stationary = new Map<number, { ticks: number; maximum: number; x: number; z: number; routine: string; state: string }>();
  let markerKey = '', finalHash = '', peak = 0, finalBoarding: object | null = null;
  const classify = (actor: EntitySnapshot) => actor.civilian?.zooAnimal ? 'animal' : actor.civilian?.ally?.role === 'soldier' ? 'soldier' : /^npc\.(zookeeper|vet|groundskeeper)$/.test(actor.archetype) ? 'staff' : 'civilian';
  const run = await runLevel('L8', 'complete', 1, policy === 'stationary' ? 180 : undefined, 'auto', campaign, undefined, 0, {
    quality: tier, passive: policy === 'stationary',
    beforeBegin: world => {
      world.events.on('outbreak.infection', event => {
        if (event.type !== 'outbreak.infection') return;
        if (event.phase === 'stagger') turns.set(event.entityId, { id: event.entityId, startTick: event.tick, endTick: null, seconds: null, initial: initial.get(event.entityId), finalArchetype: null, finalVariant: null });
        if (event.phase === 'infected') {
          const row = turns.get(event.entityId), actor = world.entities.get(event.entityId);
          if (row && actor) Object.assign(row, { endTick: event.tick, seconds: (event.tick - row.startTick) / 60, finalArchetype: actor.archetype, finalVariant: actor.infected?.variant ?? null });
        }
      });
      world.events.on('infected.attack', event => {
        if (event.type === 'infected.attack') attacks.push({ ...event, victimClass: initial.get(event.targetId)?.victimClass ?? (event.targetId === 1 ? 'player' : 'other') });
      });
      world.events.on('outbreak.bite',event=>{
        if(event.type==='outbreak.bite')hits.push({...event,successfulBite:true,victimClass:initial.get(event.targetId)?.victimClass??'other'});
      });
      world.events.on('combat.hit', event => {
        if (event.type === 'combat.hit' && event.amount > 0 && world.entities.get(event.sourceId)?.infected)
          hits.push({ ...event, victimClass: initial.get(event.targetId)?.victimClass ?? (event.targetId === 1 ? 'player' : 'other') });
      });
      if (policy === 'stationary') {
        const apply = world.applyInput.bind(world);
        world.applyInput = (frame, scheme) => apply(world.missions!.l8!.state.breachedAt ? emptyInput() : frame, scheme);
      }
      const update = world.update.bind(world);
      world.update = () => {
        // beforeBegin precedes the mission's population preparation. Capture
        // after begin, immediately before its first ordinary simulation tick.
        if (!initial.size) for (const actor of world.entities.iterate()) if (actor.civilian) initial.set(actor.id, {
          id: actor.id, archetype: actor.archetype, species: actor.civilian.zooAnimal ?? null, victimClass: classify(actor), variant: actor.civilian.variant,
        });
        update();
        const zoo = world.missions!.l8!.state;
        peak = Math.max(peak, world.infected!.active.filter(actor => actor.health.current > 0 && !actor.hidden && !actor.pendingAdmission).length);
        if (!zoo.breachedAt) for (const [id] of initial) {
          const actor = world.entities.get(id);
          if (!actor?.civilian || actor.hidden || actor.health.current <= 0) continue;
          const row = stationary.get(id) ?? { ticks: 0, maximum: 0, x: actor.transform.x, z: actor.transform.z, routine: actor.civilian.routine, state: actor.civilian.state };
          row.ticks = Math.hypot(actor.transform.x - row.x, actor.transform.z - row.z) < .0001 ? row.ticks + 1 : 0;
          row.maximum = Math.max(row.maximum, row.ticks); row.x = actor.transform.x; row.z = actor.transform.z; stationary.set(id, row);
        }
        for (const admission of zoo.arrivals) {
          const actor = world.entities.get(admission.id);
          if (seen.has(admission.id) || !actor || actor.hidden || actor.pendingAdmission) continue;
          seen.add(admission.id);
          arrivals.push({ ...admission, observedTick: world.tick, position: { ...actor.transform }, inNativeCamera: world.infected!.director.inPlayerView(actor.transform), archetype: actor.archetype });
        }
        const marker = world.missions!.state.marker, anchor = marker ? world.missions!.def.anchors[marker] : null;
        const nextKey = JSON.stringify([marker, anchor?.x, anchor?.z]);
        if (nextKey !== markerKey) { markers.push({ tick: world.tick, marker, anchor: anchor ? { ...anchor } : null }); markerKey = nextKey; }
      };
    },
    beforeDispose: world => {
      finalHash = stateHash(world.getState());
      const zoo = world.missions!.l8!.state;
      finalBoarding = { carId: zoo.carId, driver: world.vehicles!.active, roster: zoo.roster.map(id => {
        const actor = world.entities.get(id);
        return { id, hp: actor?.health.current, infected: !!actor?.infected, passengerOf: actor?.passengerOf ?? null, hidden: actor?.hidden };
      }), transfer: world.missions!.l8!.transferOrNull() };
    },
  });
  assert.equal(finalHash, control.nativeStateHash, 'additional observer must preserve the canonical final state');
  rows.push({ tier, policy, run, initial: [...initial.values()], turns: [...turns.values()], attacks, hits, arrivals, markers, peak,
    calmMotion: [...stationary].map(([id, row]) => ({ id, ...row, maximumSeconds: row.maximum / 60 })), finalBoarding, nativeStateHash: finalHash, controlIdentical: true });
  console.log(tier, policy, { turns: turns.size, attacks: attacks.length, admitted: arrivals.length, peak, controlIdentical: true });
}
atomicJson(process.env.FIX53_L8_OUT ?? 'docs/reports/fix53-c/L8-native-observation.json', { ...identity,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  method: 'Both canonical policies/tiers; ordinary native inputs; read-only event and every-tick observation. Same-ID turn clock/species, real victim classes, admitted tunnel actors, fixed markers and actual boarding. Calm translation is not an animation-idle verdict. Native camera membership is not rendered visibility. Final state must equal independent canonical acceptance receipts.', rows });
