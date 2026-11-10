import { loadLevel } from '../../sim-runner/levels';
import { followFrustum } from '../../sim-runner/l3Bots';
import { LevelEightBot } from '../../../src/debug/bot/LevelEightBot';
import { preset } from '../../../src/sim/progression/Campaign';
const campaign: any = preset('L8-default' as any);
campaign.seed = 1; campaign.settings.quality = 'low';
const w: any = await loadLevel('L8', 1, campaign, 0, { quality: 'low' } as any);
const bot: any = new LevelEightBot(w, 'complete');
const m = w.missions, zoo = m.l8, player = w.entities.get(1);
let lastKey = '';

for (let i = 0; i < 1300 * 60 && !bot.finished; i++) {
  followFrustum(w); w.applyInput(bot.sample(), 'keyboard'); w.update();
  if (i === 200 * 60 || i === 300 * 60 || i === 450 * 60) {
    const p = player.transform;
    const live = zoo.roster().map((id: number) => w.entities.get(id)).filter((e: any) => e && e.health.current > 0 && !e.infected && e.passengerOf === undefined);
    const za = zoo.state.arenas[1];
    console.log('DIAG', i / 60, 'player', p.x | 0, p.z | 0, 'prot', zoo.protecting(), 'roster', live.map((e: any) => `${e.id}@${e.transform.x | 0},${e.transform.z | 0}:${Math.hypot(e.transform.x - p.x, e.transform.z - p.z) | 0}`).join(' '), 'zebra', JSON.stringify({ phase: za.phase, carrier: za.carrier, retry: za.carrierRetryAt, ids: za.ids.length, nextAt: za.nextAt, tick: w.tick }));
    const ids = za.ids.map((id: number) => { const e = w.entities.get(id); return e ? `${id}:${e.infected ? 'inf' : e.civilian ? 'civ' : '?'}:${e.health.current | 0}@${e.transform.x | 0},${e.transform.z | 0}:${e.infected?.state ?? e.civilian?.state ?? ''}` : id + ':gone'; });
    console.log('ZEBRA', i / 60, ids.join(' '));
    const car = w.entities.get(za.carrier); console.log('CARRIER', car ? `${car.archetype}@${car.transform.x | 0},${car.transform.z | 0} ${car.infected?.state} hp${car.health.current | 0}` : 'none');
    console.log('STATE', JSON.stringify({ animalBiteStarted: zoo.state.animalBiteStarted, breachedAt: zoo.state.breachedAt }));
  }
  const arenas = zoo.state.arenas.map((a: any) => a.id[0] + a.phase).join('');
  const steps = m.def.steps.map((s: any) => m.state.steps[s.id].status[0]).join('');
  const key = arenas + steps + (zoo.state.breachedAt ? 'B' : '') + (w.vehicles.active !== null ? 'V' : '');
  if (key !== lastKey || i % 1800 === 0) {
    lastKey = key;
    const act = m.def.steps.find((s: any) => m.state.steps[s.id].status === 'active');
    console.log(`t=${(i / 60).toFixed(0)}s arenas=${arenas} steps=${steps} active=${act?.id} breach=${!!zoo.state.breachedAt} pos=${player.transform.x | 0},${player.transform.z | 0} hp=${player.health.current | 0} phase=${m.state.phase}`);
  }
}
console.log('end', bot.finished, (w.tick / 60) | 0, m.state.phase, 'collision', w.solids.snapshot().failures);
process.exit(0);
