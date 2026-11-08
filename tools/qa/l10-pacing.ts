/** Native production-input route audit for L10 pacing and completion. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { emptyInput } from '../../src/input/InputFrame';
import { LevelTenBot } from '../../src/debug/bot/LevelTenBot';
import { cure } from '../../src/levels/L10/district';
import { loadLevel } from '../sim-runner/levels';
import { followTenFrustum } from '../sim-runner/l10';
import { execFileSync } from 'node:child_process';
import { cornBlocksSight } from '../../src/levels/L10/farm';
import { createHash } from 'node:crypto';
import { markerAnchor } from '../../src/sim/missions/markerAnchor';
import { AcceptanceObserver } from './accept/observer';
import { ThreatObserver } from './threat/observer';
import { cureEscapeGaps, insideCureHangar } from '../../src/data/l10Story';

const output = process.argv.find((arg, i) => process.argv[i - 1] === '--out') ?? 'test-results/l10-pacing/report.json';
const seed = Number(process.env.L10_PACING_SEED ?? 42);
const maxSeconds = Number(process.env.L10_PACING_MAX_SECONDS ?? 3600);
const tiers = (process.env.L10_PACING_TIERS ?? 'low,high').split(',') as ('low' | 'high')[];
const results: Record<string, unknown>[] = [];
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
let revision = process.env.L10_PACING_REVISION ?? 'runner-manifest';
try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch { /* Runner workspaces use a manifest-only index. */ }
const hash = createHash('sha256');
for (const path of execFileSync('git', ['ls-files', 'src', 'layouts/D-CURE', 'tools/qa/l10-pacing.ts', 'public/assets/layouts/D-CURE.layout.json', 'public/assets/layouts/D-CURE.chunks/manifest.json'], { encoding: 'utf8' }).trim().split('\n').sort()) hash.update(path).update(readFileSync(path));
const sourceHash = hash.digest('hex');

for (const quality of tiers) {
  const world = await loadLevel('L10', seed, undefined, 0, { quality });
  const acceptance = process.env.L10_PACING_ACCEPTANCE === '1' ? new AcceptanceObserver(world) : null;
  const threat = process.env.L10_PACING_ACCEPTANCE === '1' ? new ThreatObserver(world, 'L10') : null;
  const mission = world.missions!, bot = new LevelTenBot(world, process.env.L10_PACING_PROFILE ?? 'complete'), beats: Record<string, unknown>[] = [], checkpoints: Record<string, unknown>[] = [];
  const gapCrossings: { index: number; seconds: number; x: number; z: number; megaDistance: number; maxSeparation20s: number }[] = [];
  const megaActions: Record<string, unknown>[] = [], hangarVisits: Record<string, unknown>[] = [];
  const seenVignettes = new Set<string>(), knownInfected = new Set<number>(), trace: Record<string, unknown>[] = [];
  let deaths = 0, fights = 0, finds = 0, scares = 0, megaMoments = 0, fightUntil = 0, lastCombatBeat = -1200, lastMegaBand = -1, routeMetres = 0, lastEncounterBeat = -600;
  let gameplayEnd = 0, peakOpeningRegulars = 0, peakOpeningDogs = 0, peakOpeningAlphas = 0, arenaMetres = 0;
  let previousPosition = { ...world.entities.get(1)!.transform };
  const addBeat = (kind: string, detail: string, position = world.entities.get(1)!.transform) => {
    const player = world.entities.get(1)!.transform;
    beats.push({ tick: world.tick, seconds: world.tick / 60, distance: Number(routeMetres.toFixed(1)), kind, detail, x: Number(player.x.toFixed(1)), z: Number(player.z.toFixed(1)), subject: { x: position.x, z: position.z } });
  };
  checkpoints.push({ id: mission.state.checkpoint, tick: world.tick, seconds: world.tick / 60, routeMetres: 0, x: previousPosition.x, z: previousPosition.z });
  const off: (() => void)[] = [
    world.events.on('player.died', () => { deaths++; const p = world.entities.get(1)!; trace.push({ event: 'death', seconds: world.tick / 60, x: p.transform.x, z: p.transform.z, checkpoint: mission.state.checkpoint }); }),
    world.events.on('dialogue.line', e => { if (e.type === 'dialogue.line') addBeat('radio', e.id); }),
    world.events.on('objective.completed', e => { if (e.type === 'objective.completed') addBeat('objective', e.id); }),
    world.events.on('checkpoint.set', e => { if (e.type === 'checkpoint.set') { const p = world.entities.get(1)!.transform; checkpoints.push({ id: e.id, tick: world.tick, seconds: world.tick / 60, routeMetres, x: p.x, z: p.z }); addBeat('checkpoint', e.id); } }),
    world.events.on('checkpoint.restored', e => { if (e.type === 'checkpoint.restored') { const p = world.entities.get(1)!.transform; checkpoints.push({ id: e.id, restored: true, tick: world.tick, seconds: world.tick / 60, routeMetres, x: p.x, z: p.z }); } }),
    world.events.on('pickup.collected', e => { if (e.type === 'pickup.collected' && 'actionId' in e) { if (e.pickupId) finds++; addBeat(e.pickupId ? 'find' : 'handover', e.actionId); } }),
    world.events.on('combat.hit', e => {
      if (e.type !== 'combat.hit' || e.sourceId !== 1) return;
      const target = world.entities.get(e.targetId);
      if (!target?.infected) return;
      if (world.tick > fightUntil) fights++;
      if (world.tick - lastCombatBeat >= 1200) { addBeat('fight', e.actionId); lastCombatBeat = world.tick; }
      fightUntil = world.tick + 20 * 60;
    }),
    world.events.on('music.stinger', e => { if (e.type === 'music.stinger' && e.kind === 'scare') { scares++; addBeat('scare', 'corn-emergence'); } }),
    world.events.on('infected.special', e => { if (e.type === 'infected.special' && e.sourceId === world.megaPursuit?.state.id) megaActions.push({ seconds: world.tick / 60, ...e }); }),
  ];
  const vignettes = world.districts?.districts.find(d => d.id === 'D-CURE')?.decay.placements.filter(p => p.id.startsWith('decor-cure-vignette-')) ?? [];
  const megaBands = [80, 35, 15];
  let outcome: string = 'tick-budget', activeAtEnd: string | null = null, elapsedSeconds = 0, observation: unknown, threatObservation: unknown;
  try {
    for (let tick = 0; tick < maxSeconds * 60; tick++) {
      if (mission.state.phase === 'result' || mission.state.phase === 'progression') { outcome = 'complete'; break; }
      if (mission.state.phase === 'retry') { mission.restore(); continue; }
      const player = world.entities.get(1)!, active = mission.def.steps.find(s => mission.state.steps[s.id].status === 'active');
      activeAtEnd = active?.id ?? null;
      if (!active || player.health.current <= 0) { world.applyInput(emptyInput(), 'keyboard'); world.update(); continue; }
      followTenFrustum(world);
      const travelling = !mission.state.states['cure-installed'];
      const frame = bot.sample(); world.applyInput(frame, 'keyboard'); world.update();
      const p = world.entities.get(1)!.transform;
      const separation = world.megaPursuit?.distance() ?? Infinity;
      for (const [index, gap] of cureEscapeGaps.entries()) if (!gapCrossings.some(row => row.index === index) && Math.hypot(p.x - gap.x, p.z - gap.z) < 2) gapCrossings.push({ index, seconds: world.tick / 60, x: p.x, z: p.z, megaDistance: separation, maxSeparation20s: separation });
      for (const row of gapCrossings) if (world.tick / 60 - row.seconds <= 20 && Number.isFinite(separation)) row.maxSeparation20s = Math.max(row.maxSeparation20s, separation);
      if (insideCureHangar(p) && tick % 600 === 0) hangarVisits.push({ seconds: world.tick / 60, x: p.x, z: p.z, cast: Object.entries(mission.state.actors).filter(([key]) => key.startsWith('hangar-')).map(([key,id]) => ({ key, id, hp: world.entities.get(id)?.health.current })), infectedInside: world.infected!.active.filter(e=>e.health.current>0&&insideCureHangar(e.transform)).map(e=>e.id) });
      const stepMetres = distance(p, previousPosition);
      // The route ends at installation. Mounted-gun pose corrections and arena
      // combat loops do not add kilometres to the checkpoint walking route.
      if (stepMetres < 8) { if (travelling) routeMetres += stepMetres; else arenaMetres += stepMetres; }
      previousPosition = { ...p };
      if (!mission.state.states['cure-released']) gameplayEnd = world.tick / 60;
      if (world.tick <= 3600) {
        const living = world.infected!.active.filter(e => e.health.current > 0 && !e.infected?.pursuit);
        peakOpeningRegulars = Math.max(peakOpeningRegulars, living.filter(e => e.archetype !== 'infected.dog' && e.archetype !== 'infected.alpha').length);
        peakOpeningDogs = Math.max(peakOpeningDogs, living.filter(e => e.archetype === 'infected.dog').length);
        peakOpeningAlphas = Math.max(peakOpeningAlphas, living.filter(e => e.archetype === 'infected.alpha').length);
      }
      if (tick % 600 === 0) {
        const mega = world.megaPursuit?.entity();
        trace.push({ seconds: world.tick / 60, x: p.x, z: p.z, y: p.y, hp: world.entities.get(1)!.health.current, active: active.id, move: frame.move, waypoint: Reflect.get(bot, 'waypoint'), marker: markerAnchor(mission), checkpoint: mission.state.checkpoint, charge: mission.state.counters['charge-ticks'], rack: world.entities.get(1)!.weapons?.RIGHT.rack.map(s => s.id), mega: mega ? { id: mega.id, x: mega.transform.x, z: mega.transform.z, hp: mega.health.current, distance: distance(p, mega.transform), state: mega.infected?.state } : null });
      }
      if (tick % 3600 === 0) console.log(`[l10-pacing] ${quality} ${Math.round(world.tick / 60)}s ${active.id} (${p.x.toFixed(1)},${p.z.toFixed(1)}) finds=${finds} deaths=${deaths}`);
      if (tick % 30 === 0) for (const scene of vignettes) {
        const at = { x: scene.position[0], z: scene.position[2] };
        const sceneId = scene.id.replace(/-\d+$/, '');
        if (seenVignettes.has(sceneId) || distance(at, p) > 30 || !world.infected!.director.inPlayerView({ ...at, y: p.y }, 24, 1, 2) || cornBlocksSight(world, [p.x, p.z], [at.x, at.z])) continue;
        seenVignettes.add(sceneId); addBeat('vignette', sceneId, { ...p, ...at });
      }
      if (tick % 30 === 0) for (const enemy of world.infected!.active) {
        if (enemy.infected?.pursuit || knownInfected.has(enemy.id) || enemy.health.current <= 0 || enemy.hidden || enemy.infected?.hidden || distance(enemy.transform, p) > 30 || !world.infected!.director.inPlayerView(enemy.transform, 30, 1, 2) || cornBlocksSight(world, [p.x, p.z], [enemy.transform.x, enemy.transform.z])) continue;
        knownInfected.add(enemy.id);
        if (world.tick - lastEncounterBeat >= 600) { addBeat('encounter', enemy.archetype, enemy.transform); lastEncounterBeat = world.tick; }
      }
      const mega = world.megaPursuit?.entity();
      if (mega && mega.health.current > 0) {
        const d = distance(mega.transform, p), band = d <= 15 ? 2 : d <= 35 ? 1 : d <= 80 ? 0 : -1;
        if (band >= 0 && band > lastMegaBand && !mega.hidden && !mega.infected?.hidden && world.infected!.director.inPlayerView(mega.transform, 30, 1, 0)) { lastMegaBand = band; megaMoments++; addBeat('Mega', `close-call-${megaBands[band]}m`, mega.transform); }
        // A real fence escape can separate the actors by 50–70 m. Require
        // that recovery before counting its later return as a new encounter.
        if (d > 50) lastMegaBand = -1;
      }
    }
    if (mission.state.phase === 'result' || mission.state.phase === 'progression') outcome = 'complete';
  } finally { elapsedSeconds = world.tick / 60; observation = acceptance?.finish(); threatObservation = threat?.finish(); off.forEach(stop => stop()); world.dispose(); }
  // Recovery points and objective bookkeeping do not count as authored content.
  const gameplayBeats = [{ seconds: 0, kind: 'start' }, ...beats.filter(b => Number(b.seconds) <= gameplayEnd && !['checkpoint','objective'].includes(String(b.kind))), { seconds: gameplayEnd, kind: 'gameplay-end' }];
  const gaps = gameplayBeats.slice(1).map((beat, i) => ({ seconds: Number((Number(beat.seconds) - Number(gameplayBeats[i].seconds)).toFixed(2)), from: gameplayBeats[i], to: beat }));
  const longestGap = gaps.reduce<{ seconds: number; from: Record<string, unknown> | null; to: Record<string, unknown> | null }>((best, gap) => gap.seconds > best.seconds ? gap : best, { seconds: 0, from: null, to: null });
  const routeDistances = cure.regions.flatMap((r, i) => i ? r.route.slice(1) : r.route).slice(1).reduce((acc, p, i, points) => acc + Math.hypot(p[0] - (i ? points[i - 1][0] : cure.regions[0].route[0][0]), p[1] - (i ? points[i - 1][1] : cure.regions[0].route[0][1])), 0);
  const checkpointGaps = checkpoints.slice(1).map((cp, i) => {
    const from = checkpoints[i] as { id: string; x: number; z: number; routeMetres: number };
    const to = cp as { id: string; x: number; z: number; routeMetres: number };
    return { metres: Number((to.routeMetres - from.routeMetres).toFixed(1)), directMetres: Number(distance(from, to).toFixed(1)), from: from.id, to: to.id };
  });
  const firstRouteCheckpoint = checkpoints.find(cp => (cp as { id: string }).id !== 'cure-crash') as { seconds: number } | undefined;
  results.push({ quality, seed, profile: process.env.L10_PACING_PROFILE ?? 'complete', outcome, completed: outcome === 'complete', seconds: elapsedSeconds, gameplaySeconds: gameplayEnd, deaths, fights, finds, scares, megaMoments, gapCrossings, megaActions, hangarVisits, observation, threat: threatObservation, opening: { peakRegulars: peakOpeningRegulars, peakDogs: peakOpeningDogs, peakAlphas: peakOpeningAlphas }, trace, routeMetresTravelled: routeMetres, arenaMetres, canonicalRouteMetres: routeDistances, checkpoints, checkpointGaps, maxCheckpointGapM: Math.max(0, ...checkpointGaps.map(g => g.metres)), timeToFirstCheckpoint: firstRouteCheckpoint?.seconds ?? null, beats, longestBeatGapSeconds: longestGap.seconds, longestGap, activeAtEnd, limits: { beatGapSeconds: 40, checkpointGapMetres: 250, firstCheckpointSeconds: 60 } });
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), revision, sourceHash, seed, tiers, results }, null, 2));
console.log(JSON.stringify(results.map(r => ({ quality: r.quality, outcome: r.outcome, seconds: r.seconds, deaths: r.deaths, fights: r.fights, finds: r.finds, scares: r.scares, megaMoments: r.megaMoments, timeToFirstCheckpoint: r.timeToFirstCheckpoint, longestBeatGapSeconds: r.longestBeatGapSeconds, maxCheckpointGapM: r.maxCheckpointGapM })), null, 2));
if (process.env.L10_PACING_ENFORCE === '1' && results.some(r => !r.completed || r.finds !== 6 || Number(r.longestBeatGapSeconds) > 40 || Number(r.maxCheckpointGapM) > 250 || r.timeToFirstCheckpoint === null || Number(r.timeToFirstCheckpoint) > 60)) process.exitCode = 1;
