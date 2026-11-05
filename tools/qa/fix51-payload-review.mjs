/** Deterministic campaign captures across the startup and streamed cast paths.
 * Caller owns both QA previews; this uses the shared headless browser pool.
 * PAYLOAD_BASELINE_ORIGIN=http://127.0.0.1:4918 PAYLOAD_CANDIDATE_ORIGIN=http://127.0.0.1:4917
 * node --import tsx tools/qa/fix51-payload-review.mjs high [L1,L2,...]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from '../browser-pool/client.ts';

const tier = process.argv[2] ?? 'high';
if (!['high', 'low'].includes(tier)) throw Error('Expected high or low');
const reportOnly = process.argv.includes('--report-only');
const levels = (process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'L1,L2,L3,L4,L5,L6,L7,L8,L9,L10').split(',');
const out = resolve(process.env.PAYLOAD_REVIEW_OUT ?? 'test-results/fix51-payload/review', tier);
mkdirSync(out, { recursive: true });
const sources = [['baseline', process.env.PAYLOAD_BASELINE_ORIGIN ?? 'http://127.0.0.1:4918'], ['candidate', process.env.PAYLOAD_CANDIDATE_ORIGIN ?? 'http://127.0.0.1:4917']];
const browser = reportOnly ? undefined : await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const rows = reportOnly ? JSON.parse(readFileSync(resolve(out, 'rows.json'))) : [];
async function capture(page, level, side, moment) {
  await page.evaluate(async () => { await window.__SS__.screenshotReady(); });
  const snapshot = await page.evaluate(() => {
    const a = window.__SS__, g = window.__SCENE__.game;
    return { tick: a.tick(), player: a.getState().player?.transform,
      figures: a.crowdFigures().filter(f => f.drawn).map(f => ({ id: f.id, lod: f.lod, model: f.appearance?.model, accessory: f.appearance?.accessory })).sort((a, b) => a.id - b.id),
      entities: a.query({}).map(e => ({ id: e.id, archetype: e.archetype, transform: e.transform, health: e.health?.current, hidden: e.hidden })).sort((a, b) => a.id - b.id),
      placeholders: g.view.getState().crowd?.assets ?? [], phase: a.missions.state()?.phase };
  });
  const image = `${level}-${side}-${moment}.jpg`;
  await page.screenshot({ path: resolve(out, image), type: 'jpeg', quality: 85 });
  return { ...snapshot, image };
}
try {
  if (!reportOnly) for (const level of levels) for (const [side, origin] of sources) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(120000);
    page.on('pageerror', error => { errors.push(error.message); console.error(`${level} ${side}: ${error.message}`); });
    await page.addInitScript('window.__name = fn => fn');
    const row = { level, side, tier, errors };
    try {
      await page.goto(`${origin}/?test=1&scenelab=1&preload=0&audio=muted&dpr=1&quality=${tier}`);
      await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
      await page.evaluate(async ({ level, tier }) => {
        const a = window.__SS__, g = window.__SCENE__.game;
        await a.ready; a.pause();
        await a.loadLevel(level, { seed: 1, ...(level === 'L1' ? {} : { progression: `${level}-default` }) });
        a.pause(); a.settings.set({ quality: tier, cameraShake: false });
        g.ui.show(null); a.debug.figureJoints(false);
      }, { level, tier });
      row.initial = await capture(page, level, side, 'initial');
      await page.evaluate(async level => {
        const a = window.__SS__;
        a.missions.begin(); a.cheats.god(true); a.bot.start('complete');
        const ticks = level === 'L8' ? 4500 : level === 'L4' ? 3600 : 1800;
        for (let tick = 0; tick < ticks; tick += 30) await a.step(30);
        a.bot.stop(); a.input.clear();
      }, level);
      row.streamed = await capture(page, level, side, 'streamed');
    } catch (error) { row.failure = String(error); console.error(`${level} ${side}: ${error}`); }
    finally { rows.push(row); writeFileSync(resolve(out, 'rows.json'), JSON.stringify(rows, null, 2)); await context.close(); }
    console.log(JSON.stringify({ level, side, initial: row.initial?.figures.length, streamed: row.streamed?.figures.length, errors, failure: row.failure }));
  }
} finally { await browser?.close(); }
const comparisons = levels.map(level => {
  const pair = rows.filter(row => row.level === level), [baseline, candidate] = pair;
  const moments = ['initial', 'streamed'].map(moment => {
    const before = baseline?.[moment]?.figures ?? [], after = candidate?.[moment]?.figures ?? [];
    const looks = figures => figures.map(({ id, model, accessory }) => ({ id, model, accessory }));
    // Keep strict equality as evidence. Within LOD hysteresis a finer resident
    // tier is allowed; missing actors, changed looks and coarser detail fail.
    const sameLooks = JSON.stringify(looks(before)) === JSON.stringify(looks(after));
    const noDetailLoss = sameLooks && before.every((figure, i) => figure.lod === after[i].lod || after[i].lod && figure.lod && after[i].lod < figure.lod);
    return { moment,
    sameEntities: JSON.stringify(baseline?.[moment]?.entities) === JSON.stringify(candidate?.[moment]?.entities),
    sameFigures: JSON.stringify(baseline?.[moment]?.figures) === JSON.stringify(candidate?.[moment]?.figures),
    noDetailLoss, baselineFigures: before, candidateFigures: after };
  });
  return { level, moments, errors: pair.flatMap(row => row.errors), failures: [
    ...pair.filter(row => row.failure).map(row => row.failure),
    ...(!baseline?.initial || !baseline?.streamed || !candidate?.initial || !candidate?.streamed ? ['MISSING_CAPTURE'] : []),
  ] };
});
writeFileSync(resolve(out, 'comparisons.json'), JSON.stringify(comparisons, null, 2));
if (comparisons.some(row => row.failures.length || row.errors.length || row.moments.some(moment => !moment.sameEntities || !moment.noDetailLoss))) process.exitCode = 1;
