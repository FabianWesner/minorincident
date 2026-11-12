/** Vehicle-contact motion diagnostic. Run under e2e-lock with SCENE_PORT=49xx. */
import { mkdirSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import type { Game } from '../../src/Game';
import { airborneFootTrack, footYaw, summarizeMotion } from '../../src/debug/scenelab/motion';
const out = 'test-results/s83-vehicleslide/native-contact';
mkdirSync(out, { recursive: true });
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ tier });
    try {
      await session.open();
      for (const name of ['ram', 'surrounded', 'clinging', 'push', 'prop-push']) {
        await session.load(readSpec(`tests/scenes/l9-apc/${name}.json`));
        await session.ready();
        // Match the production vehicle AI path; Scene Lab's L1 search controller
        // otherwise walks away from a hidden driver instead of pursuing the hull.
        await session.page.evaluate(() => {
          const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          for (const e of w.infected!.active) { delete e.infected!.l1; e.infected!.state = 'chase'; }
          const probe = window as unknown as { __s83Knockback?: Game['world']['knockback']; __s83Shoves: { tick: number; id: number; distance: number }[] };
          probe.__s83Shoves = [];
          const knockback = probe.__s83Knockback ??= w.knockback.bind(w);
          w.knockback = (entity, direction, impulse, ticks) => {
            const x = entity.transform.x, z = entity.transform.z;
            knockback(entity, direction, impulse, ticks);
            // Vehicles' overlap resolver issues this exact authored nudge.
            // Record its actual resolved displacement, including blocked nudges.
            if (entity.infected && impulse === .12) probe.__s83Shoves.push({ tick: w.tick, id: entity.id, distance: Math.hypot(entity.transform.x - x, entity.transform.z - z) });
          };
        });
        const cells: { frame: number; jpeg: Buffer }[] = [];
        const attachmentTrack = [];
        for (let frame = 1; frame <= 300; frame++) {
          await session.step(1);
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
          if (tier === 'high' && name === 'surrounded' && frame >= 140 && frame <= 145) cells.push({ frame, jpeg: await session.snapshot() });
        }
        if (cells.length) await session.makeSheet(cells, `${out}/apc-consecutive.jpg`, 480);
        const metrics = await session.metrics();
        const propMotion = await session.page.evaluate(() => {
          const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          return (w.props?.items ?? []).map(p => ({ id: p.id, travelM: Math.hypot(p.pose.p[0] - p.home.p[0], p.pose.p[2] - p.home.p[2]) }));
        });
        const shoves = await session.page.evaluate(() => (window as unknown as { __s83Shoves: { tick: number; id: number; distance: number }[] }).__s83Shoves);
        const events = await session.page.evaluate(() => {
          const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          return w.events.events().filter(e => e.type.startsWith('vehicle.') || e.type === 'combat.hit');
        });
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
        const contactProven = name === 'prop-push' ? propMotion.some(p => p.travelM >= .2) : name === 'push' ? shoves.some(shove => shove.distance > .001) : name === 'clinging' ? events.some(e => e.type === 'vehicle.grabbed') : name === 'ram' ? events.filter(e => e.type === 'combat.hit').length >= 6 && shoves.some(shove => shove.distance > .001)
          : events.filter(e => e.type === 'vehicle.attack-windup').length >= 4 && events.some(e => e.type === 'vehicle.durability-hit');
        let vehicleTravelM = 0;
        for (let i = 1; i < attachmentTrack.length; i++) vehicleTravelM += Math.hypot(attachmentTrack[i].car.x - attachmentTrack[i - 1].car.x, attachmentTrack[i].car.z - attachmentTrack[i - 1].car.z);
        const movingAttachmentProven = name !== 'clinging' || vehicleTravelM >= 2;
        const motionProven = name === 'clinging' ? airborneChecks.length === 4 && airborneChecks.every(check => check.pass) : checks.every(check => check.pass);
        const pass = contactProven && movingAttachmentProven && motionProven && session.errors.length === 0;
        if (!pass) process.exitCode = 1;
        writeJson(`${out}/${tier}-${name}.json`, { pass, contactProven, movingAttachmentProven, vehicleTravelM, checks, airborneChecks, metrics, events, attachmentTrack, shoves, shoveWindows, propMotion });
        console.log(JSON.stringify({ tier, name, events: events.length, actors: Object.fromEntries(Object.entries(metrics.actors).filter(([id]) => id.startsWith('infected')).map(([id, actor]) => [id, actor.motion])) }));
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); }
