/** Read-only L5 pace and exact bot-wait intent, with canonical state comparison. */
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { loadLevel } from '../../sim-runner/levels.ts';
import { LevelFiveBot } from '../../../src/debug/bot/LevelFiveBot.ts';
import { preset } from '../../../src/sim/progression/Campaign.ts';
import { stateHash } from '../../../src/sim/world/stateHash.ts';
import { followerInCombat } from '../../../src/sim/outbreak/Survivors.ts';
import { isWalkingSample, median } from '../threat/observer.ts';
import { provenance } from './probe.ts';

const tier = process.argv[2] ?? 'high';
if (!['low', 'high'].includes(tier)) throw new Error('Expected low|high');
const identity = provenance(), campaign = preset('L5-default'); campaign.settings.quality = tier;
const world = await loadLevel('L5', 1, campaign, 0, { quality: tier });
const bot = new LevelFiveBot(world, 'complete'), samples = [], waits = [], paces = new Map(), commands = new Map();
let escortTicks = 0, waitTicks = 0, soleWaitTicks = 0, hash;
const eligible = () => [...world.entities.iterate()].filter(e => e.id !== 1 && e.health.current > 0 && !e.hidden && !e.infected && !e.infection &&
  e.civilian?.survivor?.mode === 'follow' && !['grabbed', 'bitten', 'down', 'rising', 'flee'].includes(e.civilian.state) &&
  !e.civilian.survivor.cover && e.civilian.story?.clip !== 'npc-cower');
try {
  const move = world.npcs.move.bind(world.npcs);
  world.npcs.move = (entity, goal, speed, ...args) => {
    if (entity.civilian?.survivor?.mode === 'follow') commands.set(entity.id, { x: goal.x, z: goal.z, speed, stop: args[1] ?? .1 });
    return move(entity, goal, speed, ...args);
  };
  for (let tick = 0; tick < 1200 * 60 && !bot.finished; tick++) {
    commands.clear();
    const phase = world.missions.def.steps.filter(s => world.missions.state.steps[s.id].status === 'active').map(s => s.id).join(',');
    const player = world.entities.get(1), before = { ...player.transform }, lag = bot.lag;
    const frame = bot.sample(), waitingIntent = lag < 300 && bot.lag === lag + 1 && Math.hypot(frame.move.x, frame.move.z) === 0;
    world.applyInput(frame, 'keyboard'); world.update();
    const speed = Math.hypot(player.transform.x - before.x, player.transform.z - before.z) * 60;
    if (world.storyLock || world.missions.state.phase !== 'playing') continue;
    const group = eligible(); if (group.length) escortTicks++;
    const far = group.filter(e => Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) > 10);
    if (waitingIntent && speed <= .2 && far.length) {
      waitTicks++; if (far.length === 1) soleWaitTicks++;
      waits.push({ tick: world.tick, phase, ids: far.map(e => e.id), player: { ...player.transform } });
    }
    if (world.tick % 30 || speed <= .2) continue;
    const row = [];
    for (const e of group) {
      if (!e.motion) continue;
      const distance = Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z);
      if (!isWalkingSample(e.motion.speed, speed, distance > 6, e.civilian.knockedUntil > world.tick)) continue;
      const key = `${phase}/${e.id}`, values = paces.get(key) ?? []; values.push(e.motion.speed); paces.set(key, values);
      row.push({ id: e.id, key: e.civilian.survivor.key, slot: e.civilian.survivor.slot, speed: e.motion.speed,
        distance, inCombat: followerInCombat(world, e), brisk: e.civilian.survivor.briskAt === world.tick,
        at: { ...e.transform }, command: commands.get(e.id) ?? null });
    }
    samples.push({ tick: world.tick, phase, player: { ...player.transform }, playerSpeed: speed, followers: row });
  }
  hash = stateHash(world.getState());
} finally { world.dispose(); }
const control = JSON.parse(gunzipSync(readFileSync(`docs/reports/sweep-g/G-13-L5-${tier}-complete.json.gz`)));
const summaries = [...paces].map(([key, values]) => ({ phase: key.slice(0, key.lastIndexOf('/')), id: Number(key.slice(key.lastIndexOf('/') + 1)), samples: values.length, median: median(values) }));
const result = { ...identity, tier, method: 'Same loadLevel/LevelFiveBot/sample/applyInput/update loop and1200s budget as the canonical runner. Read-only command/pose samples and exact existing bot.lag wait-branch intent; >10m live human followers only. Corgi excluded. Whole final state compared with canonical acceptance receipt.',
  completed: bot.finished, hash, controlHash: control.nativeStateHash, identical: hash === control.nativeStateHash,
  escortTicks, waitTicks, soleWaitTicks, waitPercent: escortTicks ? waitTicks / escortTicks * 100 : null, summaries, waits, samples };
const data = gzipSync(JSON.stringify(result)), path = `docs/reports/sweep-g/G-13-L5-${tier}-trace.json.gz`; writeFileSync(path, data);
console.log(JSON.stringify({ path, sha256: createHash('sha256').update(data).digest('hex'), completed: result.completed, identical: result.identical,
  escortTicks, waitTicks, soleWaitTicks, waitPercent: result.waitPercent, summaries }));
process.exitCode = result.identical ? 0 : 1;
