import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { test, expect } from '../e2e/fixtures';
import { menuStart } from '../e2e/ui-helpers';

const output = 'test-results/epics/E19/hitch';
// Baseline capture uses the same test and unmodified production bundle, without the new budget gate.
const phase = process.env.HITCH_PHASE ?? 'after';
test.describe.configure({ mode: 'serial' });
test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });
interface Frame { ms: number; tick: number; objectives: string[]; phase: string }
interface Recording { frames: Frame[]; stopped: boolean; previous: number }
declare global { interface Window { hitchRecording?: Recording } }
for (const mode of ['desktop', 'mobile'] as const) test.describe(mode, () => {
  test.use(mode === 'mobile' ? { userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } : {});
  test(`@E19 @perf M1-22 L1 transition frame budget ${mode}`, async ({ page, context }) => {
    test.setTimeout(240_000); mkdirSync(output, { recursive: true });
    await menuStart(page); await page.evaluate(() => { window.__SS__!.pause(); window.__SS__!.cheats.god(true); });
    // Real ground clicks walk the approach; paused setup does not enter the transition under test.
    const walk = async (x: number, z: number) => {
      for (let i = 0; i < 160; i++) {
        const p = await page.evaluate(() => window.__SS__!.getState().player!.transform);
        const d = Math.hypot(x - p.x, z - p.z); if (d < .7) return;
        const point = await page.evaluate(p => window.__SS__!.input.project(p), { x: p.x + (x - p.x) / d * Math.min(3, d), z: p.z + (z - p.z) / d * Math.min(3, d) });
        await page.mouse.click(point.x, point.y); await page.evaluate(() => window.__SS__!.step(24));
      }
      throw new Error(`Walk failed ${x},${z}`);
    };
    const cdp = await context.newCDPSession(page);
    const samples: Record<string, { max: number; frames: Frame[] }> = {};
    const measure = async (label: string, action: () => Promise<unknown>, duration: number) => {
      console.log(`${phase} ${mode} measuring ${label}`);
      if (process.env.HITCH_CPU_PROFILE === '1' && label === 'diner') { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
      await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline', transferMode: 'ReturnAsStream' });
      await page.evaluate(async () => {
        const h: Recording = { frames: [], stopped: false, previous: 0 }; window.hitchRecording = h;
        const frame = () => { const now = performance.now(), a = window.__SS__!, m = a.missions.state()!; if (h.previous) h.frames.push({ ms: now - h.previous, tick: a.tick(), objectives: [...m.completedObjectives], phase: m.phase }); h.previous = now; if (!h.stopped) requestAnimationFrame(frame); };
        requestAnimationFrame(frame); window.__SS__!.resume();
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      });
      await action(); await page.waitForTimeout(duration);
      const frames = await page.evaluate(() => { const h = window.hitchRecording!; h.stopped = true; window.__SS__!.pause(); return h.frames; });
      if (process.env.HITCH_CPU_PROFILE === '1' && label === 'diner') { const profile = await cdp.send('Profiler.stop'); writeFileSync(`${output}/${phase}-${mode}-cpu-profile.json`, JSON.stringify(profile)); }
      samples[label] = { max: Math.max(...frames.map(f => f.ms)), frames };
      writeFileSync(`${output}/${phase}-${mode}-samples.json`, JSON.stringify(samples, null, 2));
      console.log(`${phase} ${mode} ${label} max=${samples[label].max.toFixed(1)}ms`);
      const completed = new Promise<{ stream: string }>((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Chrome trace did not finish')), 15_000); cdp.once('Tracing.tracingComplete', event => { clearTimeout(timeout); resolve({ stream: event.stream! }); }); });
      await cdp.send('Tracing.end'); const { stream } = await completed; let trace = '';
      for (;;) { const chunk = await cdp.send('IO.read', { handle: stream }); trace += chunk.data; if (chunk.eof) break; }
      await cdp.send('IO.close', { handle: stream });
      writeFileSync(`${output}/${phase}-${mode}-${label}-trace.json`, trace);
    };
    const walkLive = async (x: number, z: number) => {
      for (let i = 0; i < 50; i++) {
        const p = await page.evaluate(() => window.__SS__!.getState().player!.transform), d = Math.hypot(x - p.x, z - p.z);
        if (d < .7) return;
        const point = await page.evaluate(p => window.__SS__!.input.project(p), { x: p.x + (x - p.x) / d * Math.min(2, d), z: p.z + (z - p.z) / d * Math.min(2, d) });
        await page.mouse.click(point.x, point.y); await page.waitForTimeout(180);
      }
      throw new Error(`Live walk failed ${x},${z}`);
    };
    await walk(-14, -4); await walk(0, 0); await walk(42, 0);
    await measure('diner', () => walkLive(42, -6.5), 15_000);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.completedObjectives)).toContain('breakfast');
    if (process.env.HITCH_DINER_ONLY === '1') return;
    // Moving cameras must keep rendering through the swap, rather than silently pausing for loading.
    expect(new Set(samples.diner.frames.map(f => f.tick)).size).toBeGreaterThan(100);
    await walk(42, 0); await walk(70, 0);
    await measure('hardware', () => walkLive(70, -7), 1_500);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('melee');
    await page.getByTestId('choose-bat').click();
    await measure('weapon-pickup-store-spawn', () => page.keyboard.press('f'), 4_000);
    expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons!.LEFT.rack[0].id)).toBe('weapon.bat');
    await measure('store-fight', async () => {
      for (let i = 0; i < 80; i++) {
        const point = await page.evaluate(() => {
          const a = window.__SS__!, p = a.getState().player!.transform;
          const target = a.query({ kind: 'infected' }).filter(e => e.health.current > 0).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
          if (!target) return null;
          const q = a.input.project(target.transform), d = Math.hypot(target.transform.x - p.x, target.transform.z - p.z);
          if (q.x > 20 && q.y > 20 && q.x < innerWidth - 20 && q.y < innerHeight - 20 && !document.elementFromPoint(q.x, q.y)?.closest('.hud-tracker,.hud-map,.hud-vitals,.menus')) return q;
          return a.input.project({ x: p.x + (target.transform.x - p.x) / d * Math.min(2, d), z: p.z + (target.transform.z - p.z) / d * Math.min(2, d) });
        });
        if (!point) break;
        await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.waitForTimeout(350); await page.mouse.up();
        if (await page.evaluate(() => window.__SS__!.events().some(e => e.type === 'combat.hit' && e.sourceId === 1))) break;
      }
    }, 1_000);
    expect(await page.evaluate(() => window.__SS__!.events().some(e => e.type === 'combat.hit' && e.sourceId === 1))).toBe(true);
    await measure('death-respawn', () => page.evaluate(() => window.__SS__!.survivor.damage(100)), 3_500);
    expect(await page.evaluate(() => window.__SS__!.getState().player!.health.current)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.stats.deaths)).toBe(1);
    await measure('end-screen', () => page.evaluate(() => window.__SS__!.cheats.completeObjective('store-fight')), 1_000);
    await expect(page.getByTestId('mission-heading')).toHaveText('Milestone 1 complete — thanks for playing');
    // Restart also switches W1 back to its already prepared W0 presentation.
    await measure('restart', () => page.getByRole('button', { name: 'Restart', exact: true }).click(), 1_000);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.completedObjectives)).toEqual([]);
    const proof = await page.evaluate(() => { const a = window.__SS__!, gl = document.querySelector('canvas')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info'); return { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string : null, mission: a.missions.state(), perf: a.perf() }; });
    writeFileSync(`${output}/${phase}-${mode}.json`, JSON.stringify({ samples, ...proof }, null, 2));
    expect(proof.gpu).not.toMatch(/swiftshader|llvmpipe|software/i);
    if (phase !== 'before') for (const [label, sample] of Object.entries(samples)) expect(sample.max, `${mode} ${label} max frame ms`).toBeLessThanOrEqual(50);
  });
});
