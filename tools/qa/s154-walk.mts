import { mkdirSync, writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';

// Same bot routes, weapons and interactions as runLevel. Walking changes only
// the ordinary walk input. Neither policy grants health or changes actors.
const out = 'test-results/s154-lowexits';
mkdirSync(out, { recursive: true });
const skilled = process.env.S154_SKILLED === '1';
const rows = [];
for (const level of ['L4', 'L6'] as const) for (const quality of ['low', 'high'] as const) {
  const deaths: { tick: number; phase: string; position: unknown; near: unknown[]; attackers: unknown[] }[] = [];
  const run = await runLevel(level, 'complete', 1, 700, 'auto', undefined, undefined, 0, {
    quality,
    beforeBegin: world => {
      const apply = world.applyInput.bind(world);
      world.applyInput = (frame, scheme) => apply(skilled ? frame : { ...frame, walk: true }, scheme);
      world.events.on('player.died', () => {
        const player = world.entities.get(1)!;
        deaths.push({ tick: world.tick,
          phase: level === 'L4' ? world.missions!.state.l4!.phase : world.missions!.state.l6!.phase,
          position: { ...player.transform }, attackers: [],
          near: world.infected!.active.filter(a => a.health.current > 0 && Math.hypot(a.transform.x - player.transform.x, a.transform.z - player.transform.z) < 5)
            .map(a => ({ id: a.id, archetype: a.archetype, position: { ...a.transform } })),
        });
      });
      // Damage emits the death before the combat receipt. Join on that tick;
      // proximity alone is retained separately and never called an attacker.
      for (const type of ['combat.hit', 'combat.kill'] as const) world.events.on(type, event => {
        if (event.targetId !== 1) return;
        const death = deaths.find(d => d.tick === event.tick);
        if (death) death.attackers.push({ sourceId: event.sourceId, archetype: world.entities.get(event.sourceId)?.archetype,
          attackId: event.attackId, actionId: event.actionId, amount: event.amount, type: event.type });
      });
    },
  });
  rows.push({ level, quality, run, deaths });
  writeFileSync(`${out}/native-${skilled ? 'skilled' : 'walk'}.json`, JSON.stringify(rows, null, 2));
  console.log(JSON.stringify({ level, quality, outcome: run.outcome, deaths: run.deaths,
    escapeDeaths: deaths.filter(d => d.phase === 'collapse' || d.phase === 'exit').length }));
}
