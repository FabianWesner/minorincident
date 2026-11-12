/** Native campaign contact sampler; run under the browser lock on SCENE_PORT=49xx. */
import { SceneSession, stopServer, writeJson } from './session';
import { footYaw, summarizeMotion } from '../../src/debug/scenelab/motion';
import type { Game } from '../../src/Game';
const tier = process.env.REVIEW_TIER === 'low' ? 'low' : 'high';
const requestedLevel = process.env.REVIEW_LEVEL ?? 'L9';
const level = requestedLevel as 'L9' | 'L7' | 'L4';
if (!['L9', 'L7', 'L4'].includes(level)) throw new Error('Expected L9, L7 or L4');
const frameCount = Number(process.env.CAMPAIGN_MOTION_FRAMES ?? 360);
if (!Number.isSafeInteger(frameCount) || frameCount < 1) throw new Error('Invalid CAMPAIGN_MOTION_FRAMES');
const session = new SceneSession({ tier });
try {
  await session.open();
  const observation = await session.page.evaluate(async ({ level, frameCount }) => {
    const api = window.__SS__!;
    await api.loadLevel(level, { seed: 1, progression: `${level}-default` });
    api.missions.begin(); api.pause(); api.cheats.god(true); api.camera.zoom(1.5);
    await api.screenshotReady();
    api.bot.start('complete');
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    const result = [];
    const progress = [];
    for (let frame = 1; frame <= frameCount; frame++) {
      game.view.renderer.nextNodeFrame();
      game.view.frame(1 / 60);
      await api.step(1);
      const w = game.world;
      if (frame % 300 === 0) progress.push({ frame, tick: w.tick, scenario: w.scenario, phase: w.missions?.state.phase,
        l9Phase: w.missions?.l9?.state.phase, bot: api.bot.status(), figures: game.view.crowdFigures().length,
        drawn: game.view.crowdFigures().filter(f => f.drawn).length, livingInfected: w.infected!.active.filter(e => e.health.current > 0).length,
        cars: [...w.vehicles!.cars.values()].map(c => ({ id: c.entity.id, ...c.entity.transform, speed: c.physics.speed })) });
      for (const figure of game.view.crowdFigures()) {
        const e = w.entities.get(figure.id);
        if (!e?.infected || e.health.current <= 0 || !figure.drawn || !figure.soles?.length) continue;
        const cars = [...w.vehicles!.cars.values()];
        const hull = cars.find(car => car.physics.hullDistance(e.transform.x, e.transform.z) <= 3);
        if (!hull) continue;
        result.push({ id: e.id, archetype: e.archetype, state: e.attachedTo !== undefined ? 'attached' : 'hull-ground', frame,
          clip: figure.clip, speed: e.motion?.speed ?? 0, at: [e.transform.x, e.transform.z],
          floor: w.districts?.pavingHeight(e.transform.x, e.transform.z) ?? 0,
          feet: Array.from({ length: figure.soles.length / 2 }, (_, i) => ({ heel: figure.soles![2 * i], toe: figure.soles![2 * i + 1] })) });
      }
    }
    api.input.clear();
    return { samples: result, progress };
  }, { level, frameCount });
  const { samples, progress } = observation;
  const groups = new Map<string, typeof samples>();
  for (const sample of samples) { const key = `${sample.state}/${sample.id}`; const group = groups.get(key) ?? []; group.push(sample); groups.set(key, group); }
  const rows = [...groups].map(([key, frames]) => ({ key, motion: summarizeMotion(frames.map(f => ({ ...f, feet: f.feet.map(foot => ({ ...foot, yaw: footYaw(foot.heel, foot.toe) })) }))) }));
  const pass = rows.length > 0 && rows.every(row => row.motion.slideMaxCm <= 15 && (row.motion.slideP95Cm ?? Infinity) <= 5) && session.errors.length === 0;
  writeJson(`test-results/s83-vehicleslide/campaign/${level}-${tier}.json`, { level, tier, pass, samples, rows, progress, errors: session.errors });
  console.log(JSON.stringify({ level, tier, samples: samples.length, rows, progress }));
  if (!pass) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
