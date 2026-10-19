import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

test.use({ viewport: { width: 1280, height: 720 }, launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });
for (const backend of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) test(`PO #21/#24/#29/#40 @E18-AC01 close bodies and clean loading ${backend} ${quality}`, async ({ page }) => {
  test.setTimeout(240_000);
  const warnings: string[] = [];
  page.on('console', message => { if (/\[assets\].*wpn\.(fists|kick).*PLACEHOLDER|THREE\.AttributeNode.*position.*not found/i.test(message.text())) warnings.push(message.text()); });
  const spec = JSON.parse(readFileSync('tests/scenes/catalog/polish-crowd-bodies.json', 'utf8')) as SceneSpec;
  spec.camera = { ...spec.camera!, zoom: .5 } as SceneSpec['camera'];
  await page.goto(`/?test=1&scenelab&${backend === 'webgl' ? 'renderer=webgl&' : ''}quality=${quality}&audio=muted&profile=1&dpr=1`);
  await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
  const proof = await page.evaluate(async spec => {
    const api = window.__SS__!, lab = window.__SCENE__!; await api.ready; await lab.load(spec); await lab.step(120); await lab.ready();
    const figures = api.crowdFigures(), ids = Object.fromEntries([...lab.actors].map(([name, actor]) => [name, actor.entity]));
    const alphas = figures.filter(f => [ids['alpha-live'], ids['alpha-dead'], ids['mega-dead']].includes(f.id));
    return { alphas, runner: figures.find(f => f.id === ids['runner-near']), perf: api.perf() };
  }, spec);
  const out = 'docs/reports/visual-polish/close'; mkdirSync(out, { recursive: true });
  await page.screenshot({ path: `${out}/${backend}-${quality}-alphas.png` });
  expect(warnings).toEqual([]);
  expect(proof.perf.backend).toBe(backend);
  expect(proof.alphas).toHaveLength(3);
  expect(proof.runner?.drawn).toBe(true);
  expect(proof.runner?.lod).toBe(quality === 'low' ? 'lod1' : 'lod0');
  for (const figure of proof.alphas) { expect(figure.drawn).toBe(true); expect(figure.lod).toBe('lod0'); }
  const waiting = JSON.parse(readFileSync('tests/scenes/catalog/polish-waiting-crowd.json', 'utf8')) as SceneSpec;
  waiting.camera = { mode: 'game', target: [0, 0], zoom: .5 };
  const civilians = await page.evaluate(async spec => {
    const lab = window.__SCENE__!, api = window.__SS__!; await lab.load(spec); await lab.step(180); await lab.ready();
    const ids = [...lab.actors].filter(([name]) => name.startsWith('waiting-')).map(([, actor]) => actor.entity);
    return api.crowdFigures().filter(f => ids.includes(f.id));
  }, waiting);
  await page.screenshot({ path: `${out}/${backend}-${quality}-waiting.png` });
  writeFileSync(`${out}/${backend}-${quality}.json`, JSON.stringify({ warnings, alphas: proof.alphas, runner: proof.runner, civilians, perf: proof.perf }, null, 2));
  expect(civilians).toHaveLength(5);
  expect(new Set(civilians.map(f => f.clip)).size).toBeGreaterThanOrEqual(3);
  expect(new Set(civilians.map(f => Math.floor(f.phase * 8))).size).toBeGreaterThanOrEqual(3);
  for (const figure of civilians) expect(figure.lod).not.toBe('lod2');
  expect(warnings).toEqual([]);
  expect(proof.perf.drawCalls).toBeLessThanOrEqual(quality === 'low' ? 300 : 600);
  expect(proof.perf.triangles).toBeLessThanOrEqual(quality === 'low' ? 500000 : 1500000);
});
