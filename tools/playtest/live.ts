import { createServer } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from '../browser-pool/client';
import { look, type Body, type Eyes } from './eyes';
import { preset } from '../../src/sim/progression/Campaign';

/**
 * Live control server: one headless game session that an agent plays unscripted by real input.
 *
 *   npm run build:qa && E2E_PORT=4761 LIVE_PORT=4762 sh tools/e2e-lock.sh npx tsx tools/playtest/live.ts [--heroine male] [--quality low]
 *
 * GET  /look          → compact text of what the player sees (objective, ring, prompts, health, visible bodies).
 * GET  /shot          → saves a JPEG of the screen and returns its path.
 * POST /act  {json}   → real input, then returns /look. Fields (all optional, applied in this order):
 *   key: "2"            press a key once (weapon slot, E, Escape …)
 *   click: [x, y]       left click on the screen (shoot at the cursor, or use a menu point)
 *   attack: [x, y]      aim at a screen point and attack (Space) once
 *   move: "wd", ms: 600 hold movement keys (w/a/s/d) for ms
 *   hold: "e", ms: 900  hold any key for ms (E for prompts and rings)
 *   wait: 500           let the game run for ms
 *   wheel: -1000        physical mouse wheel (negative zooms in)
 *   button: "mission" | "resume" | "retry" | "continue"   click a visible UI button
 * Nothing here moves the player or reads hidden state for the agent: it only sends device input and reports the HUD.
 */
const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const heroine = arg('heroine', 'female'), quality = arg('quality', 'low'), level = arg('level', 'L1');
// --step: the game clock pauses between actions and runs only while an action plays (turn-based, input stays real).
const step = process.argv.includes('--step');
// --autofight: an aim assist that attacks the nearest drawn, on-screen infected by real input (mouse on its body + Space).
// Melee reach 2.6 m, ranged weapons 14 m. The agent still chooses route, weapon, prompts and objectives.
const autofight = process.argv.includes('--autofight');
const screenOnly = process.argv.includes('--screen');
const port = Number(process.env.E2E_PORT ?? 4101), livePort = Number(process.env.LIVE_PORT ?? 4102);
if (port === 3300 || livePort === 3300) throw new Error('never port 3300');
if (!existsSync('dist/index.html')) throw new Error('npm run build:qa first');
const origin = `http://127.0.0.1:${port}`;
const up = async () => { try { return (await fetch(origin)).ok; } catch { return false; } };
let server: ChildProcess | null = null;
if (!(await up())) {
  server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
  for (let i = 0; i < 120 && !(await up()); i++) await new Promise(r => setTimeout(r, 500));
}
const hold = (ms: number) => new Promise(r => setTimeout(r, ms));
const args = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await launchBrowser({ headless: true, args });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.addInitScript('window.__name = (f) => f;');
const menuUrl = `${origin}/?test=poses&testApi=1&scenelab=1&renderer=webgl&dpr=1&audio=muted&quality=${quality}`;
await page.goto(menuUrl);
await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.debug.figureJoints(true); });
// Seed the real campaign save before opening the menu, so the normal unlocked-level
// list is used and the debug controls never need to be enabled.
if (level !== 'L1') {
  await page.evaluate(({ save }) => {
    const api = window.__SS__!;
    api.campaign.restore(save);
    api.campaign.save();
  }, { level, save: preset(`L${level.slice(1)}-default` as `L${2|3|4|5|6|7|8|9|10}-default`) });
  await page.reload();
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
  await page.evaluate(() => window.__SS__!.ready);
}
await page.getByTestId('start-game').click({ timeout: 120_000 });
await hold(500);
if (await page.getByTestId(`character-${heroine}`).isVisible().catch(() => false)) await page.getByTestId(`character-${heroine}`).click();
// Retry one failed level start from the menu. This is an in-memory reload only;
// dist is built once by luna-play.sh before the session loop.
let levelStarted = false;
for (let attempt = 0; attempt < 2 && !levelStarted; attempt++) {
  if (attempt > 0) {
    await page.goto(menuUrl);
    await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
    await page.evaluate(() => window.__SS__!.ready);
    await page.getByTestId('start-game').click({ timeout: 120_000 });
    await hold(500);
    if (await page.getByTestId(`character-${heroine}`).isVisible().catch(() => false)) await page.getByTestId(`character-${heroine}`).click();
  }
  await page.getByTestId(`level-${level}`).click({ timeout: 60_000 });
  try {
    await Promise.race([
      page.getByTestId('mission-button').waitFor({ state: 'visible', timeout: 120_000 }),
      page.waitForFunction(() => window.__SS__!.missions.state()?.phase === 'playing', null, { timeout: 120_000 }),
    ]);
    levelStarted = true;
  } catch { /* retry the level selection once from the saved menu */ }
}
if (!levelStarted) throw new Error(`${level} failed to start after one retry`);
const beginMission = async () => {
  const phase = await page.evaluate(() => window.__SS__!.missions.state()?.phase);
  if (phase === 'briefing') {
    const button = page.getByTestId('mission-button');
    await button.waitFor({ state: 'visible', timeout: 30_000 });
    await button.click();
    await page.waitForTimeout(900);
    if (await page.evaluate(() => window.__SS__!.missions.state()?.phase) === 'briefing') {
      await button.click();
      await page.waitForFunction(() => window.__SS__!.missions.state()?.phase !== 'briefing', null, { timeout: 30_000 });
    }
  }
};
await beginMission();

// PO 11-01: "a mode where the user cannot die, so an agent has a chance to play it. This is not for judging fun but to check
// the acceptance criterias". Screen play is immortal unless LUNA_MORTAL=1: attacks still land and are logged, but the courier takes no damage.
const immortal = screenOnly && process.env.LUNA_MORTAL !== '1';
if (immortal) setInterval(() => { void page.evaluate(() => window.__SS__?.cheats.god(true)).catch(() => {}); }, 1000);
const started = Date.now() - Number(process.env.LUNA_WALL_OFFSET_MS ?? 0);
let deaths = 0, lastHp = Infinity, lastPos: { x: number; z: number } | null = null;
const body = (b: Body, p: NonNullable<Eyes['player']>) => `${b.kind}#${b.id} ${Math.round(b.d)}m dir ${compass(b.x - p.x, b.z - p.z)} hp ${Math.round(b.hp)}/${b.max} screen ${Math.round(b.aim.x)},${Math.round(b.aim.y)}${b.attacking ? ' ATTACKING' : ''}${b.state ? ` (${b.state})` : ''}`;
const compass = (dx: number, dz: number) => ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8];
const describe = (e: Eyes) => {
  const p = e.player, lines: string[] = [];
  if (p) { if (p.hp <= 0 && lastHp > 0) deaths++; lastHp = p.hp; }
  lines.push(`t=${Math.round((Date.now() - started) / 1000)}s tick ${e.tick} level ${e.level ?? '-'} phase ${e.phase ?? '-'} deaths ${deaths}${autofight ? ` autofight-attacks ${fights}` : ''}${e.loading ? ' LOADING' : ''}${e.menu ? ` MENU:${e.menu}` : ''}`);
  lines.push(`objective: ${e.objective || '-'}${e.tracker ? ` | tracker: ${e.tracker}` : ''}`);
  if (e.marker) {
    // The edge arrow only shows a direction; turn it into a ground point a player would click (player ≈ screen centre).
    const cx = e.view.w / 2, cy = e.view.h / 2, dx = e.marker.x - cx, dy = e.marker.y - cy, len = Math.hypot(dx, dy) || 1;
    const reach = e.marker.offscreen ? 260 : Math.min(260, len);
    const gx = Math.round(Math.min(e.view.w - 260, Math.max(260, cx + dx / len * reach))), gy = Math.round(Math.min(e.view.h - 170, Math.max(120, cy + dy / len * reach)));
    const dir = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
    lines.push(`objective marker: ${e.marker.offscreen ? 'off screen, the arrow points' : 'on screen,'} ${dir} (marker ${Math.round(e.marker.x)},${Math.round(e.marker.y)}). To walk that way, click the ground at ${gx},${gy}.`);
  }
  if (e.prompt) lines.push(`prompt: ${e.prompt}`);
  if (e.subtitle) lines.push(`subtitle: ${e.subtitle}`);
  if (e.panel.visible) lines.push(`panel: ${e.panel.heading}${e.panel.button ? ` [button: ${e.panel.button}]` : ''}`);
  if (p) { const moved = lastPos ? Math.hypot(p.x - lastPos.x, p.z - lastPos.z) : 0; lines.push(`moved since last look: ${moved.toFixed(1)} m${lastPos && moved < .5 ? ' (NOT MOVING: blocked? try another direction or click a different spot)' : ''}`); lastPos = { x: p.x, z: p.z }; }
  if (p) lines.push(`you: hp ${Math.round(p.hp)}/${p.max} weapon ${p.current ?? 'fists'} rack [${p.weapons.join(', ')}]${p.riding ? ' RIDING' : ''}${e.driving ? ' DRIVING' : ''}`);
  if (p) { lines.push(`enemies on screen: ${e.enemies.length}`); for (const b of e.enemies.slice(0, 6)) lines.push(`  ${body(b, p)}`); }
  if (p && e.allies.length) { lines.push(`allies on screen: ${e.allies.length}`); for (const b of e.allies.slice(0, 4)) lines.push(`  ${body(b, p)}`); }
  return lines.join('\n');
};
const see = async () => describe(await page.evaluate(look));
const click = async (x: number, y: number) => { await page.mouse.move(x, y); await page.mouse.down(); await hold(40); await page.mouse.up(); };
const buttons: Record<string, string> = { mission: 'mission-button', resume: 'resume-game', retry: 'retry-level', continue: 'continue-level' };
const clock = (run: boolean) => { running = run; return step ? page.evaluate(r => { const c = (window.__SCENE__ as unknown as { game: { clock: { pause(): void; resume(): void } } } | undefined)?.game.clock; if (c) { if (r) c.resume(); else c.pause(); } }, run) : Promise.resolve(); };
type Act = { key?: string; click?: [number, number]; attack?: [number, number]; move?: string; hold?: string; ms?: number; wait?: number; wheel?: number; button?: string; playerTurn?: number; playerLevel?: string };
const act = async (a: Act) => {
  if (Number.isFinite(a.wheel)) await page.mouse.wheel(0, Math.max(-2000, Math.min(2000, a.wheel!)));
  if (a.key) await page.keyboard.press(/^[a-z]$/i.test(a.key) ? `Key${a.key.toUpperCase()}` : /^\d$/.test(a.key) ? `Digit${a.key}` : a.key);
  if (a.button) await page.getByTestId(buttons[a.button] ?? a.button).click({ timeout: 3000 }).catch(() => undefined);
  if (a.click) { while (fighting) await hold(20); fighting = true; try { await click(a.click[0], a.click[1]); } finally { fighting = false; } }
  if (a.attack) { await page.mouse.move(a.attack[0], a.attack[1]); await page.keyboard.press('Space'); }
  const ms = Math.min(4000, Math.max(0, a.ms ?? 500));
  if (a.move) {
    const keys = [...new Set([...a.move.toLowerCase()].filter(k => 'wasd'.includes(k)))].map(k => `Key${k.toUpperCase()}`);
    try { for (const k of keys) await page.keyboard.down(k); await hold(ms); }
    finally { for (const k of keys.reverse()) await page.keyboard.up(k).catch(() => undefined); }
  }
  if (a.hold) { const k = a.hold.length === 1 ? `Key${a.hold.toUpperCase()}` : a.hold; await page.keyboard.down(k); await hold(ms); await page.keyboard.up(k); }
  if (a.wait) await hold(Math.min(4000, a.wait));
};
let busy = Promise.resolve();
let lastInput = Date.now();
const idleMs = Number(process.env.BROWSER_POOL_IDLE_MS ?? 60_000);
let fights = 0, fighting = false;
let turn = Number(process.env.LUNA_TURN_OFFSET ?? 0);
let lastFight = 0;
let lastScreenPlayerTurn = -1;
let screenBatch: { from: number; to: number } | null = null;
const deathsByLevel = new Map<string, number>();
let deathVisible = false;
const screenResponse = async (action?: Act) => {
  const out = resolve('test-results/live');
  mkdirSync(out, { recursive: true });
  const path = resolve(out, 'shot.jpg');
  const keepPath = resolve(out, 'shot-keep.jpg');
  await page.screenshot({ path, type: 'jpeg', quality: 60, scale: 'css', clip: { x: 0, y: 0, width: 1280, height: 720 } });
  await page.screenshot({ path: keepPath, type: 'jpeg', quality: 70, scale: 'css', clip: { x: 0, y: 0, width: 1280, height: 720 } });
  const hud = await page.evaluate(() => {
    const visible = (e: Element | null) => !!e && (e as HTMLElement).offsetParent !== null && !(e as HTMLElement).hidden;
    const ids = ['objective-text', 'objective-tracker', 'mission-tracker', 'interaction-ring', 'mission-subtitle'];
    const lines = ids.flatMap(id => { const e = document.querySelector(`[data-testid="${id}"]`); return visible(e) && e!.textContent?.trim() ? [e!.textContent!.trim()] : []; });
    const health = document.querySelector<HTMLElement>('.hud-health .hud-bar-fill');
    if (visible(health) && health!.parentElement) {
      const width = parseFloat(getComputedStyle(health!).width), total = health!.parentElement.clientWidth;
      if (total > 0) lines.push(`Health ${Math.round(width / total * 100)}%`);
    }
    const weapon = document.querySelector<HTMLElement>('.hud-weapon[aria-label]');
    if (visible(weapon)) lines.push(`${weapon!.getAttribute('aria-label')}; ammo ${weapon!.dataset.ammo ?? 'unlimited'}`);
    for (const selector of ['.hud-health .hud-bar-label', '.hud-weapon[aria-label]', '.hud-weapon-rack', '.story-bubble', '.mission-subtitle', '.hud-interaction']) for (const e of document.querySelectorAll<HTMLElement>(selector)) if (visible(e) && Number(getComputedStyle(e).opacity || 1) > 0.05) { const t = e.getAttribute('aria-label') || e.innerText.trim(); if (t) lines.push(t); }
    for (const e of document.querySelectorAll<HTMLElement>('button,[role="button"]')) {
      const label = e.innerText.trim();
      if (visible(e) && label && /mission|retry|continue|resume|death|credits|the end/i.test(label)) lines.push(label);
    }
    const text = [...new Set(lines)].join('\n');
    const debugBarVisible = ['[data-input-controls]', '[data-audio-controls]'].some(selector => {
      const el = document.querySelector<HTMLElement>(selector);
      return !!el && !el.hidden && getComputedStyle(el).display !== 'none';
    });
    return { text: text || 'HUD text unavailable', debugBarVisible };
  });
  const debugBarVisible = hud.debugBarVisible;
  const hudText = hud.text;
  if (action && process.env.LUNA_RUN_DIR) {
    const retryVisible = await page.getByTestId('retry-level').isVisible().catch(() => false);
    const loggedLevel = action.playerLevel && action.playerLevel !== '-' ? action.playerLevel : hudText.match(/\bL\d+\b/)?.[0] ?? level;
    const deaths = deathsByLevel.get(loggedLevel) ?? 0;
    if (retryVisible && !deathVisible) deathsByLevel.set(loggedLevel, deaths + 1);
    deathVisible = retryVisible;
    turn++;
    const frames = resolve(process.env.LUNA_RUN_DIR, '.frames');
    mkdirSync(frames, { recursive: true });
    await page.screenshot({ path: resolve(frames, `turn-${String(action.playerTurn ?? turn).padStart(6, '0')}-action.jpg`), type: 'jpeg', quality: 70, scale: 'css', clip: { x: 0, y: 0, width: 1280, height: 720 } });
    appendFileSync(resolve(process.env.LUNA_RUN_DIR, 'log.jsonl'), JSON.stringify({ turn, player_turn: action.playerTurn ?? null, time: new Date().toISOString(), level: loggedLevel, objective: hudText.split('\n')[0], action, movement_keys: action.move ? [...new Set([...action.move.toLowerCase()].filter(k => 'wasd'.includes(k)))].sort() : [], debug_bar_visible: debugBarVisible, deaths: deathsByLevel.get(loggedLevel) ?? 0, autofight: autofight && Date.now() - lastFight < 1500 ? 'autofight: firing' : autofight ? 'autofight: idle' : undefined, wall_seconds: Math.round((Date.now() - started) / 1000) }) + '\n');
  }
  return { screenshot: path, hud: hudText, debugBarVisible, ...(autofight ? { autofight: Date.now() - lastFight < 1500 ? 'autofight: firing' : 'autofight: idle' } : {}) };
};
const ranged = /pistol|handgun|shotgun|rifle|smg|revolver|minigun|rocket|crossbow|gun|launcher|mg/;
const fightTick = async () => {
  if (!autofight || fighting || Date.now() - lastInput >= idleMs) return;
  fighting = true;
  try {
    const e = await page.evaluate(look);
    const p = e.player;
    if (!p || p.hp <= 0 || e.loading || e.menu || e.driving) return;
    const reach = ranged.test(p.current ?? '') ? 14 : 2.6;
    const target = e.enemies.find(b => b.drawn && b.d <= reach);
    if (!target) return;
    await page.mouse.move(target.aim.x, target.aim.y);
    await page.keyboard.press('Space');
    fights++; lastFight = Date.now();
  } catch { /* page busy or navigating */ } finally { fighting = false; }
};
if (autofight) setInterval(() => { if (!step || running) void fightTick(); }, 220);
let running = false;
createServer((req, res) => {
  let data = '';
  req.on('data', c => { data += c; });
  req.on('end', () => { busy = busy.then(async () => {
    try {
      let acceptedAction: Act | undefined;
      if (req.url === '/act' || req.url === '/shot') lastInput = Date.now();
      if (req.url === '/ping') { lastInput = Date.now(); await page.evaluate(() => 1); res.end('ok\n'); return; }
      if (req.url === '/batch') {
        const batch = JSON.parse(data || '{}') as { from?: number; to?: number };
        if (!Number.isSafeInteger(batch.from) || !Number.isSafeInteger(batch.to) || batch.from! < 1 || batch.to! < batch.from!) throw new Error('Invalid player batch range');
        screenBatch = { from: batch.from!, to: batch.to! }; lastInput = Date.now();
        res.end(JSON.stringify({ accepted: true, ...screenBatch }) + '\n'); return;
      }
      if (req.url === '/shot') { const path = resolve(`test-results/live/shot.jpg`); await page.screenshot({ path, type: 'jpeg', quality: screenOnly ? 60 : 50, scale: 'css', clip: { x: 0, y: 0, width: 1280, height: 720 } }); res.end(path + '\n'); return; }
      if (req.url === '/act') {
        const a = JSON.parse(data || '{}') as Act;
        if (screenOnly && process.env.LUNA_RUN_DIR && screenBatch && (!Number.isSafeInteger(a.playerTurn) || a.playerTurn! < screenBatch.from || a.playerTurn! > screenBatch.to)) {
          res.statusCode = 409; res.end(JSON.stringify({ error: 'Player batch limit reached; finish this invocation now.', batchDone: true, allowed: screenBatch }) + '\n'); return;
        }
        // The player model can issue multiple tool calls in one turn despite the prompt.
        // Accept only the first numbered action so one screenshot turn means one control action.
        const duplicateScreenTurn = screenOnly && Number.isFinite(a.playerTurn) && a.playerTurn! <= lastScreenPlayerTurn;
        if (!duplicateScreenTurn) {
          acceptedAction = a;
          if (screenOnly && Number.isFinite(a.playerTurn)) lastScreenPlayerTurn = a.playerTurn!;
          if (screenOnly && process.env.LUNA_RUN_DIR && Number.isFinite(a.playerTurn)) {
            const frames = resolve(process.env.LUNA_RUN_DIR, '.frames');
            mkdirSync(frames, { recursive: true });
            await page.screenshot({ path: resolve(frames, `turn-${String(a.playerTurn).padStart(6, '0')}-input.jpg`), type: 'jpeg', quality: 70, scale: 'css', clip: { x: 0, y: 0, width: 1280, height: 720 } });
          }
          await clock(true); await act(a); if (!a.move && !a.hold && !a.wait) await hold(step ? 400 : 700); await clock(false);
        }
      }
      if (screenOnly) res.end(JSON.stringify(await screenResponse(acceptedAction)) + '\n');
      else res.end(await see() + '\n');
    } catch (error) { console.error('live request failed:', error); res.statusCode = 500; res.end(String(error) + '\n'); }
  }); });
}).listen(livePort, '127.0.0.1', () => console.log(`live control on http://127.0.0.1:${livePort} (game ${origin})`));
const stop = async () => { await browser.close().catch(() => undefined); server?.kill(); process.exit(0); };
if (process.env.MI_BROWSER_POOL === '1') setInterval(() => { if (Date.now() - lastInput >= idleMs) { console.log('Live session idle: releasing browser; restart live.ts to play again.'); void stop(); } }, 1000).unref();
process.on('SIGINT', stop); process.on('SIGTERM', stop);
