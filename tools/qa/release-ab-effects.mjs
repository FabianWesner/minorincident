/** Paired shared-pipeline visual probes; native campaign runs cover progression separately. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { launchBrowser } from '../browser-pool/client.ts';
const backend = process.argv[2] ?? 'webgpu', out = resolve('test-results/release-ab-1101/effects', backend); mkdirSync(out, { recursive: true });
function readSpec(file) { const spec = JSON.parse(readFileSync(file)); if (!spec.extends) return spec; const base = readSpec(resolve(dirname(file), spec.extends)); delete spec.extends; return { ...base, ...spec }; }
const fixtures = [
  ...['bat', 'handgun', 'smg', 'shotgun', 'assault-rifle', 'army-mg', 'rocket-launcher'].map(id => ({
    name: `weapon-${id}`, seed: 1, ground: 'asphalt', size: 50, time: id === 'rocket-launcher' ? 'night' : 'L4', dof: false,
    actors: [{ id: 'courier', kind: 'courier', at: [0, 0], loadout: [`weapon.${id}`, 'weapon.kick'] }, { id: 'target', kind: 'infected', at: [id === 'bat' ? 1.2 : 7, 0], archetype: 'infected.alpha', state: 'idle' }],
    camera: { mode: 'game', target: 'courier', zoom: 1.5 }, frames: 120,
    script: [{ frame: 8, actor: 'courier', do: { attack: 'target', seconds: .65, move: [0, 0] } }]
  })),
  readSpec(resolve('tests/scenes/catalog/qa-l10-title-credits.json')),
];
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', ...(backend === 'webgpu' ? ['--enable-unsafe-webgpu'] : [])] }), rows = [];
try {
  for (const spec of fixtures) for (const [side, origin] of [['prod', 'http://127.0.0.1:4902'], ['candidate', 'http://127.0.0.1:4901']]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }), page = await context.newPage(); page.setDefaultTimeout(120000);
    const row = { side, name: spec.name, backend, frames: [], errors: [] };
    page.on('pageerror', e => row.errors.push(e.message));
    try {
      await page.addInitScript('window.__name = f => f');
      await page.goto(`${origin}/?test=1&scenelab=1&profile=1&quality=low&audio=muted&dpr=1&preload=0${backend === 'webgl2' ? '&renderer=webgl' : ''}`);
      await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
      await page.evaluate(async () => { await window.__SS__.ready; window.__SS__.pause(); window.__SS__.settings.set({ quality: 'low', vfx: true }); });
      row.setup = await page.evaluate(s => window.__SCENE__.load(s), spec);
      let previous = 0;
      for (const frame of spec.name.includes('credits') ? [0, 60, 180, 300, 360, 480] : [0, 10, 16, 24, 36, 60, 90]) {
        if (frame > previous) await page.evaluate(n => window.__SCENE__.step(n), frame - previous); previous = frame;
        await page.evaluate(() => window.__SCENE__.ready());
        const image = `${spec.name}-${side}-${frame}.jpg`;
        await page.screenshot({ path: resolve(out, image), type: 'jpeg', quality: 76 });
        row.frames.push({ frame, image, metrics: await page.evaluate(() => window.__SCENE__.metrics()), effects: await page.evaluate(() => window.__SS__.perf().effects) });
      }
      row.events = await page.evaluate(() => window.__SS__.events());
      row.backendActual = await page.evaluate(() => window.__SS__.perf().backend);
    } catch (e) { row.failure = String(e); }
    finally { await context.close(); rows.push(row); writeFileSync(resolve(out, 'results.json'), JSON.stringify(rows, null, 2)); console.log(JSON.stringify({ mode: 'effects', side, name: row.name, failure: row.failure, errors: row.errors })); }
  }
} finally { await browser.close(); }
if (rows.some(r => r.failure || r.errors.length)) process.exitCode = 1;
