import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchBrowser } from '../../browser-pool/client.ts';
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';

const tier = process.argv[2]; assert(['low', 'high'].includes(tier));
const identity = provenance(), hash = browserHash(), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const seedPath = `docs/reports/fix51-r10c/L10-${tier}-dog-save.json.gz`;
const seedBytes = readFileSync(seedPath), campaign = JSON.parse(gunzipSync(seedBytes).toString());
const out = resolve(`test-results/sweep-c5/L10-07-${tier}-${Date.now()}`); mkdirSync(out, { recursive: true });
const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port; await new Promise(r => socket.close(r)); assert.notEqual(port, 3300);
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const rows = [];
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break; } catch { /* own preview starts */ } await delay(100); }
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage(), errors = []; page.setDefaultTimeout(120000);
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript('window.__name=f=>f');
    await page.goto(`http://127.0.0.1:${port}/?test=1&ui=1&scenelab=1&renderer=webgl&quality=${tier}&controls=wasd&audio=enabled&dpr=1&preload=0`);
    await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
    await page.evaluate(async ({ campaign, tier }) => {
      const a = window.__SS__, g = window.__SCENE__.game; await a.ready; a.pause(); a.campaign.restore(campaign);
      await a.loadLevel('L10', { seed: 1 }); a.pause(); a.settings.set({ quality: tier, muted: false });
      a.cheats.god(true); g.driver = null; g.ui.show(null); g.input.release(); g.world.clearInput(); a.camera.zoom(1.5);
      await a.audio.unlock(); window.__megaProof = { cues: [], samples: [] };
      g.world.events.on('mega.cue', event => window.__megaProof.cues.push({ ...structuredClone(event), distance: g.world.megaPursuit.distance() }));
    }, { campaign, tier });
    const captures = [], bands = new Set();
    await page.evaluate(() => window.__SS__.resume());
    for (let second = 0; second <= 100; second++) {
      const sample = await page.evaluate(() => {
        const g = window.__SCENE__.game, w = g.world, ring = document.querySelector('[data-testid="mega-distance-ring"]'), map = document.querySelector('.hud-map');
        const r = ring ?? document.querySelector('.hud-mega-ring'), css = getComputedStyle(r), box = r.getBoundingClientRect(), m = map.getBoundingClientRect();
        const animations = r.getAnimations().map(a => ({ name: a.animationName, state: a.playState, keyframes: a.effect.getKeyframes() }));
        return { tick: w.tick, distance: w.megaPursuit.distance(), band: w.megaPursuit.band(), id: w.megaPursuit.state.id,
          ring: { hidden: r.hidden, band: r.dataset.band, width: r.style.width, height: r.style.height, opacity: css.opacity, animation: css.animationName, animations,
            centerError: Math.hypot(box.x + box.width/2 - m.x - m.width/2, box.y + box.height/2 - m.y - m.height/2), attributes: [...r.attributes].map(a => [a.name,a.value]) },
          pins: [...map.querySelectorAll('[data-entity-id]')].filter(p => !p.hidden).map(p => Number(p.dataset.entityId)),
          audio: window.__SS__.audio.snapshot() };
      });
      rows.push(sample);
      if (!bands.has(sample.band)) {
        bands.add(sample.band); await page.evaluate(() => window.__SS__.screenshotReady());
        const file = resolve(out, `${tier}-${sample.band}.jpg`); await page.screenshot({ path: file, type:'jpeg',quality:88 });
        captures.push({ file, sha256: sha(readFileSync(file)), band: sample.band, tick: sample.tick });
      }
      if (second < 100) await delay(1000);
    }
    const events = await page.evaluate(() => window.__megaProof.cues);
    // Full snapshots are retained once; each sample keeps only new actual graph cue records.
    let lastVoice = 0;
    for (const sample of rows) { const audio = sample.audio; sample.audio = { ...audio, cues: audio.cues.filter(c => c.voice > lastVoice && c.cue.startsWith('mega.')) }; lastVoice = Math.max(lastVoice, ...audio.cues.map(c=>c.voice)); }
    rows.push({ captures, events, errors });
    console.log(tier, { bands:[...bands], cues:events.filter(e=>e.kind!=='step'), errors });
  } finally { await context.close(); }
} finally {
  await browser.close(); server.kill('SIGTERM');
  mkdirSync('docs/reports/sweep-c5/L10-07', { recursive: true });
  writeFileSync(`docs/reports/sweep-c5/L10-07/${tier}-presentation.json`, JSON.stringify({ ...identity, browserHash: hash, toolSha256: sha(readFileSync(new URL(import.meta.url))), seed: { file: seedPath, sha256: sha(seedBytes) }, out,
    method: 'Shared headless Metal WebGL2. Naturally progressed native production Resume; no actor or objective writes. Courier protection only, stand for100 wall-clock seconds with the normal production clock; actual audio unlocked and graph scheduling, host output muted. Read-only DOM ring/animation/pins, pursuit distances and cue records. Not a performance measurement.', rows }, null, 2) + '\n');
}
