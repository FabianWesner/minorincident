import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { look, type Body, type Eyes } from './eyes';
import { assertRenderedBodies, shouldResumePause } from './startup';
import { canCoverVisibleAllies, fistsRetreatAttack, keepMovingWithFists, prioritizeAllyThreat } from './combat';
import { PlaytestProgress } from './progress';
import { clickGroundInput } from './input';

/**
 * One browser session of the playtest driver (run under tools/e2e-lock.sh by play.ts).
 * Plays levels by real device input only: mouse clicks on the ground (the game's own click-to-move),
 * WASD while driving or unsticking, mouse aim + Space to attack, E to interact, real clicks on the menu
 * and mission buttons. It follows the HUD objective text, the ring and the screen-edge arrow.
 * Game state is used (a) to read what the HUD shows anyway and (b) to locate itself when lost; every (b)
 * is logged as an "assist" entry and named in the report.
 */
export interface SessionOptions {
  origin: string; out: string; levels: string[]; quality: 'low' | 'high'; zoom: number; heroine: 'female' | 'male';
  /** new: title → Start game → heroine → L1. continue: title → Start game → resume level (menu Continue). debug: level list with ?debug=1. */
  entry: 'new' | 'continue' | 'debug'; profile: string; levelMinutes: number; stopAfterLevel: boolean; tag: string; noSkip?: boolean;
}
export interface Issue { level: string; tick: number; x: number; z: number; severity: 'P0' | 'P1' | 'P2' | 'P3'; kind: string; text: string; captures: string[]; step: string | null; objective: string }
export interface LevelRun { level: string; entry: string; heroine: string; finished: boolean; skipped: string[]; wallSeconds: number; simSeconds: number; maxNoProgressSeconds: number; deaths: number; assists: number; attacks: Record<string, number>; weaponsStart: string[]; weaponsEnd: string[]; steps: { id: string; text: string; tick: number; marker: unknown }[] }

const hold = (ms: number) => new Promise(r => setTimeout(r, ms));
const ranged = /pistol|shotgun|rifle|smg|revolver|minigun|rocket|crossbow|gun|launcher/;

export async function runSession(o: SessionOptions): Promise<{ runs: LevelRun[]; issues: Issue[] }> {
  mkdirSync(o.out, { recursive: true }); mkdirSync(join(o.out, 'captures'), { recursive: true });
  const logFile = join(o.out, `log-${o.tag}.jsonl`);
  const log = (entry: object) => appendFileSync(logFile, JSON.stringify({ t: new Date().toISOString(), ...entry }) + '\n');
  const args = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const context = await chromium.launchPersistentContext(resolve(o.profile), { headless: true, args, viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = context.pages()[0] ?? await context.newPage();
  // tsx keeps function names with a __name helper; page-side functions need it defined.
  await page.addInitScript('window.__name = (f) => f; window.__playtestFrames = []; (() => { let last = 0; const f = (now) => { if (last && now - last > 200) window.__playtestFrames.push([now - last, window.__SS__ ? window.__SS__.tick() : -1]); last = now; requestAnimationFrame(f); }; requestAnimationFrame(f); })();');
  if(process.env.PLAYTEST_HANDOVER_AUDIT==='1') await page.addInitScript(`window.__playtestHandoverAudit = []; (() => {
    let sawL7=false,start=null,done=false;
    const visible=e=>!!e&&!e.hidden&&e.offsetParent!==null,q=id=>document.querySelector('[data-testid="'+id+'"]');
    const frame=now=>{const g=window.__SCENE__?.game;
      if(g?.world.scenario==='L7'&&g.world.missions?.state.phase==='playing') sawL7=true;
      if(sawL7&&!done&&g?.world.scenario==='L8'&&!g.loading&&!g.clock.paused&&g.world.missions?.state.phase==='playing'){
        start??=now;const text=q('objective-text')?.textContent??'',pin=visible(q('minimap-objective')),marker=visible(q('mission-marker'));
        const sample={elapsedMs:now-start,tick:g.world.tick,text,pin,marker};
        const ready=text.includes('armored vehicle')&&pin&&marker;
        if(!window.__playtestHandoverAudit.length||ready){window.__playtestHandoverAudit.push(sample);if(ready)done=true;}
      } requestAnimationFrame(frame);};requestAnimationFrame(frame);
  })();`);
  const issues: Issue[] = [], runs: LevelRun[] = [], consoleSeen = new Set<string>();
  let eyes: Eyes | null = null;
  const capture = async (name: string): Promise<string> => {
    const file = `captures/${o.tag}-${name.replace(/[^a-z0-9-]+/gi, '-')}.jpg`;
    try { await page.screenshot({ path: join(o.out, file), type: 'jpeg', quality: 72 }); } catch { /* page busy */ }
    return file;
  };
  const issue = async (severity: Issue['severity'], kind: string, text: string, shot = true): Promise<Issue> => {
    const e = eyes, item: Issue = { level: e?.level ?? '?', tick: e?.tick ?? -1, x: +(e?.player?.x ?? 0).toFixed(1), z: +(e?.player?.z ?? 0).toFixed(1), severity, kind, text, captures: [], step: e?.step ?? null, objective: e?.objective ?? '' };
    if (shot) item.captures.push(await capture(`${item.level}-${item.tick}-${kind}`));
    issues.push(item); log({ issue: item }); console.log(`[${severity}] ${item.level} t${item.tick} (${item.x},${item.z}) ${kind}: ${text}`);
    writeFileSync(join(o.out, `issues-${o.tag}.json`), JSON.stringify(issues, null, 2));
    return item;
  };
  page.on('console', m => { if (m.type() === 'error' && !consoleSeen.has(m.text())) { consoleSeen.add(m.text()); void issue('P2', 'console-error', m.text().slice(0, 300), false); } });
  page.on('pageerror', e => { if (!consoleSeen.has(e.message)) { consoleSeen.add(e.message); void issue('P1', 'page-error', e.message.slice(0, 300), false); } });

  const see = async () => { eyes = await page.evaluate(look); return eyes; };
  const assist = (what: string, data: object = {}) => { log({ assist: what, level: eyes?.level, tick: eyes?.tick, ...data }); };
  const keysDown = new Set<string>();
  const press = async (keys: string[]) => {
    for (const k of [...keysDown]) if (!keys.includes(k)) { await page.keyboard.up(k); keysDown.delete(k); }
    for (const k of keys) if (!keysDown.has(k)) { await page.keyboard.down(k); keysDown.add(k); }
  };
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const safe = (x: number, y: number, e: Eyes) => ({ x: clamp(x, 260, e.view.w - 260), y: clamp(y, 120, e.view.h - 170) });
  const clickGround = (x: number, y: number) => clickGroundInput({ releaseKeys: () => press([]), releaseAim, mouse: page.mouse }, x, y);

  // --- boot and menu ---
  // The figure probe checks presence of `test`; production clock/UI/prewarming check `test=1`.
  // Enable rendered-pose observations while retaining the production play path.
  const params = `test=poses&testApi=1&scenelab=1&renderer=webgl&dpr=1&audio=muted&quality=${o.quality}${o.entry === 'debug' ? '&debug=1' : ''}`;
  await page.goto(`${o.origin}/?${params}`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
  await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.debug.figureJoints(true); });
  await page.getByTestId('start-game').click({ timeout: 120_000 });
  await hold(500);
  const first = o.levels[0];
  if (await page.getByTestId(`character-${o.heroine}`).isVisible().catch(() => false)) await page.getByTestId(`character-${o.heroine}`).click();
  // ?debug=1 lets locked levels start; they stay aria-disabled, so the click is forced.
  await page.getByTestId(`level-${first}`).click({ timeout: 60_000, force: o.entry === 'debug' });
  log({ session: o.tag, entry: o.entry, levels: o.levels, quality: o.quality, heroine: o.heroine });

  // --- per-level state ---
  let run = null as LevelRun | null, wallStart = 0, tickStart = 0;
  let lastProgress = { key: '', tick: 0, wall: Date.now(), best: Infinity };
  let visibleProgress = new PlaytestProgress(), lastObservation=0;
  let stuckLogged = new Set<string>(), lastClick = 0, lastE = 0, zoomed = false, assistMode = false, lastDeathTick = -1;
  let fetchHint: { x: number; z: number } | null = null, escort: { id: number; x: number; z: number } | null = null;
  let navPos = { x: 0, z: 0, wall: Date.now() }, sideStep = 0, navAssist = false, navUntil = 0, navEpisodes = 0, navLog = 0, lastPos = { x: 0, z: 0, wall: Date.now() }, lastShot = -1e9, lastHp = 0, prevWeapons: string[] | null = null, frameCursor = 0, unstickDir = 0;
  const allyWatch = new Map<number, { still: number; hits: number; backwards: number; lastHp: number; reported: Set<string> }>();
  const enemyWatch = new Map<number, { still: number; reported: boolean }>();
  const levelDeadline = () => wallStart + o.levelMinutes * 60_000;
  /** The ring the player sees: the active marker's authored anchor (as markerAnchor() resolves it for the 3D ring). The drawn
   * ring object can still sit at (0, 0, 0) on the first frame of a level, so it is not read directly (10-20: a cached origin ring
   * walked the courier 274 m away in L7). The drawn height is logged once per step for the audit. */
  const markerRing = async (): Promise<{ x: number; y: number; z: number } | null> => page.evaluate(() => {
    const lab = window.__SCENE__ as unknown as { game?: { world: { missions?: { def: { l3?: unknown; anchors: Record<string, { x: number; z: number; y?: number }> }; state: { marker: string | null } } } } } | undefined;
    const m = lab?.game?.world.missions, key = m?.state.marker; if (!m || !key) return null;
    const a = m.def.anchors[m.def.l3 && key === 'l3-route' ? 'l3-zone' : key];
    return a ? { x: a.x, y: a.y ?? 0, z: a.z } : null;
  });
  const drawnRing = async (): Promise<number[] | null> => page.evaluate(() => {
    const m = (window.__SS__!.getState().render as { missionMarker?: { visible: boolean; position: number[] } | null }).missionMarker;
    return m?.visible ? m.position.map(v => +v.toFixed(2)) : null;
  });
  let lastRingRead = 0;
  let ring: { x: number; y: number; z: number } | null = null, ringKey = '';

  const startLevel = async (e: Eyes) => {
    if(process.env.PLAYTEST_GOD==='1'){await page.evaluate(()=>window.__SS__!.cheats.god(true));log({fixture:'god-mode',level:e.level});}
    run = { level: e.level!, entry: o.entry, heroine: o.heroine, finished: false, skipped: [], wallSeconds: 0, simSeconds: 0, maxNoProgressSeconds: 0, deaths: 0, assists: 0, attacks: {}, weaponsStart: e.player?.weapons ?? [], weaponsEnd: [], steps: [] };
    await page.evaluate(() => {
      const observation = window as unknown as { __playtestAttacks: Record<string, number> };
      observation.__playtestAttacks = {};
      const world = (window.__SCENE__ as unknown as { game: { world: import('../../src/sim/world/SimWorld').SimWorld } }).game.world;
      world.events.on('combat.attack', event => { if (event.type === 'combat.attack' && event.sourceId === 1) observation.__playtestAttacks[event.actionId] = (observation.__playtestAttacks[event.actionId] ?? 0) + 1; });
    });
    runs.push(run); lastShot = -1e9; wallStart = Date.now(); tickStart = e.tick; zoomed = false; assistMode = false; stuckLogged = new Set(); allyWatch.clear(); enemyWatch.clear(); fetchHint = null; escort = null;
    lastProgress = { key: '', tick: e.tick, wall: Date.now(), best: Infinity };
    visibleProgress = new PlaytestProgress();lastObservation=0;
    log({ levelStart: e.level, tick: e.tick, weapons: run.weaponsStart, owned: await page.evaluate(() => window.__SS__!.campaign.state()?.ownedActions ?? []) });
    if (e.level === 'L6') writeFileSync(join(o.out, 'campaign-L6.json'), JSON.stringify(await page.evaluate(() => window.__SS__!.campaign.state())));
  };
  const finishLevel = async (e: Eyes) => {
    if (!run) return;
    run.finished = true; run.wallSeconds = Math.round((Date.now() - wallStart) / 1000); run.simSeconds = Math.round((e.tick - tickStart) / 60);
    const deaths = await page.evaluate(level => { const m = window.__SS__!.missions.state(); return m?.id === level ? m.stats.deaths : null; }, run.level);
    if (deaths !== null) run.deaths = deaths;
    run.attacks = await page.evaluate(() => ({ ...(window as unknown as { __playtestAttacks: Record<string, number> }).__playtestAttacks }));
    run.weaponsEnd = e.player?.weapons ?? []; prevWeapons = run.weaponsEnd;
    log({ levelEnd: e.level, run }); await capture(`${e.level}-result`);
    writeFileSync(join(o.out, `runs-${o.tag}.json`), JSON.stringify(runs, null, 2));
  };

  // --- combat and following ---
  const shotAt = new Map<number, { hp: number; ms: number; last: number }>(), ignored = new Map<number, number>(), reportedUnhittable = new Set<number>();
  let aimHeld: number | null = null, lastAimClick = 0, lastCrowdKick = 0;
  const releaseAim = async () => { if (aimHeld !== null) { aimHeld = null; await page.mouse.up(); } };
  const fight = async (e: Eyes): Promise<boolean> => {
    const unarmed = !e.player?.current || /fists|kick|unarmed/.test(e.player.current);
    // While the objective is not progressing, only fight what is close: walking on matters more than ranged shots.
    const lostTime = (Date.now() - lastProgress.wall) / 1000 > 30;
    const reach = lostTime ? 3 : ranged.test(e.player?.current ?? '') ? 14 : unarmed ? 1.6 : 4.5;
    // Threats to the group within 16 m count too (keep the group alive).
    const ok = (b: Body) => (ignored.get(b.id) ?? 0) < Date.now();
    const nearby = e.enemies.find(b => b.d < reach && ok(b));
    const allyThreat = e.enemies.find(b => b.d < 16 && ok(b) && e.allies.some(a => canCoverVisibleAllies(e.level,e.step,unarmed,a,e.objective) && Math.hypot(a.x - b.x, a.z - b.z) < 2.5));
    const threat = prioritizeAllyThreat(unarmed, nearby, allyThreat);
    if (!threat) { if (keysDown.has('Space')||keysDown.has('KeyJ')||keysDown.has('KeyK')) await press([]); await releaseAim(); return false; }
    // Time spent on a target without hurting it accumulates across target switches.
    const now = Date.now(), seen = shotAt.get(threat.id) ?? { hp: threat.hp, ms: 0, last: now };
    if (threat.hp < seen.hp) { seen.hp = threat.hp; seen.ms = 0; } else seen.ms += Math.min(500, now - seen.last);
    seen.last = now; shotAt.set(threat.id, seen);
    if (seen.ms > 8000) {
      // A target that takes no damage for 8 s is unreachable (behind a fence) or ignores hits: note it, walk on.
      ignored.set(threat.id, Date.now() + 20_000); log({ unhittable: threat.id, d: threat.d, state: threat.state, hp: threat.hp }); await releaseAim();
      if (!reportedUnhittable.has(threat.id)) { reportedUnhittable.add(threat.id); if (threat.d < 2.2) await issue('P2', 'enemy-unhittable', `Infected #${threat.id} (${threat.state}) ${threat.d.toFixed(1)} m away took no damage from 8 s of attacks (hp ${threat.hp}/${threat.max})`); }
      return false;
    }
    if (threat.d > reach) { // walk toward the ally's attacker
      if (Date.now() - lastClick > 700) { const s = safe(threat.screen.x, threat.screen.y, e); await clickGround(s.x, s.y); lastClick = Date.now(); }
      return true;
    }
    if (e.level === 'L6' && e.player?.weapons.includes('weapon.fire-axe') && e.enemies.filter(b => b.d < 3).length >= 3) {
      // The carried LEFT axe covers a close crowd while the courier keeps retreating. J is its shipped binding.
      await releaseAim();
      if (now - lastCrowdKick > 750) {
        await page.mouse.move(threat.screen.x, threat.screen.y); await press(['KeyJ']); await hold(180); await press([]);
        lastCrowdKick = now; log({ crowdAxe: e.tick, enemies: e.enemies.filter(b => b.d < 3).length });
      }
      return false;
    }
    if (e.level === 'L6' && e.player?.current === 'weapon.fire-axe' && e.player.weapons.includes('weapon.army-mg') && threat.d > 3) {
      // J selects the LEFT axe. Use the shipped RIGHT binding to return to the carried gun at range.
      await releaseAim(); await page.mouse.move(threat.screen.x, threat.screen.y); await press(['KeyK']); await hold(60); await press([]);
      return true;
    }
    if (ranged.test(e.player?.current ?? '')) {
      // Retain the branch's passing gun policy: one body click per target, held until it changes.
      // The unarmed chain's repeated clicks must not interrupt a firearm's target command.
      if (keysDown.has('Space')) await press([]);
      if (aimHeld !== threat.id) {
        await releaseAim();
        await page.mouse.move(threat.screen.x, threat.screen.y - 18); await page.mouse.down(); aimHeld = threat.id;
      }
      return true;
    }
    // The PO clicks the visible infected and holds. Target input aims and approaches with the carried weapon;
    // on an unarmed rack it uses the fist chain even when the selected action is the kick. Space instead keeps
    // kicking along the facing cone, which left the fists campaign repeating L5 with no damage for eight seconds.
    if (keepMovingWithFists(e.level,e.step,!!e.player?.weapons.every(id => /fists|kick/.test(id)),e.enemies.filter(b => b.d < 3).length,(e.player?.hp??1)/(e.player?.max??1),threat.d)) {
      // Punch against one or two contacts; kick through a crowd while walking toward the visible ring.
      // Waiting for a fetched survivor keeps the courier beside that visible body.
      const contacts=e.enemies.filter(b=>b.d<3).length;
      const escortId=escort?.id,escortNear=escortId===undefined||e.allies.some(b=>b.id===escortId&&b.drawn&&b.d<=4);
      const walkingAttack=fistsRetreatAttack(contacts);
      const goal=escortNear&&(e.step==='retreat'||e.step==='exit')?await goalScreen(e):null;
      const approach=goal&&e.player&&ring&&Math.hypot(ring.x-e.player.x,ring.z-e.player.z)>1.5?wasdToward(e,goal.x,goal.y):[];
      await releaseAim();
      if(approach.length) {
        const feet=await page.evaluate(at=>window.__SS__!.input.project(at,'destination'),{x:threat.x,z:threat.z});
        await page.mouse.move(feet.x,feet.y);await press([...approach,walkingAttack]);
        if(now-lastCrowdKick>750){lastCrowdKick=now;log({fistsRetreat:e.tick,keys:approach,attack:walkingAttack,enemy:threat.id});}
        return true;
      }
      // At a waiting ring, use the same punch/kick choice and leave room for E.
      if (now - lastCrowdKick > 750) {
        const feet=await page.evaluate(at=>window.__SS__!.input.project(at,'destination'),{x:threat.x,z:threat.z});
        await page.mouse.move(feet.x,feet.y); await press([walkingAttack]); await hold(400); await press([]);
        lastCrowdKick = now; log({ fistsAtRing: e.tick, attack: walkingAttack, enemies: contacts });
      }
      await press([]);return false;
    }
    if (!ranged.test(e.player?.current ?? '') && e.player && e.player.hp < e.player.max * .3 && threat.d < 2) {
      // A keyboard attack aims through the ground ray, unlike a target click on the drawn chest.
      await releaseAim(); await page.mouse.move(threat.screen.x, threat.screen.y);
      await press(['Space', ...awayKeys(e, threat)]); return true;
    }
    await press([]);
    if (aimHeld !== threat.id || seen.ms > 1000 && now - lastAimClick > 1000) {
      await releaseAim();
      await page.mouse.move(threat.aim.x, threat.aim.y); await page.mouse.down(); aimHeld = threat.id; lastAimClick = now;
    }
    return true;
  };
  const awayKeys = (e: Eyes, b: Body): string[] => {
    const dx = e.view.w / 2 - b.screen.x, dy = e.view.h / 2 - b.screen.y, out: string[] = [];
    if (Math.abs(dx) > 20) out.push(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dy) > 20) out.push(dy > 0 ? 'KeyS' : 'KeyW');
    return out;
  };
  const wasdToward = (e: Eyes, sx: number, sy: number): string[] => {
    const dx = sx - e.view.w / 2, dy = sy - e.view.h / 2, len = Math.hypot(dx, dy) || 1, out: string[] = [];
    if (dx / len > .38) out.push('KeyD'); if (dx / len < -.38) out.push('KeyA');
    if (dy / len > .38) out.push('KeyS'); if (dy / len < -.38) out.push('KeyW');
    return out;
  };
  /** Where the player would aim for: the ring if on screen, else a point toward the edge arrow. */
  const goalScreen = async (e: Eyes): Promise<{ x: number; y: number } | null> => {
    if (!e.marker || !e.marker.visible) return null;
    if (!e.marker.offscreen) {
      // The DOM diamond floats 1.8 m above the anchor; click the ring on the ground under it.
      if (ring && e.player && Math.hypot(ring.x - e.player.x, ring.z - e.player.z) < 40) return page.evaluate(r => window.__SS__!.input.project(r, 'destination'), ring);
      return { x: e.marker.x, y: e.marker.y + 40 };
    }
    const cx = e.view.w / 2, cy = e.view.h / 2;
    return { x: cx + (e.marker.x - cx) * .7, y: cy + (e.marker.y - cy) * .7 };
  };
  /** Vehicle WASD is local (W throttle, A/D steer). Heading comes from the car's own motion; which of A/D turns which way is
   * learned from what the car does (a turn that makes the error grow flips the sign). */
  const drive = async (e: Eyes, goal: { x: number; z: number }) => {
    const car = e.driving!; trail.push({ x: car.x, z: car.z, t: Date.now() }); while (trail.length > 2 && Date.now() - trail[0].t > 1200) trail.shift();
    const a = trail[0], hx = car.x - a.x, hz = car.z - a.z, moving = Math.hypot(hx, hz) > .8;
    const gx = goal.x - car.x, gz = goal.z - car.z;
    if (!moving) { await press(['KeyW']); return; }
    const err = Math.atan2(hx * gz - hz * gx, hx * gx + hz * gz);
    if (lastErr !== null && Math.abs(err) > Math.abs(lastErr) + .05 && Math.abs(err) > .3 && Date.now() - steerFlip > 1500 && steering) { steerSign = -steerSign; steerFlip = Date.now(); log({ steerSign, err: +err.toFixed(2) }); }
    lastErr = err;
    const keys = ['KeyW']; steering = Math.abs(err) > .12;
    if (steering) keys.push((err > 0) === (steerSign > 0) ? 'KeyD' : 'KeyA');
    await press(keys);
  };
  const trail: { x: number; z: number; t: number }[] = []; let steerSign = 1, steerFlip = 0, lastErr: number | null = null, steering = false;

  const watchAllies = async (e: Eyes) => {
    for (const a of e.allies) {
      const w = allyWatch.get(a.id) ?? { still: 0, hits: 0, backwards: 0, lastHp: a.hp, reported: new Set<string>() }; allyWatch.set(a.id, w);
      const hit = a.hp < w.lastHp; w.lastHp = a.hp;
      const attacker = e.enemies.some(b => Math.hypot(b.x - a.x, b.z - a.z) < 1.6);
      w.still = attacker && !a.moving && !a.attacking ? w.still + 1 : 0; w.hits = w.still ? w.hits + (hit ? 1 : 0) : 0;
      // Only when it is really being hurt: the PO saw survivors hold still while zombies chew on them.
      if (w.still > 25 && w.hits >= 2 && !w.reported.has('still')) { w.reported.add('still'); await issue('P1', 'ally-passive', `Ally ${a.kind}#${a.id} (${a.state}) stands still with an infected attacking it for ~4 s${hit ? ', losing health' : ''} (hp ${a.hp}/${a.max})`); }
      if (a.corpse && a.hp >= a.max && !w.reported.has('dead-full')) { w.reported.add('dead-full'); await issue('P2', 'ally-dead-full-health', `Ally ${a.kind}#${a.id} lies as a corpse but reports full health ${a.hp}/${a.max}`); }
      if (a.speed > .8) {
        const fx = Math.cos(a.yaw), fz = Math.sin(a.yaw), fx2 = Math.sin(a.yaw), fz2 = Math.cos(a.yaw), v = Math.hypot(a.vx, a.vz) || 1;
        // Yaw convention differs by system; count only when both conventions say backwards.
        const back = (fx * a.vx + fz * a.vz) / v < -.7 && (fx2 * a.vx + fz2 * a.vz) / v < -.7;
        w.backwards = back ? w.backwards + 1 : Math.max(0, w.backwards - 1);
        if (w.backwards > 20 && !w.reported.has('backwards')) { w.reported.add('backwards'); await issue('P1', 'ally-backwards', `Ally ${a.kind}#${a.id} (${a.state}) moves opposite to its facing for ~3 s (speed ${a.speed.toFixed(1)} m/s)`); }
      }
    }
    for (const b of e.enemies) {
      if (b.d > 10) continue;
      const w = enemyWatch.get(b.id) ?? { still: 0, reported: false }; enemyWatch.set(b.id, w);
      w.still = !b.moving && !b.attacking && (b.state === 'chase' || b.state === 'attack') && b.d > 1.8 ? w.still + 1 : 0;
      if (w.still > 30 && !w.reported) { w.reported = true; await issue('P2', 'enemy-frozen', `Infected #${b.id} in state ${b.state} ${b.d.toFixed(1)} m away has not moved for ~5 s`); }
    }
  };

  // --- main loop ---
  let lastLevel: string | null = null, levelIndex = 0, lastPhase = '', idleScreens = 0, bootWall = Date.now();
  for (;;) {
    let e: Eyes;
    try { e = await see(); } catch (error) { log({ seeError: String(error) }); await hold(500); if (Date.now() - bootWall > 600_000 && !run) break; continue; }
    if (run && shouldResumePause(e.menu,e.loading)) {
      await press([]); await releaseAim();
      await page.getByTestId('resume-game').click({ timeout: 5000 });
      log({ resumedVisiblePause: true, level: e.level, tick: e.tick });
      await hold(150); continue;
    }
    // Hitches: long frames during play only.
    const frames = await page.evaluate(n => (window as unknown as { __playtestFrames: number[][] }).__playtestFrames.slice(n), frameCursor);
    frameCursor += frames.length;
    if (e.phase === 'playing' && run) for (const [ms, tick] of frames) if (ms > 200) { log({ hitch: ms, tick, level: e.level }); if (ms > 500) await issue(ms > 2000 ? 'P1' : 'P2', 'hitch', `Frame of ${Math.round(ms)} ms at tick ${tick}`, false); }

    // The title screen loads L1 speculatively behind the menu: ignore levels outside the range until the first one starts.
    if (!run && e.level && !o.levels.includes(e.level)) { if (Date.now() - bootWall > 600_000) break; await hold(300); continue; }
    if (e.level && e.level !== lastLevel && e.phase && e.phase !== 'result') {
      if (lastLevel && run && !run.finished) { log({ handoverWithoutResult: lastLevel }); await finishLevel({ ...e, level: lastLevel }); }
      if (lastLevel && o.stopAfterLevel) {
        await press([]);
        if(e.loading||e.phase==='briefing'){
          if(!e.loading&&e.panel.button)await page.getByTestId('mission-button').click({timeout:5000}).catch(()=>undefined);
          await hold(100);continue;
        }
        if(process.env.PLAYTEST_HANDOVER_AUDIT==='1')await page.waitForFunction('window.__playtestHandoverAudit?.some(s => s.text.includes("armored vehicle") && s.pin && s.marker)',null,{timeout:2500}).catch(()=>undefined);
        log({ handover: lastLevel, to: e.level, firstPlayableTick:e.tick,objective:e.objective }); break;
      }
      lastLevel = e.level; levelIndex = o.levels.indexOf(e.level);
      if (levelIndex < 0) { log({ beyondRange: e.level }); break; }
      await startLevel(e);
    }
    if (!run) { if (Date.now() - bootWall > 600_000) { await issue('P0', 'boot', 'No level started within 10 minutes of the menu click'); break; } await hold(400); continue; }
    if (e.phase !== lastPhase) { log({ phase: e.phase, level: e.level, tick: e.tick, panel: e.panel }); lastPhase = e.phase ?? ''; idleScreens = 0; }

    if (e.phase === 'briefing' || e.phase === 'retry' || e.phase === 'progression') {
      if (e.phase === 'retry' && lastDeathTick !== e.tick) { lastDeathTick = e.tick; run.deaths++; await issue('P3', 'retry', `Mission failed screen: ${e.panel.heading}`); }
      await press([]);
      if (e.panel.button && !e.loading) { await page.getByTestId('mission-button').click({ timeout: 5000 }).catch(() => undefined); }
      idleScreens++; if (idleScreens === 300) await issue('P0', 'stuck-screen', `Stuck on the ${e.phase} screen for ~60 s (button ${e.panel.button})`);
      await hold(200); continue;
    }
    if (e.phase === 'result') {
      await press([]);
      if (!run.finished) await finishLevel(e);
      const last = levelIndex === o.levels.length - 1;
      if (last && o.levels.length > 0) { log({ done: e.level }); if (!o.stopAfterLevel) break; }
      if (e.panel.button && !e.loading) await page.getByTestId('mission-button').click({ timeout: 5000 }).catch(() => undefined);
      idleScreens++; if (idleScreens === 600) { await issue('P0', 'stuck-result', `Result screen did not hand over within ~2 min (button ${e.panel.button})`); break; }
      if (o.stopAfterLevel && idleScreens > 20 && !e.panel.button) { /* waiting for next level */ }
      await hold(200); continue;
    }
    if (e.phase !== 'playing') { await press([]); await hold(200); idleScreens++; if (idleScreens === 900) await issue('P1', 'long-cinematic', `Phase ${e.phase} lasted ~3 min`); continue; }

    // Playing.
    if (e.tick - lastShot > 45 * 60) { lastShot = e.tick; await capture(`${e.level}-t${e.tick}`); }
    if (!zoomed) {
      if (e.level === 'L6') assertRenderedBodies(await page.evaluate(() => window.__SS__!.crowdFigures().map(f => ({ drawn: f.drawn, joints: !!f.joints }))));
      // Rack check at the first playing tick (the briefing can still show the previous rack).
      run.weaponsStart = e.player?.weapons ?? [];
      const lost = (prevWeapons ?? []).filter(w => !run!.weaponsStart.includes(w) && !/fists|kick|unarmed/.test(w));
      if (lost.length) await issue('P1', 'lost-weapon', `Carried ${lost.join(', ')} at the end of the previous level, not in the rack when ${e.level} starts (rack: ${run.weaponsStart.join(', ')})`);
    }
    if (!zoomed) { // the PO's zoom: wheel over the canvas
      await page.mouse.move(e.view.w / 2, e.view.h / 2);
      for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, o.zoom >= 1 ? 120 : -120); await hold(60); }
      zoomed = true; log({ zoom: await page.evaluate(() => window.__SS__!.getState().render.camera.zoom) });
    }
    const key = `${e.step}|${e.completed}|${e.checkpoint}|${e.objective.replace(/ · [\d.]+\s?m\b/g, '').replace(/ · \d+:\d\d/g, '').replace(/\d+\/\d+ ?s\b/g, '#')}`;
    if (key !== lastProgress.key) {
      if (lastProgress.key) log({ progress: key, tick: e.tick, after: Math.round((e.tick - lastProgress.tick) / 60) });
      // Diagnostic evidence only: this snapshot never supplies a movement or combat decision.
      if (e.level === 'L6') log({ l6Observation: await page.evaluate(() => {
        const a = window.__SS__!, m = a.missions.state()!, s = m.l6!;
        const p = a.getEntity(1)!;
        return { tick: a.tick(), deaths: m.stats.deaths, player: { transform: p.transform, health: p.health }, leaderX: s.leaderX, tailX: s.tailX,
          paused: s.paused, waitFor: s.waitFor, gates: s.gates, survivors: s.survivors.map(r => ({ ...r, transform: a.getEntity(r.id)?.transform })) };
      }) });
      lastProgress = { key, tick: e.tick, wall: Date.now(), best: e.distance ?? Infinity }; assistMode = false; unstickDir = 0; navAssist = false; navUntil = 0; navEpisodes = 0; lastPos = { x: e.player?.x ?? 0, z: e.player?.z ?? 0, wall: Date.now() };
      if (e.step && !run.steps.some(s => s.id === e.step)) { ring = await markerRing(); ringKey = `${e.step}|${e.marker?.anchor}`; await hold(300); run.steps.push({ id: e.step, text: e.objective, tick: e.tick, marker: { anchor: e.marker?.anchor ?? null, ring, drawn: await drawnRing(), playerY: e.player?.y } }); }
      if (stuckLogged.size) bootWall = Date.now();
    }
    if (Date.now() - lastRingRead > 2000 && !(e.marker === null || !e.marker.visible)) { lastRingRead = Date.now(); const r = await markerRing(); if (r) ring = r; }
    if (`${e.step}|${e.marker?.anchor}` !== ringKey) { ring = await markerRing(); ringKey = `${e.step}|${e.marker?.anchor}`; log({ marker: e.marker?.anchor, ring }); }
    if (e.level === 'L6') {
      if (/help the injured survivor/.test(e.objective)) { fetchHint = await markerRing(); escort = null; }
      else if (/Bring the injured survivor/.test(e.objective) && !escort && fetchHint) {
        const hint = fetchHint;
        const seen = e.allies.filter(b => b.drawn && b.hp > 0 && !b.corpse && b.kind !== 'companion')
          .sort((a, b) => Math.hypot(a.x - hint.x, a.z - hint.z) - Math.hypot(b.x - hint.x, b.z - hint.z))[0];
        if (seen && Math.hypot(seen.x - hint.x, seen.z - hint.z) < 6) {
          escort = { id: seen.id, x: seen.x, z: seen.z }; log({ escortSeen: escort, tick: e.tick });
        }
      } else if (e.step !== 'retreat' || /^(Cover the retreat|The group waits: cover the rear)/.test(e.objective)) escort = null;
      const seen = escort && e.allies.find(b => b.id === escort!.id && b.drawn && b.hp > 0 && !b.corpse);
      if (seen && escort) { escort.x = seen.x; escort.z = seen.z; }
    }
    const observed=visibleProgress.update({context:`${e.level}|${e.step}|${e.checkpoint}|${run.deaths}`,text:e.objective,distance:e.distance,player:e.player,marker:ring,tick:e.tick,nowMs:Date.now()});
    if(observed.reason) {
      lastProgress.tick=e.tick;lastProgress.wall=Date.now();lastProgress.best=e.distance??Infinity;
      log({visibleProgress:{tick:e.tick,text:e.objective,distance:e.distance,player:e.player?{x:e.player.x,z:e.player.z}:null,marker:ring,reason:observed.reason}});
    }
    if(Date.now()-lastObservation>=1000) {
      lastObservation=Date.now();log({observation:{tick:e.tick,step:e.step,checkpoint:e.checkpoint,menu:e.menu,text:e.objective,player:e.player?{x:e.player.x,z:e.player.z,hp:e.player.hp}:null,marker:ring,noProgressSeconds:observed.seconds}});
    }
    if (e.distance !== null && e.distance < lastProgress.best - 2) { lastProgress.best = e.distance; lastProgress.wall = Date.now(); }
    const stuckSim = (e.tick - lastProgress.tick) / 60, stuckWall = (Date.now() - lastProgress.wall) / 1000;
    run.maxNoProgressSeconds=Math.max(run.maxNoProgressSeconds,observed.seconds);
    if (e.player && e.player.hp < lastHp && e.player.hp <= 0) run.deaths++;
    lastHp = e.player?.hp ?? 0;
    await watchAllies(e);

    if(o.noSkip&&observed.seconds>=30) {
      await issue('P0','cannot-finish',`No visible progress for ${observed.seconds.toFixed(1)} s; stopping without advancing the objective`);
      log({abortedNoSkip:true,level:e.level,tick:e.tick,step:e.step});break;
    }
    // Stuck ladder: 20 s confusion (issue), 60 s try E, 120 s state assist, levelMinutes cap → skip step.
    // The HUD distance can point at a moving guidance waypoint (L3 l3-route); the ring itself decides "at the ring".
    const ringDist = ring && e.player ? Math.hypot(ring.x - e.player.x, ring.z - e.player.z) : e.distance;
    const atRing = ringDist !== null && ringDist < 4;
    if (stuckSim > 20 && stuckWall > 20) {
      const tag = `${key}|${atRing ? 'ring' : 'nav'}`;
      if (!stuckLogged.has(tag)) { stuckLogged.add(tag); await issue('P2', atRing ? 'stuck-at-ring' : 'stuck-navigating', `${Math.round(stuckSim)} s without objective progress ${atRing ? `standing at the ring (${e.distance?.toFixed(1)} m)` : `(distance ${e.distance?.toFixed(1) ?? 'none'} m, no marker: ${!e.marker?.visible})`}; HUD: "${e.tracker}"`); }
    }
    if (Date.now() > levelDeadline() || stuckSim > 420) {
      await issue('P0', 'cannot-finish', `Driver could not finish step ${e.step} ("${e.objective}") after ${Math.round(stuckSim)} s on it (${o.levelMinutes} min level cap: ${Date.now() > levelDeadline()}); ${o.noSkip?'stopping without advancing the objective':'skipping it with the debug objective cheat'}`);
      if(o.noSkip) { log({ abortedNoSkip:true, level:e.level, tick:e.tick, step:e.step }); break; }
      run.skipped.push(e.step ?? '?'); assist('skip-step', { step: e.step });
      await page.evaluate(id => window.__SS__!.cheats.completeObjective(id ?? undefined), e.step);
      wallStart = Math.max(wallStart, Date.now() - (o.levelMinutes - 4) * 60_000);
      lastProgress.tick = e.tick; lastProgress.wall = Date.now();
      await hold(500); continue;
    }

    if (await fight(e)) { await hold(120); continue; }
    if (e.driving) { if (ring) await drive(e, ring); else await press([]); await hold(120); continue; }

    // Escort the person we just fetched, rather than running to the bring ring and leaving them out of view.
    // Only drawn allies update this remembered position; losing sight sends us back to where we last saw them.
    if (escort && e.player) {
      const seen = e.allies.find(b => b.id === escort!.id && b.drawn && b.hp > 0 && !b.corpse);
      if (!seen || seen.d > 4) {
        await press([]);
        if (Date.now() - lastClick > 700) {
          const s = await page.evaluate(at => window.__SS__!.input.project(at, 'destination'), { x: escort.x, z: escort.z });
          const sp = safe(s.x, s.y, e); await clickGround(sp.x, sp.y); lastClick = Date.now();
          log({ escortWait: escort.id, at: { x: escort.x, z: escort.z }, tick: e.tick });
        }
        await hold(150); continue;
      }
    }

    if (stuckSim > 120 && stuckWall > 60 && !assistMode) {
      assistMode = true; run.assists++;
      const truth = await page.evaluate(() => { const a = window.__SS__!, m = a.missions.state()!; return { marker: m.marker, states: m.states, counters: m.counters, checkpoint: m.checkpoint }; });
      assist('state-locate', { why: `stuck ${Math.round(stuckSim)} s`, truth });
      await issue('P1', 'hidden-condition', `Stuck ${Math.round(stuckSim)} s on "${e.objective}"; read mission state to locate the blocker: ${JSON.stringify(truth).slice(0, 400)}`);
    }
    const g = await goalScreen(e);
    if (stuckSim > 60 && (atRing || !g) && Date.now() - lastE > 4000) { lastE = Date.now(); await press([]); await page.keyboard.down('KeyE'); await hold(1600); await page.keyboard.up('KeyE'); continue; }
    // Prompts near the objective (or naming it) get E; side prompts (push a dumpster) are ignored like a player would.
    const relevant = e.prompt && !/^push\b/i.test(e.prompt) && (atRing || (e.distance !== null && e.distance < 6) || /pick|take|grab|open|bar|unbar|play|pack|install|release|board|enter|recover/i.test(e.prompt));
    if (relevant && Date.now() - lastE > 2500) { lastE = Date.now(); log({ prompt: e.prompt, tick: e.tick }); await press([]); await page.keyboard.down('KeyE'); await hold(1400); await page.keyboard.up('KeyE'); continue; }
    if (!g && !e.marker?.visible) {
      // No ring/arrow: follow what the minimap shows (L5 "Search <place>" cue pin, or the active step's pin).
      const pin = await page.evaluate(() => {
        const lab = window.__SCENE__ as unknown as { game?: { world: { entities: Map<number, { transform: { x: number; z: number } }>; missions?: { def: { anchors: Record<string, { x: number; z: number; y?: number }>; steps: { id: string; anchor: string; waypoint?: boolean }[] }; state: { steps: Record<string, { status: string }>; l5?: { phase: string; survivors: { key: string; status: string }[] } } } } } } | undefined;
        const m = lab?.game?.world.missions, p = lab?.game?.world.entities.get(1)?.transform; if (!m || !p) return null;
        const cue = document.querySelector<HTMLElement>('[data-survivor]:not([hidden])');
        if (m.state.l5 && cue) { const a = m.def.anchors[`l5-ring-${cue.dataset.survivor}`]; return a ? { x: a.x, y: a.y ?? 0, z: a.z, from: `minimap cue ${cue.getAttribute('aria-label')}` } : null; }
        const step = m.def.steps.find(s => m.state.steps[s.id]?.status === 'active' && s.waypoint !== false);
        const pinEl = step && document.querySelector<HTMLElement>(`[data-testid="mission-pin-${step.id}"]:not([hidden])`);
        if (step && pinEl) { const a = m.def.anchors[step.anchor]; return a ? { x: a.x, y: a.y ?? 0, z: a.z, from: `minimap pin ${step.id}` } : null; }
        return null;
      });
      if (pin) {
        const changed = !ring || Math.hypot(ring.x - pin.x, ring.z - pin.z) > .5;
        ring = { x: pin.x, y: pin.y, z: pin.z };
        // A new pin: re-evaluate distances against it on the next pass.
        if (changed) { log({ pinGoal: pin, tick: e.tick }); await press([]); continue; }
        const r = await page.evaluate(q => window.__SS__!.input.project(q, 'destination'), ring);
        const near = e.player && Math.hypot(ring.x - e.player.x, ring.z - e.player.z) < 25;
        if (near && Date.now() - lastClick > 900) { const sp = safe(r.x, r.y, e); await clickGround(sp.x, sp.y); lastClick = Date.now(); await hold(150); continue; }
        if (near) { await hold(150); continue; }
        // far: fall through to the nav-follow block below with this goal
      } else { await press([]); await hold(200); continue; }
    }
    const arrived = atRing && ringDist! < 1.2;
    // Clicks are not getting closer: the player is lost. Locate via the game's nav grid toward the ring and walk it with WASD (logged).
    const moved = e.player ? Math.hypot(e.player.x - lastPos.x, e.player.z - lastPos.z) : 0;
    if (moved > 2.5 && e.player) { lastPos = { x: e.player.x, z: e.player.z, wall: Date.now() }; }
    // Once lost, keep walking the located route for at least 20 s (clicks led back into the same trap otherwise).
    // Far rings: walk the street route (the nav grid stands in for the player's map sense); clicks take over within 25 m.
    const far = ringDist !== null && ringDist > 25;
    const stalled = far || (Date.now() - lastPos.wall) / 1000 > 10 || stuckWall > 30 || Date.now() < navUntil;
    if (stalled && !atRing && ring && e.player) {
      if (!navAssist) { navAssist = true; if (!far) navEpisodes++; navUntil = navEpisodes >= 2 ? Infinity : Date.now() + 20_000; if (!far) run.assists++; assist(far ? 'nav-follow' : 'nav-locate', { from: { x: e.player.x, z: e.player.z }, ring, distance: e.distance }); }
      const step = await page.evaluate(({ goal }) => {
        const lab = window.__SCENE__ as unknown as { game?: { world: { entities: Map<number, { transform: { x: number; z: number } }>; infected?: { nav: { steer(p: object, g: object, r: object, rad: number, out: { x: number; z: number }, budget: number, nearest: boolean): boolean } } } } } | undefined;
        const w = lab?.game?.world, p = w?.entities.get(1)?.transform; if (!w?.infected || !p) return null;
        const out = { x: 0, z: 0 }, route = { path: [] as number[], goal: -1, pathIndex: 0 };
        if (!w.infected.nav.steer(p, goal, route, .45, out, Infinity, true)) return null;
        const a = window.__SS__!, from = a.input.project(p, 'player'), d = Math.hypot(out.x - p.x, out.z - p.z) || 1;
        const to = a.input.project({ x: p.x + (out.x - p.x) / d * 3, z: p.z + (out.z - p.z) / d * 3 }, 'player');
        return { dx: to.x - from.x, dy: to.y - from.y };
      }, { goal: ring });
      if (Date.now() - navLog > 3000) { navLog = Date.now(); log({ nav: step, keys: step ? wasdToward(e, e.view.w / 2 + step.dx, e.view.h / 2 + step.dy) : null, at: { x: +e.player.x.toFixed(1), z: +e.player.z.toFixed(1) }, tick: e.tick }); }
      // The route can run through something solid (a parked car): when the keys do not move us for 3 s, side-step around it.
      if (Math.hypot(e.player.x - navPos.x, e.player.z - navPos.z) > .6) navPos = { x: e.player.x, z: e.player.z, wall: Date.now() };
      if (step && Date.now() - navPos.wall > 3000) {
        const sides = [['KeyW'], ['KeyD'], ['KeyS'], ['KeyA'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA'], ['KeyW', 'KeyA'], ['KeyS', 'KeyD']];
        sideStep = (sideStep + 1) % sides.length; log({ navBlocked: { x: +e.player.x.toFixed(1), z: +e.player.z.toFixed(1) }, try: sides[sideStep], tick: e.tick });
        await press(sides[sideStep]); await hold(1200); await press(wasdToward(e, e.view.w / 2 + step.dx, e.view.h / 2 + step.dy)); await hold(800);
        navPos.wall = Date.now() - 1500; continue;
      }
      if (step) { await press(wasdToward(e, e.view.w / 2 + step.dx, e.view.h / 2 + step.dy)); await hold(350); continue; }
      unstickDir = (unstickDir + 1) % 4; await press([['KeyA'], ['KeyD'], ['KeyW'], ['KeyS']][unstickDir]); await hold(700); await press([]); continue;
    }
    // Close to the ring but not in it (a click on the ring can pick a body lying there): step in with WASD like a player would.
    if (atRing && ring && e.player && Math.hypot(ring.x - e.player.x, ring.z - e.player.z) > .35 && (Date.now() - lastProgress.wall) / 1000 > 4) {
      const r = await page.evaluate(({ ring, p }) => { const a = window.__SS__!; return [a.input.project(ring, 'player'), a.input.project(p, 'player')]; }, { ring, p: { x: e.player.x, z: e.player.z } });
      await press(wasdToward(e, e.view.w / 2 + r[0].x - r[1].x, e.view.h / 2 + r[0].y - r[1].y)); await hold(200); await press([]);
      if (Date.now() - navLog > 3000) { navLog = Date.now(); log({ ringStep: { x: +e.player.x.toFixed(2), z: +e.player.z.toFixed(2) }, ring, tick: e.tick }); }
      continue;
    }
    if (navAssist && !stalled) { navAssist = false; await press([]); log({ navAssistEnd: e.tick }); }
    if (!g) { await hold(150); continue; }
    if (!arrived && Date.now() - lastClick > 900) {
      await press([]);
      const s = safe(g.x, g.y, e); await clickGround(s.x, s.y); lastClick = Date.now();
    } else if (arrived) await press([]);
    await hold(150);
  }
  await press([]).catch(() => undefined);
  writeFileSync(join(o.out, `runs-${o.tag}.json`), JSON.stringify(runs, null, 2));
  writeFileSync(join(o.out, `issues-${o.tag}.json`), JSON.stringify(issues, null, 2));
  let handoverReady=true;
  if(process.env.PLAYTEST_HANDOVER_AUDIT==='1') {
    const audit=await page.evaluate('window.__playtestHandoverAudit') as {elapsedMs:number;text:string;pin:boolean;marker:boolean}[];
    writeFileSync(join(o.out,`handover-audit-${o.tag}.json`),JSON.stringify(audit,null,2));
    const ready=audit.find(s=>s.text.includes('armored vehicle')&&s.pin&&s.marker);
    handoverReady=!!ready&&ready.elapsedMs<=2000;
  }
  await context.close();
  assert.ok(handoverReady,'L8 objective, destination pin and minimap marker must appear within 2 s of control returning');
  return { runs, issues };
}

// CLI: tsx tools/playtest/session.ts '<json SessionOptions>'
if (process.argv[1]?.endsWith('session.ts')) {
  const options = JSON.parse(process.argv[2]) as SessionOptions;
  runSession(options).then(r => { console.log(JSON.stringify({ runs: r.runs.map(x => ({ level: x.level, finished: x.finished, skipped: x.skipped, wall: x.wallSeconds })), issues: r.issues.length })); process.exit(0); },
    error => { console.error(error); process.exit(1); });
}
