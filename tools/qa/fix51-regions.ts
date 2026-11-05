/** Spatial regional contact ledger. Objective names identify the destination,
 * so objective-phase durations alone cannot qualify L10's occupied regions. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cure } from '../../src/levels/L10/district';
import { loadLevel, runLevel } from '../sim-runner/levels';
import { PathProbe } from './threat/observer';
import { missionControls } from '../../src/sim/missions/controls';
import { followTenFrustum } from '../sim-runner/l10';
import { cureEncounters } from '../../src/levels/L10/encounters';

const out = process.env.QA_OUT ?? 'test-results/fix51-p1/regions';
mkdirSync(out, { recursive: true });
const receipts = [];
if (process.env.QA_STATIONARY === '1') {
  for (const tier of ['low', 'high'] as const) for (const region of cure.regions) {
    const w = await loadLevel('L10', 1, undefined, 0, { quality: tier });
    try {
      w.player!.damage = () => 0;
      // Preserve the actual sixty-second calm/admission rule. No game clock,
      // encounter counts, arsenal, objective or spawn ledger is shortened.
      if (region.id !== 'crash-outskirts') {
        for (let i = 0; i < 3600; i++) { followTenFrustum(w); w.update(); }
      }
      {
        const group = cureEncounters.find(g => g.region === region.id)!;
        const point = { x: group.at[0] - 35, z: group.at[1] };
        missionControls(w).teleport(1, point);
        const actual = w.entities.get(1)!.transform;
        if (Math.hypot(actual.x - point.x, actual.z - point.z) > 2) throw new Error(`Blocked passive fixture ${region.id}`);
      }
      const start = w.tick, pending: { sourceId: number; targetId?: number }[] = [], reach = [], path = new PathProbe();
      let windups = 0, first: number | null = null;
      w.events.on('telegraph', e => {
        if (e.type === 'telegraph' && e.sourceId !== undefined && e.special !== 'alpha.roar') pending.push({ sourceId: e.sourceId, targetId: e.target?.id });
      });
      for (let i = 0; i < 3600; i++) {
        followTenFrustum(w); w.update();
        for (const event of pending.splice(0)) {
          const brain = w.entities.get(event.sourceId)?.infected;
          if (brain && (event.targetId ?? (brain.targetId || brain.heardTargetId || 1)) === 1) { windups++; first ??= (w.tick - start) / 60; }
        }
        if (w.tick % 120 === 0) {
          const p = w.entities.get(1)!.transform;
          const local = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) <= 30);
          reach.push({ tick: w.tick, alive: local.length, reachable: local.filter(e => path.query(w.infected!.nav, e, p, 2.5)).length });
        }
      }
      const row = { tier, region: region.id, policy: 'independent stationary, survival-protected, no fire; native fixed approach anchor; sixty active seconds', windups, windupsPerMinute: windups, firstAttackSeconds: first, reach };
      receipts.push(row); console.log(JSON.stringify(row));
      writeFileSync(`${out}/stationary.json`, JSON.stringify(receipts, null, 2) + '\n');
    } finally { w.dispose(); }
  }
  if (process.env.QA_ASSERT === '1') for (const row of receipts) {
    if (!('region' in row)) continue;
    const index = cure.regions.findIndex(r => r.id === row.region), target = index < 2 ? 2 : 4;
    assert.ok(row.windupsPerMinute >= target, `${row.tier}/${row.region}: stationary windups below ${target}/min`);
    const observed = row.reach.reduce((n, s) => n + s.alive, 0), reachable = row.reach.reduce((n, s) => n + s.reachable, 0);
    assert.ok(observed > 0 && reachable / observed >= .9, `${row.tier}/${row.region}: stationary local reachability`);
  }
  process.exit(0);
}
for (const tier of (process.env.QA_TIERS?.split(',') ?? ['low', 'high']) as ('low' | 'high')[]) {
  for (const passive of [false, true]) {
    const rows = cure.regions.map(r => ({ id: r.id, seconds: 0, attacks: 0, windups: 0, firstAttack: null as number | null, firstTick: null as number | null,
      peakRegular: 0, peakDogs: 0, peakAlphas: 0, reach: [] as { tick: number; alive: number; reachable: number }[] }));
    const path = new PathProbe();
    const run = await runLevel('L10', 'complete', 1, 3600, 'auto', undefined, undefined, 0, {
      quality: tier, passive,
      beforeBegin: w => {
        const region = () => {
          const x = w.entities.get(1)!.transform.x;
          return cure.regions.reduce((index, r, i) => x >= r.route[0][0] ? i : index, 0);
        };
        const pending: { sourceId: number; special: string; targetId?: number }[] = [];
        w.events.on('telegraph', e => {
          if (e.type === 'telegraph' && e.sourceId !== undefined) pending.push({ sourceId: e.sourceId, special: e.special, targetId: e.target?.id });
        });
        w.events.on('infected.attack', e => {
          if (e.type !== 'infected.attack' || e.targetId !== 1) return;
          const row = rows[region()]; row.attacks++;
          row.firstAttack ??= (e.tick - (row.firstTick ?? e.tick)) / 60;
        });
        const update = w.update.bind(w);
        w.update = () => {
          const row = rows[region()], playing = w.missions!.state.phase === 'playing' && !w.missions!.state.states['cure-released'];
          update();
          for (const event of pending.splice(0)) {
            const source = w.entities.get(event.sourceId), b = source?.infected;
            // Inspect after the native update so barricade/prop targets assigned
            // immediately after windup() cannot be mistaken for player attacks.
            const target = event.targetId ?? (b?.targetId || b?.heardTargetId || 1);
            if (playing && b && target === 1 && event.special !== 'alpha.roar') row.windups++;
          }
          if (!playing) return;
          row.firstTick ??= w.tick; row.seconds += 1 / 60;
          const alive = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden);
          row.peakRegular = Math.max(row.peakRegular, alive.filter(e => !['infected.dog', 'infected.alpha'].includes(e.archetype)).length);
          row.peakDogs = Math.max(row.peakDogs, alive.filter(e => e.archetype === 'infected.dog').length);
          row.peakAlphas = Math.max(row.peakAlphas, alive.filter(e => e.archetype === 'infected.alpha' && !e.infected?.pursuit).length);
          if (w.tick % 120 === 0) {
            const player = w.entities.get(1)!.transform;
            const local = alive.filter(e => Math.hypot(e.transform.x - player.x, e.transform.z - player.z) <= 30);
            row.reach.push({ tick: w.tick, alive: local.length, reachable: local.filter(e => path.query(w.infected!.nav, e, player, 2.5)).length });
          }
        };
      },
    });
    const receipt = { tier, policy: passive ? 'passive moving native route, no attacks or incoming damage' : 'competent native route, mortal', run,
      regions: rows.map(r => ({ ...r, attacksPerMinute: r.attacks * 60 / r.seconds, windupsPerMinute: r.windups * 60 / r.seconds })) };
    receipts.push(receipt); writeFileSync(`${out}/receipt.json`, JSON.stringify(receipts, null, 2) + '\n');
    console.log(JSON.stringify({ tier, passive, outcome: run.outcome, deaths: run.deaths, regions: receipt.regions.map(({ id, seconds, attacks, attacksPerMinute, windups, windupsPerMinute, peakRegular }) => ({ id, seconds, attacks, attacksPerMinute, windups, windupsPerMinute, peakRegular })) }));
  }
}

if (process.env.QA_ASSERT === '1') for (const receipt of receipts) {
  if (!('regions' in receipt)) continue;
  if (receipt.policy.startsWith('competent')) assert.ok(receipt.run.completed, `${receipt.tier}: native competent route incomplete`);
  for (const [index, region] of receipt.regions.entries()) {
    const target = index < 2 ? 2 : 4;
    assert.ok(region.windupsPerMinute >= target, `${receipt.tier}/${receipt.policy}/${region.id}: windups below ${target}/min`);
    const observed = region.reach.reduce((n, s) => n + s.alive, 0), reachable = region.reach.reduce((n, s) => n + s.reachable, 0);
    assert.ok(observed > 0 && reachable / observed >= .9, `${receipt.tier}/${region.id}: local reachability`);
  }
}
