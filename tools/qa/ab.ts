import { chromium, type Browser, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { preview } from 'vite';
import { preset } from '../../src/sim/progression/Campaign';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

type Stop = { id: string; level: string; label: string; zoom: number; tick: number };
const args = process.argv.slice(2);
function arg(name: string, fallback?: string): string | undefined { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; }
const baseline = arg('--baseline', 'https://minor-incident.com')!;
const candidate = arg('--candidate');
if (!candidate) throw new Error('Usage: npm run qa:ab -- --baseline <url> --candidate <url|dist> [--levels L1-L4]');
const selected = (arg('--levels', 'L1-L10')!).split(',').flatMap(v => v.includes('-') && /^L\d+-L\d+$/.test(v) ? Array.from({ length: Number(v.split('-')[1].slice(1)) - Number(v.slice(1, v.indexOf('-L'))) + 1 }, (_, i) => `L${Number(v.slice(1, v.indexOf('-L'))) + i}`) : [v]).filter(v => /^L([1-9]|10)$/.test(v));
const threshold = Number(arg('--threshold', '0.025'));
const day = new Date().toISOString().slice(0, 10);
const output = resolve('docs/reports/qa-ab', day);
mkdirSync(output, { recursive: true });
const tour: Record<string, [string, number][]> = {
  L1: [['depot-handover', 0], ['bike-rack', 240], ['fire-station', 600], ['lab-handover', 960]],
  L2: [['ride-start-benches', 0], ['ride-opening', 240], ['ride-middle', 600], ['ride-late', 960]],
  L3: [['raised-corridor-ramps', 240], ['corridor-middle', 600], ['army-checkpoint-pullback', 960], ['checkpoint-late', 1200]],
  L4: [['plaza-tank-hold', 0], ['barrier-approach', 240], ['alarm-wave', 600], ['civilians-hold', 960]],
};
for (let n = 5; n <= 10; n++) tour[`L${n}`] = [['start-area', 0], ['gate', 360], ['handover', 720], ['finale', 1080]];
const stops: Stop[] = selected.flatMap(level => (tour[level] ?? []).map(([label, tick], i) => ({ id: `${level.toLowerCase()}-${String(i + 1).padStart(2, '0')}-${label}`, level, label, tick, zoom: i % 2 === 0 ? 1.5 : 1 })));

function urlFor(base: string): string {
  if (base === 'dist') base = `http://127.0.0.1:${process.env.E2E_PORT ?? '4201'}`;
  const u = new URL(base); u.searchParams.set('testApi', '1'); u.searchParams.set('seed', '13'); u.searchParams.set('quality', 'low'); u.searchParams.set('dpr', '1'); u.searchParams.set('audio', 'muted'); return u.toString();
}
async function prepare(page: Page, base: string, level: string, stop?: Stop): Promise<void> {
  await page.goto(urlFor(base), { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => !!window.__SS__, { timeout: 120_000 });
  const l9Save = level === 'L9' ? preset('L8-default') : null;
  if (l9Save) { l9Save.completedLevels = 8; l9Save.unlockedLevel = 9; l9Save.settings.quality = 'low'; }
  const checkpoint = level === 'L10' ? ({ 'gate': 'cure-industrial', 'handover': 'cure-research-entry', 'finale': 'cure-disperse-ready' } as Record<string, string>)[stop?.label ?? ''] : undefined;
  await page.evaluate(async ({ levelId, save, checkpointId }) => {
    const a = window.__SS__!; await a.ready;
    if (save) a.campaign.restore(save);
    await a.loadLevel(levelId, { seed: 13, ...(checkpointId ? { checkpoint: checkpointId } : {}), ...(['L1', 'L9'].includes(levelId) ? {} : { progression: `${levelId}-default` as 'L2-default' | 'L3-default' | 'L4-default' | 'L5-default' | 'L6-default' | 'L7-default' | 'L8-default' | 'L10-default' }) });
    a.pause(); a.settings.set({ quality: 'low', cameraShake: false, bloom: false, cheapDof: false, vfx: false });
    a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5);
    if (['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L8'].includes(levelId)) a.bot.start('complete');
    await a.step(1); await a.screenshotReady();
  }, { levelId: level, save: l9Save, checkpointId: checkpoint });
}
async function advance(page: Page, ticks: number, zoom: number): Promise<void> {
  await page.evaluate(async ({ n, z }) => { const a = window.__SS__!; a.camera.zoom(z); a.resume(); await a.step(n); a.pause(); await a.screenshotReady(); }, { n: ticks, z: zoom });
}
function compare(aBuf: Buffer, bBuf: Buffer, diffPath: string): number {
  const a = PNG.sync.read(aBuf), b = PNG.sync.read(bBuf);
  if (a.width !== b.width || a.height !== b.height) throw new Error(`Frame size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  const diff = new PNG({ width: a.width, height: a.height });
  const count = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.12, includeAA: false, diffColor: [255, 24, 28], alpha: .7 });
  writeFileSync(diffPath, PNG.sync.write(diff)); return count / (a.width * a.height);
}
function jpeg(path: string): void { execFileSync('/usr/bin/sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '70', path, '--out', path.replace(/\.png$/, '.jpg')], { stdio: 'ignore' }); }

const browser: Browser = await chromium.launch({ headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const rows: { stop: Stop; score: number; baseline: string; candidate: string; diff: string; strip: string[] }[] = [];
const previewServer = candidate === 'dist' ? await preview({ preview: { host: '127.0.0.1', port: Number(process.env.E2E_PORT ?? 4201), strictPort: true } }) : null;
try {
  for (const level of selected) {
    for (const side of ['baseline', 'candidate'] as const) {
      await prepare(page, side === 'baseline' ? baseline : candidate, level);
      const backend = await page.evaluate(() => window.__SS__!.getState().render.backend);
      if (backend !== 'webgpu') throw new Error(`${side} ${level}: expected WebGPU, got ${backend}`);
      let tick = 0;
      for (const stop of stops.filter(s => s.level === level)) {
        await advance(page, Math.max(0, stop.tick - tick), stop.zoom); tick = stop.tick;
        const frames: Buffer[] = [];
        for (let f = 0; f < 6; f++) { await advance(page, f === 0 ? 0 : 36, stop.zoom); frames.push(await page.screenshot({ type: 'png', animations: 'disabled' })); }
        const stillPath = resolve(output, `${stop.id}-${side}.png`); writeFileSync(stillPath, frames[0]); jpeg(stillPath);
        const stripPath = resolve(output, `${stop.id}-${side}-strip.png`);
        // Six-frame strip rendered from the captured PNGs in a browser canvas.
        const encoded = frames.map(b => b.toString('base64'));
        await page.setContent('<html><body style="margin:0;background:#111;display:flex"></body></html>');
        await page.evaluate(async images => { const body = document.body; for (const src of images) { const img = new Image(); img.src = `data:image/png;base64,${src}`; await img.decode(); img.style.width = '213px'; img.style.height = '120px'; body.append(img); } }, encoded);
        const strip = await page.screenshot({ type: 'png' }); writeFileSync(stripPath, strip); jpeg(stripPath); rmSync(stripPath);
        // Return to the game page for the next stop on the same tour.
        await prepare(page, side === 'baseline' ? baseline : candidate, level, stop); tick = 0;
        if (side === 'candidate') rows.push({ stop, score: 0, baseline: '', candidate: '', diff: '', strip: [`${stop.id}-baseline-strip.jpg`, `${stop.id}-candidate-strip.jpg`] });
      }
    }
    // Per-stop artifacts are paired only after both builds have been captured.
    for (const stop of stops.filter(s => s.level === level)) {
      const aPath = resolve(output, `${stop.id}-baseline.png`), bPath = resolve(output, `${stop.id}-candidate.png`), dPath = resolve(output, `${stop.id}-diff.png`);
      const score = compare(readFileSync(aPath), readFileSync(bPath), dPath); jpeg(dPath);
      jpeg(aPath); jpeg(bPath);
      rmSync(aPath); rmSync(bPath); rmSync(dPath);
      const row = rows.find(r => r.stop.id === stop.id)!;
      row.score = score; row.baseline = `${stop.id}-baseline.jpg`; row.candidate = `${stop.id}-candidate.jpg`; row.diff = `${stop.id}-diff.jpg`;
    }
  }
} finally { await browser.close(); await previewServer?.close(); }

rows.sort((a, b) => b.score - a.score);
const summary = { baseline, candidate, levels: selected, threshold, total: rows.length, aboveThreshold: rows.filter(r => r.score >= threshold).map(r => ({ id: r.stop.id, level: r.stop.level, label: r.stop.label, score: r.score })), stops: rows.map(r => ({ id: r.stop.id, level: r.stop.level, label: r.stop.label, tick: r.stop.tick, zoom: r.stop.zoom, score: r.score, aboveThreshold: r.score >= threshold })) };
const findings = [
  ['depot clerk returns and closes shop', ['l1-01-depot-handover']],
  ['lab handover animation', ['l1-04-lab-handover']],
  ['pedestrian hats and glasses', ['l1-02-bike-rack', 'l2-01-ride-start-benches']],
  ['sitters have a bench', ['l2-01-ride-start-benches']],
  ['L3 raised corridor gaps', ['l3-01-raised-corridor-ramps']],
  ['L4 tank stays behind barrier', ['l4-01-plaza-tank-hold', 'l4-02-barrier-approach']],
].map(([finding, ids]) => ({ finding, scoredStops: rows.filter(r => (ids as string[]).some(id => r.stop.id === id)).map(r => ({ id: r.stop.id, score: r.score, hit: r.score >= threshold })), hit: rows.some(r => (ids as string[]).includes(r.stop.id) && r.score >= threshold) }));
Object.assign(summary, { findings, findingsHit: findings.filter(f => f.hit).length, findingsTotal: findings.length, hitRate: findings.length ? findings.filter(f => f.hit).length / findings.length : 0 });
writeFileSync(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2));
const cards = rows.map(r => `<section><h2>${r.stop.id} — ${(r.score * 100).toFixed(2)}%</h2><div><figure><img src="${r.baseline}"><figcaption>Baseline</figcaption></figure><figure><img src="${r.candidate}"><figcaption>Candidate</figcaption></figure><figure><img src="${r.diff}"><figcaption>Diff heatmap</figcaption></figure></div><p>Motion strips: <a href="${r.strip[0]}">baseline</a> · <a href="${r.strip[1]}">candidate</a></p></section>`).join('\n');
writeFileSync(resolve(output, 'index.html'), `<!doctype html><meta charset="utf-8"><title>QA A/B ${day}</title><style>body{font:14px system-ui;background:#171717;color:#eee;margin:24px}section{margin:24px 0;padding:12px;background:#252525}section div{display:flex;gap:8px}figure{margin:0}img{width:32vw;height:auto}figcaption{color:#aaa}</style><h1>QA A/B — ${day}</h1><p>Baseline: ${baseline} · Candidate: ${candidate} · Threshold: ${(threshold * 100).toFixed(2)}%</p>${cards}`);
console.log(JSON.stringify({ report: output, total: rows.length, aboveThreshold: summary.aboveThreshold.length, top: rows.slice(0, 8).map(r => [r.stop.id, Number(r.score.toFixed(4))]) }, null, 2));
