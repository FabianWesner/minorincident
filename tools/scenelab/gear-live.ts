import { mkdirSync } from 'node:fs';
import { SceneSession, stopServer, origin, type Backend } from './session';
import { preset, type ProgressionPreset } from '../../src/sim/progression/Campaign';

/** npm run gear:live -- --backend webgpu --tier high --out dir
 * Live levels with a progressed save: L3 at gear tier 2 (day) and L5 at gear tier 4 (night), both survivors, game camera at its default and its
 * closest zoom. Writes full-viewport PNGs plus a crop around the courier (the evidence for docs/reports/gear-art). */
const args = process.argv.slice(2), flag = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const backend = (flag('backend') ?? 'webgpu') as Backend, tier = (flag('tier') ?? 'high') as 'high' | 'low', out = flag('out') ?? 'test-results/gear-live';
const cases: { level: string; save: ProgressionPreset; expectTier: number; time?: string }[] = [
  { level: 'L3', save: 'L4-default', expectTier: 2 },
  { level: 'L5', save: 'L6-default', expectTier: 4, time: 'night' },
];
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 }, log: () => {} });
try {
  await session.open();
  const report: unknown[] = [];
  for (const c of cases) for (const model of ['female', 'male'] as const) {
    await session.page.goto(`${origin}/?test=1&renderer=${backend === 'webgpu' ? 'webgpu' : 'webgl'}&dpr=1&quality=${tier}&audio=muted&seed=1&level=${c.level}`);
    await session.page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
    await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    await session.page.evaluate(async level => { await window.__SS__!.loadLevel(level); window.__SS__!.pause(); }, c.level);
    const save = { ...preset(c.save), character: model };
    await session.page.evaluate(async (s) => { window.__SS__!.campaign.restore(s as never); window.__SS__!.step(30); await window.__SS__!.screenshotReady(); }, save);
    if (c.time) await session.page.evaluate(t => window.__SS__!.settings.set({ timeOfDay: t } as never), c.time);
    await session.page.getByText('Begin mission').first().click({ timeout: 5000 }).catch(() => undefined);
    await session.page.evaluate(() => { window.__SS__!.step(120); });
    await session.page.addStyleTag({ content: '.story-bubble,.mission-subtitle,#toasts,.toast{visibility:hidden!important}' });
    for (let i = 0; i < 40; i++) {   // the courier model streams in after the level is ready
      const loaded = await session.page.evaluate(() => { window.__SS__!.step(10); return !!window.__SS__!.getState().render.character; });
      if (loaded) break; await session.page.waitForTimeout(500);
    }
    const state = await session.page.evaluate(() => window.__SS__!.getState());
    const character = state.render.character ?? { gearTier: -1, variant: 'missing', position: [0, 0, 0] };
    for (const zoom of ['default', 'close'] as const) {
      if (zoom === 'close') await session.page.evaluate(() => { for (let i = 0; i < 12; i++) window.dispatchEvent(new WheelEvent('wheel', { deltaY: -400 })); window.__SS__!.step(10); });
      await session.page.evaluate(async () => { await window.__SS__!.screenshotReady(); });
      const path = `${out}/${c.level}-tier${character.gearTier}-${model}-${zoom}.png`;
      await session.page.screenshot({ path, type: 'png' });
      report.push({ path, level: c.level, model, zoom, gearTier: character.gearTier, expected: c.expectTier, variant: character.variant, position: character.position });
    }
  }
  console.log(JSON.stringify(report, null, 1));
} finally { await session.close(); stopServer(); }
