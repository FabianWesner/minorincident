/** Additional E25 acceptance measurements, reusing the production Scene Lab/window scanline. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, stopServer } from '../scenelab/session';
import { windowLine } from '../../tests/helpers/window-parallax';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';
import type { Lighting } from '../../src/render/Lighting';
import type { FieldLight } from '../../src/render/LightField';
const tier = process.argv.includes('--low') ? 'low' : 'high', timing = process.argv.includes('--timing');
const out = process.env.E25_OUT ?? `test-results/epics/E25/extra-${tier}${timing ? '-timing' : ''}`;
mkdirSync(out, { recursive: true });
const s = new SceneSession({ tier, backend: 'webgl2', nativeFrameTiming: timing });
const results: Record<string, unknown> = { at: new Date().toISOString(), tier, timing };
const lin = (v: number) => v / 255 <= .04045 ? v / 3294.6 : ((v / 255 + .055) / 1.055) ** 2.4;
function rgb(p: PNG, x: number, y: number) { const i = (Math.round(y) * p.width + Math.round(x)) * 4; return [...p.data.subarray(i, i + 3)]; }
function lum(c: number[]) { return .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]); }
const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const shot = async (name: string) => PNG.sync.read(await s.screenshot(`${out}/${name}.png`));
const trailer = JSON.parse(readFileSync('tests/scenes/catalog/spec-audit-b-light-lab.json', 'utf8')) as SceneSpec;
try {
  await s.open();
  if (!timing && !process.argv.includes('--counters')) {
    // The same forty sources over the entire sixty-second path, at both tier budgets.
    await s.load(trailer); await s.step(120);
    results.promotions = await s.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const light = (game.view as unknown as { lighting: Lighting }).lighting;
      const fields: FieldLight[] = Array.from({ length: 40 }, (_, i) => ({ id: `walk-${i}`, x: i * 2, y: 3.4, z: 0, radius: 1.5, aimX: 0, aimZ: 0, stretch: 1, r: 1, g: 1, b: 1, on: true, hero: true, flicker: 0, strobe: false, seed: i }));
      light.set('night'); light.field.setStatic(fields);
      const changes: { frame: number; id: string | null; blend: number }[] = []; let prev: string | null = null;
      let maxLights = 0, maxMaps = 0;
      for (let frame = 0; frame < 3600; frame++) {
        const focus = { x: frame / 3599 * 80 - 1, y: 0, z: 0 };
        light.setHeroLight(light.field.heroAt(focus.x, focus.z), focus, frame / 60);
        const st = light.getState(); maxLights = Math.max(maxLights, st.heroLights); maxMaps = Math.max(maxMaps, st.heroShadowMaps);
        if (st.heroLight !== prev) { changes.push({ frame, id: st.heroLight, blend: st.promotionBlend }); prev = st.heroLight; }
      }
      const rollingMax = Math.max(...changes.map(c => changes.filter(d => d.frame >= c.frame && d.frame < c.frame + 60).length));
      return { lights: 40, seconds: 60, frames: 3600, changes, rollingMax, maxLights, maxMaps, pixelDeltaMeasured: false };
    });
    // Parallax measured in the window's coordinates, with its frame and mullion excluded.
    const house = JSON.parse(readFileSync('tests/scenes/catalog/qa-w6-window-depth.json', 'utf8')) as SceneSpec;
    await s.load(house); await s.step(12);
    const samples = [];
    for (const angle of [45, 60]) {
      await s.page.evaluate(angle => window.__SCENE__!.setCamera({ mode: 'orbit', radius: 19, polar: 54, azimuth: angle, target: [0, 1.3, 0] }), angle);
      await s.ready(); const line = await windowLine(s.page); if (line.length !== 200) throw Error(`window scanline has ${line.length} samples`);
      const image = await shot(`window-${angle}`), values = line.map(p => lum(rgb(image, (p[0] + 1) * image.width / 2, (1 - p[1]) * image.height / 2)));
      let edge = 0, gradient = -Infinity;
      for (let i = 20; i < 180; i++) if (i < 88 || i > 112) { const delta = values[i - 2] - values[i + 2]; if (delta > gradient) { gradient = delta; edge = i; } }
      const width = Math.hypot((line[199][0] - line[0][0]) * image.width / 2, (line[199][1] - line[0][1]) * image.height / 2);
      samples.push({ angle, line, values, edge, width, gradient });
    }
    await s.load({ ...house, props: house.props!.map(p => ({ ...p, powered: false })), camera: { mode: 'orbit', radius: 19, polar: 54, azimuth: 45, target: [0, 1.3, 0] } });
    await s.step(12); const dark = await shot('window-off');
    const darkValues = samples[0].line.map(p => lum(rgb(dark, (p[0] + 1) * dark.width / 2, (1 - p[1]) * dark.height / 2)));
    results.windows = { samples, dark: darkValues, shiftPx: Math.abs(samples[0].edge - samples[1].edge) / 199 * Math.min(samples[0].width, samples[1].width), glowRatio: Math.max(...samples[0].values) / Math.max(...darkValues) };
  }
  for (const scenario of ['light-lab', 'night-street']) {
    if (scenario === 'light-lab') { await s.load(trailer); await s.step(120); }
    else {
      await s.page.evaluate(async () => { await (window.__SCENE__ as unknown as { game: Game }).game.loadLevel('night-street', { seed: 1 }, 'perf-night-street'); window.__SS__!.pause(); });
      await s.page.evaluate(() => { const game = (window.__SCENE__ as unknown as { game: Game }).game; for (let i = 0; i < 120; i++) game.world.update(); game.view.advance(0); game.view.update(1); });
    }
    await s.ready();
    const frames = await s.page.evaluate(async timing => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game, times: number[] = []; let prev = 0;
      for (let i = 0; i < (timing ? 180 : 1); i++) { game.view.renderer.nextNodeFrame(); game.view.update(1); const now = await new Promise<number>(r => requestAnimationFrame(r)); if (i >= 60) times.push(now - prev); prev = now; }
      return { frameMs: times, perf: window.__SS__!.perf() };
    }, timing);
    const cdp = await s.page.context().newCDPSession(s.page);
    for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage'); await cdp.detach();
    frames.frameMs.sort((a, b) => a - b);
    results[scenario] = { ...frames, frameP95: frames.frameMs[Math.ceil(frames.frameMs.length * .95) - 1] ?? null, heap, state: await s.page.evaluate(() => window.__SS__!.getState().render) };
    await shot(scenario);
    if (scenario === 'night-street' && !timing) {
      // Find an open no-practical-light point in the real street before measuring the courier mask and its 2 m ring.
      const spot = await s.page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        const lamps = [...game.world.lightPower!.lamps.values()]; const d = game.world.districts!;
        let best = { x: 0, z: 0, distance: -Infinity };
        for (let x = -25; x <= 25; x++) for (let z = -25; z <= 25; z++) {
          if (!d.nav.walkable([x, z])) continue;
          const distance = Math.min(...lamps.filter(l => game.world.lightPower!.isOn(l.id)).map(l => Math.hypot(l.x - x, l.z - z)));
          if (distance > best.distance) best = { x, z, distance };
        }
        window.__SS__!.teleport('player', best); window.__SS__!.camera.follow(); game.view.advance(0); game.view.update(1); return best;
      });
      const image = await shot('night-player');
      await s.page.evaluate(() => window.__SS__!.settings.set({ idPass: true })); const mask = await shot('night-player-mask');
      const body: number[] = [];
      for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) { const c = rgb(mask, x, y); if (c[0] > 150 && c[2] > 150 && c[1] < 100) body.push(lum(rgb(image, x, y))); }
      await s.page.evaluate(() => window.__SS__!.settings.set({ idPass: false }));
      const ring = await s.page.evaluate(spot => Array.from({ length: 120 }, (_, i) => { const a = i / 120 * Math.PI * 2; return window.__SCENE__!.project([spot.x + Math.cos(a) * 2, .05, spot.z + Math.sin(a) * 2]); }), spot);
      const background = ring.map(p => lum(rgb(image, p.x, p.y)));
      results.readability = { spot, maskPixels: body.length, bodyMean: avg(body), ringMean: avg(background), ratio: avg(body) / avg(background), infectedEyesMeasured: false };
    }
    console.log(`${scenario} ${tier} captured`);
  }
  results.errors = s.errors;
} finally { writeFileSync(`${out}/measurements.json`, JSON.stringify(results, null, 2) + '\n'); await s.close(); stopServer(); }
console.log(`${out}/measurements.json`);
