import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Browser } from '@playwright/test';
import { newCampaign, preset, type ProgressionPreset } from '../../../../src/sim/progression/Campaign';
import { oracle } from '../oracles';
import { SceneSession, readSpec, stopServer } from '../../../../tools/scenelab/session';
import type { Game } from '../../../../src/Game';
import type { InstancedGroup } from '../../../../src/render/InstancedGroup';
import type { Mesh } from 'three';
import { PNG } from 'pngjs';

const baseline = process.env.QA_INVARIANTS_BASELINE ?? 'https://minor-incident.com';
const levels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'] as const;

async function measure(browser: Browser, origin: string, level: typeof levels[number]) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    const url = new URL(origin);
    for (const [key, value] of Object.entries({ quality: 'low', renderer: 'webgpu', dpr: '1', seed: '1', test: '1', ui: '1', profile: '1', audio: 'muted' })) url.searchParams.set(key, value);
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('menu-title')).toBeVisible({ timeout: 120_000 });
    await page.waitForFunction(() => !!window.__SS__);
    const save = level === 'L1' ? newCampaign() : preset((level === 'L9' ? 'L8-default' : `${level}-default`) as ProgressionPreset);
    save.unlockedLevel = Number(level.slice(1)) as typeof save.unlockedLevel;
    save.completedLevels = save.unlockedLevel - 1; save.settings.quality = 'low';
    await page.evaluate(save => { window.__SS__!.campaign.restore(save); window.__SS__!.campaign.menu(); window.__SS__!.settings.set({ quality: 'low' }); }, save);
    await page.getByTestId('start-game').click();
    if (await page.getByTestId('character-female').isVisible()) await page.getByTestId('character-female').click();
    const t0 = await page.evaluate(() => performance.now());
    await page.getByTestId(`level-${level}`).click();
    // A briefing is part of preparing the playable level. Activate Begin as soon as it is ready,
    // then stop the timer on the first drawn gameplay frame; no human reading delay is measured.
    await page.waitForFunction(level => {
      const cover = document.querySelector<HTMLElement>('[data-testid=level-transition]');
      if (!cover?.hidden || window.__SS__?.getState().scenario !== level) return false;
      const begin = document.querySelector<HTMLElement>('[data-testid=mission-button]');
      const pause = document.querySelector<HTMLElement>('[data-testid=pause-button]');
      return !!begin && !begin.hidden && begin.getBoundingClientRect().height > 0 || !!pause && !pause.hidden && pause.getBoundingClientRect().height > 0;
    }, level, { timeout: 180_000 });
    if (await page.getByTestId('mission-button').isVisible() && /Begin/.test(await page.getByTestId('mission-button').innerText())) await page.getByTestId('mission-button').click();
    await expect(page.getByTestId('pause-button')).toBeVisible({ timeout: 180_000 });
    const result = await page.evaluate(async start => {
      // Loading has presented its first frame. Two gameplay RAFs prove a live drawn frame without waiting for
      // background chunk streaming (screenshotReady can wait forever while an L9/L10 world keeps streaming).
      for (let i = 0; i < 2; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const perf = window.__SS__!.perf();
      return { ms: performance.now() - start, backend: perf.backend, quality: perf.quality.tier, tick: window.__SS__!.tick(), phase: window.__SS__!.missions.state()?.phase, drawCalls: perf.drawCalls, bundle: document.querySelector<HTMLScriptElement>('script[type=module][src]')?.src };
    }, t0);
    expect(result.backend, `${level} requires WebGPU`).toBe('webgpu');
    expect(result.quality, `${level} requires low quality`).toBe('low');
    expect(result.drawCalls, `${level} requires a drawn gameplay frame`).toBeGreaterThan(0);
    expect(result.phase, `${level} requires playable mission state`).toBe('playing');
    return result;
  } finally { await context.close(); }
}

for (const [index, level] of levels.entries()) test(`8 load time ${level}: level click → playable versus PROD, WebGPU low`, async ({ browser, baseURL }, info) => {
  test.setTimeout(240_000);
  // Alternate order, with a fresh storage/cache context for every observation, using one browser.
  const results = new Map<string, Awaited<ReturnType<typeof measure>>>();
  for (const [name, origin] of index % 2 ? [['baseline', baseline], ['candidate', baseURL!]] : [['candidate', baseURL!], ['baseline', baseline]]) results.set(name, await measure(browser, origin, level));
  const candidate = results.get('candidate')!, reference = results.get('baseline')!;
  const receipt = { level, candidate, baseline: reference, baselineURL: baseline, limitMs: reference.ms + Math.min(1000, reference.ms * .1) };
  mkdirSync('test-results/qa-invariants', { recursive: true });
  writeFileSync(`test-results/qa-invariants/load-${level}.json`, JSON.stringify(receipt, null, 2) + '\n');
  await info.attach('load-time', { body: JSON.stringify(receipt, null, 2), contentType: 'application/json' });
  expect(oracle.load({ candidateMs: candidate.ms, baselineMs: reference.ms }), `${level} load invariant: ${JSON.stringify(receipt)}`).toBe(false);
});


test('Scene Lab: scripted cast is submitted and drawn on both quality paths', async ({ browser }, info) => {
  test.setTimeout(180_000);
  try {
    for (const tier of ['low', 'high'] as const) {
      const session = new SceneSession({ backend: 'webgpu', tier });
      try {
        await session.open(browser);
        await session.load(readSpec('tests/scenes/catalog/ped-l1-staged-cast.json'));
        await session.ready(); await session.step(3);
        const metrics = await session.metrics();
        for (const [id, actor] of Object.entries(metrics.actors)) {
          expect.soft(actor.drawnFrames, `${tier}/${id} must be drawn`).toBeGreaterThan(0);
          expect.soft(actor.missedInViewFrames, `${tier}/${id} disappeared while in view`).toBe(0);
        }
        expect.soft(Object.keys(metrics.actors)).toEqual(expect.arrayContaining(['clerk', 'tech-a', 'tech-b', 'firefighter']));
        await info.attach(`scripted-cast-${tier}`, { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
        const seated = readSpec('tests/scenes/catalog/fix-p1-l2-start-courier-crew.json');
        seated.camera = { mode: 'game', target: [-67.05, 0, 32.39], zoom: 1.5 };
        await session.load(seated); await session.ready(); await session.step(60);
        const benches = await session.page.evaluate(() => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world;
          const drawn = new Set(window.__SS__!.crowdFigures().filter(f => f.drawn).map(f => f.id));
          const submissions: { x: number; y: number; z: number; placeholder: boolean }[] = [];
          game.view.scene.traverse(node => {
            if (node.name !== 'inst:prop.bench') return;
            const group = node as InstancedGroup;
            for (let parent = node; parent; parent = parent.parent!) if (!parent.visible) return;
            if (!group.children.some(child => (child as Mesh).isMesh && (child as unknown as { count: number }).count > 0)) return;
            for (const ref of group.references) { const p = ref.position.clone().applyMatrix4(group.matrixWorld); submissions.push({ x: p.x, y: p.y, z: p.z, placeholder: !!group.userData.placeholder }); }
          });
          return w.missions!.state.l2!.benchIds.filter(id => drawn.has(id)).map(id => {
            const e = w.entities.get(id)!, a = e.civilian!.schedule![0], prop = w.props!.items.find(p => p.id === a.seatProp);
            const points: number[][] = [];
            if (prop) for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) {
              const yaw = 2 * Math.atan2(prop.pose.q[1], prop.pose.q[3]), x = prop.center[0] + dx * prop.half[0], z = prop.center[2] + dz * prop.half[2];
              const p = game.view.project(prop.pose.p[0] + Math.cos(yaw) * x + Math.sin(yaw) * z, prop.pose.p[1] + prop.center[1] + dy * prop.half[1], prop.pose.p[2] - Math.sin(yaw) * x + Math.cos(yaw) * z);
              points.push([(p[0] + 1) * innerWidth / 2, (1 - p[1]) * innerHeight / 2]);
            }
            return { id, prop: prop?.id ?? null, drawnSeat: !!prop && submissions.some(p => !p.placeholder && Math.hypot(p.x - prop.pose.p[0], p.z - prop.pose.p[2]) < .05), rect: points.length ? [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))] : null };
          });
        });
        expect.soft(benches.length, `${tier}: seated NPCs in the PO camera must be drawn`).toBeGreaterThan(0);
        for (const seat of benches) expect.soft(seat.drawnSeat, `${tier}/NPC ${seat.id}: missing drawn bench ${seat.prop}`).toBe(true);
        const withBenches = PNG.sync.read(await session.page.screenshot());
        try {
          await session.page.evaluate(async () => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game;
            const changed: { mesh: Mesh; start: number; count: number }[] = [];
            const used = new Set<string>();
            game.view.scene.traverse(node => {
              if (node.name !== 'inst:prop.bench') return;
              node.traverse(child => { const mesh = child as Mesh; if (!mesh.isMesh || used.has(mesh.geometry.uuid)) return; used.add(mesh.geometry.uuid); const { start, count } = mesh.geometry.drawRange; changed.push({ mesh, start, count }); mesh.geometry.setDrawRange(0, 0); });
            });
            (window as unknown as { __qaRestoreBenches: () => void }).__qaRestoreBenches = () => { for (const { mesh, start, count } of changed) mesh.geometry.setDrawRange(start, count); game.view.update(1); };
            game.view.update(1);
            for (let i = 0; i < 2; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          });
          const withoutBenches = PNG.sync.read(await session.page.screenshot());
          for (const seat of benches) if (seat.rect) {
            const [x0, y0, x1, y1] = seat.rect; let changed = 0;
            // The top half isolates the seat/back above its ground shadow; a live draw call alone cannot prove visible pixels.
            for (let y = Math.max(0, Math.floor(y0)); y < Math.min(withBenches.height, Math.ceil((y0 + y1) / 2)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(withBenches.width, Math.ceil(x1)); x++) {
              const p = (y * withBenches.width + x) * 4;
              if (Math.abs(withBenches.data[p] - withoutBenches.data[p]) + Math.abs(withBenches.data[p + 1] - withoutBenches.data[p + 1]) + Math.abs(withBenches.data[p + 2] - withoutBenches.data[p + 2]) > 30) changed++;
            }
            expect.soft(changed, `${tier}/NPC ${seat.id}: bench has no visible body pixels`).toBeGreaterThanOrEqual(8);
          }
        } finally { await session.page.evaluate(() => (window as unknown as { __qaRestoreBenches?: () => void }).__qaRestoreBenches?.()); }
        await info.attach(`seated-props-${tier}`, { body: JSON.stringify(benches, null, 2), contentType: 'application/json' });
        expect.soft(session.errors, `${tier} Scene Lab errors`).toEqual([]);
      } finally { await session.close(); }
    }
  } finally { stopServer(); }
});
