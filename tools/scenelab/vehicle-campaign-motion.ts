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
  const samples = await session.page.evaluate(async ({ level, frameCount }) => {
    const api = window.__SS__!;
    await api.loadLevel(level, { seed: 1, progression: `${level}-default` });
    api.missions.begin(); api.pause(); api.cheats.god(true); api.camera.zoom(1.5);
    await api.screenshotReady();
    api.bot.start('complete');
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    const result = [];
    for (let frame = 1; frame <= frameCount; frame++) {
      await api.step(1);
      const w = game.world;
      for (const figure of game.view.crowdFigures()) {
        const e = w.entities.get(figure.id);
        if (!e?.infected || e.health.current <= 0 || !figure.drawn || !figure.soles?.length) continue;
        const cars = [...w.vehicles!.cars.values()];
        const hull = cars.find(car => car.physics.hullDistance(e.transform.x, e.transform.z) <= 3);
        if (!hull) continue;
        result.push({ id: e.id, state: e.attachedTo !== undefined ? 'attached' : 'hull-ground', frame,
          clip: figure.clip, speed: e.motion?.speed ?? 0, at: [e.transform.x, e.transform.z],
          floor: w.districts?.pavingHeight(e.transform.x, e.transform.z) ?? 0,
          feet: Array.from({ length: figure.soles.length / 2 }, (_, i) => ({ heel: figure.soles![2 * i], toe: figure.soles![2 * i + 1] })) });
      }
    }
    api.input.clear();
    return result;
  }, { level, frameCount });
  const groups = new Map<string, typeof samples>();
  for (const sample of samples) { const key = `${sample.state}/${sample.id}`; const group = groups.get(key) ?? []; group.push(sample); groups.set(key, group); }
  const rows = [...groups].map(([key, frames]) => ({ key, motion: summarizeMotion(frames.map(f => ({ ...f, feet: f.feet.map(foot => ({ ...foot, yaw: footYaw(foot.heel, foot.toe) })) }))) }));
  writeJson(`test-results/s83-vehicleslide/campaign/${level}-${tier}.json`, { level, tier, samples, rows, errors: session.errors });
  console.log(JSON.stringify({ level, tier, samples: samples.length, rows }));
  if (!rows.length || session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
