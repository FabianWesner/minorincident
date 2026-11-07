/** blk-l3 (L3-14): native complete run (qa:accept setup); between crossing and the boom closing, log what holds the boom. */
import { runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { l3 } from '../../src/data/l3';
const seed = Number(process.argv[2] ?? 1), tier = (process.argv[3] ?? 'high') as 'low' | 'high';
const campaign = preset('L3-default'); campaign.seed = seed; campaign.settings.quality = tier;
const bx = l3.finale.barrierX;
await runLevel('L3', 'complete', seed, undefined, 'auto', campaign, undefined, 0, {
  quality: tier,
  beforeBegin: world => world.events.on('sim.tick', () => {
    const s = world.missions?.state.l3; if (!s?.crossedAt || s.barrierClosedAt || (world.tick - s.crossedAt) % 20) return;
    const following = new Set(s.squad.map(m => m.id));
    const group = [1, ...s.officerIds.filter(id => following.has(id)), ...[...world.entities.iterate()].filter(e => !!e.companion).map(e => e.id)];
    const out = group.map(id => world.entities.get(id)).filter(e => e && e.health.current > 0 && !e.infection && e.transform.x <= bx + 1.1).map(e => `${e!.id}${e!.companion ? 'dog' : ''}@${e!.transform.x.toFixed(1)},${e!.transform.z.toFixed(1)}`);
    const under = [...world.entities.iterate()].filter(e => !e.infected && e.health.current > 0 && Math.abs(e.transform.x - bx) < .6 && Math.abs(e.transform.z) < 2.2).map(e => `${e.id}:${e.kind}/${e.archetype}${e.civilian ? '/civ' : ''}`);
    const dog = [...world.entities.iterate()].find(e => e.companion)!, near = world.infected!.active.filter(e => e.health.current > 0 && Math.hypot(e.transform.x - dog.transform.x, e.transform.z - dog.transform.z) < 2.5).length;
    const npcs = world.npcs as unknown as { routeless: Map<number, number>; unreachable: Map<number, unknown> };
    const nav = world.infected!.nav, cell = nav.nearestCell(dog.transform.x, dog.transform.z, .44);
    console.log('   dog', dog.companion!.state, dog.companion!.following, 'v', JSON.stringify(dog.companion!.velocity), 'nearInf', near, 'routeless', npcs.routeless.get(dog.id), 'unreach', !!npcs.unreachable.get(dog.id), 'cell', cell, 'player', world.entities.get(1)!.transform.x.toFixed(1));
    console.log(world.tick - s.crossedAt, 'groupOutside', out.join(' ') || '-', 'underArm', under.join(' ') || '-', 'finale', world.tick - (s.finaleAt ?? 0));
  }),
  beforeDispose: world => { const s = world.missions!.state.l3!; console.log('crossed', s.crossedAt, 'barrier', (s.barrierClosedAt ?? NaN) - s.crossedAt, 'done', s.doneAt - s.crossedAt); },
});
