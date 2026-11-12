/** Vehicle-contact motion diagnostic. Run under e2e-lock with SCENE_PORT=49xx. */
import { mkdirSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import type { Game } from '../../src/Game';
import type { CrowdFootwork } from '../../src/render/characters/CrowdLocomotion';
import { airborneFootTrack, footYaw, summarizeMotion } from '../../src/debug/scenelab/motion';
const out = 'test-results/s83-vehicleslide/native-contact';
mkdirSync(out, { recursive: true });
const scenes = ['ram', 'surrounded', 'clinging', 'push', 'prop-push', 'prop-momentum', 'reach-recovery', 'ram-survivor'];
if (process.env.VEHICLE_MOTION_SCENE && !scenes.includes(process.env.VEHICLE_MOTION_SCENE)) throw new Error('Unknown VEHICLE_MOTION_SCENE');
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ tier });
    try {
      await session.open();
      for (const name of scenes.filter(name => !process.env.VEHICLE_MOTION_SCENE || name === process.env.VEHICLE_MOTION_SCENE)) {
        await session.load(readSpec(`tests/scenes/l9-apc/${name}.json`));
        await session.ready();
        // Match the production vehicle AI path; Scene Lab's L1 search controller
        // otherwise walks away from a hidden driver instead of pursuing the hull.
        await session.page.evaluate(forceCheap => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world;
          if (forceCheap) {
            const footwork = (game.view as unknown as { crowd: { footwork: CrowdFootwork } | null }).crowd?.footwork;
            if (!footwork) throw new Error('Missing crowd footwork');
            // Exhaust the presentation budget, never actor stats or physics.
            footwork.cap = 0;
          }
          for (const e of w.infected!.active) { delete e.infected!.l1; e.infected!.state = 'chase'; }
          const probe = window as unknown as { __s83Rams: { tick: number; id: number; distance: number; health: number }[]; __s83PropImpulses: { tick: number; prop: string; magnitude: number; nearbyInfected: number[] }[]; __s83Knockback?: Game['world']['knockback']; __s83Shoves: { tick: number; id: number; distance: number }[] };
          probe.__s83Shoves = [];
          probe.__s83PropImpulses = [];
          probe.__s83Rams = [];
          for (const prop of w.props?.items ?? []) {
            const applyImpulse = prop.body.applyImpulse.bind(prop.body);
            prop.body.applyImpulse = (impulse, wake) => {
              const magnitude = Math.hypot(impulse.x, impulse.z);
              if (magnitude > 0) probe.__s83PropImpulses.push({ tick: w.tick, prop: prop.id, magnitude,
                nearbyInfected: w.infected!.active.filter(e => e.health.current > 0 && Math.hypot(e.transform.x - prop.pose.p[0], e.transform.z - prop.pose.p[2]) <= prop.radius + .4).map(e => e.id) });
              applyImpulse(impulse, wake);
            };
          }
          const knockback = probe.__s83Knockback ??= w.knockback.bind(w);
          w.knockback = (entity, direction, impulse, ticks) => {
            const x = entity.transform.x, z = entity.transform.z;
            knockback(entity, direction, impulse, ticks);
            // Vehicles' overlap resolver issues this exact authored nudge.
            // Record its actual resolved displacement, including blocked nudges.
            if (entity.infected && impulse === .12) probe.__s83Shoves.push({ tick: w.tick, id: entity.id, distance: Math.hypot(entity.transform.x - x, entity.transform.z - z) });
            if (entity.infected && impulse >= 3) probe.__s83Rams.push({ tick: w.tick, id: entity.id, distance: Math.hypot(entity.transform.x - x, entity.transform.z - z), health: entity.health.current });
          };
        }, name === 'reach-recovery');
        const cells: { frame: number; jpeg: Buffer }[] = [];
        const attachmentTrack = [];
        const cheapFrames: number[] = [];
        const ramEvidence = [];
        for (let frame = 1; frame <= 300; frame++) {
          if (name === 'prop-momentum' && frame === 1) await session.page.evaluate(() => {
            const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
            const prop = w.props!.items[0];
            if (!prop || !w.props!.kick(prop.entityId, { x: 1, z: 0 })) throw new Error('Momentum fixture must launch a kickable prop');
          });
          await session.step(1);
          if (name === 'ram-survivor') ramEvidence.push(...await session.page.evaluate(() => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world;
            const hits = w.events.events().filter(e => e.type === 'combat.hit' && e.actionId === 'vehicle.military-apc');
            return w.infected!.active.filter(e => e.health.current > 0 && hits.some(h => h.type === 'combat.hit' && h.targetId === e.id)).map(e => ({
              tick: w.tick, id: e.id, health: e.health.current, speed: e.motion?.speed ?? 0,
              clip: game.view.crowdFigures().find(f => f.id === e.id)?.clip ?? null,
              phase: game.view.crowdFigures().find(f => f.id === e.id)?.phase ?? null,
              reactionHeavy: !!e.combat?.reaction?.heavy, slideActive: !!e.knockbackSlide,
            }));
          }));
          if (name === 'reach-recovery') cheapFrames.push(await session.page.evaluate(() => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game;
            const footwork = (game.view as unknown as { crowd: { footwork: CrowdFootwork } | null }).crowd?.footwork;
            return footwork?.cap === 0 ? [...footwork.far.keys()].filter(id => game.world.entities.get(id)?.infected).length : 0;
          }));
          if (name === 'clinging') attachmentTrack.push(await session.page.evaluate(() => {
            const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
            const car = [...w.vehicles!.cars.values()][0].entity, p = car.transform;
            const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
            return { tick: w.tick, car: { x: p.x, y: p.y, z: p.z, yaw: p.yaw },
              actors: w.infected!.active.map(e => ({ id: e.id, attached: e.attachedTo === car.id,
                along: (e.transform.x - p.x) * c - (e.transform.z - p.z) * s,
                side: (e.transform.x - p.x) * s + (e.transform.z - p.z) * c,
                height: e.transform.y - p.y, speed: e.motion?.speed ?? null })) };
          }));
          if (tier === 'high' && (name === 'surrounded' && frame >= 140 && frame <= 145 || name === 'reach-recovery' && frame >= 146 && frame <= 151)) cells.push({ frame, jpeg: await session.snapshot() });
        }
        if (cells.length) await session.makeSheet(cells, `${out}/${name === 'surrounded' ? 'apc' : 'reach-recovery'}-consecutive.jpg`, 480);
        const metrics = await session.metrics();
        const propMotion = await session.page.evaluate(() => {
          const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          return (w.props?.items ?? []).map(p => ({ id: p.id, travelM: Math.hypot(p.pose.p[0] - p.home.p[0], p.pose.p[2] - p.home.p[2]) }));
        });
        const shoves = await session.page.evaluate(() => (window as unknown as { __s83Shoves: { tick: number; id: number; distance: number }[] }).__s83Shoves);
        const rams = await session.page.evaluate(() => (window as unknown as { __s83Rams: { tick: number; id: number; distance: number; health: number }[] }).__s83Rams);
        const events = await session.page.evaluate(() => {
          const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          return w.events.events().filter(e => e.type.startsWith('vehicle.') || e.type === 'combat.hit');
        });
        const propImpulses = await session.page.evaluate(() => (window as unknown as { __s83PropImpulses: { tick: number; prop: string; magnitude: number; nearbyInfected: number[] }[] }).__s83PropImpulses);
        const actors = Object.entries(metrics.actors).filter(([id]) => id.startsWith('infected'));
        const shoveWindows = shoves.map(shove => {
          const actor = actors.find(([, actor]) => actor.entity === shove.id);
          const samples = (actor?.[1].track ?? []).filter(f => f.frame >= shove.tick - 2 && f.frame <= shove.tick + 6);
          return { ...shove, actor: actor?.[0] ?? null, from: shove.tick - 2, to: shove.tick + 6,
            frames: samples.length, clips: [...new Set(samples.map(f => f.clip))], motion: summarizeMotion(samples.map(f => ({ ...f, feet: f.feet.map(foot => ({ ...foot, yaw: footYaw(foot.heel, foot.toe) })) }))) };
        });
        const airborneChecks = name === 'clinging' ? actors.map(([id, actor]) => {
          const proof = airborneFootTrack((actor.track ?? []).filter(f => f.frame >= 181 && f.frame <= 300), 120, 2);
          return { actor: id, ...proof, pass: proof.complete && proof.clearanceMinCm >= 1.2 && proof.travelMinM >= 2 };
        }) : [];
        const checks = actors.map(([id, actor]) => ({ actor: id, contacts: actor.motion.contacts,
          p95Cm: actor.motion.slideP95Cm, maxCm: actor.motion.slideMaxCm,
          pass: actor.motion.contacts >= 5 && actor.motion.slideP95Cm !== null && actor.motion.slideP95Cm <= 5 && actor.motion.slideMaxCm <= 15 }));
        const contactProven = name === 'prop-momentum' ? events.some(e => e.type === 'combat.hit' && e.actionId === 'prop.momentum') : name === 'prop-push' ? propMotion.some(p => p.travelM >= .2) && propImpulses.some(p => p.nearbyInfected.length > 0) : name === 'push' || name === 'reach-recovery' ? shoves.some(shove => shove.distance > .001) : name === 'clinging' ? events.some(e => e.type === 'vehicle.grabbed') : name === 'ram-survivor' ? events.some(e => e.type === 'combat.hit' && e.actionId === 'vehicle.military-apc' && e.knockback > 0 && e.amount > 0) && shoves.some(shove => shove.distance > .001) : name === 'ram' ? events.filter(e => e.type === 'combat.hit').length >= 6 && shoves.some(shove => shove.distance > .001)
          : events.filter(e => e.type === 'vehicle.attack-windup').length >= 4 && events.some(e => e.type === 'vehicle.durability-hit');
        let vehicleTravelM = 0;
        for (let i = 1; i < attachmentTrack.length; i++) vehicleTravelM += Math.hypot(attachmentTrack[i].car.x - attachmentTrack[i - 1].car.x, attachmentTrack[i].car.z - attachmentTrack[i - 1].car.z);
        const movingAttachmentProven = name !== 'clinging' || vehicleTravelM >= 2;
        const motionProven = name === 'clinging' ? airborneChecks.length === 4 && airborneChecks.every(check => check.pass) : checks.every(check => check.pass);
        const cheapProven = name !== 'reach-recovery' || cheapFrames.filter(count => count === 6).length >= 120;
        const livingRamProven = name !== 'ram-survivor' || rams.some(r => {
          const follow = ramEvidence.filter(e => e.id === r.id && e.tick >= r.tick && e.tick < r.tick + 80 && e.reactionHeavy && e.clip && /^(knockdown|flung|get-up|stagger-|shamble|infected-)/.test(e.clip));
          return events.some(e => e.type === 'combat.hit' && e.actionId === 'vehicle.military-apc' && e.targetId === r.id && e.tick === r.tick && e.amount > 0) && r.health > 0 && r.distance > .05 && follow.some(e => e.tick <= r.tick + 1 && e.speed > .1) && follow.length >= 3 && new Set(follow.map(e => e.phase)).size >= 2;
        });
        const pass = contactProven && cheapProven && livingRamProven && movingAttachmentProven && motionProven && session.errors.length === 0;
        if (!pass) process.exitCode = 1;
        writeJson(`${out}/${tier}-${name}.json`, { pass, contactProven, cheapProven, livingRamProven, ramEvidence, rams, cheapFrames, movingAttachmentProven, vehicleTravelM, checks, airborneChecks, metrics, events, attachmentTrack, shoves, shoveWindows, propMotion, propImpulses });
        console.log(JSON.stringify({ tier, name, events: events.length, actors: Object.fromEntries(Object.entries(metrics.actors).filter(([id]) => id.startsWith('infected')).map(([id, actor]) => [id, actor.motion])) }));
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
