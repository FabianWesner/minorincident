/** Screen-only L5 acceptance driver. No entity, navigation, anchor or simulation position reads. */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { launchProfile } from '../browser-pool/client';
import type { Game } from '../../src/Game';

const realtime = process.env.L5_CUE_REALTIME === '1';
const adaptiveCombat = realtime && process.env.L5_CUE_COMBAT === '1';
const out = resolve(`test-results/l5-visual-cue/${realtime ? 'realtime-run' : 'real-input'}`), origin = 'http://127.0.0.1:4881';
mkdirSync(`${out}/profile`, { recursive: true }); mkdirSync(`${out}/raw`, { recursive: true });
const source = resolve('test-results/playtest/l5-visual-cue-l4-flee-save/profile/pool-storage.json');
copyFileSync(source, `${out}/profile/pool-storage.json`);
writeFileSync(`${out}/save-provenance.json`, JSON.stringify({ source, sha256: createHash('sha256').update(readFileSync(source)).digest('hex') }, null, 2));
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4881', '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const hold = (ms: number) => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 60; i++) { try { if ((await fetch(origin)).ok) break; } catch { /* own preview starting */ } await hold(250); }
const context = await launchProfile(`${out}/profile`, { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'], viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.addInitScript('window.__name = f => f');
await page.goto(`${origin}/?test=poses&testApi=1&scenelab=1&dpr=1&audio=muted&quality=low`);
await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.debug.figureJoints(true); });
await page.getByTestId('start-game').click();
await page.getByTestId('level-L5').click();
await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-testid=level-transition]')?.hidden === true, null, { timeout: 120_000 });
await page.evaluate(() => { window.__SS__!.settings.set({ quality: 'low', muted: true }); window.__SS__!.camera.zoom(1.5); });
if (await page.getByTestId('mission-button').isVisible()) await page.getByTestId('mission-button').click();
if (!realtime) await page.evaluate(() => window.__SS__!.pause());
writeFileSync(`${out}/configuration.json`, JSON.stringify({ realtime, adaptiveCombat, ...await page.evaluate(() => {
  const a = window.__SS__!, audio = a.audio.snapshot(), render = a.getState().render;
  return { input: 'physical WASD/mouse', backend: render.backend, quality: render.quality, zoom: render.camera.zoom, muted: audio.muted, master: audio.master, output: audio.output };
}) }, null, 2));
const started = Date.now();
await page.evaluate(() => {
  const start = performance.now(), records: { elapsedS: number; gameS: number; text: string }[] = [];
  let previous = '';
  const sample = () => {
    const text = document.querySelector('[data-testid=survivors-found]')?.textContent ?? '';
    if (text && text !== previous) { previous = text; records.push({ elapsedS: (performance.now() - start) / 1000, gameS: window.__SS__!.tick() / 60, text }); }
  };
  new MutationObserver(sample).observe(document.querySelector('.hud')!, { subtree: true, childList: true, characterData: true });
  sample(); (window as unknown as { __l5CueFinds: typeof records }).__l5CueFinds = records;
});
let index = 0;
const look = () => page.evaluate(() => {
  const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const shown = (el: HTMLElement | null) => !!el && !el.hidden && el.offsetParent !== null;
  const cue = q('survivor-world-cue'), arrow = q('survivor-cue-arrow');
  const rect = cue?.getBoundingClientRect();
  return { objective: q('objective-tracker')?.innerText, subtitle: q('mission-subtitle')?.innerText,
    cue: shown(cue) && +cue!.style.opacity > .1 ? { text: q('survivor-cue-line')?.innerText,
      x: rect!.x + rect!.width / 2, y: rect!.bottom,
      edge: shown(arrow), arrow: shown(arrow) ? arrow!.style.transform : null,
      box: rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height } } : null,
    survivors: [...document.querySelectorAll<HTMLElement>('.hud-survivor-card')].filter(shown).map(e => e.innerText),
    health: q('health-label')?.innerText, weapon: q('weapon-active')?.getAttribute('aria-label'),
    prompt: q('interaction-ring')?.innerText, menu: document.body.dataset.uiScreen };
});
// Remember only captions that actually appeared on the screen during an input action.
let recentCue: Awaited<ReturnType<typeof look>>['cue'] = null, cueSeenAt = 0;
const captions = setInterval(() => {
  void look().then(observation => {
    if (observation.cue) { recentCue = observation.cue; cueSeenAt = Date.now(); }
  }).catch(() => undefined);
}, 200);
// Read submitted bodies performing visible infected animations, project their drawn chest into pixels,
// and send ordinary mouse/number-key events. No simulation entity/position queries are used.
let defending = false, firing = false, selected = '';
const defense = adaptiveCombat ? setInterval(() => {
  if (defending) return; defending = true;
  void (async () => {
    const targets = await page.evaluate(() => {
      if (document.body.dataset.uiScreen !== 'game') return [];
      const view = (window.__SCENE__ as unknown as { game: Game }).game.view;
      const panels = [...document.querySelectorAll<HTMLElement>('.hud-panel')].filter(p => !p.hidden && p.offsetParent !== null && getComputedStyle(p).visibility !== 'hidden').map(p => p.getBoundingClientRect());
      // Dressed infected share the civilian renderer; animation identifies the visibly infected pose.
      return view.crowdFigures().flatMap(f => {
        const head = f.joints?.head, hip = f.joints?.hip;
        if (!f.drawn || !head || !hip || f.appearance?.model.endsWith('.aftermath') || !/^(infected-|shamble$|crawl$|windup$|swing$)/.test(f.clip)) return [];
        const p = view.project(...hip.map((v, i) => v + (head[i] - v) * .6) as [number, number, number]);
        const x = (p[0] + 1) * innerWidth / 2, y = (1 - p[1]) * innerHeight / 2;
        if (p[2] < -1 || p[2] > 1 || x < 4 || x > innerWidth - 4 || y < 4 || y > innerHeight - 4 || panels.some(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) return [];
        return [{ x, y, attacking: /windup|swing/.test(f.clip) }];
      });
    });
    const score = (p: { x: number; y: number; attacking: boolean }) => Math.hypot(p.x - 640, p.y - 340) - (p.attacking ? 500 : 0);
    const target = targets.sort((a, b) => score(a) - score(b))[0];
    if (target) {
      // The basement shotgun permanently kills close infected; distant MG knockdowns recover behind the group.
      const key = 'Digit6';
      const label = await page.getByTestId('weapon-active').getAttribute('aria-label') ?? '';
      if (key !== selected || !label.includes(key === 'Digit6' ? 'shotgun' : 'Machine gun')) { await page.keyboard.press(key); selected = key; }
      await page.mouse.move(target.x, target.y); if (!firing) { await page.mouse.down(); firing = true; }
      appendFileSync(`${out}/combat.jsonl`, JSON.stringify({ elapsedS: (Date.now() - started) / 1000, aim: [target.x, target.y], key }) + '\n');
    } else if (firing) { await page.mouse.up(); firing = false; }
  })().catch(error => console.error(String(error))).finally(() => { defending = false; });
}, 150) : null;
type Action = { move?: string; ms?: number; aim?: [number, number]; fire?: boolean; key?: string; button?: string };
let chain = Promise.resolve();
const controls = createServer((req, res) => {
  let body = ''; req.on('data', chunk => { body += chunk; });
  req.on('end', () => { chain = chain.then(async () => {
    try {
      if (req.url === '/done') {
        clearInterval(captions);
        if (defense) clearInterval(defense); while (defending) await hold(20); if (firing) await page.mouse.up();
        const finds = await page.evaluate(() => (window as unknown as { __l5CueFinds: unknown[] }).__l5CueFinds);
        const events = await page.evaluate(() => window.__SS__!.events().filter(e => ['l5.found', 'player.died', 'player.respawned'].includes(e.type)).map(e => ({ type: e.type, tick: e.tick, ...(e.type === 'l5.found' ? { key: e.key, count: e.count } : {}) })));
        writeFileSync(`${out}/finds.json`, JSON.stringify({ realtime, elapsedS: (Date.now() - started) / 1000, finds, events }, null, 2));
        await context.close(); server.kill(); res.end(JSON.stringify(finds)); controls.close(); return;
      }
      if (req.url === '/act') {
        const actions = JSON.parse(body || '{}') as Action | Action[];
        if (!realtime) await page.evaluate(() => window.__SS__!.resume());
        for (const a of Array.isArray(actions) ? actions : [actions]) {
          if (a.aim && !adaptiveCombat) await page.mouse.move(...a.aim);
          if (a.key) await page.keyboard.press(a.key);
          if (a.button) await page.getByTestId(a.button).click();
          if (a.fire && !adaptiveCombat) await page.mouse.down();
          const keys = [...a.move ?? ''].filter(k => 'wasd'.includes(k)).map(k => `Key${k.toUpperCase()}`);
          for (const key of keys) await page.keyboard.down(key);
          await hold(Math.min(4000, a.ms ?? 500));
          for (const key of keys) await page.keyboard.up(key);
          if (a.fire && !adaptiveCombat) await page.mouse.up();
          appendFileSync(`${out}/inputs.jsonl`, JSON.stringify({ elapsedS: (Date.now() - started) / 1000, ...a }) + '\n');
        }
      }
      if (!realtime) await page.evaluate(() => window.__SS__!.pause());
      const observation = await look();
      const screenshot = `${out}/raw/${String(index++).padStart(4, '0')}.jpg`;
      await page.screenshot({ path: screenshot, type: 'jpeg', quality: 75 });
      appendFileSync(`${out}/screen.jsonl`, JSON.stringify({ elapsedS: (Date.now() - started) / 1000, ...observation, screenshot }) + '\n');
      res.end(JSON.stringify({ ...observation, recentCue: Date.now() - cueSeenAt < 4000 ? recentCue : null, screenshot }));
    } catch (error) { res.statusCode = 500; res.end(String(error)); }
  }); });
}).listen(4883, '127.0.0.1', () => console.log('Screen-only L5 controls: http://127.0.0.1:4883'));
