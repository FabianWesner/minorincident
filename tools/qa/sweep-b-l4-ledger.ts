/** Read-only ordinary native L4 route clauses; final-state control is mandatory. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { preset } from '../../src/sim/progression/Campaign';
import { stateHash } from '../../src/sim/world/stateHash';
import { runLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const rows = [];
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L4-default'); campaign.settings.quality = tier;
  const events: unknown[] = [], alphas: unknown[] = [], mix: unknown[] = [], spectacle: unknown[] = [];
  const encounters = new Map<number, unknown>();
  let alphaCursor = 0, enteredTank = 0, damage: unknown = null, finalHash = '';
  const run = await runLevel('L4', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: tier, beforeBegin: world => {
      for (const type of ['l4.wave', 'l4.lineBreaks', 'l4.descended', 'l4.heliWithdrawn', 'hmg.burst', 'barricade.damaged'] as const)
        world.events.on(type, event => events.push(structuredClone(event)));
      world.events.on('l4.tankFire', event => {
        if (event.type !== 'l4.tankFire') return;
        const protectedActors = [...world.entities.iterate()].filter(e => e.id === 1 || e.health.current > 0 && !!e.civilian && !e.infected);
        events.push({ ...event, phase: world.missions!.state.l4!.phase,
          protectedActors: protectedActors.map(e => ({ id: e.id, distanceM: Math.hypot(event.to.x - e.transform.x, event.to.z - e.transform.z) })) });
      });
      world.events.on('sim.tick', () => {
        const s = world.missions!.state.l4!, p = world.entities.get(1)!;
        if (s.tankPhase === 'enter') enteredTank ||= world.tick;
        for (const id of s.alphaIds.slice(alphaCursor)) {
          const e = world.entities.get(id)!;
          alphas.push({ id, tick: world.tick, at: { ...e.transform }, anchor: s.alphaAnchors[s.alphaIds.indexOf(id)],
            offscreen: world.infected!.director.offscreen(e.transform), playerDistance: Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) });
        }
        alphaCursor = s.alphaIds.length;
        const live = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.pendingAdmission && !e.corpse);
        if (s.phase === 'collapse') for (const e of live) if (!encounters.has(e.id) && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) <= 10 && world.combat!.query.visible(p.transform, e.transform))
          encounters.set(e.id, { id: e.id, tick: world.tick, x: e.transform.x, z: e.transform.z });
        if (s.descendAt && !damage) damage = { tick: world.tick, fires: s.fires, shatteredWindows: s.glass.length,
          burningVehicles: s.burning.map(id => ({ id, entity: structuredClone(world.entities.get(id)) })), controllerScorch: s.scorch };
        if (world.tick % 30 === 0 && s.phase === 'war') {
          const nearest = [...live].sort((a, b) => Math.hypot(a.transform.x - p.transform.x, a.transform.z - p.transform.z) - Math.hypot(b.transform.x - p.transform.x, b.transform.z - p.transform.z)).slice(0, 20);
          if (nearest.length === 20) mix.push({ tick: world.tick, actors: nearest.map(e => ({ id: e.id, x: e.transform.x, z: e.transform.z, model: e.infected!.model ?? e.appearance?.asset ?? e.infected!.variant, archetype: e.archetype })) });
        }
        if (world.tick % 60 === 0 && s.warAt) spectacle.push({ tick: world.tick, tankPhase: s.tankPhase, heliPhase: s.heliPhase, heliAngle: s.heliAngle,
          heli: s.heliId ? { ...world.entities.get(s.heliId)?.transform } : null });
      }, 8);
    }, beforeDispose: world => { finalHash = stateHash(world.getState()); },
  });
  const canonical = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L4-${tier}-complete.json`, 'utf8'));
  assert.equal(canonical.sourceHash, provenance().sourceHash); assert.equal(finalHash, canonical.nativeStateHash);
  rows.push({ tier, run, nativeStateHash: finalHash, canonicalStateHash: canonical.nativeStateHash, enteredTank, events, alphas, mix, spectacle, routeEncounters: [...encounters.values()], damage });
  console.log(tier, run.outcome, finalHash);
}
writeFileSync('docs/reports/sweep-b/L4-native-ledger.json', JSON.stringify({ ...provenance(), method: 'Read-only actual events and every-tick actor identities; nearest20 living infected sampled at2Hz; no authored positions substituted for admissions. Canonical final-state hashes must match.', rows }, null, 2) + '\n');
