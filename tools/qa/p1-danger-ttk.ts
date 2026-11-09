/** Standard stationary-courier TTK: one ordinary runner, no combat input or level-specific encounter population. */
import { SimWorld } from '../../src/sim/world/SimWorld';
import { runnerLevels } from '../sim-runner/levels';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const rows: { level: string; seconds: number | null; landedHits: number; damage: number; healthAfter: number }[] = [];
for (const level of runnerLevels) {
  const world = new SimWorld();
  await world.init();
  try {
    world.loadScenario('horde-arena', 1);
    world.scenario = level;
    world.infected!.configureL1v2();
    const player = world.entities.get(1)!;
    player.health.current = player.health.max = 100;
    world.combat!.damage.god = false;
    const id = world.infected!.spawn('infected.runner', { x: 2.3, z: 0 }, { state: 'chase' });
    const runner = world.entities.get(id)!;
    runner.infected!.l1!.mode = 'chase'; runner.infected!.l1!.targetId = 1; runner.infected!.l1!.pauseUntil = 0;
    let hits = 0, damage = 0, deathTick: number | null = null;
    world.events.on('combat.hit', event => {
      if (event.type === 'combat.hit' && event.targetId === 1 && event.sourceId === id && event.amount > 0) { hits++; damage += event.amount; }
    });
    world.events.on('player.died', () => { deathTick ??= world.tick; });
    for (let tick = 0; tick < 3600 && deathTick === null; tick++) world.update();
    rows.push({ level, seconds: deathTick === null ? null : deathTick / 60, landedHits: hits, damage, healthAfter: player.health.current });
  } finally { world.dispose(); }
}
const receipt = { seed: 1, setup: 'horde-arena; one infected.runner at 2.3 m; courier stationary; no attack input', rows };
console.log(JSON.stringify(receipt, null, 2));
const output = process.env.P1_DANGER_OUT;
if (output) { await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(receipt, null, 2) + '\n'); }
