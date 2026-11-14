/** Native campaign contact sampler; run under the browser lock on SCENE_PORT=49xx. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SceneSession, stopServer, writeJson } from './session';
import { vehicleTrackVerdict } from './vehicle-motion-verdict';
import type { Game } from '../../src/Game';
import type { CrowdFootwork } from '../../src/render/characters/CrowdLocomotion';
import type { EntitySnapshot } from '../../src/sim/world/types';
import type { SolidBox } from '../../src/sim/world/SolidGeometry';
const tier = process.env.REVIEW_TIER === 'low' ? 'low' : 'high';
const fixtures = { 'l4-parked': 'L4', 'l4-tank': 'L4', 'l7-bus': 'L7' };
const fixture = process.env.REVIEW_FIXTURE as keyof typeof fixtures | undefined;
if (fixture && !(fixture in fixtures)) throw new Error('Unknown REVIEW_FIXTURE');
const requestedLevel = process.env.REVIEW_LEVEL ?? (fixture === 'l7-bus' ? 'L7' : fixture ? 'L4' : 'L9');
const level = requestedLevel as 'L9' | 'L7' | 'L4';
if (!['L9', 'L7', 'L4'].includes(level)) throw new Error('Expected L9, L7 or L4');
if (fixture && fixtures[fixture] !== level) throw new Error('Fixture and level do not match');
const frameCount = Number(process.env.CAMPAIGN_MOTION_FRAMES ?? 360);
if (!Number.isSafeInteger(frameCount) || frameCount < 1) throw new Error('Invalid CAMPAIGN_MOTION_FRAMES');
const contactIds = (process.env.CAMPAIGN_CONTACT_IDS ?? '').split(',').filter(Boolean).map(Number);
const session = new SceneSession({ tier });
const runtimeHash = () => {
  const hash = createHash('sha256');
  for (const path of execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src'], { encoding: 'utf8' }).trim().split('\n').sort()) hash.update(path).update(readFileSync(path));
  return hash.digest('hex');
};
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  const sourceHash = runtimeHash();
  const cells: { frame: number; jpeg: Buffer }[] = [];
  await session.page.exposeFunction('__s83Capture', async (frame: number) => {
    cells.push({ frame, jpeg: await session.page.screenshot({ type: 'jpeg', quality: 85, clip: { x: 400, y: 180, width: 480, height: 360 } }) });
  });
  await session.page.exposeFunction('__s83Progress', (progress: { hulls: unknown[] }) => console.log(JSON.stringify({ progress: { ...progress, hulls: progress.hulls.length } })));
  const captureFrom = Number(process.env.CAMPAIGN_CAPTURE_FROM ?? (frameCount >= 8890 ? 8885 : 0));
  const observation = await session.page.evaluate(async ({ level, fixture, frameCount, captureFrom, contactIds }) => {
    const api = window.__SS__!;
    await api.loadLevel(level, { seed: 1, progression: `${level}-default` }); api.missions.begin();
    api.pause(); api.cheats.god(true); api.camera.zoom(1.5);
    await api.screenshotReady();
    if (!fixture) api.bot.start('complete');
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    const registry = game.world.solids as unknown as { hulls: Map<number, { entity: EntitySnapshot; boxes: SolidBox[] }> };
    const stagedActors: number[] = [];
    if (fixture) {
      const w = game.world, mission = w.missions!;
      if (level === 'L4') {
        // The same production-controller preparation as Scene Lab's L4
        // parked/tank fixtures, on the full native level and quality budget.
        for (let frames = 0; frames < 3600 && mission.state.l4!.phase === 'convoy'; frames += 60) await api.step(60);
        if (mission.state.l4!.phase === 'convoy') throw new Error('Native L4 convoy did not park');
        if (fixture === 'l4-tank') {
          mission.completeObjective('quartermaster');
          for (let frames = 0; frames < 10800 && mission.state.l4!.tankPhase !== 'hold'; frames += 60) await api.step(60);
          if (mission.state.l4!.tankPhase !== 'hold') throw new Error('Native L4 tank did not reach its post');
        }
      }
      const state = mission.state.l4;
      const id = fixture === 'l7-bus' ? w.l7Departure?.state.busId : fixture === 'l4-tank' ? state?.tankId : state?.convoyIds[0];
      const hull = id === undefined ? undefined : registry.hulls.get(id);
      if (!hull) throw new Error(`Missing prepared hull for ${fixture}`);
      const p = hull.entity.transform, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
      const hx = Math.max(...hull.boxes.map(b => Math.abs(b.x) + b.halfX)), hz = Math.max(...hull.boxes.map(b => Math.abs(b.z) + b.halfZ));
      api.teleport('player', { x: p.x + (hz + 3) * s, z: p.z + (hz + 3) * c });
      api.camera.follow(); api.camera.zoom(1.5);
      const spots = [[-hx - 1, 0], [hx + 1, 0], [0, hz + 1], [0, -hz - 1], [-hx - 1, hz + 1], [hx + 1, -hz - 1]];
      for (const [i, [x, z]] of spots.entries()) {
        const at = { x: p.x + x * c + z * s, z: p.z - x * s + z * c };
        let actor: number;
        try { actor = api.spawn('infected.sprinter', at, { variant: ['inf.suburban-mom', 'inf.delivery-driver', 'inf.bathrobe-neighbor'][i % 3], state: 'chase' }); }
        catch (error) {
          if (!String(error).includes('Infected concurrency cap reached')) throw error;
          // A full native LOW population is part of the case. Relocate a live
          // ordinary actor instead of increasing caps, healing or deleting one.
          const candidates = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.pendingAdmission && !e.infectionRise && !e.emerging
            && !e.infected?.legLost && !stagedActors.includes(e.id) && /^infected\.(runner|sprinter|riot|firefighter|hazmat|armored|butcher|nurse|screamer|bloated|brute)$/.test(e.archetype));
          candidates.sort((a, b) => Number(a.health.current < a.health.max) - Number(b.health.current < b.health.max)
            || Math.hypot(a.transform.x - at.x, a.transform.z - at.z) - Math.hypot(b.transform.x - at.x, b.transform.z - at.z));
          if (!candidates.length) throw new Error('No live ordinary actor available at the native cap');
          actor = candidates[0].id;
          const crowd = (game.view as unknown as { crowd: { footwork: CrowdFootwork; batches: Map<string, { locomotion: { reset(id: number): void } }> } | null }).crowd;
          crowd?.footwork.states.delete(actor); crowd?.footwork.far.delete(actor);
          for (const batch of crowd?.batches.values() ?? []) batch.locomotion.reset(actor);
          api.teleport(actor, at);
        }
        const e = w.entities.get(actor)!; delete e.infected!.l1;
        stagedActors.push(actor);
      }
      await api.screenshotReady();
    }
    const staticHulls = game.world.districts!.districts.flatMap(d => d.decay.placements.filter(p => p.assetId.startsWith('veh.')).map(p => ({
      id: `${d.id}/${p.id}`, asset: p.assetId, boxes: d.decay.colliders.filter(c => !c.walkable && (c.id === p.id || c.id.startsWith(`${p.id}/`))).map(c => ({
        x: (c.aabb.min[0] + c.aabb.max[0]) / 2 + d.origin[0], z: (c.aabb.min[2] + c.aabb.max[2]) / 2 + d.origin[1],
        y: (c.aabb.min[1] + c.aabb.max[1]) / 2, halfX: (c.aabb.max[0] - c.aabb.min[0]) / 2,
        yaw: 0, halfZ: (c.aabb.max[2] - c.aabb.min[2]) / 2, halfY: (c.aabb.max[1] - c.aabb.min[1]) / 2,
      })),
    })).filter(h => h.boxes.length));
    const gap = (boxes: SolidBox[], x: number, y: number, z: number) => {
      let distance = Infinity;
      for (const b of boxes) {
        if (b.y - b.halfY >= y + 1.2 || b.y + b.halfY <= y - .2) continue;
        const dx = x - b.x, dz = z - b.z, extent = b.halfX + b.halfZ + 3;
        if (Math.abs(dx) > extent || Math.abs(dz) > extent) continue;
        const c = Math.cos(b.yaw ?? 0), s = Math.sin(b.yaw ?? 0);
        distance = Math.min(distance, Math.hypot(Math.max(0, Math.abs(dx * c - dz * s) - b.halfX), Math.max(0, Math.abs(dx * s + dz * c) - b.halfZ)));
      }
      return distance;
    };
    // Observe the two cleanup writers without changing simulation state.
    // CharacterSeparation owns infected X/Z in phase 6; solid commit is 6.75.
    const separation = new Map<number, number>(), collision = new Map<number, number>();
    const beforeSeparation = new Map<number, number[]>(), beforeCollision = new Map<number, number[]>();
    game.world.events.on('sim.tick', () => {
      beforeSeparation.clear(); separation.clear();
      for (const e of game.world.infected!.active) if (e.health.current > 0) beforeSeparation.set(e.id, [e.transform.x, e.transform.z]);
    }, 5.99);
    game.world.events.on('sim.tick', () => {
      for (const e of game.world.infected!.active) {
        const p = beforeSeparation.get(e.id); if (!p) continue;
        const moved = Math.hypot(e.transform.x - p[0], e.transform.z - p[1]);
        if (moved > 1e-6) separation.set(e.id, moved);
      }
    }, 6.01);
    game.world.events.on('sim.tick', () => {
      beforeCollision.clear(); collision.clear();
      for (const e of game.world.infected!.active) if (e.health.current > 0) beforeCollision.set(e.id, [e.transform.x, e.transform.z]);
    }, 6.74);
    game.world.events.on('sim.tick', () => {
      for (const e of game.world.infected!.active) {
        const p = beforeCollision.get(e.id); if (!p) continue;
        const moved = Math.hypot(e.transform.x - p[0], e.transform.z - p[1]);
        if (moved > 1e-6) collision.set(e.id, moved);
      }
    }, 6.76);
    const startTick = game.world.tick;
    // The native route can avoid final-commit penetration entirely. Exercise its
    // recovery path explicitly after the original leaper window, without stats
    // changes or removing any native witness. All resulting samples still gate.
    const collisionFixture: { id: number; at: { x: number; y: number; z: number }; dx: number; dz: number; tick: number }[] = [];
    game.world.events.on('sim.tick', () => {
      const w = game.world;
      if (level !== 'L9' || frameCount < 9000) return;
      if (w.tick === startTick + 8970) {
        const car = w.vehicles!.cars.get(w.vehicles!.active!)!, p = car.entity.transform;
        for (const turn of [0, Math.PI]) {
          const angle = p.yaw + turn, dx = Math.cos(angle), dz = -Math.sin(angle);
          const point = (distance: number) => ({ x: p.x + dx * distance, y: .7, z: p.z + dz * distance });
          if (!w.solids.clear(point(7), .35)) continue;
          let lo = 0, hi = 7;
          for (let j = 0; j < 24; j++) { const mid = (lo + hi) / 2; if (w.solids.clear(point(mid), .35, undefined, false)) hi = mid; else lo = mid; }
          const at = point(hi + .05);
          if (!w.solids.clear(at, .35)) continue;
          const id = api.spawn('infected.sprinter', at, { state: 'chase' });
          const e = w.entities.get(id)!;
          if (e.combat!.radius !== .35) throw new Error('Collision fixture radius differs from the prepared boundary');
          collisionFixture.push({ id, at, dx, dz, tick: w.tick + 1 });
          break;
        }
      }
      for (const fixture of collisionFixture) if (w.tick === fixture.tick) {
        const e = w.entities.get(fixture.id)!;
        Object.assign(e.transform, { ...fixture.at, x: fixture.at.x - fixture.dx * .08, z: fixture.at.z - fixture.dz * .08 });
        w.spatial.set(e.id, e.transform.x, e.transform.z);
        w.solids.wrote(e, 'qa.collision-recovery-proposal');
      }
    }, 6.73);

    const stagedMotion = new Map(stagedActors.map(id => { const p = game.world.entities.get(id)!.transform; return [id, { x: p.x, z: p.z, travelM: 0, movingFrames: 0, aliveFrames: 0 }]; }));
    const result = [];
    const progress = [];
    const captureCamera = [];
    for (let frame = 1; frame <= frameCount; frame++) {
      game.view.renderer.nextNodeFrame();
      game.view.frame(1 / 60);
      await api.step(1);
      if (captureFrom > 0 && frame >= captureFrom && frame < captureFrom + 6) {
        captureCamera.push({ frame, ...game.view.view.getState() });
        await (window as unknown as { __s83Capture(frame: number): Promise<void> }).__s83Capture(frame);
      }
      const w = game.world;
      for (const [id, audit] of stagedMotion) {
        const e = w.entities.get(id); if (!e || e.health.current <= 0) continue;
        const distance = Math.hypot(e.transform.x - audit.x, e.transform.z - audit.z);
        audit.travelM += distance; audit.x = e.transform.x; audit.z = e.transform.z; audit.aliveFrames++;
        if (distance > .001 || (e.motion?.speed ?? 0) > .06) audit.movingFrames++;
      }
      const hulls = [...registry.hulls.values()].filter(h => !h.entity.hidden).map(h => {
        const p = h.entity.transform, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
        return { id: String(h.entity.id), asset: h.entity.archetype, source: 'dynamic', boxes: h.boxes.map(b => ({ ...b,
          x: p.x + b.x * c + b.z * s, z: p.z - b.x * s + b.z * c, y: p.y + b.y, yaw: p.yaw + (b.yaw ?? 0) })) };
      }).concat(staticHulls.map(h => ({ ...h, source: 'static' })));
      for (const car of w.vehicles!.cars.values()) if (!car.entity.hidden && !hulls.some(h => h.id === String(car.entity.id))) throw new Error(`Missing drivable hull ${car.entity.id}`);
      if (frame % 300 === 0) {
        progress.push({ frame, tick: w.tick, scenario: w.scenario, phase: w.missions?.state.phase,
        l9Phase: w.missions?.l9?.state.phase, stallAt: w.missions?.l9?.driving.state.stallAt, restarted: w.missions?.l9?.driving.state.restarted, hatch: w.missions?.l9?.driving.hatch, bot: api.bot.status(), figures: game.view.crowdFigures().length,
        drawn: game.view.crowdFigures().filter(f => f.drawn).length, livingInfected: w.infected!.active.filter(e => e.health.current > 0).length,
        hulls: hulls.map(h => ({ id: h.id, asset: h.asset, source: h.source })),
        cars: [...w.vehicles!.cars.values()].map(c => ({ id: c.entity.id, ...c.entity.transform, speed: c.physics.speed })) });
        await (window as unknown as { __s83Progress(progress: unknown): Promise<void> }).__s83Progress(progress[progress.length - 1]);
      }
      for (const figure of game.view.crowdFigures()) {
        const e = w.entities.get(figure.id);
        if (!e?.infected || e.health.current <= 0 || !figure.drawn || !figure.soles?.length) continue;
        const floor = w.districts?.supportBelow(e.transform.x, e.transform.z, e.transform.y - .7) ?? 0;
        const hull = hulls.find(h => gap(h.boxes, e.transform.x, floor + .7, e.transform.z) <= 3);
        if (!hull) continue;
        const driving = w.missions?.l9?.driving;
        const context = driving ? driving.hatch ? 'hatch' : driving.state.stallAt !== null && !driving.state.restarted ? 'rail-stall' : driving.state.repairActive ? 'repair' : 'driving' : level;
        const contexts = driving ? ['driving', 'detour', ...(driving.hatch ? ['hatch'] : []), ...(driving.state.stallAt !== null && !driving.state.restarted ? ['rail-stall'] : []), ...(driving.state.repairActive ? ['repair'] : [])] : [level];
        const footwork = contactIds.includes(e.id) ? (game.view as unknown as { crowd: { footwork: CrowdFootwork } | null }).crowd?.footwork : undefined;
        const detailed = footwork?.states.get(e.id), far = footwork?.far.get(e.id);
        const dimensions = detailed ? detailed.contacts as unknown as { sole: number; feet: { a: number; b: number }[] } : undefined;
        const contactDebug = footwork ? { dimensions: dimensions ? { sole: dimensions.sole, lengths: dimensions.feet.map(f => [f.a, f.b]) } : null, joints: figure.joints ? Object.fromEntries(['hip','legL','shinL','footL','legR','shinR','footR'].map(k => [k, figure.joints![k]])) : null, weight: detailed?.weight, detailed: detailed ? [0, 1].map(i => {
          const c = detailed.contacts.contact(i); return { target: c.target.toArray(), anchor: c.anchor.toArray(), locked: c.locked, pitch: c.pitch };
        }) : null, far: far ? [0, 1].map(i => { const c = far.contacts.contact(i); return c ? { target: c.target.toArray(), yaw: c.yaw } : null; }) : null } : undefined;
        result.push({ contactDebug, reaction: e.combat?.reaction ? { heavy: e.combat.reaction.heavy, started: e.combat.reaction.started, until: e.combat.reaction.until } : null,
          special: e.infected.specialAttack?.move ?? null, rising: !!e.infectionRise, alphaType: e.infected.alphaType, phase: figure.phase,
          correction: { separationM: separation.get(e.id) ?? 0, collisionM: collision.get(e.id) ?? 0 }, hull: { id: hull.id, source: hull.source, asset: hull.asset }, yaw: e.transform.yaw, context, contexts, id: e.id, archetype: e.archetype, lod: figure.lod, model: e.infected.model, variant: e.infected.variant, severance: figure.severance, health: e.health.current, instanceKey: figure.instanceKey, tick: w.tick, state: e.attachedTo !== undefined ? 'attached' : 'hull-ground', frame,
          clip: figure.clip, speed: e.motion?.speed ?? 0, at: [e.transform.x, e.transform.z],
          floor,
          feet: Array.from({ length: figure.soles.length / 2 }, (_, i) => ({ heel: figure.soles![2 * i], toe: figure.soles![2 * i + 1] })) });
      }
    }
    api.input.clear();
    const stagedOutcomes = stagedActors.map(id => { const e = game.world.entities.get(id); return { id, exists: !!e, health: e?.health.current ?? null, deathFrame: e?.infected?.deadAt ? e.infected.deadAt - startTick : null, motion: stagedMotion.get(id)! }; });
    return { samples: result, progress, stagedActors, stagedOutcomes, captureCamera, collisionFixture };
  }, { level, fixture, frameCount, captureFrom, contactIds });
  const name = fixture ?? level;
  if (cells.length) await session.makeSheet(cells, `test-results/s83-vehicleslide/campaign/${name}-${tier}-consecutive.jpg`, 480);
  const { samples, progress, stagedActors, stagedOutcomes, captureCamera, collisionFixture } = observation;
  const groups = new Map<string, typeof samples>();
  for (const sample of samples) { const key = `${sample.context}/${sample.state}/${sample.id}`; const group = groups.get(key) ?? []; group.push(sample); groups.set(key, group); }
  const checkTrack = vehicleTrackVerdict;
  const rows = [...groups].map(([key, frames]) => checkTrack(key, frames));
  const correctionRows: ReturnType<typeof vehicleTrackVerdict>[] = [];
  for (const kind of ['separationM', 'collisionM'] as const) {
    const actors = new Map<number, Set<number>>();
    for (const sample of samples) if (sample.correction[kind] > 0) {
      let frames = actors.get(sample.id); if (!frames) actors.set(sample.id, frames = new Set());
      // Retain the full heavy recovery and its landing, not just an airborne
      // half-second slice. Every earlier correction sample remains measured.
      const recovery = sample.reaction?.heavy ? Math.max(0, sample.reaction.until - sample.tick) : 0;
      for (let frame = sample.frame - 30; frame <= sample.frame + recovery + 30; frame++) frames.add(frame);
    }
    for (const [id, frames] of actors) correctionRows.push(checkTrack(`${kind}/${id}`, samples.filter(s => s.id === id && frames.has(s.frame))));
  }
  const contextRows: ReturnType<typeof vehicleTrackVerdict>[] = [];
  const contextCoverage = [...new Set(samples.flatMap(s => s.contexts))].map(context => {
    const track = samples.filter(s => s.contexts.includes(context));
    const actors = [...new Set(track.map(s => s.id))];
    const checks = actors.map(id => checkTrack(`${context}/${id}`, track.filter(s => s.id === id)));
    contextRows.push(...checks);
    const grounded = checks.filter(row => row.classification === 'grounded');
    return { context, frames: track.length, actors: actors.length, contacts: checks.reduce((sum, row) => sum + row.motion.contacts, 0),
      maxCm: grounded.length ? Math.max(...grounded.map(row => row.motion.slideMaxCm)) : null,
      p95Cm: grounded.length ? Math.max(...grounded.map(row => row.motion.slideP95Cm!)) : null };
  });
  const contextsProven = level !== 'L9' || ['driving', 'detour', 'rail-stall', 'hatch'].every(context => contextCoverage.some(c => c.context === context && c.contacts > 0));
  const sourceStable = sourceHash === runtimeHash();
  const stagedCoverage = stagedActors.map(id => {
    const track = samples.filter(s => s.id === id);
    let travelM = 0;
    for (let i = 1; i < track.length; i++) if (track[i].frame === track[i - 1].frame + 1) travelM += Math.hypot(track[i].at[0] - track[i - 1].at[0], track[i].at[1] - track[i - 1].at[1]);
    const outcome = stagedOutcomes.find(e => e.id === id)!;
    const stationary = outcome.motion.movingFrames === 0 && outcome.motion.travelM <= .01 && track.length > 0;
    return { id, frames: track.length, travelM, moving: track.length >= 60 && travelM >= .2,
      outcome, stationary, covered: outcome.exists && (track.length >= 60 || stationary) };
  });
  // Native soldiers can kill or occlude staged actors immediately. Require two
  // sustained moving witnesses; still measure every visible actor and retain every corpse.
  const stagedMotionProven = !stagedActors.length || stagedCoverage.filter(c => c.moving && c.covered).length >= 2;
  const correctionsProven = level !== 'L9' || ['separationM/', 'collisionM/'].every(kind => correctionRows.some(row => row.key.startsWith(kind) && row.motion.contacts > 0));
  const pass = sourceStable && stagedMotionProven && contextsProven && correctionsProven && contextRows.every(row => row.pass) && correctionRows.every(row => row.pass) && stagedCoverage.every(c => c.outcome.exists) && rows.some(row => row.classification === 'grounded') && rows.every(row => row.pass) && session.errors.length === 0;
  writeJson(`test-results/s83-vehicleslide/campaign/${name}-${tier}.json`, { level, fixture, tier, sourceHash, sourceStable, pass, captureCamera, collisionFixture, samples, rows, correctionRows, contextRows, contextCoverage, contextsProven, correctionsProven, progress, stagedActors, stagedCoverage, stagedMotionProven, errors: session.errors });
  const grounded = rows.filter(row => row.classification === 'grounded');
  console.log(JSON.stringify({ level, fixture, tier, pass, sourceStable, samples: samples.length, groundedRows: grounded.length,
    maxCm: Math.max(0, ...grounded.map(row => row.motion.slideMaxCm)), p95Cm: Math.max(0, ...grounded.map(row => row.motion.slideP95Cm!)),
    failed: rows.filter(row => !row.pass), correctionFailures: correctionRows.filter(row => !row.pass), contextCoverage, stagedCoverage }));
  if (!pass) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
