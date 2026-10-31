/** Campaign handover profiler. Loads the outgoing scene, then runs the same
 * continueCampaign path as CampaignUI with the actual final-playthrough save.
 * This keeps outgoing resource teardown, carried rosters and crash state in scope.
 * Run with tools/e2e-lock.sh; e.g. <origin> <out> [targets=2,3,...,10] [quality=low] [backend=webgl2].
 * This is a loading diagnostic; it does not certify gameplay or replace the L3 input proof.
 */
import { launchBrowser } from '../browser-pool/client';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { newCampaign, type CampaignSave, type Level } from '../../src/sim/progression/Campaign';
import type { Game } from '../../src/Game';

const [origin, destination, targets = '2,3,4,5,6,7,8,9,10', quality = 'low', backend = 'webgl2'] = process.argv.slice(2);
if (!origin || !destination) throw new Error('Usage: campaign-handover-time.ts <origin> <out> [targets] [quality] [backend]');
const out = resolve(destination); mkdirSync(out, { recursive: true });
const runs: unknown[] = [];
const files = ['fresh-03', 'fresh-07', 'fresh-12-L3-FAIL-permitted-continuation', 'fresh-16', 'fresh-19', 'fresh-20', 'fresh-21', 'fresh-22', 'fresh-23'];
const boundary = (level: number): CampaignSave => level === 1 ? newCampaign() : JSON.parse(readFileSync(`docs/reports/final-e2e/fresh/${files[level - 2]}-completion.json`, 'utf8')).campaign;
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', ...(backend === 'webgpu' ? ['--enable-unsafe-webgpu'] : [])] });
try {
  for (const target of targets.split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(); page.setDefaultTimeout(120_000);
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    try {
      await page.addInitScript('window.__name = fn => fn;');
      const before = boundary(target - 1), after = boundary(target);
      before.settings.quality = after.settings.quality = quality as 'low' | 'high';
      await page.addInitScript(save => localStorage.setItem('minor-incident.campaign', JSON.stringify(save)), before);
      await page.goto(`${origin}/?test=poses&testApi=1&scenelab=1&preload=0&loadProfile=1&audio=muted&dpr=1&quality=${quality}${backend === 'webgl2' ? '&renderer=webgl' : ''}`);
      await page.waitForFunction(() => !!window.__SS__);
      await page.evaluate(async ({ save, level }) => {
        await window.__SS__!.ready;
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        await g.continueCampaign(save, level as Level);
      }, { save: before, level: target - 1 });
      // The outgoing level remains fully resident. Let ordinary background
      // streaming start, as it does during a real campaign, before the handover.
      await page.waitForTimeout(6000);
      await page.evaluate(() => window.__SS__!.pause());
      const profiler = process.env.CAMPAIGN_CPU_PROFILE === '1' ? await context.newCDPSession(page) : null;
      if (profiler) { await profiler.send('Profiler.enable'); await profiler.send('Profiler.start'); }
      const result = await page.evaluate(async ({ save, level }) => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        const frames: number[] = []; let last = performance.now(), stopped = false;
        const frame = (now: number) => { frames.push(now - last); last = now; if (!stopped) requestAnimationFrame(frame); };
        requestAnimationFrame(frame);
        const buildsBefore = g.view.renderer.nodeBuilds, materialsBefore = { ...g.view.renderer.nodeBuildMaterials };
        const start = performance.now();
        const card = document.querySelector<HTMLElement>('[data-testid="level-transition"]')!;
        let shownAt: number | null = null, hiddenAt: number | null = null;
        const cardChanged = () => {
          if (!card.hidden && shownAt === null) shownAt = performance.now();
          if (card.hidden && shownAt !== null && hiddenAt === null) hiddenAt = performance.now();
        };
        const cardObserver = new MutationObserver(cardChanged);
        cardObserver.observe(card, { attributes: true, attributeFilter: ['hidden'] });
        const shaderBuilds: { at: number; name: string; foreground: boolean }[] = [];
        const onBuild = g.view.renderer.debug.onNodeBuilderCreated;
        g.view.renderer.debug.onNodeBuilderCreated = (builder, object) => {
          onBuild?.(builder, object);
          shaderBuilds.push({ at: performance.now() - start, name: (object as { material: { name: string } }).material.name, foreground: g.view.renderer.foregroundCompile });
        };
        await g.continueCampaign(save, level as Level);
        const end = performance.now(); stopped = true;
        cardChanged(); cardObserver.disconnect();
        g.view.renderer.debug.onNodeBuilderCreated = onBuild;
        return { ms: end - start, loadingCardMs: shownAt !== null && hiddenAt !== null ? hiddenAt - shownAt : null, frames, shaderBuilds, backend: g.view.renderer.selectedBackend, quality: g.quality.tier,
          nodeBuilds: g.view.renderer.nodeBuilds - buildsBefore, entities: g.world.entities.size,
          nodeBuildMaterials: Object.fromEntries(Object.entries(g.view.renderer.nodeBuildMaterials).map(([name, count]) => [name, count - (materialsBefore[name] ?? 0)]).filter(([, count]) => Number(count) > 0)),
          bundle: document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src,
          passengers: g.campaign?.transport?.occupants.length ?? 0,
          infectedBatches: [...(g.view as unknown as { crowd?: { batches: Map<string, unknown> } }).crowd?.batches.keys() ?? []],
          measures: performance.getEntriesByType('measure').filter(e => e.startTime >= start).map(e => ({ name: e.name, ms: e.duration, at: e.startTime - start })),
          objective: document.querySelector('[data-testid="objective-text"]')?.textContent,
          begin: document.querySelector('[data-testid="mission-button"]')?.textContent,
          loading: !document.querySelector<HTMLElement>('[data-testid="level-transition"]')?.hidden };
      }, { save: after, level: target });
      if (profiler) { writeFileSync(resolve(out, `L${target - 1}-L${target}.cpuprofile`), JSON.stringify((await profiler.send('Profiler.stop')).profile)); await profiler.detach(); }
      await page.screenshot({ path: resolve(out, `L${target - 1}-L${target}.jpg`), type: 'jpeg', quality: 78 });
      const row = { from: `L${target - 1}`, to: `L${target}`, requestedQuality: quality, requestedBackend: backend, at: new Date().toISOString(), errors, ...result };
      runs.push(row); writeFileSync(resolve(out, 'timings.json'), JSON.stringify(runs, null, 2));
      console.log(JSON.stringify({ from: row.from, to: row.to, ms: row.ms, errors, stages: row.measures.filter(e => !e.name.startsWith('bake:')) }));
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
