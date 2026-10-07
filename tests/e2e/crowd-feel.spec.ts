import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { boot, test, expect } from './fixtures';

const stage = process.env.CROWD_CAPTURE ?? 'after';
const output = `test-results/epics/E07/crowd-feel/${stage}`;
test.use({ video: { mode: 'on', size: { width: 1280, height: 720 } } });

test('crowd draw visibility stays continuous for 60 seconds after the L1 outbreak @E07', async ({ page }) => {
  const videoStarted = Date.now();
  test.setTimeout(240_000); mkdirSync(output, { recursive: true });
  await boot(page);
  await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L1', { seed: 1, checkpoint: 'accident' });
    a.pause(); a.cheats.god(true); a.teleport('player', { x: 55, z: -10 }); a.camera.follow();
    for (const [i, c] of a.query({ kind: 'civilian' }).filter(e => !e.hidden && e.health.current > 0).slice(0, 12).entries()) a.teleport(c.id, { x: 51 + i % 4, z: -8 + Math.floor(i / 4) });
    await a.step(120); await a.screenshotReady();
  });
  const videoOffset = (Date.now() - videoStarted) / 1000;
  const capture = page.evaluate(async () => {
    const a = window.__SS__!;
    const histories = new Map<number, { missing: number; seen: boolean }>();
    const recentlySeen = new Map<number, number>();
    let unexplainedDepartures = 0;
    let infectedSamples = 0, movingInfectedSamples = 0, civilianSamples = 0;
    let flickerEvents = 0, sustainedDisappearances = 0, duplicateDraws = 0, frames = 0, onScreenSamples = 0;
    const start = performance.now(); a.resume();
    while (performance.now() - start < 60_000) {
      await new Promise(requestAnimationFrame); frames++;
      const figures = a.crowdFigures(), counts = new Map<number, number>();
      const instances = new Set<string>();
      for (const f of figures) if (f.drawn) {
        const key = f.instanceKey ?? String(f.id); if (instances.has(key)) duplicateDraws++; instances.add(key);
        counts.set(f.id, (counts.get(f.id) ?? 0) + 1);
      }
      // Query is authoritative: building entry/death/escape is never classified as a renderer disappearance.
      const eligible = new Set<number>();
      for (const e of [...a.query({ kind: 'civilian' }), ...a.query({ kind: 'infected' })]) {
        if (e.hidden || e.infected?.hidden || e.civilian?.pet) continue;
        const p = a.camera.project(e.transform.x, e.transform.y, e.transform.z);
        if (Math.abs(p[0]) > .9 || Math.abs(p[1]) > .9 || Math.abs(p[2]) > 1) continue;
        eligible.add(e.id);
        recentlySeen.set(e.id, a.tick());
        onScreenSamples++;
        if (e.infected) { infectedSamples++; if ((e.motion?.speed ?? 0) > .5) movingInfectedSamples++; } else if (e.civilian) civilianSamples++;
        let h = histories.get(e.id);
        if (!h) { h = { missing: 0, seen: false }; histories.set(e.id, h); }
        if (counts.has(e.id)) {
          if (h.seen && h.missing > 0 && h.missing <= 3) flickerEvents++;
          h.missing = 0; h.seen = true;
        } else { h.missing++; if (h.missing === 4) sustainedDisappearances++; }
      }
      for (const id of histories.keys()) if (!eligible.has(id)) histories.delete(id);
      for (const [id, seenAt] of recentlySeen) {
        if (a.tick() - seenAt > 3600) { recentlySeen.delete(id); continue; }
        if (!a.getEntity(id)) {
          if (!a.events(seenAt).some(e => e.type === 'outbreak.civilian-escaped' && e.id === id)) unexplainedDepartures++;
          recentlySeen.delete(id);
        }
      }
    }
    a.pause();
    return { seconds: (performance.now() - start) / 1000, frames, onScreenSamples, infectedSamples, movingInfectedSamples, civilianSamples, figures: histories.size, flickerEvents, sustainedDisappearances, duplicateDraws, unexplainedDepartures, eventsPerMinute: flickerEvents };
  });
  for (const [i, seconds] of [5, 15, 40].entries()) {
    await page.waitForTimeout(seconds * 1000);
    await page.screenshot({ path: `${output}/still-${i + 1}.png` });
  }
  const result = await capture;
  writeFileSync(`${output}/visibility.json`, JSON.stringify(result, null, 2));
  const video = page.video()!; await page.close();
  const raw = await video.path();
  execFileSync('ffmpeg', ['-y', '-ss', String(videoOffset), '-i', raw, '-t', '15', '-vf', 'scale=1280:-2', '-c:v', 'libvpx-vp9', '-threads', '2', '-deadline', 'realtime', '-cpu-used', '8', '-an', `${output}/outbreak.webm`], { stdio: 'ignore' });
  rmSync(raw, { force: true });
  expect(result.onScreenSamples).toBeGreaterThan(1000);
  expect(result.movingInfectedSamples).toBeGreaterThan(100);
  expect(result.civilianSamples).toBeGreaterThan(100);
  if (stage !== 'before') {
    expect(result.flickerEvents).toBe(0);
    expect(result.sustainedDisappearances).toBe(0);
    expect(result.duplicateDraws).toBe(0);
    expect(result.unexplainedDepartures).toBe(0);
  }
});

test('20 infected corpses remain drawn after walking 60 m away and returning @smoke @E07', async ({ page }) => {
  test.skip(stage === 'before'); test.setTimeout(180_000);
  await boot(page);
  const proof = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('horde-arena'); a.pause(); a.cheats.god(true);
    const ids = Array.from({ length: 20 }, (_, i) => a.spawn('infected.runner', { x: 3 + i % 5, z: -2 + Math.floor(i / 5) }, { state: 'idle' }));
    a.cheats.killAll(); await a.step(121); a.camera.cinematic({ position: [13, 12, 14], target: [5, .5, 0] }); await a.screenshotReady();
    const first = ids.filter(id => a.crowdFigures().some(f => f.id === id && f.drawn));
    // Stay inside the finite arena floor and exercise the actual walking controller.
    a.input.set({ moveTarget: { x: -50, z: 45 }, walk: true }); a.camera.follow(); await a.step(3000); a.input.clear();
    const away = a.getEntity(1)!.transform; await a.step(3601);
    const waited = a.getEntity(1)!.transform;
    a.input.set({ moveTarget: { x: 0, z: 0 }, walk: true }); await a.step(3000); a.input.clear();
    const returned = a.getEntity(1)!.transform;
    a.camera.cinematic({ position: [13, 12, 14], target: [5, .5, 0] }); await a.screenshotReady();
    a.settings.set({ gore: 'Off' }); await a.step(0); await a.screenshotReady();
    const goreOffVisible = ids.filter(id => a.crowdFigures().some(f => f.id === id && f.drawn)).length;
    a.settings.set({ gore: 'Full' }); await a.step(0); await a.screenshotReady();
    return { first: first.length, final: ids.filter(id => a.crowdFigures().some(f => f.id === id && f.drawn)).length, retained: ids.filter(id => a.getEntity(id)?.corpse).length, goreOffVisible, awayDistance: Math.hypot(away.x, away.z), waitedDistance: Math.hypot(waited.x, waited.z), awayY: waited.y, returnedDistance: Math.hypot(returned.x, returned.z) };
  });
  expect(proof).toMatchObject({ first: 20, final: 20, retained: 20 });
  expect(proof.goreOffVisible).toBe(20);
  expect(proof.awayDistance).toBeGreaterThanOrEqual(60); expect(proof.waitedDistance).toBeGreaterThanOrEqual(60);
  expect(proof.awayY).toBeGreaterThan(.5); expect(proof.returnedDistance).toBeLessThan(.2);
  mkdirSync(output, { recursive: true }); writeFileSync(`${output}/permanence.json`, JSON.stringify(proof, null, 2));
  await page.locator('canvas').screenshot({ path: `${output}/corpse-return.png` });
  await page.close(); rmSync(await page.video()!.path(), { force: true });
});

test('common-worker hierarchy and crowd remain readable at all delivered tiers @E07', async ({ page }) => {
  test.setTimeout(180_000); mkdirSync(output, { recursive: true });
  await page.goto('/preview/?asset=inf.common-worker&test=1&renderer=webgl');
  await page.waitForFunction(() => !!window.__ASSET__);
  await page.evaluate(() => window.__ASSET__!.ready);
  for (const quality of ['high', 'lod1', 'lod2'] as const) {
    await page.evaluate(quality => window.__ASSET__!.inspectionView!(quality, Math.PI / 4), quality);
    await page.locator('canvas').screenshot({ path: `${output}/worker-hierarchy-${quality}.png` });
  }
  for (const azimuth of [45, 135, 225, 315]) {
    await page.evaluate(azimuth => window.__ASSET__!.inspectionView!('lod1', azimuth), azimuth);
    await page.locator('canvas').screenshot({ path: `${output}/worker-angle-${azimuth}.png` });
  }
  await boot(page);
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('perf-horde-200'); a.pause(); a.cheats.god(true); a.camera.preset('perf-horde');
    await a.step(720); await a.screenshotReady();
  });
  await page.locator('canvas').screenshot({ path: `${output}/worker-horde.png` });
  await page.evaluate(async () => { const a = window.__SS__!; a.camera.cinematic({ position: [8, 6, 10], target: [3, .7, 0] }); await a.screenshotReady(); });
  await page.locator('canvas').screenshot({ path: `${output}/worker-crowd-close.png` });
  await page.close(); const raw = await page.video()!.path(); rmSync(raw, { force: true });
});
