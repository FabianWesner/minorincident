/** Headless production/main comparison. Own ports 4511/4512/4513; one GPU browser. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
const out = 'test-results/tex-zebra', report = 'docs/reports/tex-zebra';
mkdirSync(out, { recursive: true }); mkdirSync(report, { recursive: true });
const onlyMotions = process.argv.includes('--motions-only');
const baseline = process.env.ZEBRA_BASELINE ?? '/Users/wesner/Workspace/tex-zebra-baseline';
const pipeline = process.env.ZEBRA_PIPELINE ?? '/Users/wesner/Workspace/3dp-tex-zebra';
const old = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4511', '--strictPort', '--configLoader', 'runner'], { cwd: baseline, stdio: 'ignore' });
const viewer = spawn('python3', ['-m', 'http.server', '4513', '--bind', '127.0.0.1', '--directory', pipeline], { stdio: 'ignore' });
const results: unknown[] = [];
async function waitURL(url: string) { for (let i = 0; i < 120; i++) { try { if ((await fetch(url)).ok) return; } catch { /* booting */ } await new Promise(r => setTimeout(r, 500)); } throw new Error(`No server ${url}`); }
async function sheet(session: SceneSession, cells: { label: string; image: Buffer }[], path: string, columns = 2, width = 640) {
  const data = cells.map(c => ({ label: c.label, src: `data:image/png;base64,${c.image.toString('base64')}` }));
  const scratch = await session.page.context().newPage();
  try {
    const png = await scratch.evaluate(async ({ data, columns, width }) => {
      const images = await Promise.all(data.map(c => new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = c.src; })));
      const h = 400, canvas = document.createElement('canvas'); canvas.width = width * columns; canvas.height = (h + 28) * Math.ceil(data.length / columns);
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#20242b'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.font = '17px sans-serif';
      images.forEach((image, i) => { const x = i % columns * width, y = Math.floor(i / columns) * (h + 28), scale = Math.min(width / image.width, h / image.height); ctx.drawImage(image, x + (width - image.width * scale) / 2, y + 28 + (h - image.height * scale) / 2, image.width * scale, image.height * scale); ctx.fillStyle = '#fff'; ctx.fillText(data[i].label, x + 8, y + 21); });
      return canvas.toDataURL('image/png').split(',')[1];
    }, { data, columns, width });
    writeFileSync(path, Buffer.from(png, 'base64'));
  } finally { await scratch.close(); }
}
function rest(zoom: number): SceneSpec {
  const spec = readSpec('tests/scenes/zoo-s3/qa-zoo-zebra-kick.json'); spec.name = 'tex-zebra-comparison'; spec.script = []; spec.actors![0].at = [10, 8]; spec.actors![1].at = [-1, 0];
  spec.actors!.push({ id: 'healthy', kind: 'animal', species: 'zebra', at: [3, 0], yaw: 0 }); spec.camera = { mode: 'game', target: [1, 0], zoom }; return spec;
}
try {
  await waitURL('http://127.0.0.1:4511'); await waitURL('http://127.0.0.1:4513/artifacts/latest.html');
  let reference: Buffer | undefined;
  for (const backend of ['webgl2', 'webgpu'] as const) for (const tier of ['low', 'high'] as const) {
    if (onlyMotions && (backend !== 'webgpu' || tier !== 'high')) continue;
    const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 800 } });
    try {
      await session.open(); const currentURL = session.page.url();
      if (!onlyMotions && !reference) {
        await session.page.goto('http://127.0.0.1:4513/artifacts/latest.html#zebra');
        await session.page.waitForFunction(() => (window as unknown as { currentModelState?: { asset: string } }).currentModelState?.asset === 'zebra');
        reference = await session.page.locator('.compare').screenshot();
      }
      for (const zoom of onlyMotions ? [] : [1, 1.5]) {
        const cells: { label: string; image: Buffer }[] = [];
        for (const version of ['main', 'replacement']) {
          await session.page.goto(version === 'main' ? currentURL.replace(':4512', ':4511') : currentURL);
          await session.page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__, null, { timeout: 120_000 });
          await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
          await session.load(rest(zoom));
          const metrics = await session.metrics(); if (metrics.backend !== (backend === 'webgpu' ? 'webgpu' : 'webgl')) throw new Error(`Backend fallback ${backend}: ${metrics.backend}`);
          cells.push({ label: `${version} · ${backend} · ${tier} · zoom ${zoom}`, image: await session.screenshot(`${out}/${version}-${backend}-${tier}-${zoom}.png`) });
          results.push({ version, backend, tier, zoom, metrics, crowd: await session.page.evaluate(() => window.__SS__!.getState().render.crowd), errors: [...session.errors] });
        }
        cells.push({ label: 'Original draft + pipeline viewer · selected full source', image: reference! });
        await sheet(session, cells, `${report}/${backend}-${tier}-zoom${zoom}.png`, 2);
        console.log(`captured ${backend} ${tier} zoom ${zoom}`);
      }
      if (backend === 'webgpu' && tier === 'high') {
        const cells: { label: string; image: Buffer }[] = [];
        for (const move of ['kick', 'stampede'] as const) {
          const spec = readSpec(`tests/scenes/zoo-s3/qa-zoo-zebra-${move}.json`); spec.camera = { mode: 'game', target: move === 'kick' ? [0, 0] : [2, 0], zoom: 1.5 };
          await session.load(spec); let previous = 0;
          for (const frame of move === 'kick' ? [25, 42, 60, 84] : [35, 47, 60, 84]) { await session.step(frame - previous); previous = frame; cells.push({ label: `${move} f${frame}`, image: await session.screenshot(`${out}/${move}-${frame}.png`) }); }
          results.push({ move, metrics: await session.metrics() });
        }
        await sheet(session, cells, `${report}/special-motions.png`, 4, 480);
        const states: { label: string; image: Buffer }[] = [];
        for (const action of ['walk', 'run', 'hurt', 'death'] as const) {
          const spec = rest(1.5); spec.actors = spec.actors!.filter(a => a.id !== 'healthy'); spec.camera = { mode: 'follow', actor: 'animal', zoom: 1.5 }; spec.script = [];
          if (action === 'walk') { spec.actors![1] = { id: 'animal', kind: 'animal', species: 'zebra', at: [-1, 0], yaw: 0 }; }
          else if (action === 'run') { spec.actors![0].at = [10, 0]; spec.actors![1].state = 'chase'; }
          else if (action === 'hurt') spec.script = [{ frame: 5, actor: 'animal', do: { hit: { amount: 1, heavy: false } } }];
          await session.load(spec);
          await session.page.evaluate(action => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game, world = game.world;
            const animal = [...world.entities.iterate()].find(e => e.archetype === 'infected.zebra' || e.civilian?.zooAnimal === 'zebra')!;
            if (action === 'walk') { const c = animal.civilian!; c.waypoints = [{ x: -1, z: 0 }, { x: 10, z: 0 }]; c.waypoint = 1; c.pauseUntil = 0; }
            if (action === 'run') animal.infected!.specialCooldowns = { 'zebra.kick': 1000000, 'zebra.stampede': 1000000 };
            if (action === 'death') world.combat!.damage.apply({ attackId: 9911, actionId: 'burn', sourceId: 1, targetId: animal.id, origin: { x: -2, z: 0 }, direction: { x: 1, z: 0 }, base: 10000, multiplier: 1, type: 'status', permanent: true, knockback: 0, stagger: 0 });
          }, action);
          let previous = 0;
          const frames = action === 'death' ? [20, 180, 1800] : action === 'hurt' ? [8, 18] : [15, 30, 45];
          for (const frame of frames) { await session.step(frame - previous); previous = frame; states.push({ label: `${action} f${frame}`, image: await session.screenshot(`${out}/${action}-${frame}.png`) }); }
          const metrics = await session.metrics();
          if ((action === 'walk' || action === 'run') && metrics.actors.animal.travelM < .2) throw new Error(`${action} fixture did not move`);
          if (action === 'death' && metrics.grounding!.corpses < 1) throw new Error('Permanent corpse was not retained');
          results.push({ action, metrics, crowd: await session.page.evaluate(() => window.__SS__!.getState().render.crowd) });
        }
        await sheet(session, states, `${report}/gaits-hurt-corpses.png`, 4, 480);
      }
      if (session.errors.length) throw new Error(session.errors.join('\n'));
    } finally { await session.close(); }
  }
} finally { writeFileSync(`${out}/${onlyMotions ? 'motions' : 'captures'}.json`, JSON.stringify(results, null, 2)); old.kill(); viewer.kill(); stopServer(); }
