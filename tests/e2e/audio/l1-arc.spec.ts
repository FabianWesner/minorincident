import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';

/** Lane H: the accident beat in the real browser: events in order, ringing + calm drop, and no frame hitch at the blast. */
test('T-E19-19d @E19 @E19-AC19 @E19-AC21 accident events produce the cue order and no frame above 50 ms', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  await page.mouse.click(200, 250);
  const data = await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L1'); a.missions.begin(); a.resume();
    await a.audio.unlock();
    a.audio.clearLog();
    const frames: { t: number; dt: number }[] = [];
    let last = performance.now(), running = true;
    const loop = () => { const now = performance.now(); frames.push({ t: now, dt: now - last }); last = now; if (running) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    const start = performance.now();
    await new Promise(r => setTimeout(r, 2500)); // calm
    const stamps: Record<string, number> = {};
    // Compressed accident timeline (spec offsets / 3): flicker, blast, ringing, smoke, screams, exit.
    for (const [type, at] of [['l1.flicker', 0], ['l1.blast', 500], ['l1.ringing', 570], ['l1.smoke', 970], ['l1.screams', 1170], ['l1.infectedExit', 3000]] as const) {
      await new Promise(r => setTimeout(r, Math.max(0, start + 2500 + at - performance.now())));
      stamps[type] = performance.now() - start;
      a.audio.emit({ type, tick: 0, anchor: 'lab-exit-window' } as never);
    }
    await new Promise(r => setTimeout(r, 3000));
    running = false;
    const snap = a.audio.snapshot();
    return { frames, stamps, cues: snap.cues.map(c => ({ cue: c.cue, t: c.time })), start, errors: snap.errors };
  });
  const names = data.cues.map(c => c.cue);
  const first = (cue: string) => names.indexOf(cue);
  expect(data.errors).toEqual([]);
  expect(names.some(n => n.startsWith('l1.calm.')) || names.some(n => n.startsWith('bed.'))).toBe(true);
  for (const [a, b] of [['l1.flicker.buzz', 'l1.blast'], ['l1.blast', 'l1.ringing'], ['l1.ringing', 'l1.bell'], ['l1.bell', 'l1.scream']]) {
    expect(first(a), a).toBeGreaterThanOrEqual(0);
    expect(first(a), `${a} before ${b}`).toBeLessThan(first(b));
  }
  const blast = data.start + data.stamps['l1.blast'];
  const around = data.frames.filter(f => f.t >= blast - 200 && f.t <= blast + 2000);
  const max = Math.max(...around.map(f => f.dt));
  mkdirSync('test-results/epics/E19', { recursive: true });
  writeFileSync('test-results/epics/E19/l1-accident-perf.json', JSON.stringify({ frames: around.length, maxFrameMs: max, cueOrder: names.filter(n => n.startsWith('l1.')) }, null, 2) + '\n');
  expect(max).toBeLessThan(50);
});
