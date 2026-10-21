import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, readSpec, stopServer } from '../../tools/scenelab/session';
import { healthBarColors, nightHealthBarGains } from '../../src/ui/health';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

test.describe.configure({ mode: 'serial' });
const output = process.env.HEALTH_BAR_OUT ?? 'docs/reports/alpha-bars';
const night = process.env.HEALTH_BAR_NIGHT === '1';
const backend = process.env.HEALTH_BAR_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
const fixture = readSpec('tests/scenes/health-bars/shared.json');
for (const [width, height, tier] of [[1600, 900, 'high'], [390, 844, 'low'], [844, 390, 'low']] as const) {
  test(`T-E07-06-alpha-${width} @E07-AC06 Alpha bar follows actual HP at game camera ${tier}`, async () => {
    test.setTimeout(180_000);
    const session = new SceneSession({ backend, tier, viewport: { width, height } });
    try {
      await session.open();
      await session.load({ name: 'alpha-bar', size: 40, ground: 'asphalt', dof: false, time: night ? 'L6' : 'L1',
        actors: [{ id: 'courier', kind: 'courier', at: [0, 0], state: 'idle' }, { id: 'alpha', kind: 'infected', archetype: 'infected.alpha', at: [3, 0], state: 'idle' }],
        camera: { mode: 'game', target: [0, 0] } });
      const id = (await session.describe()).actors.find(a => a.id === 'alpha')!.entity;
      const before = await session.page.evaluate(id => ({ hp: window.__SS__!.getEntity(id)!.health, bar: window.__SS__!.getState().render.healthBars!.bars.find(b => b.id === id) }), id);
      expect(before.bar).toMatchObject({ fraction: 1, width: width === 1600 ? 64 : 48, height: width === 1600 ? 8 : 6 });
      mkdirSync(output, { recursive: true }); await session.screenshot(`${output}/alpha-before-${width}.png`);
      await session.page.evaluate(async () => { window.__SCENE__!.command('alpha', { hit: { amount: 60 } }); await window.__SS__!.step(0); });
      const after = await session.page.evaluate(id => ({ hp: window.__SS__!.getEntity(id)!.health, bar: window.__SS__!.getState().render.healthBars!.bars.find(b => b.id === id) }), id);
      expect(after.hp.current).toBeLessThan(before.hp.current);
      expect(Math.abs(after.bar!.fraction - after.hp.current / after.hp.max)).toBeLessThanOrEqual(.01);
      await session.screenshot(`${output}/alpha-after-${width}.png`);
      expect(session.errors).toEqual([]);
      writeFileSync(`${output}/alpha-proof-${width}.json`, JSON.stringify({ width, height, tier, backend, night, before, after }, null, 2));
    } finally { await session.close(); stopServer(); }
  });
  test(`T-E07-06-bars-${width} @E07-AC06 @E07-AC19 @E30-AC15 shared bars at game camera ${tier}`, async () => {
    test.setTimeout(180_000);
    const session = new SceneSession({ backend, tier, viewport: { width, height } });
    const spec: SceneSpec = { ...fixture, time: night ? 'L6' : fixture.time, actors: fixture.actors!.filter(a => ['courier', 'near', 'normal'].includes(a.id!)), script: [] };
    try {
      await session.open();
      await session.load({ ...spec, barArchetypes: [] });
      expect(await session.page.evaluate(() => window.__SS__!.perf().backend)).toBe(backend === 'webgl2' ? 'webgl' : 'webgpu');
      mkdirSync(output, { recursive: true });
      const beforeImage = PNG.sync.read(await session.screenshot(`${output}/before-${width}.png`));
      await session.load(spec); await session.ready();
      const state = () => session.page.evaluate(() => window.__SS__!.getState().render.healthBars!);
      const described = await session.describe(), id = described.actors.find(a => a.id === 'near')!.entity;
      let bars = await state(); expect(bars.count).toBe(1); expect(bars.bars[0].id).toBe(id);
      expect(bars.bars[0].fraction).toBe(1);
      expect(bars.bars[0].width).toBe(width === 1600 ? 64 : 48); expect(bars.bars[0].height).toBe(width === 1600 ? 8 : 6);
      // Real damage; one presentation frame must reflect the actual effective HP.
      await session.page.evaluate(async () => { window.__SCENE__!.command('near', { hit: { amount: 30 } }); await window.__SS__!.step(0); });
      bars = await state(); const hp = await session.page.evaluate(id => window.__SS__!.getEntity(id)!.health, id);
      expect(Math.abs(bars.bars[0].fraction - hp.current / hp.max)).toBeLessThanOrEqual(.01);
      const png = PNG.sync.read(await session.screenshot(`${output}/after-${width}.png`));
      // Most of the game image must survive compositing; bars and hit flashes affect only small regions.
      let changed = 0;
      for (let i = 0; i < png.data.length; i += 4) if (Math.abs(png.data[i] - beforeImage.data[i]) + Math.abs(png.data[i + 1] - beforeImage.data[i + 1]) + Math.abs(png.data[i + 2] - beforeImage.data[i + 2]) > 30) changed++;
      expect(changed / (png.width * png.height)).toBeLessThan(.1);
      const b = bars.bars[0], sample = (x: number, y: number) => { const i = (Math.round(y) * png.width + Math.round(x)) * 4; return [...png.data.subarray(i, i + 3)]; };
      const luminance = (rgb: number[]) => rgb.map(v => v / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((s, c, i) => s + c * [.2126, .7152, .0722][i], 0);
      const pixels = [sample(b.x - b.width / 4, b.y), sample(b.x + b.width / 4, b.y), sample(b.x - b.width / 2 - 1, b.y)];
      const ls = pixels.map(luminance), contrast = ls.flatMap((a, i) => ls.slice(i + 1).map(v => (Math.max(a, v) + .05) / (Math.min(a, v) + .05)));
      for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(3);
      if (night) {
        const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
        expect(ls[0]).toBeCloseTo(luminance(rgb(healthBarColors.fill)) * nightHealthBarGains.fill, 2);
        expect(ls[2]).toBeCloseTo(luminance(rgb(healthBarColors.outline)) * nightHealthBarGains.outline, 2);
      }
      // Camera movement: bar center stays on its world anchor within two CSS pixels.
      await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'game', target: [-1, 1], zoom: .85 }));
      bars = await state(); expect(bars.count).toBe(1);
      const projected = await session.page.evaluate(anchor => window.__SS__!.camera.project(anchor[0], anchor[1], anchor[2]), bars.bars[0].anchor);
      expect(Math.abs((projected[0] + 1) / 2 * width - bars.bars[0].x)).toBeLessThanOrEqual(2);
      expect(Math.abs((1 - projected[1]) / 2 * height - bars.bars[0].y)).toBeLessThanOrEqual(2);
      // Recoverable death keeps an empty bar; explosive death removes it.
      await session.page.evaluate(async () => { window.__SCENE__!.command('near', { hit: { amount: 1000 } }); await window.__SS__!.step(0); });
      bars = await state(); expect(bars.count).toBe(1); expect(bars.bars[0].fraction).toBe(0);
      await session.page.evaluate(async id => { const a = window.__SS__!; await a.step(a.getEntity(id)!.infected!.recoverAt - a.tick() + 1); }, id);
      expect((await state()).bars[0].fraction).toBe(1);
      await session.page.evaluate(async () => { window.__SCENE__!.effect({ blast: 'explosion.car', at: [-3, 0] }); await window.__SCENE__!.step(1); });
      expect((await state()).count).toBe(0);
      // Healthy-to-infected conversion on the same id uses the shared eligibility path.
      await session.load(spec);
      const normalId = (await session.describe()).actors.find(a => a.id === 'normal')!.entity;
      expect((await state()).bars.some(b => b.id === normalId)).toBe(false);
      await session.page.evaluate(async () => { window.__SCENE__!.command('normal', { infect: { instant: true } }); await window.__SS__!.step(0); });
      expect((await state()).bars.some(b => b.id === normalId)).toBe(true);
      // Pristine at 15m, pristine beyond 15m, damaged beyond 15m; camera is fixed on the target.
      await session.load({ ...spec, actors: spec.actors!.filter(a => a.kind !== 'pedestrian') });
      await session.page.evaluate(async () => { const a = window.__SS__!; a.teleport(1, { x: 12, z: 0 }); await a.step(0); });
      expect((await state()).count).toBe(1);
      await session.page.evaluate(async () => { const a = window.__SS__!; a.teleport(1, { x: 12.01, z: 0 }); await a.step(0); });
      expect((await state()).count).toBe(0);
      await session.page.evaluate(async () => { window.__SCENE__!.command('near', { hit: { amount: 1 } }); await window.__SS__!.step(0); });
      expect((await state()).count).toBe(1);
      await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'game', target: [35, 35] }));
      expect((await state()).count).toBe(0);
      await session.load(readSpec('tests/scenes/health-bars/occlusion.json')); await session.step(1);
      await session.screenshot(`${output}/occlusion-before-${width}.png`);
      expect((await state()).count).toBe(0);
      await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'orbit', target: [-5, -5], radius: 19, azimuth: 225, polar: 54 }));
      expect((await state()).count).toBe(1);
      await session.screenshot(`${output}/occlusion-after-${width}.png`);
      await session.load(readSpec('tests/scenes/health-bars/zoo.json')); await session.ready();
      const zoo = (await session.describe()).actors.filter(a => ['lion', 'gorilla', 'flamingo'].includes(a.id));
      expect((await state()).bars.map(b => b.id).sort()).toEqual(zoo.map(a => a.entity).sort());
      await session.screenshot(`${output}/zoo-before-${width}.png`);
      await session.page.evaluate(async zoo => {
        for (const actor of zoo) { const e = window.__SS__!.getEntity(actor.entity)!; window.__SCENE__!.command(actor.id, { hit: { amount: e.health.max / 2 } }); }
        await window.__SS__!.step(0);
      }, zoo);
      for (const bar of (await state()).bars) expect(bar.fraction).toBe(.5);
      await session.screenshot(`${output}/zoo-after-${width}.png`);
      expect(session.errors).toEqual([]);
      writeFileSync(`${output}/proof-${width}.json`, JSON.stringify({ width, height, tier, hp, pixels, contrast, bars }, null, 2));
    } finally { await session.close(); stopServer(); }
  });
}
for (const [tier, count] of [['high', 200], ['low', 100]] as const) {
  test(`T-E07-bars-budget-${tier} @E07-AC12 @E18-AC01 @perf pooled bar budget at ${count} infected`, async () => {
    test.setTimeout(180_000);
    const session = new SceneSession({ tier });
    const spec: SceneSpec = { name: `qa-health-bars-${count}`, size: 80, infectedCap: 200, ground: 'asphalt', seed: 7, barArchetypes: ['infected.runner'],
      actors: [{ id: 'courier', kind: 'courier', at: [0, 0], state: 'idle' }, { id: 'ring', kind: 'infected', at: [0, 0], count, spread: 12, yaw: 180, state: 'idle' }],
      camera: { mode: 'game', target: [0, 0], zoom: 4 }, dof: false };
    try {
      await session.open(); await session.load({ ...spec, barArchetypes: [] }); await session.step(1); await session.ready();
      const cdp = await session.page.context().newCDPSession(session.page);
      await cdp.send('HeapProfiler.collectGarbage');
      // Match E18's retained JS heap measurement, rather than Chromium's coarse performance.memory estimate.
      const beforeHeap = await cdp.send('Runtime.getHeapUsage');
      const before = { ...await session.page.evaluate(() => window.__SS__!.perf()), heapBytes: beforeHeap.usedSize };
      await session.screenshot(`${output}/perf-before-${tier}.png`);
      await session.load(spec); await session.step(1); await session.ready();
      await cdp.send('HeapProfiler.collectGarbage');
      const afterHeap = await cdp.send('Runtime.getHeapUsage');
      const after = await session.page.evaluate(() => ({ perf: window.__SS__!.perf(), bars: window.__SS__!.getState().render.healthBars!, crowd: window.__SS__!.getState().render.crowd! }));
      after.perf.heapBytes = afterHeap.usedSize;
      await session.screenshot(`${output}/perf-after-${tier}.png`);
      writeFileSync(`${output}/perf-${tier}.json`, JSON.stringify({ before, ...after }, null, 2));
      expect(after.bars.count).toBe(count); expect(after.bars.draws).toBe(3);
      expect(after.crowd.instances).toBe(count);
      // Exactly three pooled draws, with inline color conversion.
      expect(after.perf.profile!.other.drawCalls - before.profile!.other.drawCalls).toBe(3);
      expect(after.perf.drawCalls - before.drawCalls).toBe(3);
      expect(after.perf.triangles - before.triangles).toBe(count * 6);
      expect(after.perf.drawCalls).toBeLessThanOrEqual(tier === 'high' ? 600 : 300);
      expect(after.perf.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
      expect(after.perf.heapBytes! / 1_000_000).toBeLessThanOrEqual(tier === 'high' ? 400 : 250);
      expect(session.errors).toEqual([]);
    } finally { await session.close(); stopServer(); }
  });
}
