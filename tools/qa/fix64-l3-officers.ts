/** Read-only shot/hit timing around fallback; no combat or population changes. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL3, runL3 } from '../sim-runner/l3Bots';
import { provenance } from './accept/probe';

const runs = [];
for (const tier of ['low', 'high'] as const) {
  const { world, mission } = await loadL3(1, tier);
  try {
    const shots: unknown[] = [], hits: unknown[] = [], losses: unknown[] = [];
    world.events.on('ally.attack', e => {
      if (e.type !== 'ally.attack' || !mission.state.l3!.officerIds.includes(e.sourceId)) return;
      const s = mission.state.l3!, actor = world.entities.get(e.sourceId)!;
      shots.push({ tick: e.tick, source: e.sourceId, target: e.targetId, hit: e.hit,
        from: e.from, to: e.to, fallback: s.fallbackAt, segment: s.segment,
        member: s.squad.some(q => q.id === e.sourceId), hp: actor.health.current });
    });
    world.events.on('combat.hit', e => {
      if (e.type !== 'combat.hit' || !mission.state.l3!.officerIds.includes(e.sourceId)) return;
      const s = mission.state.l3!;
      hits.push({ tick: e.tick, source: e.sourceId, target: e.targetId, amount: e.amount, action: e.actionId, damageType: e.damageType,
        position: e.position, fallback: s.fallbackAt, segment: s.segment,
        member: s.squad.some(q => q.id === e.sourceId) });
    });
    world.events.on('l3.squad-lost', e => { losses.push({ ...e, player: { ...world.entities.get(1)!.transform } }); });
    const report = runL3(world, mission, 'complete');
    runs.push({ tier, report, shots, hits, losses });
    console.log(tier, JSON.stringify(report.s1), 'shots', shots.length, 'hits', hits.length);
  } finally { world.dispose(); }
}
mkdirSync('docs/reports/fix64-a', { recursive: true });
writeFileSync('docs/reports/fix64-a/L3-officer-ledger.json', JSON.stringify({ ...provenance(),
  method: 'Fresh mortal complete InputFrames, seed1, both tiers; read-only ally.attack and positive combat.hit event ledger; no actor edits.', runs }, null, 2) + '\n');
