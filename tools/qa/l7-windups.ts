/** Observe distinct targeted infected attack starts near each L7 street on the ordinary skilled route. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { l7Encounters } from '../../src/data/l7';
import { provenance } from './accept/probe';

type Hit = { tick: number; street: number; sector: string; source: number; target: number; pack: number; roadReachable: boolean; sourcePosition: { x: number; z: number }; targetPosition: { x: number; z: number }; playerPosition: { x: number; z: number } };
const identity = provenance();
const producerHash = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L7-default'); campaign.settings.quality = tier;
  const hits: Hit[] = [];
  const run = await runLevel('L7', 'complete', 1, undefined, 'auto', campaign, undefined, 0, { quality: tier, beforeBegin: w => w.events.on('telegraph', ev => {
    if (ev.type !== 'telegraph' || !ev.sourceId || !('special' in ev) || ['alpha.roar', 'scream', 'revive'].includes(ev.special)) return;
    const source = w.entities.get(ev.sourceId), player = w.entities.get(1);
    if (!source?.infected || !player) return;
    const target = w.entities.get(ev.target?.id ?? 0);
    if (!target || !(target.id === 1 || target.civilian?.survivor || target.civilian?.ally) || Math.hypot(target.transform.x - player.transform.x, target.transform.z - player.transform.z) > 25) return;
    const dx = source.transform.x - target.transform.x, dz = source.transform.z - target.transform.z;
    const sector = Math.abs(dx) > Math.abs(dz) ? dx > 0 ? 'east' : 'west' : dz > 0 ? 'south' : 'north';
    const nav = w.infected!.nav, path: number[] = [];
    const from = nav.nearestCell(source.transform.x, source.transform.z, .35), to = nav.nearestCell(target.transform.x, target.transform.z, .35);
    const roadReachable = from >= 0 && to >= 0 && nav.path(from, to, path, 900);
    const point = (p: { x: number; z: number }) => ({ x: p.x, z: p.z });
    l7Encounters.streets.forEach((c, street) => {
      if (Math.hypot(player.transform.x - c.x, player.transform.z - c.z) <= 25) hits.push({ tick: w.tick, street, sector, source: source.id, target: target.id, pack: source.infected!.pack, roadReachable, sourcePosition: point(source.transform), targetPosition: point(target.transform), playerPosition: point(player.transform) });
    });
  }) });
  const streets = l7Encounters.streets.map((_, street) => {
    const events = hits.filter(x => x.street === street); let best: Hit[] = [];
    for (const first of events) {
      const bySource = new Map<number, Hit>();
      for (const hit of events) if (hit.roadReachable && hit.tick >= first.tick && hit.tick < first.tick + 300 && !bySource.has(hit.source)) bySource.set(hit.source, hit);
      const witnesses = [...bySource.values()];
      if (new Set(witnesses.map(x => x.sector)).size > new Set(best.map(x => x.sector)).size) best = witnesses;
    }
    return { street, windups: events.length, witnesses: best };
  });
  const result = { ...identity, producerHash, tier, seed: 1, completed: run.completed, saved: run.survivorsSaved, total: run.survivorsTotal, streets };
  writeFileSync(`docs/reports/s192-l7harder/directions-${tier}.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ tier, completed: run.completed, streets: streets.map(x => ({ street: x.street, sectors: [...new Set(x.witnesses.map(y => y.sector))] })) }));
}
