import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';
import { provenance } from './accept/probe';

const backend = (process.argv[2] ?? 'webgl2') as Backend, tier = (process.argv[3] ?? 'low') as 'low' | 'high';
if (!['webgl2', 'webgpu'].includes(backend) || !['low', 'high'].includes(tier)) throw new Error('Expected backend and quality');
const reportSlug = process.env.QA_REPORT_SLUG ?? 'fix51-r10g';
const out = `test-results/${reportSlug}/G-24-${backend}-${tier}`;
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend, tier });
const species = ['lion', 'gorilla', 'elephant', 'zebra', 'flamingo'] as const;
const kinds = ['infected.alpha', ...species.map(name => `infected.${name}`)];
const point = (i: number): [number, number] => [Math.cos(i * Math.PI / 3) * 8, Math.sin(i * Math.PI / 3) * 8];
const camera = { mode: 'pose' as const, position: [24, 30, 28] as [number, number, number], target: [0, 1, 0] as [number, number, number] };
const rows: unknown[] = [], shots: { frame: number; jpeg: Buffer }[] = [];
try {
  await session.open();
  const spec: SceneSpec = { name: 'G-24-enemies', ground: 'asphalt', time: 'L8-zoo', tier: 0,
    actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }, ...kinds.map((archetype, i) => ({ id: archetype, kind: 'infected' as const, archetype, at: point(i), state: 'idle' as const }))], camera, frames: 1 };
  await session.load(spec); await session.step(1); await session.ready();
  async function capture(stage: string, expected: number) {
    await session.ready();
    const data = await session.page.evaluate(() => {
      const world = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game.world, render = window.__SS__!.getState().render;
      return { backend: render.backend, quality: render.quality, bars: render.healthBars, player: { ...world.entities.get(1)!.transform },
        actors: [...world.entities.iterate()].filter(e => e.infected || e.civilian?.zooAnimal).map(e => ({ id: e.id, archetype: e.archetype, faction: e.faction, health: { ...e.health }, at: { ...e.transform }, animal: e.civilian?.zooAnimal })) };
    });
    const file = join(out, `${stage}.png`), buffer = await session.screenshot(file), png = PNG.sync.read(buffer);
    const pixels = (data.bars?.bars ?? []).map(bar => {
      let red = 0;
      for (let y = Math.max(0, Math.floor(bar.y - bar.height / 2)); y < Math.min(png.height, Math.ceil(bar.y + bar.height / 2)); y++) for (let x = Math.max(0, Math.floor(bar.x - bar.width / 2)); x < Math.min(png.width, Math.ceil(bar.x + bar.width / 2)); x++) {
        const i = (y * png.width + x) * 4, r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
        if (r > 130 && r > g * 1.6 && r > b * 1.5) red++;
      }
      return { ...bar, redPixels: red, pass: red >= bar.width * bar.height * bar.fraction * .3 };
    });
    rows.push({ stage, expected, ...data, countPass: data.bars?.count === expected, pixels, file, sha256: createHash('sha256').update(buffer).digest('hex') });
    shots.push({ frame: shots.length, jpeg: buffer });
  }
  await capture('near-healthy', 6);
  await session.page.evaluate(camera => { window.__SS__!.teleport('player', { x: 100, z: 100 }); window.__SCENE__!.setCamera(camera); }, camera);
  await capture('far-healthy', 0);
  await session.page.evaluate(() => { const world = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game.world; for (const e of world.entities.iterate()) if (e.infected) e.health.current = e.health.max / 2; });
  await capture('far-damaged', 6);
  await session.page.evaluate(camera => {
    window.__SS__!.teleport('player', { x: 0, z: 0 }); window.__SCENE__!.setCamera(camera);
    const world = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game.world;
    let attackId = 7000;
    for (const e of [...world.entities.iterate()]) if (e.infected) world.combat!.damage.apply({ attackId: attackId++, actionId: 'weapon.rocket-launcher', sourceId: 1, targetId: e.id,
      origin: e.transform, direction: { x: 1, z: 0 }, base: 1000000, multiplier: 1, type: 'explosive', knockback: 0, stagger: 0, direct: true, permanent: true });
  }, camera);
  await session.step(2); await capture('dead-near', 0);
  await session.load({ ...spec, name: 'G-24-healthy-zoo', actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }, ...species.map((name, i) => ({ id: name, kind: 'animal' as const, species: name, at: point(i), state: 'idle' as const }))] });
  await session.step(1); await capture('healthy-zoo', 0);
  await session.makeSheet(shots, `test-results/${reportSlug}/G-24-${backend}-${tier}.jpg`, 640, 380);
} finally {
  writeFileSync(`docs/reports/${reportSlug}/G-24-${backend}-${tier}.json`, JSON.stringify({ ...provenance(), scriptSha256: createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'), backend, tier,
    setup: 'production renderer fixture; actual Alpha and five zoo species; native lethal damage; healthy animals; fixed camera; no route or timing claim', rows, errors: session.errors }, null, 2) + '\n');
  await session.close(); stopServer();
}
console.log(`${backend}/${tier}: ${rows.length} bar eligibility transitions captured`);
