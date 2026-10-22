import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { boot, expect, test } from '../fixtures';
import { tick as inputTick } from '../input-helpers';
import { crossing } from '../../../src/levels/L9/district';
import { Recorder } from '../../../src/input/Recorder';
import { preset } from '../../../src/sim/progression/Campaign';
import type { Game } from '../../../src/Game';

// Native headless GPU, including an explicit backend assertion (no silent fallback).
test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });
const out = 'test-results/epics/E31/Q3';
async function tick(page: Page, ticks = 1) {
  // Fixed input stepping pauses the RAF clock; advance the existing render clock for smoke/trails too.
  await page.evaluate(n => window.__SS__!.vfx.stepRender(Math.min(1, n / 60)), ticks);
  return inputTick(page, ticks);
}
async function homeClear(page: Page) {
  const home = page.getByTestId('home-button'); await expect(home).toBeVisible();
  const h = (await home.boundingBox())!;
  for (const id of ['minimap', 'vitals', 'corgi-companion', 'objective-tracker', 'pause-button', 'vehicle-durability']) {
    const b = await page.getByTestId(id).boundingBox();
    if (b) expect(h.x < b.x + b.width && h.x + h.width > b.x && h.y < b.y + b.height && h.y + h.height > b.y, `Home overlaps ${id}`).toBe(false);
  }
}
for (const backend of ['webgl', 'webgpu'] as const) for (const zoom of [1, .5, 1.5]) for (const hp of [1000, 0]) {
  test(`T-E31-17-input @E31-AC08 @E31-AC09 @E31-AC12 @E31-AC15 @E31-AC16 @E31-AC17 @E31-AC18 ${backend} zoom=${zoom} HP=${hp}`, async ({ page, context }, info) => {
    test.setTimeout(300_000);
    const touch = info.project.name.startsWith('pixel'), quality = touch ? 'low' : 'high';
    // Both projects leave/rejoin the road; keyboard takes the long road, touch the open countryside.
    const route = crossing.routes.find(r => r.id === (touch ? 'countryside' : 'road'))!.detour;
    const name = `${info.project.name}-${backend}-z${zoom}-hp${hp}`;
    mkdirSync(out, { recursive: true });
    await boot(page, `/?test=1&scenelab=1&ui=1&renderer=${backend}&quality=${quality}&audio=muted&dpr=1`);
    await page.mouse.click(200, 400);
    const save = preset('L8-default'); save.completedLevels = 8; save.unlockedLevel = 9; save.settings.quality = quality;
    await page.evaluate(async ({ save, hp }) => {
      const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
      game.campaign = save; await api.loadLevel('L9', { seed: 31 }); api.pause();
      // Initial fixture only. From here to the crash there are no position/mission/input writes.
      const car = game.world.missions!.l9!.state.carId;
      game.world.vehicles!.damage(car, 1000 - hp);
      // Keep speaker output muted by the URL, but enable the actual cue graph after UI setup.
      api.settings.set({ muted: false, captions: true }); await api.audio.unlock(); api.input.record();
    }, { save, hp });
    await tick(page);
    expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(backend);
    const carId = await page.evaluate(() => window.__SS__!.getState().l9!.carId);
    await expect(page.getByTestId('durability-label')).toHaveText(hp ? 'Armor 1000 / 1000' : 'Barely functional');
    await homeClear(page);
    if (zoom !== 1) {
      // Wheel notches change zoom by one step regardless of delta magnitude.
      for (let i = 0; i < 5; i++) await page.mouse.wheel(0, zoom < 1 ? -100 : 100);
      await tick(page, 60);
    }
    expect(await page.evaluate(() => window.__SS__!.getState().render!.camera.zoom)).toBeCloseTo(zoom, 2);
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${out}/${name}-start.png` });
    const cdp = await context.newCDPSession(page);
    const origin = { x: 90, y: page.viewportSize()!.height - 240 };
    async function finger(type: 'touchStart' | 'touchMove' | 'touchEnd', x = origin.x, y = origin.y) {
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ id: 1, x, y, radiusX: 1, radiusY: 1 }] });
      await cdp.send('Runtime.evaluate', { expression: 'new Promise(r => requestAnimationFrame(r))', awaitPromise: true });
    }
    if (touch) await finger('touchStart');
    else { await page.mouse.move(800, 450); await page.mouse.down(); await page.keyboard.down('KeyW'); }
    let index = 1, traveled = 0, peakChunks = 0, previousHP = hp;
    const samples = [];
    for (let i = 0; i < 1500; i++) {
      const s = await page.evaluate(id => {
        const a = window.__SS__!, state = a.getState(), car = a.getEntity(id)!;
        return { phase: state.l9?.phase, scenario: state.scenario, p: car.transform, hp: car.health.current, speed: car.vehicle!.speed, perf: { terrain: a.perf().terrain } };
      }, carId);
      if (s.phase !== 'driving') break;
      while (index < route.length - 1 && Math.hypot(route[index][0] - s.p.x, route[index][1] - s.p.z) < 8) index++;
      const dx = route[index][0] - s.p.x, dz = route[index][1] - s.p.z, distance = Math.hypot(dx, dz);
      const want = -Math.atan2(dz, dx), delta = Math.atan2(Math.sin(want - s.p.yaw), Math.cos(want - s.p.yaw));
      if (touch) {
        // Invert the production camera-relative stick transform, then send a real drag.
        const screen = await page.evaluate(({ dx, dz, distance }) => {
          const camera = (window.__SCENE__ as unknown as { game: Game }).game.view.camera;
          const e = camera.matrixWorld.elements, l = Math.hypot(e[8], e[10]), fx = -e[8] / l, fz = -e[10] / l;
          return { x: (-fz * dx + fx * dz) / distance, y: (-fx * dx - fz * dz) / distance };
        }, { dx, dz, distance });
        await finger('touchMove', origin.x + screen.x * 60, origin.y + screen.y * 60); await tick(page, 30);
      } else {
        // LevelNineBot's pure pursuit, expressed as real key pulses instead of injected frames.
        const steer = Math.max(-1, Math.min(1, delta * 2)), n = Math.round(Math.abs(steer) * 30), key = steer > 0 ? 'KeyD' : 'KeyA';
        if (n) { await page.keyboard.down(key); await tick(page, n); await page.keyboard.up(key); }
        if (n < 30) await tick(page, 30 - n);
      }
      traveled++;
      peakChunks = Math.max(peakChunks, s.perf.terrain?.resident ?? 0);
      if (i % 60 === 0) samples.push({ tick: i * 30, at: s.p, hp: s.hp, chunks: s.perf.terrain });
      expect(s.hp).toBeLessThanOrEqual(previousHP); previousHP = s.hp;
      if (!hp) { expect(s.hp).toBe(0); expect(s.speed).toBeLessThanOrEqual(10.8 * 1.02); }
      if (i === 90) { await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/${name}-route.png` }); }
    }
    if (touch) await finger('touchEnd'); else { await page.keyboard.up('KeyW'); await page.mouse.up(); }
    expect(traveled).toBeGreaterThan(100);
    expect(index).toBe(route.length - 1);
    expect(peakChunks).toBeLessThanOrEqual(touch ? 9 : 25);
    expect(await page.evaluate(() => window.__SS__!.getState().l9!.phase)).toBe('approach');
    const recording = await page.evaluate(() => window.__SS__!.input.stopRecording());
    writeFileSync(`${out}/${name}.ssrec`, Recorder.serialize(recording));
    writeFileSync(`${out}/${name}-route.json`, JSON.stringify(samples, null, 2));
    expect(recording.frames.some(f => touch ? f.aimSource === 'touch' : f.drive?.throttle === 1)).toBe(true);
    const before = await page.evaluate(() => ({ events: window.__SS__!.events(), audio: window.__SS__!.audio.snapshot() }));
    writeFileSync(`${out}/${name}-audio.json`, JSON.stringify(before.audio, null, 2));
    expect(before.events.filter(e => e.type === 'vehicle.exploded' || e.type === 'vehicle.exited')).toHaveLength(0);
    expect(before.audio.cues.some(c => c.cue === 'vehicle.engine-low')).toBe(true);
    expect(before.audio.voiceLimit).toBe(touch ? 16 : 32);
    if (!hp) expect(before.audio.cues.some(c => c.cue === 'vehicle.sputter')).toBe(true);
    await tick(page, 301);
    expect(await page.evaluate(() => window.__SS__!.getState().l9!.phase)).toBe('impact');
    await expect(page.getByTestId('mission-subtitle')).toContainText('bridge gave way');
    const impact = await page.evaluate(id => ({ car: window.__SS__!.getEntity(id)!, events: window.__SS__!.events(), audio: window.__SS__!.audio.snapshot() }), carId);
    expect(impact.events.filter(e => e.type === 'vehicle.exploded')).toHaveLength(1);
    expect(impact.car.vehicle).toMatchObject({ damage: 'exploded', driver: null });
    expect(impact.audio.cues.some(c => c.cue === 'vehicle.crash')).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__SS__!.audio.emitters().filter(v => v.loop && (v.cue.startsWith('vehicle.engine-') || v.cue === 'vehicle.sputter')).length)).toBe(0);
    await page.screenshot({ path: `${out}/${name}-impact.png` });
    await page.evaluate(() => window.__SS__!.audio.clearLog());
    await tick(page, 250);
    expect(await page.evaluate(() => window.__SS__!.getState().player!.survivor!.scriptedClip)).toBe('crawl');
    expect(await page.evaluate(() => window.__SS__!.audio.snapshot().cues.some(c => c.sourceId === 1 && c.cue.startsWith('footstep.survivor.')))).toBe(true);
    await page.screenshot({ path: `${out}/${name}-crawl.png` });
    await tick(page, 400);
    await expect.poll(() => page.evaluate(() => window.__SS__!.getState().scenario), { timeout: 120_000 }).toBe('L10');
    await page.evaluate(async () => { window.__SS__!.pause(); await window.__SS__!.step(1); });
    const end = await page.evaluate(() => ({ state: window.__SS__!.getState(), save: window.__SS__!.campaign.state() }));
    expect(end.save!.ownedActions.filter(id => id.startsWith('weapon.'))).toEqual(['weapon.fire-axe']);
    expect(end.save!.ownedActions.filter(id => !id.startsWith('weapon.'))).toEqual(save.ownedActions.filter(id => !id.startsWith('weapon.')));
    expect(end.save!.upgrades).toEqual(save.upgrades);
    expect(end.save!.crossingHandover).toMatchObject({ applied: true, checkpoint: 'cure-crash' });
    expect(end.save!.crossingHandover!.lostWeapons.length).toBeGreaterThan(0);
    expect(end.save!.pending).toBeUndefined();
    expect(end.state.entities.some(e => e.companion && e.health.current > 0)).toBe(true);
    for (const side of ['LEFT', 'RIGHT'] as const) expect(end.state.player!.weapons![side].rack.map(s => s.id)).toEqual(['weapon.fire-axe']);
    expect(end.state.player!.hidden).not.toBe(true);
    expect(await page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.world.vehicles!.active)).toBeNull();
    expect(end.state.player!.health.current).toBe(end.state.player!.health.max);
    await homeClear(page);
    await expect(page.getByTestId('weapon-active')).toHaveAttribute('data-weapon', 'weapon.fire-axe');
    await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/${name}-axe.png` });
    // The narrow mouse layout reported by Q2 is exercised independently of touch media queries.
    if (!touch) { await page.setViewportSize({ width: 390, height: 844 }); await tick(page); await homeClear(page); await page.screenshot({ path: `${out}/${name}-narrow.png` }); }
    await cdp.detach();
  });
}

for (const backend of ['webgl', 'webgpu'] as const) test(`T-E31-22-input @E31-AC08 @E31-AC16 @E31-AC22 ${backend} cumulative HUD, audio and caption stages`, async ({ page }, info) => {
  test.setTimeout(180_000);
  const quality = info.project.name.startsWith('pixel') ? 'low' : 'high';
  await boot(page, `/?test=1&scenelab=1&ui=1&renderer=${backend}&quality=${quality}&audio=muted&dpr=1`);
    await page.mouse.click(200, 400);
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L9', { seed: 31 }); a.pause(); a.settings.set({ muted: false, captions: true }); await a.audio.unlock(); });
  mkdirSync(out, { recursive: true });
  let previous = 1000;
  for (const [hp, stage, caption] of [[760, 0, ''], [750, 1, 'Armor dented'], [510, 1, ''], [500, 2, 'Glass cracked'], [260, 2, ''], [250, 3, 'Engine smoking'], [10, 3, ''], [0, 4, 'Barely functional']] as const) {
    const result = await page.evaluate(async ({ damage }) => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
      a.audio.clearLog(); game.world.vehicles!.damage(game.world.missions!.l9!.state.carId, damage); await a.step(1);
      return { car: a.getEntity(a.getState().l9!.carId)!, render: game.view.labProbes().vehicles!.snapshot().find(v => v.id === a.getState().l9!.carId)!.apcDamage, audio: a.audio.snapshot(), events: a.events() };
    }, { damage: previous - hp });
    expect(result.car.vehicle!.stage).toBe(stage);
    expect(result.render).toMatchObject({ stage, dents: stage >= 1, glass: stage >= 2, smoke: stage === 4 ? 'heavy' : stage === 3 ? 'light' : 'none' });
    await expect(page.getByTestId('durability-label')).toHaveText(hp ? `Armor ${hp} / 1000` : 'Barely functional');
    const contrast = await page.getByTestId('durability-label').evaluate(label => {
      const luminance = (color: string) => {
        const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      const ink = luminance(getComputedStyle(label).color);
      return [label.parentElement!, document.querySelector('[data-testid=durability-fill]')!].map(e => {
        const background = luminance(getComputedStyle(e).backgroundColor);
        return (Math.max(ink, background) + .05) / (Math.min(ink, background) + .05);
      });
    });
    expect(Math.min(...contrast)).toBeGreaterThanOrEqual(3);
    if (caption) {
      expect(result.audio.captions.some(c => c.includes(caption))).toBe(true);
      await expect(page.locator('[data-audio-captions]')).toContainText(caption);
      expect(result.audio.cues.some(c => c.cue === 'vehicle.sputter')).toBe(true);
      expect(result.events.filter(e => e.type === 'vehicle.damage-stage' && e.stage === stage)).toHaveLength(1);
      await tick(page, 10);
      expect(await page.evaluate(stage => window.__SS__!.events().filter(e => e.type === 'vehicle.damage-stage' && e.stage === stage).length, stage)).toBe(1);
    }
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${out}/${info.project.name}-${backend}-stage-${hp}.png` });
    expect(result.audio.voices).toBeLessThanOrEqual(quality === 'low' ? 16 : 32);
    previous = hp;
  }
});
