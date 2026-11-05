/** Read-only L4 breach-south cohort ledger for the moving (complete) and passive native routes, low tier, seed 1.
 * Usage: node --import tsx/esm tools/qa/accept/fix61-l4-south-trace.ts [complete|passive] [side=south] */
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { ThreatObserver } from '../threat/observer';

const passive = process.argv[2] === 'passive', side = process.argv[3] ?? 'south', key = `breach-${side}`;
const tier = process.argv[4] === 'high' ? 'high' : 'low';
const campaign = preset('L4-default'); campaign.seed = 1; campaign.settings.quality = tier;
let observer!: ThreatObserver;
const log: string[] = [], born = new Map<string, number>();
const round = (n: number) => Math.round(n * 10) / 10;
let openAt = 0;
let result: ReturnType<ThreatObserver['finish']> | undefined;
await runLevel('L4', 'complete', 1, passive ? 250 : undefined, 'auto', campaign, undefined, 0, {
  quality: tier, passive,
  beforeBegin: world => {
    observer = new ThreatObserver(world, 'L4');
    const member = (id: number) => {
      const e = world.entities.get(id); if (!e?.infected) return undefined;
      const w = observer.waves.finish().find(q => q.key === key);
      const token = observer.identity(e);
      return w?.members.includes(token) ? token : undefined;
    };
    world.events.on('combat.kill', ev => {
      if (ev.type !== 'combat.kill') return;
      const token = member(ev.targetId); if (!token) return;
      const src = world.entities.get(ev.sourceId), e = world.entities.get(ev.targetId)!;
      log.push(`t=${round((world.tick - openAt) / 60)} KILL ${token} by #${ev.sourceId} ${src?.archetype ?? '?'} at (${round(e.transform.x)},${round(e.transform.z)})`);
    });
    world.events.on('combat.hit', ev => {
      if (ev.type !== 'combat.hit') return;
      const token = member(ev.targetId); if (!token) return;
      const src = world.entities.get(ev.sourceId);
      if (src?.id === 1) return;
      log.push(`t=${round((world.tick - openAt) / 60)} hit ${token} by #${ev.sourceId} ${src?.archetype ?? "?"} spear=${world.entities.get(ev.targetId)?.infected?.spearheadUntil ?? "-"} tick=${world.tick} d=${src ? round(Math.hypot(src.transform.x - world.entities.get(ev.targetId)!.transform.x, src.transform.z - world.entities.get(ev.targetId)!.transform.z)) : "?"}`);
    });
    const update = world.update.bind(world);
    world.update = () => {
      const before = world.tick; update(); if (world.tick === before) return;
      const l4 = world.missions!.state.l4!; const b = l4.breaches?.[side as 'south'];
      if (!b?.openAt) return;
      if (!openAt) { openAt = b.openAt; const p = world.entities.get(1)!.transform; log.push(`OPEN tick ${openAt} phase ${l4.phase} player (${round(p.x)},${round(p.z)})`); }
      const w = observer.waves.finish().find(q => q.key === key); if (!w) return;
      for (const token of w.members) if (!born.has(token)) {
        born.set(token, world.tick);
        const e = world.entities.get(Number(token.split('@')[0]));
        log.push(`t=${round((world.tick - openAt) / 60)} JOIN ${token} ${e?.archetype} at (${round(e?.transform.x ?? 0)},${round(e?.transform.z ?? 0)}) approach=${e?.infected?.breachApproach} spear=${e?.infected?.spearheadUntil ?? "-"} origin=${l4.origin[e?.id ?? -1]}`);
      }
      const age = (world.tick - openAt) / 60;
      if (age <= 40 && (world.tick - openAt) % 120 === 0) {
        const p = world.entities.get(1)!.transform;
        const rows = w.members.map(token => {
          const e = world.entities.get(Number(token.split('@')[0]));
          if (!e?.infected || observer.identity(e) !== token || e.health.current <= 0) return null;
          const b = e.infected;
          return `${token}:(${round(e.transform.x)},${round(e.transform.z)}) d=${round(Math.hypot(e.transform.x - p.x, e.transform.z - p.z))} ${b.state}/${b.l1?.mode ?? '-'} ap=${b.breachApproach ?? '-'} hp=${e.health.current}${e.hidden ? ' hidden' : ''}${e.emerging ? ' emerging' : ''}`;
        }).filter(Boolean);
        log.push(`t=${round(age)} player (${round(p.x)},${round(p.z)}) alive=${rows.length} ${rows.join(' | ')}`);
      }
    };
  },
  beforeDispose: () => { result = observer.finish(); },
});
const w = result?.waves.find(q => q.key === key);
console.log(log.join('\n'));
console.log(`${key} ${passive ? 'passive' : 'complete'}: spawned ${w?.spawned} first ${w?.firstAttackSeconds}`);
