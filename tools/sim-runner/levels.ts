import { LevelThreeBot, type LevelThreeRoute } from '../../src/debug/bot/LevelThreeBot';
import { LevelTwoBot } from '../../src/debug/bot/LevelTwoBot';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { readFileSync } from 'node:fs';
import { Rng } from '../../src/core/Rng';
import { emptyInput, type InputFrame } from '../../src/input/InputFrame';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission, type MissionId } from '../../src/levels/missions';
import type { Trigger } from '../../src/sim/missions/types';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { runL1, Walker } from './l1Bots';

export type CompletionPolicy = 'complete' | 'newbie';
/** Same contract for individual levels and the fast completion battery. Times are simulation seconds. */
export interface LevelReport {
  level: MissionId; policy: CompletionPolicy; seed: number; completed: boolean;
  timerRemaining?: number; runovers?: number; smashed?: number; maxConcurrentInfected?: number;
  time: number; deaths: number; kills: number; damageTaken: number;
  failures: Record<string, number>; objectiveTimeline: { id: string; t: number }[];
  furthestObjective: string | null; activeObjectives: string[];
  outcome: 'complete' | 'stalled' | 'tick-budget' | 'load-error' | 'mission-failed';
  blocker: null | { objective: string | null; detail: string; player?: { x: number; z: number }; distance?: number; actors?: Record<string, { x: number; z: number; hp: number; state?: string; driver?: number | null; speed?: number; yaw?: number }> };
}
export async function loadLevel(level: MissionId, seed: number): Promise<SimWorld> {
  const world = new SimWorld();
  try {
    await world.init(); const composition = compositions[level];
    world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed);
    if (level === 'L3') applyCampaign(world, preset('L3-default'));
    if (level === 'L2') applyCampaign(world, preset('L2-default'));
    world.loadMission(resolveCampaignMission(level, world.districts!)).begin();
    return world;
  } catch (error) { world.dispose(); throw error; }
}
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
function findDrive(t: Trigger): Extract<Trigger, { kind: 'drive' }> | undefined {
  if (t.kind === 'drive') return t;
  if (t.kind === 'all' || t.kind === 'any') return t.triggers.map(findDrive).find(Boolean);
}
/** Inputs and ordinary Begin/Retry/Skip menu actions only; no teleport, loadout injection or cheats. */
export async function runLevel(level: MissionId, policy: CompletionPolicy, seed: number, maxSeconds = 1200, forcedRoute: LevelThreeRoute = 'market'): Promise<LevelReport> {
  const report: LevelReport = { level, policy, seed, completed: false, time: 0, deaths: 0, kills: 0, damageTaken: 0, failures: {}, objectiveTimeline: [], furthestObjective: null, activeObjectives: [], outcome: 'tick-budget', blocker: null };
  let world: SimWorld;
  try { world = await loadLevel(level, seed); }
  catch (error) { report.outcome = 'load-error'; report.failures['load-error'] = 1; report.blocker = { objective: null, detail: String(error) }; return report; }
  try {
    const mission = world.missions!, walker = new Walker(), rng = new Rng(seed, `campaign-${policy}`);
    const stops = [world.events.on('mission.failed', e => { if (e.type === 'mission.failed') report.failures[e.reason] = (report.failures[e.reason] ?? 0) + 1; }), world.events.on('player.died', () => { report.failures['player-died'] = (report.failures['player-died'] ?? 0) + 1; }), world.events.on('objective.completed', e => { if (e.type === 'objective.completed') report.objectiveTimeline.push({ id: e.id, t: world.tick / 60 }); })];
    if (level === 'L1') {
      const l1 = runL1(world, mission, policy, { seed, maxSeconds });
      report.outcome = l1.outcome === 'complete' ? 'complete' : 'tick-budget';
    } else if (level === 'L2') {
      // E20: the shared L2 policy (ordinary inputs only), same as the browser bot.
      const bot = new LevelTwoBot(world, policy);
      for (let tick = 0; tick < maxSeconds * 60 && !bot.finished; tick++) { world.applyInput(bot.sample(), 'keyboard'); world.update(); }
    } else if (level === 'L3') {
      const bot = new LevelThreeBot(world, policy, forcedRoute);
      for (let tick = 0; tick < maxSeconds * 60 && !bot.finished; tick++) { world.applyInput(bot.sample(), 'keyboard'); world.update(); }
      report.timerRemaining = (mission.state.deadlineTicks ?? 0) / 60;
      report.runovers = mission.state.counters.runovers; report.smashed = mission.state.counters.smashed; report.maxConcurrentInfected = mission.state.counters['max-infected'];
    } else {
      let lastProgress = 0, bestDistance = Infinity, progress = '', frame: InputFrame = emptyInput();
      const route = { path: [] as number[], goal: -1, pathIndex: 0 }, waypoint = { x: 0, z: 0 };
      for (let tick = 0; tick < maxSeconds * 60; tick++) {
        if (mission.state.phase === 'result' || mission.state.phase === 'progression') { report.outcome = 'complete'; break; }
        if (mission.state.phase === 'retry') {
          if (Object.values(report.failures).reduce((a, b) => a + b, 0) >= 3) { report.outcome = 'mission-failed'; break; }
          mission.restore(); walker.reset(); route.path.length = 0; route.goal = -1; lastProgress = tick;
        }
        if (mission.state.phase === 'cinematic') { world.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); world.update(); continue; }
        const player = world.entities.get(1)!, step = mission.def.steps.find(s => mission.state.steps[s.id].status === 'active');
        if (player.health.current <= 0 || !step) { world.applyInput(emptyInput(), 'keyboard'); world.update(); continue; }
        report.furthestObjective = step.id;
        const state = mission.state.steps[step.id], at = mission.def.anchors[step.anchor], trigger = step.complete, drive = findDrive(trigger);
        const signature = `${mission.state.completedObjectives.length}:${step.id}:${JSON.stringify(state.holds ?? {})}:${trigger.kind === 'interact' && trigger.actor ? world.entities.get(mission.state.actors[trigger.actor])?.interactable?.progress : ''}`;
        if (signature !== progress) { progress = signature; bestDistance = distance(player.transform, at); lastProgress = tick; }
        if (distance(player.transform, at) < bestDistance - 1.5) { bestDistance = distance(player.transform, at); lastProgress = tick; }
        if (tick - lastProgress > 45 * 60) { report.outcome = 'stalled'; break; }
        if (tick % (policy === 'newbie' ? 15 : 1) === 0) {
          frame = emptyInput();
          if (world.vehicles!.active !== null) {
            const car = world.vehicles!.cars.get(world.vehicles!.active)!, p = car.entity.transform;
            if (!drive || (drive.exit && state.driveArrived)) { frame.brake = true; frame.interact = car.physics.speed < .5; }
            else {
              const nav = world.infected!.nav, radius = car.physics.def.width / 2 + .25;
              const found = nav.steer(p, at, route, radius, waypoint, Infinity, true);
              if (!found) { frame.drive = { throttle: -.6, steer: .6 }; frame.brake = car.physics.speed > 3; }
              else {
                // Look ahead along the visible route instead of steering around a half-metre cell.
                for (let i = route.pathIndex; i < route.path.length; i++) {
                  const candidate = { x: nav.x(route.path[i]), z: nav.z(route.path[i]) };
                  if (distance(p, candidate) > 8 || !nav.visible(p, candidate, radius)) break;
                  if (distance(p, candidate) >= 3) Object.assign(waypoint, candidate);
                }
                const dx = waypoint.x - p.x, dz = waypoint.z - p.z;
                const delta = Math.atan2(Math.sin(Math.atan2(-dz, dx) - p.yaw), Math.cos(Math.atan2(-dz, dx) - p.yaw));
                const reversing = Math.abs(delta) > Math.PI / 2;
                const angle = reversing ? Math.atan2(Math.sin(delta + Math.PI), Math.cos(delta + Math.PI)) : delta;
                frame.drive = { throttle: reversing ? -.6 : .65, steer: Math.max(-1, Math.min(1, Math.atan(2 * car.physics.def.wheelbase * Math.sin(angle) / Math.max(3, Math.hypot(dx, dz))) / car.physics.def.steering * (reversing ? -1 : 1))) };
                frame.brake = car.physics.speed > (Math.abs(angle) > .6 ? 3 : 7);
              }
            }
          } else if (drive) {
            const car = world.vehicles!.cars.get(mission.state.actors[drive.actor]);
            if (car && !(drive.exit && state.driveArrived)) {
              const p = car.entity.transform, z = car.physics.def.width / 2 + .55;
              const door = { x: p.x + Math.cos(p.yaw) * .2 + Math.sin(p.yaw) * z, z: p.z - Math.sin(p.yaw) * .2 + Math.cos(p.yaw) * z };
              frame.move = walker.step(world, door, .4, `enter-${car.entity.id}`) ?? frame.move;
              frame.interact = distance(player.transform, door) <= .6;
            }
          } else {
            let goal = at, stop = Math.min(1, at.radius * .5);
            if (trigger.kind === 'items') stop = .5;
            if (trigger.kind === 'escort') {
              const follower = world.entities.get(mission.state.actors[trigger.actor]);
              // Walk through the destination so the follower's 2.5 m stop distance fits inside the ring.
              if (follower && distance(follower.transform, at) > at.radius && distance(player.transform, at) < 4) {
                const dx = at.x - follower.transform.x, dz = at.z - follower.transform.z, d = Math.hypot(dx, dz) || 1;
                goal = { ...at, x: at.x + dx / d * 3, z: at.z + dz / d * 3 };
              }
            }
            frame.move = walker.step(world, goal, stop, step.id) ?? frame.move;
            const enemy = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && distance(e.transform, player.transform) < 2.6).sort((a,b) => distance(a.transform, player.transform) - distance(b.transform, player.transform))[0];
            const target = enemy ?? (trigger.kind === 'destroy' ? world.entities.get(mission.state.actors[trigger.actor]) : undefined);
            if (target && (policy === 'complete' || rng.next() > .15)) { frame.attackTarget = { id: target.id, side: 'LEFT' }; frame.left.held = true; frame.move = { x: 0, z: 0 }; }
          }
        }
        world.applyInput(frame, 'keyboard'); world.update(); frame.interact = false;
      }
    }
    stops.forEach(stop => stop()); world.clearInput();
    report.completed = mission.state.phase === 'result' || mission.state.phase === 'progression';
    if (report.completed) report.outcome = 'complete';
    report.time = mission.state.stats.time; report.deaths = mission.state.stats.deaths; report.kills = mission.state.stats.kills; report.damageTaken = mission.state.stats.damage;
    report.activeObjectives = mission.def.steps.filter(s => mission.state.steps[s.id].status === 'active').map(s => s.id);
    report.furthestObjective = report.activeObjectives[0] ?? report.objectiveTimeline.at(-1)?.id ?? report.furthestObjective;
    if (!report.completed) {
      const step = mission.def.steps.find(s => s.id === report.furthestObjective), player = world.entities.get(1)!, anchor = step ? mission.def.anchors[step.anchor] : null;
      const actors = Object.fromEntries(Object.entries(mission.state.actors).filter(([, entity]) => world.entities.get(entity)).map(([id, entity]) => { const e = world.entities.get(entity)!; return [id, { x: e.transform.x, z: e.transform.z, hp: e.health.current, state: e.escort?.state ?? e.interactable?.hint ?? e.vehicle?.damage, ...(e.vehicle ? { driver: e.vehicle.driver, speed: e.vehicle.speed, yaw: e.transform.yaw } : {}) }]; }));
      report.failures[report.outcome] = (report.failures[report.outcome] ?? 0) + 1;
      report.blocker = { objective: step?.id ?? null, detail: mission.state.failure ?? `${report.outcome}: ${step?.text ?? 'no active objective'}`, player: { x: player.transform.x, z: player.transform.z }, ...(anchor ? { distance: distance(player.transform, anchor) } : {}), actors };
    }
    return report;
  } finally { world.dispose(); }
}
