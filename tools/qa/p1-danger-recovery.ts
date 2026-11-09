/** Actual campaign initialization and update loop: an ordinary shotgun down rises in L1–L10. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadLevel, runnerLevels } from '../sim-runner/levels';
import { infectedDef, infectedRecovery, INFECTED_TOUGHNESS } from '../../src/data/infected';
import { l1v2 } from '../../src/data/l1v2';
import { provenance } from './accept/probe';

const rows = [];
for (const level of runnerLevels) {
  const world = await loadLevel(level, 1, undefined, 0, { quality: 'low' });
  try {
    const ai = world.infected!, player = world.entities.get(1)!;
    // This disposable mechanics fixture protects only the courier so the
    // observation clock survives the unplayed opening. Infected rules stay live.
    world.combat!.damage.god = true;
    if (ai.director.count >= ai.director.cap) ai.release(ai.active.find(e => e.health.current > 0)!);
    const cell = ai.nav.nearestCell(player.transform.x + 5, player.transform.z);
    const id = ai.spawn('infected.runner', { x: ai.nav.x(cell), z: ai.nav.z(cell), y: player.transform.y }, { variant: 'inf.cashier' });
    const runner = world.entities.get(id)!, brain = runner.infected!.l1;
    const hp = runner.health.max, speed = runner.infected!.speed, multiplier = runner.combat!.damageMultiplier;
    let roseAt: number | null = null, fullHealthAtRise = false;
    world.events.on('infected.recovered', event => {
      if (event.type === 'infected.recovered' && event.sourceId === id) { roseAt = event.tick; fullHealthAtRise = runner.health.current === hp; }
    });
    world.combat!.damage.apply({ attackId: 1000, actionId: 'weapon.shotgun', sourceId: 1, targetId: id,
      origin: player.transform, direction: { x: 1, z: 0 }, base: 9999, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
    const downAt = world.tick, scheduled = runner.infected!.recoverAt;
    for (let tick = 0; tick <= infectedRecovery.downS[1] * 60 + 2 && roseAt === null; tick++) world.update();
    const passed = !!brain && hp === infectedDef('infected.runner').hp * INFECTED_TOUGHNESS && multiplier === 1 &&
      speed >= l1v2.speedTiers.factor.minMs && speed <= l1v2.speedTiers.average.baseMs * l1v2.speedTiers.factor.max &&
      scheduled - downAt >= infectedRecovery.downS[0] * 60 && scheduled - downAt <= infectedRecovery.downS[1] * 60 &&
      roseAt !== null && fullHealthAtRise && world.entities.get(id) === runner && !runner.corpse;
    const row = { level, hp, speed, multiplier, sharedBrain: !!brain, downAt, scheduled, roseAt, fullHealthAtRise, sameIdentity: world.entities.get(id) === runner, passed };
    rows.push(row); console.log(JSON.stringify(row));
  } finally { world.dispose(); }
}
const out = 'test-results/p1-danger/recovery'; mkdirSync(out, { recursive: true });
writeFileSync(`${out}/native.json`, JSON.stringify({ ...provenance(), method: 'Normal low-tier campaign initialization; one controlled shotgun down; courier protected only to keep observation running; live mission and infected updates; no infected stat/timer edits.', rows }, null, 2) + '\n');
process.exitCode = rows.every(row => row.passed) ? 0 : 1;
