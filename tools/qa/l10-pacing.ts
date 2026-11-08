/** Native production-input route audit for L10 pacing and completion. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { emptyInput } from '../../src/input/InputFrame';
import { LevelTenBot } from '../../src/debug/bot/LevelTenBot';
import { cure } from '../../src/levels/L10/district';
import { loadLevel } from '../sim-runner/levels';
import { followTenFrustum } from '../sim-runner/l10';

const output = process.argv.find((arg, i) => process.argv[i - 1] === '--out') ?? 'test-results/l10-pacing/report.json';
const seed = Number(process.env.L10_PACING_SEED ?? 42);
const maxSeconds = Number(process.env.L10_PACING_MAX_SECONDS ?? 3600);
const tiers = (process.env.L10_PACING_TIERS ?? 'low,high').split(',') as ('low' | 'high')[];
const results: Record<string, unknown>[] = [];
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

for (const quality of tiers) {
  const world = await loadLevel('L10', seed, undefined, 0, { quality });
  const mission = world.missions!, bot = new LevelTenBot(world), beats: Record<string, unknown>[] = [], checkpoints: Record<string, unknown>[] = [];
  const seenVignettes = new Set<string>(), knownInfected = new Set<number>();
  let deaths = 0, fights = 0, finds = 0, scares = 0, megaMoments = 0, fightUntil = 0, lastMegaBand = 0, routeMetres = 0;
  let previousPosition = { ...world.entities.get(1)!.transform };
  const addBeat = (kind: string, detail: string, position = world.entities.get(1)!.transform) => {
    beats.push({ tick: world.tick, seconds: world.tick / 60, distance: Number(routeMetres.toFixed(1)), kind, detail, x: Number(position.x.toFixed(1)), z: Number(position.z.toFixed(1)) });
  };
  const off: (() => void)[] = [
    world.events.on('player.died', () => { deaths++; }),
    world.events.on('dialogue.line', e => { if (e.type === 'dialogue.line') addBeat('radio', e.id); }),
    world.events.on('objective.completed', e => { if (e.type === 'objective.completed') addBeat('objective', e.id); }),
    world.events.on('checkpoint.set', e => { if (e.type === 'checkpoint.set') { const p = world.entities.get(1)!.transform; checkpoints.push({ id: e.id, tick: world.tick, seconds: world.tick / 60, routeMetres, x: p.x, z: p.z }); addBeat('checkpoint', e.id); } }),
    world.events.on('pickup.collected', e => { if (e.type === 'pickup.collected' && 'actionId' in e) { finds++; addBeat('find', e.actionId); } }),
    world.events.on('combat.hit', e => {
      if (e.type !== 'combat.hit' || e.sourceId !== 1) return;
      const target = world.entities.get(e.targetId);
      if (!target?.infected) return;
      if (world.tick > fightUntil) { fights++; addBeat('fight', e.actionId); }
      fightUntil = world.tick + 20 * 60;
    }),
    world.events.on('entity.spawned', e => {
      if (e.type !== 'entity.spawned' || knownInfected.has(e.id)) return;
      knownInfected.add(e.id);
      const entity = world.entities.get(e.id), player = world.entities.get(1);
      if (entity?.infected && player && distance(entity.transform, player.transform) <= 24) { scares++; addBeat('scare', entity.archetype, entity.transform); }
    }),
  ];
  const vignettes = world.districts?.districts.find(d => d.id === 'D-CURE')?.decay.placements.filter(p => p.id.startsWith('decor-cure-vignette-')) ?? [];
  const megaBands = [80, 35, 15];
  let outcome: string = 'tick-budget', activeAtEnd: string | null = null;
  try {
    for (let tick = 0; tick < maxSeconds * 60; tick++) {
      if (mission.state.phase === 'result' || mission.state.phase === 'progression') { outcome = 'complete'; break; }
      if (mission.state.phase === 'retry') { mission.restore(); continue; }
      const player = world.entities.get(1)!, active = mission.def.steps.find(s => mission.state.steps[s.id].status === 'active');
      activeAtEnd = active?.id ?? null;
      if (!active || player.health.current <= 0) { world.applyInput(emptyInput(), 'keyboard'); world.update(); continue; }
      followTenFrustum(world);
      const frame = bot.sample(); world.applyInput(frame, 'keyboard'); world.update();
      const p = world.entities.get(1)!.transform;
      const stepMetres = distance(p, previousPosition);
      if (stepMetres < 8) routeMetres += stepMetres;
      previousPosition = { ...p };
      if (tick % 30 === 0) for (const scene of vignettes) {
        const at = { x: scene.position[0], z: scene.position[2] };
        if (seenVignettes.has(scene.id) || distance(at, p) > 30 || !world.infected!.director.inPlayerView({ ...at, y: p.y }, 24, 1, 2)) continue;
        seenVignettes.add(scene.id); addBeat('vignette', scene.id, { ...p, ...at });
      }
      const mega = world.megaPursuit?.entity();
      if (mega && mega.health.current > 0) {
        const d = distance(mega.transform, p), band = megaBands.findIndex(limit => d <= limit);
        if (band >= 0 && band > lastMegaBand) { lastMegaBand = band; megaMoments++; addBeat('Mega', `close-call-${megaBands[band]}m`); }
      }
    }
    if (mission.state.phase === 'result' || mission.state.phase === 'progression') outcome = 'complete';
  } finally { off.forEach(stop => stop()); world.dispose(); }
  const gaps = beats.slice(1).map((beat, i) => ({ seconds: Number((Number(beat.seconds) - Number(beats[i].seconds)).toFixed(2)), from: beats[i], to: beat }));
  const longestGap = gaps.reduce<{ seconds: number; from: Record<string, unknown> | null; to: Record<string, unknown> | null }>((best, gap) => gap.seconds > best.seconds ? gap : best, { seconds: 0, from: null, to: null });
  const routeDistances = cure.regions.flatMap((r, i) => i ? r.route.slice(1) : r.route).slice(1).reduce((acc, p, i, points) => acc + Math.hypot(p[0] - (i ? points[i - 1][0] : cure.regions[0].route[0][0]), p[1] - (i ? points[i - 1][1] : cure.regions[0].route[0][1])), 0);
  const checkpointGaps = checkpoints.slice(1).map((cp, i) => {
    const from = checkpoints[i] as { id: string; x: number; z: number; routeMetres: number };
    const to = cp as { id: string; x: number; z: number; routeMetres: number };
    return { metres: Number(distance(from, to).toFixed(1)), travelledMetres: Number((to.routeMetres - from.routeMetres).toFixed(1)), from: from.id, to: to.id };
  });
  const firstRouteCheckpoint = checkpoints.find(cp => (cp as { id: string }).id !== 'cure-crash') as { seconds: number } | undefined;
  results.push({ quality, seed, outcome, completed: outcome === 'complete', seconds: world.tick / 60, deaths, fights, finds, scares, megaMoments, routeMetresTravelled: routeMetres, canonicalRouteMetres: routeDistances, checkpoints, checkpointGaps, maxCheckpointGapM: Math.max(0, ...checkpointGaps.map(g => g.metres)), timeToFirstCheckpoint: firstRouteCheckpoint?.seconds ?? null, beats, longestBeatGapSeconds: longestGap.seconds, longestGap, activeAtEnd, limits: { beatGapSeconds: 40, checkpointGapMetres: 250, firstCheckpointSeconds: 60 } });
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), seed, tiers, results }, null, 2));
console.log(JSON.stringify(results.map(r => ({ quality: r.quality, outcome: r.outcome, seconds: r.seconds, deaths: r.deaths, fights: r.fights, finds: r.finds, scares: r.scares, megaMoments: r.megaMoments, timeToFirstCheckpoint: r.timeToFirstCheckpoint, longestBeatGapSeconds: r.longestBeatGapSeconds, maxCheckpointGapM: r.maxCheckpointGapM })), null, 2));
