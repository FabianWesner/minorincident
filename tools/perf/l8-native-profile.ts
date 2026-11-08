/** Full L8 route/density matrix. Native timings are diagnostics, never render-FPS evidence. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { loadavg } from 'node:os';
import { parseArgs } from 'node:util';
import { Session } from 'node:inspector/promises';
import { LevelEightBot } from '../../src/debug/bot/LevelEightBot';
import { loadLevel, runLevel } from '../sim-runner/levels';
import { followFrustum } from '../sim-runner/l3Bots';
import { preset, type CampaignSave } from '../../src/sim/progression/Campaign';
import { cloneData } from '../../src/core/clone';

const { values } = parseArgs({ options: {
  out: { type: 'string', default: 'docs/reports/r12-l8perf/native/summary.json' },
  label: { type: 'string', default: 'candidate' }, tier: { type: 'string', default: 'both' },
  campaign: { type: 'string' }, policy: { type: 'string', default: 'complete' }, profile: { type: 'boolean' },
} });
if (!['low', 'high', 'both'].includes(values.tier!) || !['complete', 'hold'].includes(values.policy!)) throw new Error('Invalid tier/policy');
const out = values.out!;
await mkdir(dirname(out), { recursive: true });
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
let campaign: CampaignSave;
try { if (!values.campaign) throw new Error('Generate campaign'); campaign = await readJson(values.campaign) as CampaignSave; }
catch {
  campaign = preset('L8-default');
  const handover = await runLevel('L7', 'complete', 1, 1200, undefined, campaign, (_world, result) => {
    campaign.results ??= {}; campaign.results.L7 = structuredClone(result);
  });
  const survivors = campaign.results?.L7?.escapedSurvivors;
  if (!handover.completed || !survivors?.length) throw new Error('Could not produce seeded L7 handover');
  const templates = cloneData(survivors);
  for (let i = survivors.length; i < 50; i++) {
    const carried = cloneData(templates[i % templates.length]); carried.id = 10000 + i;
    if (carried.civilian?.survivor) carried.civilian.survivor.slot = i;
    survivors.push(carried);
  }
  if (values.campaign) await writeFile(values.campaign, JSON.stringify(campaign));
}
const files = ['lighting/LightPower.ts', 'missions/LevelEightZoo.ts', 'npc/Npcs.ts', 'outbreak/humans.ts', 'ai/CharacterSeparation.ts'];
const sourceHash = createHash('sha256');
for (const file of files) sourceHash.update(file).update(process.env.L8_REFERENCE_REV
  ? execFileSync('git', ['show', `${process.env.L8_REFERENCE_REV}:src/sim/${file}`]) : await readFile(`src/sim/${file}`));
const percentile = (values: number[]) => {
  const a = values.slice().sort((x, y) => x - y);
  return { samples: a.length, p50: a[Math.floor(a.length * .5)] ?? 0, p95: a[Math.ceil(a.length * .95) - 1] ?? 0, max: a.at(-1) ?? 0 };
};
const results = [];
for (const tier of values.tier === 'both' ? ['low', 'high'] as const : [values.tier as 'low' | 'high']) {
  campaign.settings.quality = tier;
  const world = await loadLevel('L8', 1, cloneData(campaign), 0, { quality: tier });
  const inspector = values.profile ? new Session() : undefined;
  try {
    const bot = new LevelEightBot(world, 'complete');
    if (values.policy === 'hold') world.combat!.damage.god = true;
    const costs = new Map<string, number[]>(), totals = new Map<string, number>(), calls = new Map<string, number>();
    const wrap = (owner: object | undefined | null, method: string, label: string) => {
      if (!owner) return;
      const target = owner as Record<string, (...args: never[]) => unknown>, original = target[method];
      if (typeof original !== 'function') return;
      costs.set(label, []); totals.set(label, 0); calls.set(label, 0);
      target[method] = function (...args: never[]) {
        const start = performance.now();
        try { return original.apply(this, args); }
        finally { totals.set(label, totals.get(label)! + performance.now() - start); calls.set(label, calls.get(label)! + 1); }
      };
    };
    wrap(world.infected, 'update', 'ai'); wrap(world.npcs, 'update', 'npcs');
    wrap(world.physics, 'update', 'physics'); wrap(world.combat, 'update', 'combat');
    wrap(world.solids, 'commit', 'contactCommit'); wrap(world.vehicles, 'update', 'vehicles');
    wrap(world.npcs!.civilians.outbreak, 'update', 'outbreak');
    wrap(world.missions!.l8, 'update', 'zooMission'); wrap(world.missions!.l8, 'follower', 'zooFollowers');
    wrap(world.npcs, 'move', 'npcNavigation'); wrap(world.infected!.nav, 'path', 'pathfinding');
    const wallTicks: number[] = [], cpuTicks: number[] = [], windows: object[] = [];
    let windowStarted = performance.now(), windowTick = world.tick, peakInfected = 0;
    let profiling = false; let cpuProfile: unknown;
    if (inspector) { inspector.connect(); await inspector.post('Profiler.enable'); await inspector.post('Profiler.setSamplingInterval', { interval: 500 }); }
    const capture = () => {
      if (!wallTicks.length) return;
      const now = performance.now(), entities = [...world.entities.iterate()];
      const systems = Object.fromEntries([...costs].map(([name, a]) => [name, { ...percentile(a), calls: calls.get(name) }]));
      const humans = world.infected!.hearing.humans, snapshot = humans.all().slice();
      let humanQueryChecks = 0;
      for (const infected of world.infected!.active) if (infected.health.current > 0) {
        const p = infected.transform;
        const expected = snapshot.filter(h => humans.get(h.id) && (h.position.x - p.x) ** 2 + (h.position.z - p.z) ** 2 <= 256).map(h => h.id).sort((a, b) => a - b);
        const actual = humans.within(p, 16).map(h => h.id);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Human query mismatch at ${world.tick}/${infected.id}`);
        humanQueryChecks++;
      }
      const digest = createHash('sha256').update(JSON.stringify(entities)).update(JSON.stringify(world.missions!.state)).digest('hex');
      windows.push({ tick: world.tick, simSeconds: world.tick / 60, wallSeconds: (now - windowStarted) / 1000,
        nativeSimSecondsPerWallSecond: (world.tick - windowTick) / 60 / ((now - windowStarted) / 1000),
        tickWallMs: percentile(wallTicks), tickCpuMs: percentile(cpuTicks), systems, entities: entities.length,
        livingInfected: world.infected!.director.count, peakInfected, corpses: entities.filter(e => !!e.corpse).length,
        downed: entities.filter(e => e.civilian?.state === 'down' || e.civilian?.state === 'rising' || (e.infected && e.health.current <= 0 && !e.corpse)).length,
        followers: world.missions!.l8!.roster().length, animals: entities.filter(e => e.civilian?.zooAnimal || /infected\.(elephant|gorilla|lion|zebra|flamingo)$/.test(e.archetype)).length,
        heapBytes: process.memoryUsage().heapUsed, listeners: world.events.listenerCount, stateHash: digest, humanQueryChecks,
        player: { x: world.entities.get(1)!.transform.x, z: world.entities.get(1)!.transform.z },
        checkpoint: world.missions!.state.checkpoint, phase: world.missions!.state.phase,
        objectives: world.missions!.def.steps.filter(s => world.missions!.state.steps[s.id]?.status === 'active').map(s => s.id), load: loadavg() });
      wallTicks.length = cpuTicks.length = 0; for (const [name, a] of costs) { a.length = 0; calls.set(name, 0); }
      windowStarted = performance.now(); windowTick = world.tick; peakInfected = 0;
      const last = windows.at(-1) as { tick: number; tickCpuMs: { p95: number }; tickWallMs: { p95: number } };
      console.log(JSON.stringify({ tier, policy: values.policy, tick: last.tick, wallP95: last.tickWallMs.p95, cpuP95: last.tickCpuMs.p95 }));
    };
    const limit = values.policy === 'hold' ? 9051 : 1200 * 60;
    while (world.tick < limit && world.missions!.state.phase === 'playing') {
      followFrustum(world, 1.5);
      const frame = bot.sample();
      if (values.policy === 'hold' && world.tick >= 3600) {
        if (world.tick === 3600) {
          const p = world.entities.get(1)!; Object.assign(p.transform, { x: 27.14, z: 58.57 });
          world.physics.playerBody!.setTranslation(p.transform, true); world.spatial.set(1, p.transform.x, p.transform.z);
        }
        frame.move = { x: 0, z: 0 }; frame.interact = false;
      }
      world.applyInput(frame, 'keyboard'); for (const name of totals.keys()) totals.set(name, 0);
      if (inspector && world.tick === 5602) { await inspector.post('Profiler.start'); profiling = true; }
      const cpu = process.cpuUsage(), start = performance.now(), before = world.tick;
      world.update(); const elapsed = performance.now() - start, used = process.cpuUsage(cpu);
      if (world.tick === before) break;
      wallTicks.push(elapsed); cpuTicks.push((used.user + used.system) / 1000);
      for (const [name, total] of totals) costs.get(name)!.push(total);
      peakInfected = Math.max(peakInfected, world.infected!.director.count);
      if (inspector && profiling && world.tick === 5722) {
        const { profile } = await inspector.post('Profiler.stop'); profiling = false;
        const nodes = new Map(profile.nodes.map(n => [n.id, n.callFrame]));
        const self = new Map<string, number>();
        profile.samples?.forEach((id, i) => { const f = nodes.get(id)!; const key = `${f.url.split('/').slice(-3).join('/')}:${f.functionName}`; self.set(key, (self.get(key) ?? 0) + (profile.timeDeltas?.[i] ?? 0) / 1000); });
        cpuProfile = [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([functionName, selfMs]) => ({ functionName, selfMs }));
      }
      if (world.tick % 3600 === 0 || [5602, 5722, 8931, 9051].includes(world.tick)) capture();
    }
    capture();
    results.push({ tier, seed: 1, policy: values.policy, initialSurvivors: campaign.results!.L7!.escapedSurvivors!.length,
      complete: world.missions!.state.phase === 'progression', tick: world.tick, windows, cpuProfile });
  } finally { if (inspector) inspector.disconnect(); world.dispose(); }
}
let prior: Record<string, unknown>;
try { const old = await readJson(out); prior = Array.isArray(old) ? { preRestart: old } : old as Record<string, unknown>; }
catch { prior = {}; }
prior[values.label!] = { at: new Date().toISOString(), sourceHash: sourceHash.digest('hex'), referenceRevision: process.env.L8_REFERENCE_REV ?? null, node: process.version, instrumented: true, cpuProfiled: !!values.profile, results };
await writeFile(out, JSON.stringify(prior, null, 2));
