/** Native skilled / mortal no-attack pressure comparison, with identical policy rules on every source snapshot. */
import { newCampaign, preset } from '../../src/sim/progression/Campaign';
import { runnerLevels } from '../sim-runner/levels';
import { runLevel } from '../sim-runner/levels';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { Player } from '../../src/sim/entities/Player';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sourceHash = createHash('sha256');
function hashTree(path: string): void {
  for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) hashTree(file);
    else sourceHash.update(file).update('\0').update(readFileSync(file));
  }
}
hashTree('src');
const identity = { sourceHash: sourceHash.digest('hex'), diagnosticHash: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex') };


function campaign(level: typeof runnerLevels[number]) {
  const save = level === 'L1' ? newCampaign('female', 1) : preset(`${level}-default` as Parameters<typeof preset>[0]);
  save.seed = 1; save.settings.quality = 'low'; return save;
}
async function measure(level: typeof runnerLevels[number], passive: boolean) {
  let hits = 0, damage = 0, infectedDamage = 0, deaths = 0, startTick = 0, endTick = 0, boarded: number | null = null;
  const run = await runLevel(level, 'complete', 1, undefined, 'auto', campaign(level), undefined, 0, {
    quality: 'low', passive,
    beforeBegin: (world: SimWorld) => {
      startTick = world.tick;
      world.events.on('combat.hit', event => {
        if (event.type !== 'combat.hit' || event.targetId !== 1 || event.amount <= 0) return;
        const source = world.entities.get(event.sourceId);
        if (source?.faction !== 'infected') return;
        hits++; infectedDamage += event.amount;
      });
      world.events.on('player.damaged', event => { if (event.type === 'player.damaged') damage += event.amount; });
      world.events.on('player.died', () => { deaths++; });
      if (passive) {
        const applyInput = world.applyInput.bind(world);
        const setInput = world.setInput.bind(world);
        world.setInput = frame => setInput({ ...frame, mouseAttack: false, activeAttack: false,
          attackInPlace: false, attackTarget: undefined, left: { down: false, held: false, up: false },
          right: { down: false, held: false, up: false } });
        world.applyInput = (frame, scheme) => applyInput({ ...frame, mouseAttack: false, activeAttack: false,
          attackInPlace: false, attackTarget: undefined, left: { down: false, held: false, up: false },
          right: { down: false, held: false, up: false } }, scheme);
        if (world.player) world.player.damage = Player.prototype.damage.bind(world.player);
      }
    },
    beforeDispose: world => { endTick = world.tick; boarded = world.l7Departure?.state.boarded.length ?? null; },
  });
  const seconds = Math.max(1 / 60, (endTick - startTick) / 60);
  return { level, policy: passive ? 'passive' : 'skilled', outcome: run.outcome, completed: run.completed,
    seconds, landedHits: hits, landedHitsPerMinute: hits * 60 / seconds, damageHp: damage,
    damageHpPerMinute: damage * 60 / seconds, infectedDamageHp: infectedDamage, deaths: Math.max(deaths, run.deaths), startTick, boarded,
    furthestObjective: run.furthestObjective };
}
const rows = [];
const output = process.env.P1_DANGER_OUT;
const selected = process.env.P1_DANGER_LEVELS?.split(',') ?? [...runnerLevels];
const policies = process.env.P1_DANGER_POLICIES?.split(',') ?? ['skilled', 'passive'];
for (const level of runnerLevels.filter(level => selected.includes(level))) for (const passive of [false, true].filter(passive => policies.includes(passive ? 'passive' : 'skilled'))) {
  const row = await measure(level, passive); rows.push(row);
  console.log(JSON.stringify(row));
  if (output) { await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify({ ...identity, revision: process.env.P1_DANGER_SIDE ?? 'unspecified', seed: 1, tier: 'low', rows }, null, 2) + '\n'); }
}
