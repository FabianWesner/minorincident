// L7 density (PO 11-26): where and to what the courier dies on seed 2.
import { runLevel } from '../../sim-runner/levels';
const deaths: string[] = [];
await runLevel('L7', 'complete', Number(process.argv[2] ?? 2), 1200, 'auto', undefined, undefined, 0, { beforeBegin: w => {
  w.events.on('player.died', e => {
    const p = w.entities.get(1)!.transform, near: Record<string, number> = {};
    for (const i of w.infected!.active) if (i.health.current > 0 && Math.hypot(i.transform.x - p.x, i.transform.z - p.z) < 8) near[i.archetype] = (near[i.archetype] ?? 0) + 1;
    deaths.push(`${(e.tick / 60).toFixed(0)}s at ${p.x.toFixed(0)},${p.z.toFixed(0)} cp=${w.missions!.state.checkpoint} step=${w.missions!.def.steps.find(s => w.missions!.state.steps[s.id].status === 'active')?.id} near8m=${JSON.stringify(near)}`);
  });
} });
console.log(deaths.slice(0, 12).join('\n')); console.log('total', deaths.length);
process.exit(0);
