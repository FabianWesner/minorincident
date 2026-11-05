/** Bounded physical keyboard bicycle trial after a real parcel handover; explicit coordinate assists. */
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
import type { Game } from '../../src/Game';

const tier: 'low' | 'high' = process.env.BIKE_TIER === 'high' ? 'high' : 'low';
const out = process.env.BIKE_OUT ?? `test-results/sweep-a2/bike-${tier}`;
mkdirSync(`${out}/captures`, { recursive: true });
const s = new SceneSession({ tier, backend: 'webgpu', query: { ui: '1' } });
const commands: unknown[] = [], captures: unknown[] = [];
let index = 0;
let failure: string | undefined;
const persist = () => writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(), tier,
  method: 'Native complete InputFrames only for ordinary parcel pickup prefix. After the handover/story lock ends, commands use physical page.keyboard WASD/E and fixed simulation ticks only. Read-only positions/camera azimuth provide declared route assistance. No teleport, spawn, protection, objective skip or injected driving frames. Simulation displacement/60Hz ticks measure speed, not performance.', commands, captures, failure }, null, 2) + '\n');
const read = () => s.page.evaluate(() => {
  const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, p = w.entities.get(1)!, b = w.vehicles!.bicycle.entity!;
  const walls = w.districts!.districts.flatMap(d => d.layout.colliders.map(c => ({ id: c.id,
    min: [c.aabb.min[0] + d.origin[0], c.aabb.min[2] + d.origin[1]], max: [c.aabb.max[0] + d.origin[0], c.aabb.max[2] + d.origin[1]] })))
    .filter(c => Math.hypot(Math.max(c.min[0] - p.transform.x, 0, p.transform.x - c.max[0]), Math.max(c.min[1] - p.transform.z, 0, p.transform.z - c.max[1])) < 4);
  return { tick: w.tick, player: { ...p.transform }, carrying: !!p.survivor?.carrying,
    storyLock: !!w.storyLock, phase: w.missions!.state.l1!.phase, bike: { at: { ...b.transform }, ...b.bicycle! },
    distance: Math.hypot(p.transform.x - b.transform.x, p.transform.z - b.transform.z),
    canInteract: w.vehicles!.bicycle.canInteract(), interaction: w.missions!.interactionAvailable(),
    azimuth: g.view.view.azimuth, zoom: g.view.view.playerZoom, walls };
});
const capture = async (label: string) => {
  await s.page.evaluate(async () => window.__SS__!.screenshotReady());
  const file = `${out}/captures/${String(index++).padStart(2, '0')}-${label}.png`;
  await s.page.screenshot({ path: file });
  const state = await read(); captures.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), label, state });
  persist();
  console.log(JSON.stringify({ file, state }));
};
const advance = async (keys: string[], ticks: number) => {
  for (const key of keys) await s.page.keyboard.down(key);
  try {
    return await s.page.evaluate(async n => {
      const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world, samples = [];
      let prior = { ...w.entities.get(1)!.transform };
      for (let i = 0; i < n; i++) {
        await a.step(1); const p = w.entities.get(1)!, b = w.vehicles!.bicycle.entity!;
        samples.push({ tick: w.tick, player: { ...p.transform }, mounted: b.bicycle!.mounted,
          heading: b.bicycle!.heading, speed: b.bicycle!.speed, steer: b.bicycle!.steer,
          carrying: !!p.survivor?.carrying, metresPerSecond: Math.hypot(p.transform.x - prior.x, p.transform.z - prior.z) * 60 });
        prior = { ...p.transform };
      }
      return samples;
    }, ticks);
  } finally { for (const key of keys) await s.page.keyboard.up(key); }
};
try {
  await s.open(); await s.page.evaluate('window.__name=f=>f');
  await s.page.evaluate(async (tier: 'low' | 'high') => {
    const a = window.__SS__!; a.settings.set({ quality: tier }); await a.loadLevel('L1', { seed: 1 });
    a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(1);
    document.documentElement.setAttribute('data-scene-hud', ''); document.querySelectorAll('#hud,.hud').forEach(n => n.setAttribute('data-scene-hud', ''));
    a.bot.start('complete');
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    for (let i = 0; i < 300 && !w.entities.get(1)!.survivor?.carrying; i++) await a.step(30);
    a.bot.stop(); a.input.clear();
    for (let i = 0; i < 60 && w.storyLock; i++) await a.step(10);
    if (!w.entities.get(1)!.survivor?.carrying || w.storyLock) throw Error('Parcel-carrying unlocked setup not reached');
  }, tier);
  await capture('parcel-ready');
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    const c = JSON.parse(line) as { quit?: boolean; label?: string; note?: string; keys?: string[]; ticks?: number; walk?: [number, number] | 'bike'; ride?: [number, number]; creep?: [number, number]; maxTicks?: number };
    if (c.quit) break;
    if (!c.note || !c.label || !/^[a-z0-9-]+$/.test(c.label)) throw Error('Label and explicit assist/decision note required');
    const batches: { keys: string[]; samples: Awaited<ReturnType<typeof advance>> }[] = [];
    commands.push({ command: c, batches });
    if (c.creep) {
      let elapsed = 0;
      while (elapsed < Math.min(c.maxTicks ?? 3600, 4800)) {
        const q = await read(), dx = c.creep[0] - q.player.x, dz = c.creep[1] - q.player.z;
        if (!q.bike.mounted) throw Error('Careful ride requires a mounted bicycle');
        if (q.bike.speed < -.12) { batches.push({ keys: ['KeyW'], samples: await advance(['KeyW'], 5) }); elapsed += 5; continue; }
        if (Math.hypot(dx, dz) <= .45) break;
        const error = Math.atan2(Math.sin(Math.atan2(dz, dx) - q.bike.heading), Math.cos(Math.atan2(dz, dx) - q.bike.heading));
        const keys = ['KeyW']; if (Math.abs(error) > .06) keys.push(error > 0 ? 'KeyD' : 'KeyA');
        batches.push({ keys, samples: await advance(keys, 6) });
        batches.push({ keys: [], samples: await advance([], 12) }); elapsed += 18;
      }
    } else if (c.walk || c.ride) {
      const current = await read();
      const target = c.walk === 'bike' ? [current.bike.at.x, current.bike.at.z] : (c.walk ?? c.ride)!;
      const limit = Math.min(c.maxTicks ?? 1200, 1800);
      for (let elapsed = 0; elapsed < limit; elapsed += 5) {
        const q = await read(), dx = target[0] - q.player.x, dz = target[1] - q.player.z, distance = Math.hypot(dx, dz);
        if (c.ride && !q.bike.mounted) throw Error('Ride command started without a mounted bicycle');
        if (c.ride && q.bike.speed < -.12) { batches.push({ keys: ['KeyW'], samples: await advance(['KeyW'], 5) }); continue; }
        const error = Math.atan2(Math.sin(Math.atan2(dz, dx) - q.bike.heading), Math.cos(Math.atan2(dz, dx) - q.bike.heading));
        // Physical S brakes at9m/s² while a throttle key is held; coast drag is3m/s².
        if (distance <= (c.walk ? (process.env.ALLEY_ZOOMS === '1' ? .12 : 1.1) : Math.max(1.5, Math.cos(error) > .98 ? q.bike.speed ** 2 / 18 + .8 : 0))) break;
        const keys = [];
        if (c.walk) {
          const right = Math.cos(q.azimuth) * dx - Math.sin(q.azimuth) * dz, down = Math.sin(q.azimuth) * dx + Math.cos(q.azimuth) * dz;
          if (Math.abs(right) / distance > .34) keys.push(right > 0 ? 'KeyD' : 'KeyA');
          if (Math.abs(down) / distance > .34) keys.push(down > 0 ? 'KeyS' : 'KeyW');
        } else {
          keys.push('KeyW'); if (Math.abs(error) > .08) keys.push(error > 0 ? 'KeyD' : 'KeyA');
        }
        batches.push({ keys, samples: await advance(keys, c.walk && distance < 1 ? 1 : 5) });
      }
      if (c.walk && process.env.ALLEY_ZOOMS === '1') {
        const q = await read();
        if (Math.hypot(target[0] - q.player.x, target[1] - q.player.z) > 1.5) throw Error(`Physical walk did not reach ${c.label}: ${q.player.x},${q.player.z}`);
      }
      if (c.ride) for (let i = 0; i < 180 && (await read()).bike.speed > .12; i++) batches.push({ keys: ['KeyS'], samples: await advance(['KeyS'], 1) });
    } else {
      const ticks = c.ticks ?? 1; if (ticks < 1 || ticks > 600) throw Error('Physical key segment must be1–600ticks');
      batches.push({ keys: c.keys ?? [], samples: await advance(c.keys ?? [], ticks) });
    }
    await capture(c.label);
    if (process.env.ALLEY_ZOOMS === '1') {
      for (const zoom of [.5, 1.5]) {
        await s.page.evaluate(z => window.__SS__!.camera.zoom(z), zoom);
        await capture(`${c.label}-z${zoom}`);
      }
      await s.page.evaluate(() => window.__SS__!.camera.zoom(1));
    }
  }
} catch (error) { failure = String(error); throw error; }
finally { persist(); await s.close(); stopServer(); }
