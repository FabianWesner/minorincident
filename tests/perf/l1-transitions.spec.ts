import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { test, expect } from '../e2e/fixtures';
import { menuStart } from '../e2e/ui-helpers';

const output = 'test-results/epics/E19/hitch';
// Baseline capture uses the same test and unmodified production bundle, without the new budget gate.
const phase = process.env.HITCH_PHASE ?? 'after';
// Keep both device captures when one budget fails; the E19 runner uses one worker.
test.describe.configure({ mode: 'default' });
test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });
interface Frame { ms: number; tick: number; objectives: string[]; phase: string }
interface GlCall { call: string; ms: number; tick: number; stack: string }
interface Recording { frames: Frame[]; stopped: boolean; previous: number }
declare global { interface Window { hitchRecording?: Recording; hitchGlCalls?: GlCall[] } }
for (const mode of ['desktop', 'mobile'] as const) test.describe(mode, () => {
  test.use(mode === 'mobile' ? { userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } : {});
  test(`@E19 @E19-AC24 @E19-AC19 @perf M1-22 L1 transition frame budget ${mode}`, async ({ page, context }) => {
    test.setTimeout(240_000); mkdirSync(output, { recursive: true });
    await page.addInitScript(() => {
      window.hitchGlCalls = [];
      const prototype = WebGL2RenderingContext.prototype, get = prototype.getProgramParameter, link = prototype.linkProgram;
      prototype.getProgramParameter = function(program, parameter) { const start = performance.now(), result = get.call(this, program, parameter), ms = performance.now() - start; if (ms > 5 && window.hitchRecording && !window.hitchRecording.stopped) window.hitchGlCalls!.push({ call: 'getProgramParameter', ms, tick: window.__SS__!.tick(), stack: new Error().stack ?? '' }); return result; };
      prototype.linkProgram = function(program) { const start = performance.now(); link.call(this, program); if (window.hitchRecording && !window.hitchRecording.stopped) window.hitchGlCalls!.push({ call: 'linkProgram', ms: performance.now() - start, tick: window.__SS__!.tick(), stack: new Error().stack ?? '' }); };
    });
    await menuStart(page); await page.evaluate(() => { window.__SS__!.pause(); window.__SS__!.cheats.god(true); });
    const cdp = await context.newCDPSession(page);
    const samples: Record<string, { max: number; frames: Frame[]; glCalls?: GlCall[] }> = {};
    const measure = async (label: string, action: () => Promise<unknown>, duration: number) => {
      console.log(`${phase} ${mode} measuring ${label}`);
      if (process.env.HITCH_CPU_PROFILE === '1' && label === 'pickup') { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
      await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline', transferMode: 'ReturnAsStream' });
      await page.evaluate(async () => {
        const h: Recording = { frames: [], stopped: false, previous: 0 }; window.hitchRecording = h;
        const frame = () => { const now = performance.now(), a = window.__SS__!, m = a.missions.state()!; if (h.previous) h.frames.push({ ms: now - h.previous, tick: a.tick(), objectives: [...m.completedObjectives], phase: m.phase }); h.previous = now; if (!h.stopped) requestAnimationFrame(frame); };
        requestAnimationFrame(frame); window.__SS__!.resume();
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      });
      await action(); await page.waitForTimeout(duration);
      const frames = await page.evaluate(() => { const h = window.hitchRecording!; h.stopped = true; window.__SS__!.pause(); return h.frames; });
      if (process.env.HITCH_CPU_PROFILE === '1' && label === 'pickup') { const profile = await cdp.send('Profiler.stop'); writeFileSync(`${output}/${phase}-${mode}-cpu-profile.json`, JSON.stringify(profile)); }
      samples[label] = { max: Math.max(...frames.map(f => f.ms)), frames, glCalls: await page.evaluate(() => window.hitchGlCalls!.splice(0)) };
      writeFileSync(`${output}/${phase}-${mode}-samples.json`, JSON.stringify(samples, null, 2));
      console.log(`${phase} ${mode} ${label} max=${samples[label].max.toFixed(1)}ms`);
      const completed = new Promise<{ stream: string }>((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Chrome trace did not finish')), 15_000); cdp.once('Tracing.tracingComplete', event => { clearTimeout(timeout); resolve({ stream: event.stream! }); }); });
      await cdp.send('Tracing.end'); const { stream } = await completed; let trace = '';
      for (;;) { const chunk = await cdp.send('IO.read', { handle: stream }); trace += chunk.data; if (chunk.eof) break; }
      await cdp.send('IO.close', { handle: stream });
      writeFileSync(`${output}/${phase}-${mode}-${label}-trace.json`, trace);
    };
    // Anchors come from the layout; setup teleports (paused, outside any measurement) put the player at each transition.
    const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as { anchors: Record<string, { position: number[] }> };
    const at = (name: string) => ({ x: layout.anchors[name].position[0], z: layout.anchors[name].position[2] });
    const place = (name: string) => page.evaluate(p => { window.__SS__!.teleport('player', p); return window.__SS__!.step(1); }, at(name));
    const interact = async () => { await page.keyboard.down('e'); await page.waitForTimeout(120); await page.keyboard.up('e'); };
    const loading = await page.evaluate(() => ({ ...window.__SS__!.perf().loadTiming, warmUp: performance.getEntriesByType('measure').filter(e => e.name.startsWith('L1 ')).map(e => ({ name: e.name, ms: e.duration })) }));
    console.log(`${phase} ${mode} loading ${JSON.stringify(loading)}`);
    // Objective transitions of L1 v2: pickup, delivery hand-over, the accident (flicker, blast, smoke, screams), the infected exit,
    // the bat pickup, death/respawn from the accident checkpoint, and the fire-station shutter with the end caption.
    await place('parcel-counter'); await measure('pickup', interact, 2_500);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.completedObjectives)).toContain('pickup');
    await place('lab-door');
    await measure('handover', interact, 16_000);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.l1!.delivered)).toBe(true);
    await measure('accident', () => page.waitForFunction(() => window.__SS__!.events().some(e => e.type === 'l1.screams'), undefined, { timeout: 20_000 }), 1_500);
    await measure('infected-exit', () => page.waitForFunction(() => window.__SS__!.missions.state()!.l1!.exitIds.length === 5, undefined, { timeout: 20_000 }), 4_000);
    await place('garage-door');
    await page.evaluate(() => window.__SS__!.cheats.completeObjective('escape'));
    await place('garage-bat'); await measure('weapon-pickup', interact, 3_000);
    expect(await page.evaluate(() => window.__SS__!.getState().player!.weapons!.LEFT.rack[0].id)).toBe('weapon.bat');
    await measure('death-respawn', () => page.evaluate(() => window.__SS__!.survivor.damage(100)), 3_500);
    expect(await page.evaluate(() => window.__SS__!.getState().player!.health.current)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.stats.deaths)).toBe(1);
    // The ending is now a reach volume: entering it during paused setup would finish before recording.
    // Stand outside the open bay, then capture the player's real click and actual crossing.
    await page.evaluate(p => { const a = window.__SS__!; a.teleport('player', { x: p.x, z: p.z - 3 }); a.step(1); }, at('fire-bay-door'));
    await page.evaluate(() => window.__SS__!.screenshotReady());
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.phase)).toBe('playing');
    await measure('fire-station-end', async () => {
      const point = await page.evaluate(p => window.__SS__!.input.project(p), at('fire-bay-trigger'));
      await page.mouse.click(point.x, point.y);
    }, 3_000);
    await expect(page.getByTestId('mission-heading')).toHaveText('Delivery complete. Outbreak: not contained.');
    const proof = await page.evaluate(() => { const a = window.__SS__!, gl = document.querySelector('canvas')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info'); return { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string : null, mission: a.missions.state(), perf: a.perf() }; });
    writeFileSync(`${output}/${phase}-${mode}.json`, JSON.stringify({ samples, loading, ...proof }, null, 2));
    expect(proof.gpu).not.toMatch(/swiftshader|llvmpipe|software/i);
    if (phase !== 'before') for (const [label, sample] of Object.entries(samples)) expect(sample.max, `${mode} ${label} max frame ms`).toBeLessThanOrEqual(50);
  });
});
