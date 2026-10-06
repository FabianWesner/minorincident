import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { test, expect } from './fixtures';
import { menuStart, menuUrl } from './ui-helpers';

const output = 'test-results/m1-outbreak2';
for (const mode of ['desktop', 'portrait'] as const) test.describe(mode, () => {
  test.use({ viewport: mode === 'desktop' ? { width: 1600, height: 900 } : { width: 390, height: 844 }, hasTouch: mode === 'portrait', isMobile: mode === 'portrait', userAgent: mode === 'desktop' ? devices['Desktop Chrome'].userAgent : devices['iPhone 14'].userAgent });
  test(`M1-23 M1-24 @E19 real-input diner transformation and independent chain ${mode}`, async ({ page, context }) => {
    test.setTimeout(180_000); mkdirSync(output, { recursive: true });
    if (mode === 'desktop') await menuStart(page);
    else { await page.goto(menuUrl); for (const id of ['start-game', 'character-female', 'level-L1', 'mission-button']) await page.getByTestId(id).tap(); }
    await expect(page.getByTestId('pause-button')).toBeVisible();
    await page.evaluate(() => window.__SS__!.pause());
    const cdp = mode === 'portrait' ? await context.newCDPSession(page) : null;
    const move = async (x: number, z: number) => {
      for (let i = 0; i < 160; i++) {
        const p = await page.evaluate(() => window.__SS__!.getState().player!.transform), d = Math.hypot(x - p.x, z - p.z);
        if (d < .7) return;
        if (cdp) {
          const origin = { id: 1, x: 70, y: 506 }, dx = (x - p.x) / d, dz = (z - p.z) / d;
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [origin] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...origin, x: origin.x + (dx - dz) / Math.SQRT2 * 50, y: origin.y + (dx + dz) / Math.SQRT2 * 50 }] });
          await page.evaluate(n => window.__SS__!.step(n), Math.min(24, Math.max(1, Math.floor(d / 6 * 60))));
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else {
          const point = await page.evaluate(({ x, z }) => window.__SS__!.input.project({ x, z }), { x: p.x + (x - p.x) / d * Math.min(3, d), z: p.z + (z - p.z) / d * Math.min(3, d) });
          await page.mouse.click(point.x, point.y); await page.evaluate(() => window.__SS__!.step(24));
        }
      }
      throw new Error(`Unable to walk to ${x},${z}`);
    };
    await move(-14, -4); await move(0, 0); await move(42, 0); await move(42, -6.5);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.steps.escape.status)).toBe('active');
    await move(42, 0);
    const victims = await page.evaluate(() => window.__SS__!.missions.state()!.outbreak!.victims);
    const focus = await page.evaluate(id => window.__SS__!.getEntity(id)!.transform, victims[0]);
    await page.evaluate(p => window.__SS__!.camera.cinematic({ position: [p.x + 8, 8, p.z + 8], target: [p.x, .6, p.z] }), focus);
    // Physical diagonal keys/stick retreat east while the presentation camera watches the victim.
    if (cdp) {
      const origin = { id: 1, x: 70, y: 506 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [origin] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...origin, x: origin.x + 50 / Math.SQRT2, y: origin.y + 50 / Math.SQRT2 }] });
    } else { await page.keyboard.down('d'); await page.keyboard.down('s'); }
    const seen = new Set<string>(), samples: unknown[] = [];
    let actedDuringChain = false, peak = 0;
    const births = new Map<number, { x: number; z: number }>();
    for (let i = 0; i < 180; i++) {
      await page.evaluate(async () => { const a = window.__SS__!; await a.step(6); a.vfx.stepRender(.1); });
      const state = await page.evaluate(ids => {
        const a = window.__SS__!;
        return { tick: a.tick(), victims: ids.map(id => a.getEntity(id)!), infected: a.query({ kind: 'infected' }), events: a.events().filter(e => e.type === 'civilian.turned' || e.type === 'civilian.grabbed') };
      }, victims);
      peak = Math.max(peak, state.infected.filter(e => e.health.current > 0).length);
      const first = state.victims[0], c = first.civilian!;
      const label = `${c.state}-${Math.floor((state.tick - c.entered) / 18)}`;
      if (['bitten', 'down', 'rising', 'infected'].includes(c.state) && !seen.has(label) && (c.state !== 'infected' || state.tick - c.entered <= 72)) {
        seen.add(label); samples.push({ tick: state.tick, state: c.state, veins: c.veins, eyes: c.eyesGlow, hidden: first.hidden, newborn: c.risingInfectedId });
        if (process.env.OUTBREAK_CAPTURE === '1') {
          await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${output}/${mode}-${label}.png` });
        }
      }
      for (const event of state.events) if (event.type === 'civilian.turned' && !births.has(event.infectedId)) births.set(event.infectedId, { ...event.position });
      if (state.victims.some(e => !['infected', 'finished'].includes(e.civilian!.state))) for (const e of state.infected) {
        const birth = births.get(e.id);
        if (birth && (e.combat!.attacking || Math.hypot(e.transform.x - birth.x, e.transform.z - birth.z) > .1)) actedDuringChain = true;
      }
      if (births.size && actedDuringChain && await page.evaluate(() => window.__SS__!.getState().player!.transform.x >= 70)) break;
    }
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else { await page.keyboard.up('d'); await page.keyboard.up('s'); }
    expect([...seen].some(s => s.startsWith('bitten'))).toBe(true);
    expect([...seen].some(s => s.startsWith('down'))).toBe(true);
    expect([...seen].some(s => s.startsWith('rising'))).toBe(true);
    expect(actedDuringChain).toBe(true); expect(peak).toBeLessThanOrEqual(15);
    const chainSamples: unknown[] = [];
    for (let i = 0; i < 600; i++) {
      await page.evaluate(async () => { const a = window.__SS__!; await a.step(6); a.vfx.stepRender(.1); });
      const chain = await page.evaluate(newborns => {
        const a = window.__SS__!, events = a.events(), bitten = events.filter(e => e.type === 'civilian.grabbed' && newborns.includes(e.sourceId)).map(e => e.type === 'civilian.grabbed' ? e.targetId : 0);
        return { tick: a.tick(), victims: a.missions.state()!.outbreak!.victims.map(id => a.getEntity(id)!), infected: a.query({ kind: 'infected' }), turns: events.filter(e => e.type === 'civilian.turned'), newbornTurn: events.some(e => e.type === 'civilian.turned' && bitten.includes(e.id)) };
      }, [...births.keys()]);
      peak = Math.max(peak, chain.infected.filter(e => e.health.current > 0).length);
      if (i % 30 === 0) {
        chainSamples.push({ tick: chain.tick, states: chain.victims.map(e => e.civilian!.state), turns: chain.turns });
        if (process.env.OUTBREAK_CAPTURE === '1') {
          // Presentation-only overview; the trigger, retreat and all AI use the real game.
          const focus = chain.victims.find(e => !['infected', 'finished'].includes(e.civilian!.state)) ?? chain.infected[0];
          await page.evaluate(p => window.__SS__!.camera.cinematic({ position: [p.x + 8, 8, p.z + 8], target: [p.x, .6, p.z] }), focus.transform);
          await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${output}/${mode}-chain-${i}.png` });
        }
      }
      if (chain.newbornTurn || mode === 'portrait' && new Set(chain.turns.filter(e => e.type === 'civilian.turned').map(e => e.type === 'civilian.turned' ? e.id : 0)).size >= 3) break;
    }
    if (process.env.OUTBREAK_CAPTURE === '1') { await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${output}/${mode}-chain-turn.png` }); }
    const infectionEvents = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'civilian.turned' || e.type === 'civilian.grabbed'));
    writeFileSync(`${output}/${mode}.json`, JSON.stringify({ mode, realInput: true, headless: true, samples, chainSamples, actedDuringChain, peak, deaths: await page.evaluate(() => window.__SS__!.missions.state()!.stats.deaths), gpu: await page.evaluate(() => { const gl = document.querySelector('canvas')!.getContext('webgl2')!, debug = gl.getExtension('WEBGL_debug_renderer_info'); return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string : 'WebGL2'; }), events: await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'civilian.state' || e.type === 'civilian.turned' || e.type === 'civilian.grabbed')) }, null, 2));
    expect(new Set(infectionEvents.filter(e => e.type === 'civilian.turned').map(e => e.type === 'civilian.turned' ? e.id : 0)).size).toBeGreaterThanOrEqual(2);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.stats.deaths)).toBe(0);
    if (mode === 'desktop') {
      expect(new Set(infectionEvents.filter(e => e.type === 'civilian.grabbed').map(e => e.type === 'civilian.grabbed' ? e.sourceId : 0)).size).toBeGreaterThan(1);
      expect(infectionEvents.some(e => e.type === 'civilian.grabbed' && births.has(e.sourceId) && infectionEvents.some(t => t.type === 'civilian.turned' && t.id === e.targetId && t.tick > e.tick))).toBe(true);
    } else expect(new Set(infectionEvents.filter(e => e.type === 'civilian.turned').map(e => e.type === 'civilian.turned' ? e.id : 0)).size).toBeGreaterThanOrEqual(3);
    expect(peak).toBeLessThanOrEqual(15);
  });
});
