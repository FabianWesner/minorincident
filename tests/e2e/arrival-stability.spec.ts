import { writeFileSync } from 'node:fs';
import { test, expect, boot, testUrl } from './fixtures';

for (const skin of [0, 1]) test(`courier skin=${skin} arrival remains idle beside corgi and curb for 3 seconds @E03 @E04`, async ({ page }, info) => {
  await boot(page, `${testUrl}&skin=${skin}`);
  await page.evaluate(async () => { await window.__SS__!.loadLevel('L1', { seed: 1 }); window.__SS__!.pause(); });
  for (const target of [{ x: -66.4, z: 5.5 }, { x: -67.5, z: 3.2 }]) {
    const point = await page.evaluate(p => window.__SS__!.input.project(p), target);
    await page.mouse.click(point.x, point.y);
    await page.evaluate(async () => { const a = window.__SS__!; await a.step(300); await a.screenshotReady(); });
    // Sample every rendered fixed tick for 3 s, then fractional live render frames below.
    const frames = await page.evaluate(async () => {
      const api = window.__SS__!, frames = [];
      for (let i = 0; i < 180; i++) {
        await api.step(1); const s = api.getState(), p = s.player!;
        frames.push({ tick: s.tick, position: p.transform, velocity: p.survivor!.velocity, animation: p.survivor!.animation, character: s.render.character!, marker: s.render.moveMarker! });
      }
      return frames;
    });
    writeFileSync(info.outputPath(`arrival-${target.z}.json`), JSON.stringify(frames, null, 2));
    let travel = 0;
    for (const [i, f] of frames.entries()) {
      expect(f.animation).toBe('idle'); expect(f.character.clip).toBe('idle'); expect(f.marker.visible).toBe(false);
      expect(f.character.skinned).toBe(skin === 1);
      expect(Math.hypot(f.velocity.x, f.velocity.z)).toBeLessThan(.001);
      expect(Math.abs(f.position.yaw - frames[0].position.yaw)).toBeLessThan(.001);
      if (i) { const p = frames[i - 1].position; travel += Math.hypot(f.position.x - p.x, f.position.y - p.y, f.position.z - p.z); }
    }
    expect(travel / 3).toBeLessThanOrEqual(.001);
    expect(Math.hypot(frames[0].position.x - target.x, frames[0].position.z - target.z)).toBeLessThan(.15);
    const live = await page.evaluate(async () => {
      const api = window.__SS__!, frames = []; api.resume(); const start = performance.now();
      while (performance.now() - start < 3000) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); const s = api.getState();
        frames.push({ transform: s.player!.transform, velocity: s.player!.survivor!.velocity, animation: s.player!.survivor!.animation, character: s.render.character! });
      }
      api.pause(); return frames;
    });
    writeFileSync(info.outputPath(`arrival-live-${target.z}.json`), JSON.stringify(live, null, 2));
    expect(live.length).toBeGreaterThan(30);
    let liveTravel = 0;
    for (const [i, f] of live.entries()) {
      expect(f.animation).toBe('idle'); expect(f.character.clip).toBe('idle'); expect(Math.abs(f.character.yaw - live[0].character.yaw)).toBeLessThan(.001);
      expect(Math.hypot(f.velocity.x, f.velocity.z)).toBeLessThan(.001);
      if (i) { const p = live[i - 1].transform; liveTravel += Math.hypot(f.transform.x - p.x, f.transform.y - p.y, f.transform.z - p.z); }
    }
    expect(liveTravel / 3).toBeLessThanOrEqual(.001);
  }
});
