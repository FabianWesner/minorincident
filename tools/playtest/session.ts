import { installThreatObserver, installL3L4ThreatObserver } from './threat-observer';
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { launchProfile } from '../browser-pool/client';
import { EscortClearance, look, visibleGroupTarget, type Body, type Eyes } from './eyes';
import { assertRenderedBodies, campaignEndingComplete, campaignEndingWaiting, isMandatoryBossObjective, needsZoomInput, observeWithin, shouldResumePause } from './startup';
import { rangedWeaponPattern as ranged, campaignCombatWeapon, campaignThreat, canCoverVisibleAllies, finaleDodgeGoal, fistsRetreatAttack, keepMovingWithFists, prioritizeAllyThreat, rocketAimPoint } from './combat';
import { weaponKey } from '../../src/data/weaponKeys';
import { PlaytestProgress } from './progress';
import { dodgeWalkKeys, markerWalkKeys } from './input';
import { frameInterval, installFrameProbe, type LongFrame } from './frames';
import { VehicleRecovery } from './driving';
import type { Game } from '../../src/Game';
import { l2Routes } from '../../src/debug/bot/LevelTwoBot';
import { installFinalAudit } from './final-audit';
import { installSoftlockAudit } from './softlock-audit';
import { installL6HoldObserver } from './l6-hold-observer';
import { crossing } from '../../src/levels/L9/district';
import { l9Groups } from '../../src/data/l9';
import { l5Survivors } from '../../src/data/l5';
import { installAcceptanceLedger } from './acceptance-ledger';
import { observeAttackStarts } from '../qa/threat/attackStarts';

/**
 * One browser session of the playtest driver (run under tools/e2e-lock.sh by play.ts).
 * Plays levels by real device input only: physical WASD movement, mouse aim + LMB / Space to attack, E to interact, real clicks on the menu
 * and mission buttons. Camera zoom is explicit QA configuration. It follows the HUD objective text, the ring and the screen-edge arrow.
 * Game state is used (a) to read what the HUD shows anyway and (b) to locate itself when lost; every (b)
 * is logged as an "assist" entry and named in the report.
 */
export interface SessionOptions {
  origin: string; out: string; levels: string[]; quality: 'low' | 'high'; zoom: number; weapon?: string; heroine: 'female' | 'male';
  /** new: title → Start game → heroine → L1. continue: title → Start game → resume level (menu Continue). debug: level list with ?debug=1. */
  entry: 'new' | 'continue' | 'debug'; profile: string; levelMinutes: number; stopAfterLevel: boolean; tag: string; noSkip?: boolean;
  /** Bounded diagnostic sample; finish without skipping an objective when time expires. */
  sampleSeconds?: number;
  /** At a bounded L10 batch boundary, use paused Settings to save the live production Resume snapshot. */
  saveOnYield?: boolean;
  /** Authored road selected by a logged map assist; all driving stays WASD. */
  l9Route?: 'road' | 'countryside' | 'dry-shortcut';
  l9Waypoints?: [number, number][];
}
export interface Issue { level: string; tick: number; x: number; z: number; severity: 'P0' | 'P1' | 'P2' | 'P3'; kind: string; text: string; captures: string[]; step: string | null; objective: string }
export interface LevelRun { level: string; entry: string; heroine: string; finished: boolean; skipped: string[]; wallSeconds: number; simSeconds: number; maxNoProgressSeconds: number; deaths: number; assists: number; attacks: Record<string, number>; weaponsStart: string[]; weaponsEnd: string[]; steps: { id: string; text: string; tick: number; marker: unknown }[] }

const hold = (ms: number) => new Promise(r => setTimeout(r, ms));
// Explore the public street grid until a sign-of-life ping supplies a discovery
// destination. These are street intersections, independent of hiding places.
const l5SearchStreets = [-40, 0, 46].flatMap(z => [-60, -30, 0, 30, 60].map(x => ({ key: `explore:${x}:${z}`, ringAt: [x, z], place: 'street exploration' })));

export async function runSession(o: SessionOptions): Promise<{ runs: LevelRun[]; issues: Issue[]; yielded: boolean }> {
  if (o.saveOnYield && (o.levels.length !== 1 || o.levels[0] !== 'L10' || !o.sampleSeconds)) throw new Error('Resume batches require one bounded L10 route');
  let yielded = false;
  const visibleOnly = process.env.PLAYTEST_VISIBLE_ONLY === '1';
  const l5Order = process.env.PLAYTEST_L5_ORDER?.split(',');
  if (l5Order && (new Set(l5Order).size !== 5 || l5Order.some(key => !l5Survivors.some(s => s.key === key)))) throw new Error('PLAYTEST_L5_ORDER requires all five survivor keys once');
  const plannedL5Search = (process.env.PLAYTEST_L5_TOUR === '1' || !!l5Order) && !visibleOnly;
  mkdirSync(o.out, { recursive: true }); mkdirSync(join(o.out, 'captures'), { recursive: true });
  const logFile = join(o.out, `log-${o.tag}.jsonl`);
  const log = (entry: object) => appendFileSync(logFile, JSON.stringify({ t: new Date().toISOString(), ...entry }) + '\n');
  const cueAudio = process.env.PLAYTEST_AUDIO_CUES === '1';
  const args = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  if (cueAudio) args.push('--mute-audio'); // Keep real cue scheduling while silencing the host's speakers.
  const webgpu = process.env.PLAYTEST_BACKEND === 'webgpu';
  if (webgpu) args.push('--enable-unsafe-webgpu');
  const context = await launchProfile(resolve(o.profile), { headless: true, args, viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = context.pages()[0] ?? await context.newPage();
  let pageClosed = false;
  let pageCrashed = false;
  page.on('close', () => { pageClosed = true; });
  page.on('crash', () => { pageCrashed = true; });
  try {
  // tsx keeps function names with a __name helper; page-side functions need it defined.
  const noFrameTiming = process.env.PLAYTEST_NO_FRAME_TIMING === '1';
  if (noFrameTiming && (process.env.PLAYTEST_FRAME_GATE === '1' || process.env.PLAYTEST_CPU_PROFILE === '1')) throw new Error('PLAYTEST_NO_FRAME_TIMING conflicts with frame/CPU profiling');
  await page.addInitScript(noFrameTiming ? 'window.__name = f => f; window.__playtestFrames = [];' : `window.__name = f => f; (${installFrameProbe.toString()})(${frameInterval.toString()});`);
  if (process.env.PLAYTEST_ACCEPTANCE_LEDGER === '1') await page.addInitScript(`window.__name = f => f; (${installAcceptanceLedger.toString()})(${observeAttackStarts.toString()}, ${process.env.PLAYTEST_L4_CORPSE_CAPTURES === '1'});`);
  if (process.env.PLAYTEST_L6_HOLD_AUDIT === '1') await page.addInitScript(`(${installL6HoldObserver.toString()})();`);
  if (process.env.PLAYTEST_THREAT_AUDIT === '1') {
    await page.addInitScript(`(${installThreatObserver.toString()})(${!noFrameTiming});`);
    await page.addInitScript(`(${installL3L4ThreatObserver.toString()})(${!noFrameTiming});`);
  }
  if (process.env.PLAYTEST_SOFTLOCK_AUDIT === '1') await page.addInitScript(`window.__name = f => f; (${installSoftlockAudit.toString()})();`);
  if (visibleOnly) await page.addInitScript(`(${installFinalAudit.toString()})();`);
  if(process.env.PLAYTEST_HANDOVER_AUDIT==='1') await page.addInitScript(`window.__playtestHandoverAudit = []; (() => {
    let sawL7=false,start=null,done=false;
    const visible=e=>!!e&&!e.hidden&&e.offsetParent!==null,q=id=>document.querySelector('[data-testid="'+id+'"]');
    const frame=now=>{const g=window.__SCENE__?.game;
      if(g?.world.scenario==='L7'&&g.world.missions?.state.phase==='playing') sawL7=true;
      if(sawL7&&!done&&g?.world.scenario==='L8'&&!g.loading&&!g.clock.paused&&g.world.missions?.state.phase==='playing'){
        start??=now;const text=q('objective-text')?.textContent??'',pin=visible(q('minimap-objective')),marker=visible(q('mission-marker'));
        const breached=!!g.world.missions.state.states.breached;
        const sample={elapsedMs:now-start,tick:g.world.tick,text,pin,marker,breached};
        const previous=window.__playtestHandoverAudit.at(-1);
        if(!previous||now-start-previous.elapsedMs>=500||breached){window.__playtestHandoverAudit.push(sample);if(breached)done=true;}
      } requestAnimationFrame(frame);};requestAnimationFrame(frame);
  })();`);
  const issues: Issue[] = [], runs: LevelRun[] = [], consoleSeen = new Set<string>();
  let eyes: Eyes | null = null;
  const metroShots = new Set<string>();
  const capture = async (name: string): Promise<string> => {
    const file = `captures/${o.tag}-${name.replace(/[^a-z0-9-]+/gi, '-')}.jpg`;
    let resume = false;
    try {
      if (process.env.PLAYTEST_THREAT_AUDIT === '1') resume = await page.evaluate(() => {
        // Exclude only the RAF interval spanning an intentional screenshot pause.
        const audit = (window as unknown as { __threatPlaytestAudit?: { captureEpoch: number } }).__threatPlaytestAudit;
        if (audit) audit.captureEpoch++;
        const g = (window.__SCENE__ as unknown as { game?: Game })?.game;
        if (!g || g.clock.paused || g.world.missions?.state.phase !== 'playing') return false;
        window.__SS__!.pause(); return true;
      });
      await page.screenshot({ path: join(o.out, file), type: 'jpeg', quality: 72 });
      // Reveal diagnostics beside each capture (courier, camera, see-through cut placements, foreground state).
      if (process.env.PLAYTEST_REVEAL_AUDIT === '1') writeFileSync(join(o.out, file.replace(/\.jpg$/, '.json')), JSON.stringify(await page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game as unknown as { world: Game['world']; clock: { paused: boolean }; view: { districts?: { seeThroughAudit(): unknown }; view: { getState(): unknown }; marker?: import('three/webgpu').Group; courierForeground?: boolean } };
        const p = g.world.entities.get(1)!.transform, a = window.__SS__!;
        const render = a.getState().render as { backend: string; quality: string; healthBars?: unknown };
        const figures = new Map(a.crowdFigures().map(f => [f.id, f]));
        const bodies = [...g.world.entities.iterate()].filter(e => e.health.current <= 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) <= 12).slice(0, 30).map(e => ({
          id: e.id, archetype: e.archetype, at: { ...e.transform }, corpse: !!e.corpse, state: e.infected?.state,
          lod: figures.get(e.id)?.lod, clip: figures.get(e.id)?.clip, drawn: figures.get(e.id)?.drawn }));
        const followers = (g.world.l7Encounters?.state.roster ?? []).filter(r => r.status === 'following').map(r => {
          const e = g.world.entities.get(r.id)!, figure = figures.get(r.id);
          return { id: e.id, hp: e.health.current, at: { ...e.transform }, state: e.civilian?.state, knockedUntil: e.civilian?.knockedUntil, clip: figure?.clip, lod: figure?.lod, drawn: figure?.drawn, joints: figure?.joints };
        });
        const cue = document.querySelector<HTMLElement>('[data-testid=survivor-world-cue]'), box = cue?.getBoundingClientRect();
        const alarmCue = cue ? { text: cue.innerText, hidden: cue.hidden, alarm: cue.dataset.alarm, opacity: getComputedStyle(cue).opacity, box: box && { x: box.x, y: box.y, width: box.width, height: box.height } } : null;
        const marker = g.view.marker, mission = g.world.missions;
        const hud = (id: string) => {
          const e = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
          return e ? { text: e.textContent, visible: !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden', style: e.getAttribute('style') } : null;
        };
        const objective = { markerId: mission?.state.marker, authoredAnchors: mission?.def.anchors,
          activeSteps: mission?.def.steps.filter(s => mission.state.steps[s.id].status === 'active').map(s => ({ id: s.id, anchor: s.anchor, started: mission.state.steps[s.id].started })),
          marker: marker && { visible: marker.visible, position: marker.getWorldPosition(marker.position.clone()).toArray(), children: marker.children.map(c => ({ visible: c.visible, position: c.getWorldPosition(c.position.clone()).toArray() })) },
          tracker: hud('mission-tracker'), pin: hud('mission-marker'), minimap: hud('minimap-objective'), route: hud('minimap-route') };
        const companions = [...g.world.entities.iterate()].filter(e => !!e.companion).map(e => ({ id: e.id, archetype: e.archetype, health: { ...e.health }, hidden: !!e.hidden, passengerOf: e.passengerOf, state: e.companion?.state, transform: { ...e.transform } }));
        const vehicles = [...(g.world.vehicles?.cars.values() ?? [])].filter(c => c.entity.id === g.world.vehicles?.active || c.entity.vehicle?.driver != null || (c.entity.vehicle?.attached.length ?? 0) > 0 || (c.entity.vehicle?.passengers?.length ?? 0) > 0).map(c => ({ id: c.entity.id, archetype: c.entity.archetype, transform: { ...c.entity.transform }, vehicle: c.entity.vehicle }));
        return { tick: g.world.tick, objective, companions, vehicles, alarmCue, paused: g.clock.paused, backend: render.backend, quality: render.quality, healthBars: render.healthBars, bodies, followers, player: { x: p.x, y: p.y, z: p.z }, camera: g.view.view.getState(), audit: g.view.districts?.seeThroughAudit(), courierForeground: g.view.courierForeground };
      }), null, 1));
    } catch { /* page busy */ }
    finally { if (resume) await page.evaluate(() => window.__SS__!.resume()).catch(() => undefined); }
    return file;
  };
  const photoPresentation = () => page.evaluate(() => {
    const a = window.__SS__!, render = a.getState().render as { camera: { zoom: number; targetZoom: number }; quality: string; healthBars?: unknown };
    const world = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game.world;
    const followedActors = [...world.entities.iterate()].filter(e => e.id !== 1 && !e.companion && !e.hidden && !e.infection && !e.infected && !e.corpse && e.health.current > 0 &&
      (e.civilian?.survivor?.mode === 'follow' || e.civilian?.ally?.follow?.targetId === 1 || e.escort?.state === 'follow')).map(e => ({ id: e.id, hp: e.health.current, maxHp: e.health.max }));
    const courier = world.entities.get(1)?.survivor;
    return { captureTick: world.tick, actualZoom: render.camera.zoom, targetZoom: render.camera.targetZoom, actualQuality: render.quality, survivor: courier && { variant: courier.variant, gearTier: courier.gearTier }, healthBars: render.healthBars, followedActors };
  });
  const issue = async (severity: Issue['severity'], kind: string, text: string, shot = true, frame?: LongFrame): Promise<Issue> => {
    const e = eyes, item: Issue = { level: frame?.level ?? e?.level ?? '?', tick: frame?.tick ?? e?.tick ?? -1, x: +(frame?.x ?? e?.player?.x ?? 0).toFixed(1), z: +(frame?.z ?? e?.player?.z ?? 0).toFixed(1), severity, kind, text, captures: [], step: frame ? null : e?.step ?? null, objective: frame ? '' : e?.objective ?? '' };
    if (shot) item.captures.push(await capture(`${item.level}-${item.tick}-${kind}`));
    issues.push(item); log({ issue: item }); console.log(`[${severity}] ${item.level} t${item.tick} (${item.x},${item.z}) ${kind}: ${text}`);
    writeFileSync(join(o.out, `issues-${o.tag}.json`), JSON.stringify(issues, null, 2));
    return item;
  };
  page.on('console', m => { if (m.type() === 'error' && !consoleSeen.has(m.text())) { consoleSeen.add(m.text()); void issue('P2', 'console-error', m.text().slice(0, 300), false); } });
  page.on('pageerror', e => { if (!consoleSeen.has(e.message)) { consoleSeen.add(e.message); void issue('P1', 'page-error', e.message.slice(0, 300), false); } });

  const threatCaptured = new Set<string>();
  const acceptanceCaptured = new Set<string>();
  const corpseCaptured = new Set<string>();
  const acceptanceStarts = new Map<string, number>();
  const handoversCaptured = new Set<string>();
  let acceptanceTick = -Infinity;
  let l6FightCaptured = false, l6RetreatFightCaptured = false;
  const l6ShieldPhotos = new Set<number>();
  const l7DeparturePhotos = new Set<number>();
  let l6GatePhoto = false;
  let l5GuardStarted = false, l5GuardDone = false, l5MetroPhoto = false;
  let l6DeathExercise = process.env.PLAYTEST_L6_DIE_ONCE === '1';
  let l10DeathExercise = process.env.PLAYTEST_L10_DIE_ONCE === '1', l10Mortal = false;
  let l10ConsoleWalk = process.env.PLAYTEST_L10_CONSOLE_WALK === '1' ? 0 : -1;
  let l10PullAway = process.env.PLAYTEST_L10_PULL_AWAY === '1';
  const escortAlarms = new Set<string>();
  const l6GroupMemory: { rear: { x: number; z: number; tick: number } | null } = { rear: null };
  const see = async () => {
    eyes = await observeWithin(page.evaluate(look));
    if (eyes.level === 'L7' && process.env.PLAYTEST_L7_DEPARTURE_CAPTURES === '1') {
      const shot = await page.evaluate(() => {
        const w = (window.__SCENE__ as unknown as { game: Game }).game.world, d = w.l7Departure?.state;
        return d?.phase === 'departing' ? { tick: w.tick, seconds: (w.tick - d.startedAt) / 60, bus: { ...w.entities.get(d.busId)!.transform }, boarded: [...d.boarded] } : null;
      });
      if (shot) for (const seconds of [.5, 3, 8]) if (shot.seconds >= seconds && !l7DeparturePhotos.has(seconds)) {
        l7DeparturePhotos.add(seconds);
        const file = await capture(`L7-departure-${seconds}`);
        log({ l7DeparturePhoto: { file, requestedSeconds: seconds, ...shot, ...await photoPresentation() } });
      }
    }
    if (process.env.PLAYTEST_L6_SHIELD_CAPTURES === '1' && eyes.level === 'L6' && eyes.phase === 'playing' && eyes.player && eyes.player.x > 50 && eyes.player.x < 115 && l6ShieldPhotos.size < 2) {
      const hit = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.hit' && e.sourceId === 1 && e.shieldBreak).at(-1));
      if (hit && eyes.tick - hit.tick < 60 && !l6ShieldPhotos.has(hit.tick)) {
        l6ShieldPhotos.add(hit.tick); await capture(`L6-shield-break-t${hit.tick}`);
      }
    }
    if (process.env.PLAYTEST_L6_SHIELD_CAPTURES === '1' && eyes.level === 'L6' && !l6GatePhoto && eyes.player && eyes.player.x > 85 && eyes.player.x < 110) {
      const prompt = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('[data-testid=interaction-prompt]');
        return panel && !panel.hidden && panel.innerText.includes('E or click') ? panel.innerText : null;
      });
      if (prompt) { l6GatePhoto = true; log({ l6GatePrompt: { tick: eyes.tick, text: prompt } }); await capture(`L6-gate90-prompt-t${eyes.tick}`); }
    }
    if (process.env.PLAYTEST_COMPANION_TRACE === '1' && eyes.phase === 'playing' && !eyes.loading) {
      const alarm = await page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        const a = g.world.missions?.state.l5?.alarm ?? g.world.missions?.state.l6?.alarm;
        const cue = document.querySelector<HTMLElement>('[data-testid=survivor-world-cue]');
        return a && g.world.tick < a.until ? { ...a, tick: g.world.tick, painted: !!cue && !cue.hidden && cue.dataset.alarm === 'true' && cue.innerText.includes(a.text) && Number(getComputedStyle(cue).opacity) >= .85 } : null;
      });
      if (alarm?.painted && !escortAlarms.has(alarm.key)) { escortAlarms.add(alarm.key); await capture(`escort-alarm-${alarm.kind}-${alarm.tick}`); }
    }
    if (process.env.PLAYTEST_L5_TRUCK_PHOTO === '1' && !l5MetroPhoto && eyes.level === 'L5' && eyes.step === 'metro' && eyes.phase === 'playing' && !eyes.loading) {
      l5MetroPhoto = true; await press([]); await releaseAim();
      try {
        // Photo framing only, at the physically reached final rescue; clock stays live.
        await page.evaluate(async () => { window.__SS__!.camera.zoom(.5); await window.__SS__!.screenshotReady(); });
        await capture('L5-metro-unpaused-z0.5');
      } finally { await page.evaluate(z => window.__SS__!.camera.zoom(z), o.zoom); }
      eyes = await observeWithin(page.evaluate(look));
    }
    if (process.env.PLAYTEST_L1_HANDOVERS === '1' && eyes.level === 'L1' && eyes.phase === 'playing' && !eyes.loading) {
      const beat = await page.evaluate(() => {
        const beat = window.__SS__!.missions.state()?.l1?.beat;
        return beat && ['pickup', 'handover'].includes(beat.id) ? { id: beat.id, actor: beat.actor } : null;
      });
      if (beat && !handoversCaptured.has(beat.id)) {
        handoversCaptured.add(beat.id); await press([]); await releaseAim();
        let previous = '', lastPhoto = -Infinity, completed = 0;
        for (let sample = 0; sample < 50; sample++) {
          const state = await page.evaluate(({ id, actor }) => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game, world = game.world;
            const l1 = world.missions!.state.l1!, entity = world.entities.get(actor);
            return { tick: world.tick, beat: id, actor, carrying: l1.carrying, delivered: l1.delivered,
              activeBeat: l1.beat?.id ?? null, done: id === 'pickup' ? !l1.clerkId : l1.delivered,
              entity: entity ? { hidden: entity.hidden, at: { ...entity.transform }, story: entity.civilian?.story ?? null } : null,
              drawn: window.__SS__!.crowdFigures().find(figure => figure.id === actor)?.drawn ?? false,
              doors: [...world.openDoors.keys()] };
          }, beat);
          log({ handoverSample: state });
          const key = JSON.stringify([state.entity?.hidden, state.entity?.story?.clip, state.entity?.story?.prop, state.carrying, state.done, state.doors]);
          if (key !== previous || state.tick - lastPhoto >= 60) {
            const file = await capture(`L1-${beat.id}-burst-t${state.tick}`);
            log({ handoverPhoto: { file, ...state, ...await photoPresentation() } });
            previous = key; lastPhoto = state.tick;
          }
          completed = state.done ? completed + 1 : 0;
          if (completed >= 3) break;
          await hold(300);
        }
        eyes = await observeWithin(page.evaluate(look));
      }
    }
    if (process.env.PLAYTEST_L4_CORPSE_CAPTURES === '1' && eyes.level === 'L4' && eyes.phase === 'playing' && !eyes.loading && !eyes.menu) {
      const sample = await page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as {game:Game}).game, state=g.world.missions!.state.l4!;
        const records=(window as unknown as {__acceptanceInputLedger:{level:string;l4CorpseVertices?:{worst:{x:number;y:number;z:number;topM:number}|null}[]}[]}).__acceptanceInputLedger;
        return {tick:g.world.tick,phase:state.phase,warSeconds:state.warAt?(g.world.tick-state.warAt)/60:0,latest:[...records].reverse().find(r=>r.level==='L4')?.l4CorpseVertices?.at(-1)};
      });
      const key = sample.phase === 'cellar' ? 'cellar' : sample.warSeconds >= 120 ? 'war120' : null;
      if (key && !corpseCaptured.has(key)) {
        corpseCaptured.add(key);await press([]);await releaseAim();await page.evaluate(()=>window.__SS__!.pause());
        try {
          for (const zoom of [.5,1.5]) {
            await page.evaluate(async zoom=>{const a=window.__SS__!,g=(window.__SCENE__ as unknown as {game:Game}).game;a.camera.follow();a.camera.zoom(zoom);g.view.view.update(g.world.entities.get(1)!.transform,1);await a.screenshotReady();},zoom);
            const file=await capture(`L4-corpse-${key}-z${zoom}-route`);log({l4CorpsePhoto:{file,...sample,...await photoPresentation()}});
            if(sample.latest?.worst){
              await page.evaluate(async ({p,zoom})=>{window.__SS__!.camera.cinematic({position:[p.x+15*zoom,p.y+19*zoom,p.z+15*zoom],target:[p.x,p.y,p.z]},true);await window.__SS__!.screenshotReady();},{p:sample.latest.worst,zoom});
              const file=await capture(`L4-corpse-${key}-z${zoom}-heap`);log({l4CorpsePhoto:{file,detailOnly:true,...sample,...await photoPresentation()}});
            }
          }
        } finally {
          await page.evaluate(async zoom=>{const a=window.__SS__!,g=(window.__SCENE__ as unknown as {game:Game}).game;a.camera.follow();a.camera.zoom(zoom);g.view.view.update(g.world.entities.get(1)!.transform,1);await a.screenshotReady();a.resume();},o.zoom);
        }
      }
    }
    if (process.env.PLAYTEST_ACCEPTANCE_CAPTURES === '1' && eyes.level && eyes.phase === 'playing' && !eyes.loading && !eyes.menu && eyes.player) {
      const key = `${eyes.level}-${eyes.step}`;
      if (!acceptanceStarts.has(eyes.level)) {
        acceptanceStarts.set(eyes.level, eyes.tick);
        // Record the opening HUD without waiting for a tier swap. Production
        // terrain swaps need four seconds of running play; pausing at the first
        // tick and awaiting their readiness deadlocks the high-quality photo.
        if (noFrameTiming) await capture(`${key}-opening-t${eyes.tick}`);
      }
      // Let production streaming admission open before pausing for the matrix.
      // Timing runs retain their longer cold interval.
      if (eyes.tick - acceptanceStarts.get(eyes.level)! >= (noFrameTiming ? 300 : 600) && (!acceptanceCaptured.has(key) || eyes.tick - acceptanceTick >= 60 * 60)) {
        acceptanceCaptured.add(key); acceptanceTick = eyes.tick;
        await press([]); await releaseAim();
        await page.evaluate(() => window.__SS__!.pause());
        try {
          const tiers = process.env.PLAYTEST_ACCEPTANCE_CAPTURE_TIERS === 'single' ? [o.quality] : ['low', 'high'] as const;
          for (const quality of tiers) {
            await page.evaluate(q => window.__SS__!.settings.set({ quality: q }), quality);
            for (const zoom of noFrameTiming ? [1.5, 1, .5] : [1.5, .5]) {
              await page.evaluate(async z => { window.__SS__!.camera.zoom(z); await window.__SS__!.screenshotReady(); }, zoom);
              const file = await capture(`${key}-t${eyes.tick}-${quality}-z${zoom}`);
              const presentation = await photoPresentation();
              log({ acceptancePhoto: { file, level: eyes.level, step: eyes.step, tick: eyes.tick, quality, zoom, ...presentation, objective: eyes.objective,
                player: { x: eyes.player.x, z: eyes.player.z, hp: eyes.player.hp }, enemies: eyes.enemies.filter(e => e.drawn && e.hp > 0).length,
                allies: eyes.allies.filter(e => e.drawn && e.hp > 0).length } });
            }
          }
        } finally {
          await page.evaluate(async ({ quality, zoom }) => { window.__SS__!.settings.set({ quality }); window.__SS__!.camera.zoom(zoom); await window.__SS__!.screenshotReady(); window.__SS__!.resume(); }, { quality: o.quality, zoom: o.zoom });
        }
        eyes = await observeWithin(page.evaluate(look));
      }
    }
    if (process.env.PLAYTEST_THREAT_AUDIT === '1' && !eyes.loading && eyes.phase === 'playing' && eyes.player && eyes.level && ['L3', 'L4'].includes(eyes.level) &&
        !threatCaptured.has(`${eyes.level}-${eyes.step}`) && (eyes.level === 'L3' && eyes.step === 'armory' && (eyes.distance !== null && eyes.distance <= 2 || /Hold still or press E/.test(eyes.objective)) || (eyes.level === 'L3' ? ['defend', 'checkpoint'] : ['hold']).includes(eyes.step ?? '') && eyes.enemies.filter(e => e.drawn && e.hp > 0 && e.d < 6).length >= (eyes.level === 'L3' ? 1 : 3))) {
      threatCaptured.add(`${eyes.level}-${eyes.step}`);
      await press([]); await releaseAim();
      await page.evaluate(() => { (window as unknown as { __threatAudit: { capturePaused: boolean } }).__threatAudit.capturePaused = true; window.__SS__!.pause(); });
      try {
        for (const zoom of [.5, 1.5]) {
          await page.evaluate(async z => { window.__SS__!.camera.zoom(z); await window.__SS__!.screenshotReady(); }, zoom);
          await capture(`${eyes.level}-${eyes.step}-${o.quality}-z${zoom}`);
        }
      } finally {
        await page.evaluate(async z => { window.__SS__!.camera.zoom(z); await window.__SS__!.screenshotReady(); window.__SS__!.resume(); (window as unknown as { __threatAudit: { capturePaused: boolean } }).__threatAudit.capturePaused = false; }, o.zoom);
      }
      eyes = await observeWithin(page.evaluate(look));
    }
    if (eyes.level === 'L6' && (eyes.step === 'retreat' || eyes.step === 'exit')) {
      const group = eyes.allies.filter(a => a.drawn && a.hp > 0 && !a.corpse && a.kind !== 'companion');
      if (group.length) { const rear = group.reduce((last, a) => a.x < last.x ? a : last); l6GroupMemory.rear = { x: rear.x, z: rear.z, tick: eyes.tick }; }
    }
    const openingCapture = !l6FightCaptured && eyes.step === 'stop' && eyes.enemies.filter(e => e.drawn && e.d < 15 && e.hp > 0).length >= 3;
    const retreatCapture = !l6RetreatFightCaptured && eyes.step === 'retreat' && eyes.enemies.some(e => e.drawn && e.d < 3 && e.hp > 0);
    if (process.env.PLAYTEST_L6_HOLD_CAPTURES === '1' && eyes.level === 'L6' && (openingCapture || retreatCapture)) {
      if (openingCapture) l6FightCaptured = true; else l6RetreatFightCaptured = true;
      await page.evaluate(() => {
        const audit = (window as unknown as { __l6HoldAudit?: Record<string, unknown> }).__l6HoldAudit;
        if (audit) { audit.capturePaused = true; audit.captureStartedAt = performance.now(); }
        window.__SS__!.pause();
      });
      try {
        for (const zoom of [.5, 1.5]) {
          await page.evaluate(async z => { window.__SS__!.camera.zoom(z); await window.__SS__!.screenshotReady(); }, zoom);
          await capture(`L6-${openingCapture ? 'hold' : 'retreat'}-${o.quality}-z${zoom}`);
        }
      } finally {
        await page.evaluate(z => {
          window.__SS__!.camera.zoom(z); window.__SS__!.resume();
          const audit = (window as unknown as { __l6HoldAudit?: Record<string, unknown> }).__l6HoldAudit;
          if (audit) { audit.captureFinishedAt = performance.now(); audit.capturePaused = false; }
        }, o.zoom);
      }
    }
    if (process.env.PLAYTEST_THREAT_CAPTURES === '1' && eyes.level && eyes.phase === 'playing' && !eyes.menu && !eyes.loading
      && !threatCaptured.has(eyes.level) && eyes.enemies.some(e => e.drawn && e.hp > 0 && e.d < 6)) {
      threatCaptured.add(eyes.level);
      const wasPaused = await page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game; const paused = g.clock.paused; window.__SS__!.pause(); return paused; });
      try {
        const tiers = process.env.PLAYTEST_THREAT_CAPTURE_TIERS === 'both' ? ['low', 'high'] as const : [o.quality];
        for (const quality of tiers) {
          // Photo settings only: the fixed clock stays paused, so quality's
          // future population cap cannot admit or remove actors between shots.
          await page.evaluate(q => window.__SS__!.settings.set({ quality: q }), quality);
          for (const zoom of [1.5, .5]) {
            await page.evaluate(async z => { window.__SS__!.camera.zoom(z); await window.__SS__!.screenshotReady(); }, zoom);
            await capture(`${eyes.level}-first-threat-${quality}-z${zoom}`);
          }
        }
      } finally {
        await page.evaluate(({ zoom, quality, resume }) => { window.__SS__!.settings.set({ quality }); window.__SS__!.camera.zoom(zoom); if (resume) window.__SS__!.resume(); }, { zoom: o.zoom, quality: o.quality, resume: !wasPaused });
      }
    }
    return eyes;
  };
  const assist = (what: string, data: object = {}) => { log({ assist: what, level: eyes?.level, tick: eyes?.tick, ...data }); };
  const keysDown = new Set<string>();
  const press = async (keys: string[]) => {
    for (const k of [...keysDown]) if (!keys.includes(k)) { await page.keyboard.up(k); keysDown.delete(k); }
    for (const k of keys) if (!keysDown.has(k)) { await page.keyboard.down(k); keysDown.add(k); }
  };
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const safe = (x: number, y: number, e: Eyes) => ({ x: clamp(x, 260, e.view.w - 260), y: clamp(y, 120, e.view.h - 170) });
  const walkTowardScreenPoint = async (x: number, y: number) => {
    await releaseAim();
    const movement = await page.evaluate(({ x: sx, y: sy }) => {
      const g = (window as unknown as { __SCENE__?: { game: Game } }).__SCENE__?.game;
      const p = g?.world.entities.get(1)?.transform, ground = p && g?.input.cursor.project(sx, sy);
      if (!p || !ground) return null;
      const dx = ground.x - p.x, dz = ground.z - p.z, a = g!.view.view.azimuth;
      const right = Math.cos(a) * dx - Math.sin(a) * dz, down = Math.sin(a) * dx + Math.cos(a) * dz;
      const length = Math.hypot(right, down); if (length < .2) return null;
      const keys: string[] = [];
      if (Math.abs(right) / length > .34) keys.push(right > 0 ? 'KeyD' : 'KeyA');
      if (Math.abs(down) / length > .34) keys.push(down > 0 ? 'KeyS' : 'KeyW');
      return { keys, ms: Math.max(120, Math.min(1250, length / 4.7 * 1000)) };
    }, { x, y });
    if (!movement) { await press([]); return; }
    await press(movement.keys); await hold(movement.ms); await press([]);
  };

  // --- boot and menu ---
  // The figure probe checks presence of `test`; production clock/UI/prewarming check `test=1`.
  // Enable rendered-pose observations while retaining the production play path.
  const params = `test=poses&testApi=1&scenelab=1&${webgpu ? '' : 'renderer=webgl&'}dpr=1&audio=${cueAudio ? 'enabled' : 'muted'}&quality=${o.quality}${o.entry === 'debug' ? '&debug=1' : ''}${process.env.PLAYTEST_L6_HOLD_AUDIT === '1' ? '&loadProfile=2' : ''}`;
  await page.goto(`${o.origin}/?${params}`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
  await page.evaluate(async poses => { await window.__SS__!.ready; window.__SS__!.debug.figureJoints(poses); }, process.env.PLAYTEST_POSE_PROBES !== '0');
  const backend = await page.evaluate(() => window.__SS__!.getState().render.backend);
  if (webgpu && backend !== 'webgpu') throw new Error(`WebGPU playtest requested but renderer selected ${backend}`);
  log({ renderer: backend });
  const cpu = process.env.PLAYTEST_CPU_PROFILE === '1' ? await context.newCDPSession(page) : null;
  const shaderGuard = process.env.PLAYTEST_SHADER_GUARD === '1';
  let cpuStartedAt = 0, cpuNavigationStartMs: number | undefined;
  if (cpu) {
    await cpu.send('Performance.enable');
    await cpu.send('Profiler.enable'); await cpu.send('Profiler.start');
    const { metrics } = await cpu.send('Performance.getMetrics');
    const navigationStart = metrics.find(metric => metric.name === 'NavigationStart');
    if (navigationStart) cpuNavigationStartMs = navigationStart.value * 1000;
  }
  // Shader acceptance can record builds without the CPU profiler's timing overhead.
  if (cpu || shaderGuard) {
    cpuStartedAt = await page.evaluate(() => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game, previous = g.input.tap;
      const clicks: unknown[] = [], builds: unknown[] = [], inputs: unknown[] = [];
      (window as unknown as { __playtestClicks: unknown[] }).__playtestClicks = clicks;
      (window as unknown as { __playtestBuilds: unknown[] }).__playtestBuilds = builds;
      (window as unknown as { __playtestInputs: unknown[] }).__playtestInputs = inputs;
      const onBuild = g.view.renderer.debug.onNodeBuilderCreated;
      g.view.renderer.debug.onNodeBuilderCreated = (builder, object) => {
        onBuild?.(builder, object);
        const draw = object as unknown as { object: import('three/webgpu').Mesh; material: import('three/webgpu').Material & { id: number } };
        const path: string[] = []; let asset: string | undefined;
        for (let node: import('three/webgpu').Object3D | null = draw.object; node; node = node.parent) { path.push(node.name || node.type); asset ??= node.userData.assetId; }
        const card = document.querySelector<HTMLElement>('[data-testid=level-transition]');
        const cache = object as unknown as { getGeometryCacheKey(): string; getMaterialCacheKey(): number; getDynamicCacheKey(): number; context: { id: number } };
        const corpseCache = draw.material.name.startsWith('corpse_') ? { materialId: draw.material.id, program: draw.material.customProgramCacheKey(), geometry: cache.getGeometryCacheKey(), material: cache.getMaterialCacheKey(), dynamic: cache.getDynamicCacheKey(), context: cache.context.id } : undefined;
        builds.push({ at: performance.now(), tick: g.world.tick, level: g.world.scenario, phase: g.world.missions?.state.phase, loading: (g as unknown as { loading: boolean }).loading || !!(card && !card.hidden), asset, path, material: draw.material.name, corpseCache });
      };
      g.input.tap = (frame, scheme) => {
        previous?.(frame, scheme);
        if (g.world.scenario === 'L10') inputs.push({ tick: g.world.tick, frame: structuredClone(frame) });
        if (frame.mouseAttack && frame.left.down && frame.aimPoint) clicks.push({ tick: g.world.tick, position: { ...g.world.entities.get(1)!.transform }, target: { ...frame.aimPoint }, move: { ...frame.move } });
      };
      return performance.now();
    });
  }
  // The production menu reapplies persisted settings after boot, overriding the
  // URL's initial tier. Select through the visible UI so the requested quality
  // stays fixed throughout the campaign and is also saved for handovers.
  await page.getByTestId('title-settings').click({ timeout: 120_000 });
  await page.getByTestId('setting-quality').selectOption(o.quality);
  await page.getByTestId('settings-back').click();
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
  let cureConsole: { x: number; z: number } | null = null;
  let escortClearance = new EscortClearance();
  let marketWaypoint = 0, marketWalkLogged = false;
  let marketLastPosition: { x: number; z: number } | null = null;
  let navPos = { x: 0, z: 0, wall: Date.now() }, sideStep = 0, navAssist = false, navUntil = 0, navEpisodes = 0, navLog = 0, lastPos = { x: 0, z: 0, wall: Date.now() }, lastShot = -1e9, lastTrace = -1e9, lastHp = 0, prevWeapons: string[] | null = null, frameCursor = 0, unstickDir = 0, stairFrame = 0;
  const allyWatch = new Map<number, { still: number; hits: number; backwards: number; lastHp: number; reported: Set<string> }>();
  const enemyWatch = new Map<number, { still: number; reported: boolean }>();
  const levelDeadline = () => wallStart + o.levelMinutes * 60_000;
  /** The ring the player sees: the active marker's authored anchor (as markerAnchor() resolves it for the 3D ring). The drawn
   * ring object can still sit at (0, 0, 0) on the first frame of a level, so it is not read directly (10-20: a cached origin ring
   * walked the courier 274 m away in L7). The drawn height is logged once per step for the audit. */
  const markerRing = async (): Promise<{ x: number; y: number; z: number } | null> => page.evaluate(strict => {
    if (strict) {
      const pin = document.querySelector<HTMLElement>('[data-testid="minimap-objective"]');
      const p = window.__SS__!.getEntity(1)?.transform;
      if (!pin || pin.hidden || pin.offsetParent === null || !p) return null;
      return { x: Number(pin.dataset.worldX), y: p.y, z: Number(pin.dataset.worldZ) };
    }
    const lab = window.__SCENE__ as unknown as { game?: { world: { missions?: { def: { l3?: unknown; anchors: Record<string, { x: number; z: number; y?: number }> }; state: { marker: string | null } } } } } | undefined;
    const m = lab?.game?.world.missions, key = m?.state.marker; if (!m || !key) return null;
    const a = m.def.anchors[m.def.l3 && key === 'l3-route' ? 'l3-zone' : key];
    return a ? { x: a.x, y: a.y ?? 0, z: a.z } : null;
  }, visibleOnly);
  const drawnRing = async (): Promise<number[] | null> => page.evaluate(() => {
    const m = (window.__SS__!.getState().render as { missionMarker?: { visible: boolean; position: number[] } | null }).missionMarker;
    return m?.visible ? m.position.map(v => +v.toFixed(2)) : null;
  });
  let lastRingRead = 0;
  let ring: { x: number; y: number; z: number } | null = null, ringKey = '';
  const searchedL5Places = new Set<string>();
  let l5SearchStop: { key: string; x: number; z: number } | null = null, l5SearchArrived = 0, l5SearchFound = 0;

  const startLevel = async (e: Eyes) => {
    await press([]); await releaseAim();
    shotAt.clear(); ignored.clear(); reportedUnhittable.clear();
    trail.length = 0; lastErr = null; steering = false;
    vehicleRecovery = new VehicleRecovery();
    searchedL5Places.clear(); l5SearchStop = null; l5SearchArrived = 0; l5SearchFound = 0;
    cureConsole = null; lastE = lastClick = 0;
    escortClearance = new EscortClearance();
    if(process.env.PLAYTEST_GOD==='1'){await page.evaluate(()=>window.__SS__!.cheats.god(true));log({fixture:'god-mode',level:e.level});}
    run = { level: e.level!, entry: o.entry, heroine: o.heroine, finished: false, skipped: [], wallSeconds: 0, simSeconds: 0, maxNoProgressSeconds: 0, deaths: 0, assists: 0, attacks: {}, weaponsStart: e.player?.weapons ?? [], weaponsEnd: [], steps: [] };
    await page.evaluate(({ audit, companionTrace }) => {
      const observation = window as unknown as { __playtestAttacks: Record<string, number>; __playtestCompleted?: unknown[]; __playtestDamage: unknown[] };
      observation.__playtestAttacks = {};
      observation.__playtestCompleted ??= [];
      const game = (window.__SCENE__ as unknown as { game: Game }).game, world = game.world;
      const mission = world.missions!;
      if ((world.scenario === 'L5' || world.scenario === 'L6') && companionTrace) {
        const trace = (window as unknown as { __playtestCompanionTrace?: unknown[]; __playtestEscortEvents?: unknown[] });
        trace.__playtestCompanionTrace = []; trace.__playtestEscortEvents = [];
        for (const type of ['l5.found', 'l5.lost', 'civilian.grabbed', 'infected.attack', 'combat.hit', 'l7.follower-alarm'] as const) world.events.on(type, event => {
          const id = 'targetId' in event ? event.targetId : 'id' in event ? event.id : -1;
          if (typeof id === 'number' && world.entities.get(id)?.civilian?.survivor) trace.__playtestEscortEvents!.push(structuredClone(event));
        });
        world.events.on('sim.tick', event => {
          if (event.type !== 'sim.tick' || world.tick % 30 !== 0) return;
          const player = world.entities.get(1), dog = [...world.entities.iterate()].find(actor => actor.companion);
          const root = dog && game.view.labProbes().npcs?.heroRoot(dog.id);
          if (player && dog) trace.__playtestCompanionTrace!.push({ tick: world.tick, paused: game.clock.paused,
            render: { present: !!root, visible: root?.visible, parentVisible: root?.parent?.visible, world: root?.matrixWorld.elements.slice(12, 15) },
            hud: document.querySelector('[data-testid=corgi-state]')?.textContent,
            survivors: (mission.state.l5?.survivors ?? mission.state.l6?.survivors ?? []).map(row => ({ id: row.id, status: row.status, hp: world.entities.get(row.id)?.health.current })),
            player: { x: player.transform.x, z: player.transform.z },
            corgi: { id: dog.id, x: dog.transform.x, z: dog.transform.z, hidden: !!dog.hidden, state: dog.companion!.state, following: dog.companion!.following,
              path: dog.companion!.path.slice(), goal: dog.companion!.goal, pathIndex: dog.companion!.pathIndex, velocity: dog.companion!.velocity, motion: dog.motion?.speed },
            distance: Math.hypot(player.transform.x - dog.transform.x, player.transform.z - dog.transform.z) });
        });
      }
      world.events.on('level.completed', event => {
        if (event.type !== 'level.completed') return;
        observation.__playtestCompleted!.push({ level: event.id, tick: world.tick, result: structuredClone(event.result), steps: mission.def.steps.map(s => ({ id: s.id, optional: !!s.optional, status: mission.state.steps[s.id].status })) });
      });
      world.events.on('combat.attack', event => { if (event.type === 'combat.attack' && event.sourceId === 1) observation.__playtestAttacks[event.actionId] = (observation.__playtestAttacks[event.actionId] ?? 0) + 1; });
      observation.__playtestDamage = [];
      if (world.scenario === 'L4' || audit || companionTrace) {
        world.events.on('combat.hit', event => {
          if (event.type === 'combat.hit' && (event.sourceId === 1 || event.targetId === 1)) observation.__playtestDamage.push({ ...event, source: world.entities.get(event.sourceId)?.archetype, target: world.entities.get(event.targetId)?.archetype, targetHp: world.entities.get(event.targetId)?.health.current, shieldBrokenUntil: world.entities.get(event.targetId)?.combat?.shieldBrokenUntil });
        });
        world.events.on('player.damaged', event => { if (event.type === 'player.damaged') observation.__playtestDamage.push(event); });
        world.events.on('vehicle.durability-hit', event => { if (event.type === 'vehicle.durability-hit') observation.__playtestDamage.push(event); });
      }

    }, { audit: process.env.PLAYTEST_COMBAT_AUDIT === '1', companionTrace: process.env.PLAYTEST_COMPANION_TRACE === '1' });
    runs.push(run); lastShot = -1e9; wallStart = Date.now(); tickStart = e.tick; zoomed = false; assistMode = false; stuckLogged = new Set(); allyWatch.clear(); enemyWatch.clear(); fetchHint = null; escort = null;
    lastProgress = { key: '', tick: e.tick, wall: Date.now(), best: Infinity };
    visibleProgress = new PlaytestProgress();lastObservation=0;
    marketWaypoint = 0; marketWalkLogged = false; marketLastPosition = null;
    log({ levelStart: e.level, tick: e.tick, ...(e.level === 'L5' && l5Order ? { authoredMapTourOrder: l5Order } : {}), weapons: run.weaponsStart, owned: await page.evaluate(() => window.__SS__!.campaign.state()?.ownedActions ?? []) });
    if (e.level === 'L6') writeFileSync(join(o.out, 'campaign-L6.json'), JSON.stringify(await page.evaluate(() => window.__SS__!.campaign.state())));
  };
  const finishLevel = async (e: Eyes) => {
    if (!run) return;
    run.finished = true; run.wallSeconds = Math.round((Date.now() - wallStart) / 1000); run.simSeconds = Math.round((e.tick - tickStart) / 60);
    const deaths = await page.evaluate(level => {
      // Auto-transition may already have replaced the mission by this poll.
      // Its completion event retains deaths missed between physical samples.
      const completed = (window as unknown as { __playtestCompleted?: { level: string; result: { deaths: number } }[] }).__playtestCompleted?.filter(row => row.level === level).at(-1);
      if (completed) return completed.result.deaths;
      const m = window.__SS__!.missions.state(); return m?.id === level ? m.stats.deaths : null;
    }, run.level);
    if (deaths !== null) run.deaths = deaths;
    run.attacks = await page.evaluate(() => ({ ...(window as unknown as { __playtestAttacks: Record<string, number> }).__playtestAttacks }));
    run.weaponsEnd = e.player?.weapons ?? []; prevWeapons = run.weaponsEnd;
    if (e.level === 'L6') log({ l6Result: await page.evaluate(() => {
      const m = window.__SS__!.missions.state()!, r = m.result!;
      return { stats: m.stats, rescued: r.rescued, survivorsIn: r.survivorsIn, survivorsLost: r.survivorsLost };
    }) });
    log({ levelEnd: e.level, run }); await capture(`${e.level}-result`);
    writeFileSync(join(o.out, `runs-${o.tag}.json`), JSON.stringify(runs, null, 2));
  };

  // --- combat and following ---
  const shotAt = new Map<number, { hp: number; ms: number; last: number }>(), ignored = new Map<number, number>(), reportedUnhittable = new Set<number>();
  let aimHeld: number | null = null, lastCrowdKick = 0, l6CrowdUntil = 0, l6RetreatRouteLogged = false;
  let dodgePosition = { x: 0, z: 0, at: 0 }, dodgeAttempt = 0, dodgeDetourUntil = 0, dodgeDetourKeys: string[] = [];
  const releaseAim = async () => { if (aimHeld !== null) { aimHeld = null; await page.mouse.up(); } };
  const aimArmyGun = async (e: Eyes, target: Body, keys: string[]) => {
    await releaseAim(); await press(keys);
    const blocked = await page.evaluate(p => !!document.elementFromPoint(p.x, p.y)?.closest('button, input, select, textarea, [role="button"], [role="dialog"]'), target.aim);
    if (blocked) { await page.mouse.move(e.view.w / 2, e.view.h / 2); return; }
    // Keyboard K fires along the movement cone. Retreat cover needs the
    // carried gun selected and LMB aimed at the visible pursuer instead.
    if (e.player?.current !== 'weapon.army-mg') { await page.keyboard.press('Digit5'); return; }
    await page.mouse.move(target.aim.x, target.aim.y); await page.mouse.down(); aimHeld = target.id;
  };

  const fight = async (e: Eyes): Promise<boolean> => {
    // Carried guns cannot fire from a vehicle; keep following the driving objective.
    if (e.driving || e.player?.riding) return false;
    // The collapse objective is escape. Keep movement aimed down the street
    // route instead of repeatedly stopping to duel the pursuing horde.
    if (e.level === 'L4' && e.step === 'hide') { await releaseAim(); return false; }
    // Resume gameplay keyboard focus after a retry or a HUD button click.
    if (e.level === 'L4' && (e.step === 'hold' || e.step === 'hide')) // Re-establish a physical gameplay pointer after the menu click.
          await page.mouse.click(e.view.w / 2, e.view.h / 2);
    if (e.level === 'L4' && e.step === 'hold' && e.player?.weapons.includes('weapon.army-mg')) {
      const target = e.enemies.find(body => body.d < 20 && !body.corpse);
      await releaseAim();
      if (target) {
        const crowd = e.enemies.filter(body => body.d < 5).length;
        const away = crowd >= 3 || target.d < 2.5 || target.archetype === 'infected.alpha' && target.d < 10 ? { x: Math.max(-25, Math.min(-18, e.player.x + (e.player.x - target.x))), z: Math.max(-10, Math.min(10, e.player.z + (e.player.z - target.z))) } : null;
        const points = away ? await page.evaluate(({ p, to }) => [window.__SS__!.input.project(p, 'player'), window.__SS__!.input.project(to, 'player')], { p: e.player, to: away }) : null;
        const move = points ? wasdToward(e, e.view.w / 2 + points[1].x - points[0].x, e.view.h / 2 + points[1].y - points[0].y) : [];
        await aimArmyGun(e, target, move); return true;
      }
      if (keysDown.has('KeyJ') || keysDown.has('KeyK')) await press([]);
      // Defend from inside the gap, rather than standing on the Alpha's entry.
      if (e.distance !== null && e.distance < 6 && /breach|wall/.test(e.objective)) { await press([]); return true; }
      return false;
    }
    // During the L4 retreat, outrun a visible Alpha instead of planting the
    // courier for a repeating close-range duel. The sim bot uses the same
    // escape policy; the browser still follows the displayed street arrow.
    if (e.level === 'L4' && e.step === 'hide' && e.enemies.some(body => body.archetype === 'infected.alpha' && body.d < 14)) {
      await releaseAim(); if (keysDown.has('Space') || keysDown.has('KeyJ') || keysDown.has('KeyK')) await press([]);
      return false;
    }
    const unarmed = !e.player?.current || /fists|kick|unarmed/.test(e.player.current);
    // While the objective is not progressing, only fight what is close: walking on matters more than ranged shots.
    const lostTime = (Date.now() - lastProgress.wall) / 1000 > 30;
    const reach = e.level === 'L10' && (e.step === 'mega' || e.step === 'hold') && ranged.test(e.player?.current ?? '') ? 30 : lostTime ? 3 : ranged.test(e.player?.current ?? '') ? 14 : unarmed ? 1.6 : 4.5;
    // Threats to the group within 16 m count too (keep the group alive).
    const ok = (b: Body) => (ignored.get(b.id) ?? 0) < Date.now();
    const nearby = campaignThreat(e.level, e.step, e.enemies.filter(ok), reach);
    const allyThreat = e.enemies.find(b => b.d < 16 && ok(b) && e.allies.some(a => canCoverVisibleAllies(e.level,e.step,unarmed,{ drawn:a.drawn, hp:a.hp, corpse:a.corpse, underAttack:b.attacking },e.objective) && Math.hypot(a.x - b.x, a.z - b.z) < 2.5));
    const threat = prioritizeAllyThreat(unarmed, nearby, allyThreat);
    if (e.level === 'L6' && e.step === 'stop' && unarmed) {
      const close = e.enemies.find(b => b.d < 5);
      if (close) {
        // With no route ring during the shelter defence, keep space from the
        // visible crowd instead of standing at the spawn until it surrounds us.
        await releaseAim();
        const feet = await page.evaluate(at => window.__SS__!.input.project(at, 'destination'), { x: close.x, z: close.z });
        await page.mouse.move(feet.x, feet.y);
        await press([...awayKeys(e, close), fistsRetreatAttack(e.enemies.filter(b => b.d < 3).length)]);
        return true;
      }
    }
    if (!threat) { if (keysDown.has('Space')||keysDown.has('KeyJ')||keysDown.has('KeyK')) await press([]); await releaseAim(); return false; }
    // Time spent on a target without hurting it accumulates across target switches.
    const now = Date.now(), seen = shotAt.get(threat.id) ?? { hp: threat.hp, ms: 0, last: now };
    // Checkpoint retries restore HP on the same actor ID; that begins a new
    // damage observation rather than inheriting the previous attempt's minimum.
    if (threat.hp !== seen.hp) { seen.hp = threat.hp; seen.ms = 0; } else seen.ms += Math.min(500, now - seen.last);
    seen.last = now; shotAt.set(threat.id, seen);
    if (seen.ms > 8000 && isMandatoryBossObjective(e.level, e.step) && threat.max >= 1000) {
      // Walking toward this objective marker means walking into the boss.
      // Keep the visible target, make space and retry the ordinary aim input.
      log({ mandatoryBossRetarget: threat.id, hp: threat.hp, tick: e.tick });
      seen.ms = 0;
      await releaseAim();
    }
    if (seen.ms > 8000) {
      // A target that takes no damage for 8 s is unreachable (behind a fence) or ignores hits: note it, walk on.
      const diagnostic = await page.evaluate(id => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
        const render = a.getState().render as unknown as { healthBars?: { bars: { id: number }[] } };
        return { entity: a.getEntity(id), bar: render.healthBars?.bars.some(b => b.id === id), input: g.world.inputFrame, control: g.world.controls.snapshot(), pick: g.input.picker.last };
      }, threat.id);
      // A pointer cancellation releases the game's hold while Playwright still
      // remembers its mouse-down. Restore a real edge before judging damage.
      if (aimHeld !== null && !diagnostic.input.left.held && !diagnostic.input.right.held && !diagnostic.input.mouseAttack) {
        await releaseAim();
        await page.mouse.move(threat.aim.x, threat.aim.y); await page.mouse.down(); aimHeld = threat.id;
        seen.ms = 0;
        log({ physicalAimRearmed: threat.id, tick: e.tick, diagnostic });
        return true;
      }
      ignored.set(threat.id, Date.now() + 20_000); log({ unhittable: threat.id, d: threat.d, state: threat.state, hp: threat.hp, diagnostic }); await releaseAim();
      if (!reportedUnhittable.has(threat.id)) { reportedUnhittable.add(threat.id); if (threat.d < 2.2) await issue('P2', 'enemy-unhittable', `Infected #${threat.id} (${threat.state}) ${threat.d.toFixed(1)} m away took no damage from 8 s of attacks (hp ${threat.hp}/${threat.max})`); }
      return false;
    }
    if (threat.d > reach) { // walk toward the ally's attacker
      if (Date.now() - lastClick > 700) { const s = safe(threat.screen.x, threat.screen.y, e); await walkTowardScreenPoint(s.x, s.y); lastClick = Date.now(); }
      return true;
    }
    if (e.level === 'L6' && e.player?.weapons.includes('weapon.fire-axe') && (e.enemies.filter(b => b.d < 1.8).length >= 3 || now < l6CrowdUntil)) {
      // The carried LEFT axe covers a close crowd while the courier keeps retreating. J is its shipped binding.
      if (e.enemies.filter(b => b.d < 1.8).length >= 3) l6CrowdUntil = now + 650;
      await releaseAim();
      const retreat = awayKeys(e, threat);
      if (now - lastCrowdKick > 750) {
        await page.mouse.move(threat.screen.x, threat.screen.y); await press([...retreat, 'KeyJ']); await hold(180);
        lastCrowdKick = now; log({ crowdAxe: e.tick, enemies: e.enemies.filter(b => b.d < 3).length });
      }
      await press(retreat);
      return true;
    }
    if (e.level === 'L6' && e.player?.current === 'weapon.fire-axe' && e.player.weapons.includes('weapon.army-mg') && threat.d > 3) {
      // J selects the LEFT axe. Use the shipped RIGHT binding to return to the carried gun at range.
      await releaseAim(); await page.mouse.move(threat.screen.x, threat.screen.y); await press(['KeyK']); await hold(60); await press([]);
      return true;
    }
    if (ranged.test(e.player?.current ?? '')) {
      const l10Travel = e.level === 'L10' && !['hold', 'mega', 'epilogue'].includes(e.step ?? '');
      if (l10Travel && e.player && ring && Math.hypot(ring.x - e.player.x, ring.z - e.player.z) > 1.2) {
        if (Math.hypot(e.player.x - navPos.x, e.player.z - navPos.z) > .6) navPos = { x: e.player.x, z: e.player.z, wall: now };
        // A nearby crowd must not monopolize this loop and starve ordinary
        // WASD route recovery. Reuse that recovery when covering fire stalls.
        if (now - navPos.wall > 3000) { await releaseAim(); return false; }
      }
      const defending = e.step === 'mega' || e.step === 'hold' && /Charge \d+\/60/.test(e.objective);
      const dodge = e.player && finaleDodgeGoal(e.level, defending ? e.step : null, e.player, cureConsole, threat);
      if (dodge && e.player) {
        const points = await page.evaluate(({ p, goal, enemy }) => {
          const a = window.__SS__!;
          return [a.input.project(p, 'player'), a.input.project(goal, 'destination'), a.input.project(enemy, 'destination')];
        }, { p: e.player, goal: dodge, enemy: e.player.current === 'weapon.rocket-launcher' ? rocketAimPoint(e.player, threat) : { x: threat.x, z: threat.z } });
        const dx = points[1].x - points[0].x, dy = points[1].y - points[0].y;
        if (Math.hypot(e.player.x - dodgePosition.x, e.player.z - dodgePosition.z) > .8) dodgePosition = { x: e.player.x, z: e.player.z, at: now };
        if (now > dodgeDetourUntil && now - dodgePosition.at > 800) {
          dodgeDetourKeys = dodgeWalkKeys(dx, dy, ++dodgeAttempt);
          dodgeDetourUntil = now + 1800; dodgePosition.at = now;
        }
        const keys = now < dodgeDetourUntil ? dodgeDetourKeys : dodgeWalkKeys(dx, dy);
        // Space auto-aims along the movement cone. During a retreat that can
        // shoot away from the visible boss; aim and hold the physical mouse.
        await press(keys); await page.mouse.move(points[2].x, points[2].y);
        if (aimHeld === null) await page.mouse.down();
        aimHeld = threat.id;
        if (now - lastCrowdKick > 1500) { lastCrowdKick = now; log({ visibleFinaleDodge: e.tick, keys, enemy: threat.id, recovery: now < dodgeDetourUntil }); }
        return true;
      }
      // Keep covering pursuers while following a checkpoint or heard L5 cue,
      // rather than planting until every recovering street infected is clear.
      let retreatKeys: string[] = [];
      const coverGoal = e.level === 'L5' && e.player ? visibleGroupTarget(e.level, e.player, e.allies, 5, e.step) ?? ring : ring;
      const l7EscortRoute = process.env.PLAYTEST_L7_ESCORT_ROUTE === '1' && e.level === 'L7';
      if ((l10Travel || l7EscortRoute || e.level === 'L3' && e.step === 'checkpoint' || e.level === 'L5' && (e.step === 'look' || e.step === 'metro')) && e.player && coverGoal && Math.hypot(coverGoal.x - e.player.x, coverGoal.z - e.player.z) > (l10Travel || l7EscortRoute ? 1.2 : e.level === 'L5' ? 2 : 12)) {
        const points = await page.evaluate(({ p, goal }) => {
          const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          const out = { ...goal }, radius = w.entities.get(1)!.combat?.radius ?? .3;
          w.infected!.nav.forPlayer(radius).steer(p, goal, { path: [], goal: -1, pathIndex: 0 }, radius, out, Infinity, true);
          return [a.input.project(p, 'player'), a.input.project(out, 'player')];
        }, { p: e.player, goal: coverGoal });
        retreatKeys = markerWalkKeys(points[1].x - points[0].x, points[1].y - points[0].y, (stairFrame++ % 12) / 12);
        if (now - lastCrowdKick > 1500) { lastCrowdKick = now; log({ movingCover: e.tick, level: e.level, keys: retreatKeys, input: 'physical WASD + mouse; read-only route steering' }); }
      }
      // Held LMB aims at the current cursor; no target command or approach is created.
      await press(retreatKeys.length ? retreatKeys : e.level === 'L6' && e.step === 'stop' && threat.d < 5 ? awayKeys(e, threat) : []);
      await page.mouse.move(threat.aim.x, threat.aim.y);
      if (aimHeld === null) { await page.mouse.down(); }
      aimHeld = threat.id;
      return true;
    }
    // L1 asks the courier to escape, not clear recovering street crowds.
    // Keep physical movement toward the displayed destination while swinging.
    if (e.level === 'L1' && (e.step === 'weapon' || e.step === 'firestation') && e.player && ring) {
      if (Math.hypot(e.player.x - navPos.x, e.player.z - navPos.z) > .6) navPos = { x: e.player.x, z: e.player.z, wall: now };
      // A close infected must not bypass the normal WASD navigation recovery
      // forever. The zoom-0.5 station run held KeyA against a bollard for 90 s.
      // Yield to the existing route/side-step path until physical movement resumes.
      if (now < navUntil || now - navPos.wall > 3000) { await releaseAim(); return false; }
      const goal = await goalScreen(e);
      if (goal) {
        const keys = wasdToward(e, goal.x, goal.y);
        await press(keys); await page.mouse.move(threat.aim.x, threat.aim.y);
        if (aimHeld === null) await page.mouse.down();
        aimHeld = threat.id;
        if (now - lastCrowdKick > 1500) { lastCrowdKick = now; log({ movingEscape: e.tick, keys, enemy: threat.id, input: 'physical WASD + mouse toward the visible objective' }); }
        return true;
      }
    }
    // Approach was handled with WASD above; held LMB now attacks toward the visible infected.
    // On an unarmed rack it uses the fist chain even when the selected action is the kick. Space instead keeps
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
      // A keyboard attack uses aim assist; mouse attacks aim through the ground ray.
      await releaseAim(); await page.mouse.move(threat.screen.x, threat.screen.y);
      await press(['Space', ...awayKeys(e, threat)]); return true;
    }
    await press([]);
    await page.mouse.move(threat.aim.x, threat.aim.y);
    if (aimHeld === null) { await page.mouse.down(); }
    aimHeld = threat.id;
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
    // Read the north-up route pin: its height-free direction stays accurate at
    // every zoom, including the final metre before a street turn.
    if (e.level === 'L4' && e.step === 'hide' && e.route && e.player) return page.evaluate(({ p, route }) => {
      // A distant map pin can project beyond the viewport; click a short
      // visible piece of that street instead of clamping it onto a building.
      const scale = Math.min(1, 4 / (Math.hypot(route.dx, route.dz) || 1));
      return window.__SS__!.input.project({ x: p.x + route.dx * scale, z: p.z + route.dz * scale }, 'player');
    }, { p: e.player, route: e.route });
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
    if (e.level === 'L9' && e.driving) {
      // The APC exposes its heading directly. Inferring steering from recent
      // velocity flips the sign after a ram/reverse and can circle forever.
      const car = e.driving, want = -Math.atan2(goal.z - car.z, goal.x - car.x);
      const delta = Math.atan2(Math.sin(want - car.yaw), Math.cos(want - car.yaw));
      await press(vehicleRecovery.keys(car, Date.now()) ?? ['KeyW', ...(Math.abs(delta) > .08 ? [delta > 0 ? 'KeyD' : 'KeyA'] : [])]);
      return;
    }
    const recovery = vehicleRecovery.keys(e.driving!, Date.now());
    if (recovery) {
      trail.length = 0; lastErr = null;
      if (!keysDown.has('KeyS')) log({ vehicleReverse: e.tick, keys: recovery, at: e.driving });
      await press(recovery); return;
    }
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
  let vehicleRecovery = new VehicleRecovery();
  const l9Route = crossing.routes.find(r => r.id === o.l9Route);
  const l9Path = o.l9Waypoints ?? l9Route?.points.flatMap((a, i, points) => {
    const b = points[i + 1]; if (!b) return [a];
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const along = (p: readonly number[]) => ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length;
    return [a, ...l9Groups.filter(g => g.route === o.l9Route).map(g => g.at)
      .filter(p => along(p) > 0 && along(p) < length && Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / length < 1)
      .sort((p, q) => along(p) - along(q))];
  });
  let l9Waypoint = 1, l9RouteLogged = false;

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
  let lastLevel: string | null = null, levelIndex = 0, lastPhase = '', idleScreens = 0, bootWall = Date.now(), lastSeenWall = Date.now();
  let manual = false, latestShot = 0, creditsVisibleAt = 0;
  const endingShots = new Set<string>();
  for (;;) {
    if (pageCrashed) throw new Error(`Playtest browser renderer crashed during ${run?.level ?? 'startup'}; session cannot continue`);
    if (pageClosed || page.isClosed()) throw new Error(`Playtest browser page closed unexpectedly during ${run?.level ?? 'startup'}; session cannot continue`);
    let e: Eyes;
    try { e = await see(); lastSeenWall = Date.now(); } catch (error) {
      if (pageClosed || page.isClosed()) throw new Error(`Playtest browser page closed unexpectedly during ${run?.level ?? 'startup'}: ${String(error)}`);
      if (pageCrashed || String(error).includes('Playtest observation timed out')) throw error;
      if (Date.now() - lastSeenWall > 15_000) throw new Error(`Playtest could not observe ${run?.level ?? 'startup'} for 15 s: ${String(error)}`);
      log({ seeError: String(error) }); await hold(500); if (Date.now() - bootWall > 600_000 && !run) break; continue;
    }
    if (visibleOnly) {
      writeFileSync(join(o.out, 'latest.json'), JSON.stringify(e));
      if (Date.now() - latestShot > (manual ? 2000 : 10000)) {
        await page.screenshot({ path: join(o.out, 'latest.jpg'), type: 'jpeg', quality: 72 }); latestShot = Date.now();
      }
      // Evidence only: capture the player-visible title and credits without input.
      if (e.level === 'L10' && e.ending) {
        const card = await page.evaluate(() => {
          const title = document.querySelector<HTMLElement>('[data-testid=epilogue-title]');
          const roll = document.querySelector<HTMLElement>('.credits-roll');
          return roll?.getClientRects().length ? { kind: 'credits', text: roll.innerText }
            : title?.getClientRects().length ? { kind: 'title', text: title.innerText } : null;
        });
        if (card) {
          if (card.kind === 'credits') creditsVisibleAt ||= Date.now();
          const key = card.kind === 'credits' && Date.now() - creditsVisibleAt >= 5000 ? 'credits-roll' : card.kind;
          if (!endingShots.has(key)) {
            endingShots.add(key); log({ visibleEndingCard: card, tick: e.tick });
            await capture(`L10-ending-${key}`);
          }
        }
      }
    }
    const control = process.env.PLAYTEST_CONTROL_FILE ?? join(o.out, 'control.json');
    if (control && existsSync(control)) {
      let command: { manual?: boolean; key?: string; keys?: string[]; click?: [number, number]; ms?: number; button?: string; capture?: string; resume?: boolean; combat?: boolean; pauseAfter?: boolean; skipObjective?: string };
      try { command = JSON.parse(readFileSync(control, 'utf8')); }
      catch { await hold(50); continue; }
      unlinkSync(control); await page.bringToFront(); await press([]); await releaseAim();
      if (command.manual !== undefined) manual = command.manual;
      if (command.skipObjective) {
        if (o.noSkip || !run || e.phase !== 'playing' || e.step !== command.skipObjective) throw new Error('Explicit continuation skip requires a matching playing objective and noSkip=false');
        await issue('P0', 'permitted-debug-continuation', `FAIL: explicitly permitted continuation of ${e.step} after the recorded real-input attempts; not a gameplay completion`);
        run.skipped.push(e.step); run.assists++;
        assist('skip-step', { step: e.step, reason: 'user-permitted continuation after recorded failure' });
        await page.evaluate(id => window.__SS__!.cheats.completeObjective(id), e.step);
      }
      if (command.resume && await page.getByTestId('resume-game').isVisible()) {
        await page.getByTestId('resume-game').click();
        // Re-establish a physical gameplay pointer after the menu click.
        await page.mouse.click(e.view.w / 2, e.view.h / 2);
      }
      if (command.key) await page.keyboard.press(command.key);
      if (command.button) await page.getByTestId(command.button).click();
      if (command.click) await walkTowardScreenPoint(...command.click);
      if (command.keys) {
        const until = Date.now() + Math.min(10000, command.ms ?? 1000);
        do {
          const view = command.combat ? await see() : null;
          const target = view?.enemies.find(b => b.drawn && b.d < (ranged.test(view.player?.current ?? '') ? 14 : 3.5));
          if (target) {
            const feet = await page.evaluate(at => window.__SS__!.input.project(at, 'destination'), { x: target.x, z: target.z });
            await page.mouse.move(feet.x, feet.y);
          }
          await press([...command.keys, ...(target ? ['Space'] : [])]);
          await hold(Math.min(150, Math.max(1, until - Date.now())));
        } while (Date.now() < until);
        await press([]);
      }
      if (command.capture) await capture(command.capture);
      if (command.pauseAfter && !await page.getByTestId('resume-game').isVisible()) await page.keyboard.press('Escape');
      log({ manualInput: command, level: e.level, tick: e.tick }); continue;
    }
    if (manual && run && o.sampleSeconds !== undefined && Date.now() - wallStart >= o.sampleSeconds * 1000) manual = false;
    if (manual) { await press([]); await hold(200); continue; }
    if (run && shouldResumePause(e.menu,e.loading)) {
      await press([]); await releaseAim();
      await page.getByTestId('resume-game').click({ timeout: 5000 });
      log({ resumedVisiblePause: true, level: e.level, tick: e.tick });
      await hold(150); continue;
    }
    // Hitches: long frames during play only.
    const frames = await observeWithin(page.evaluate(n => (window as unknown as { __playtestFrames: LongFrame[] }).__playtestFrames.slice(n), frameCursor));
    frameCursor += frames.length;
    for (const frame of frames) {
      log({ frame });
      if (frame.playMs > 200 && frame.level && o.levels.includes(frame.level)) {
        log({ hitch: frame.playMs, rawFrameMs: frame.ms, tick: frame.tick, level: frame.level, x: frame.x, z: frame.z });
        if (frame.playMs > 500) await issue(frame.playMs > 2000 ? 'P1' : 'P2', 'hitch', `Frame of ${Math.round(frame.playMs)} ms at tick ${frame.tick}`, false, frame);
      }
    }
    if (run && o.sampleSeconds !== undefined && Date.now() - wallStart >= o.sampleSeconds * 1000) {
      await press([]); await releaseAim();
      run.wallSeconds = Math.round((Date.now() - wallStart) / 1000); run.simSeconds = Math.round((e.tick - tickStart) / 60);
      run.weaponsEnd = e.player?.weapons ?? [];
      run.attacks = await page.evaluate(() => ({ ...(window as unknown as { __playtestAttacks: Record<string, number> }).__playtestAttacks }));
      if (o.saveOnYield) {
        await page.keyboard.press('Escape');
        await page.getByTestId('pause-settings').click();
        await page.getByTestId('setting-quality').selectOption(o.quality);
        await page.getByTestId('settings-back').click();
        log({ productionResumeSave: await page.evaluate(() => window.__SS__!.campaign.state()?.cureResume?.current.tick) });
      }
      yielded = true;
      log({ checkpointYield: e.checkpoint, level: e.level, tick: e.tick, finished: run.finished });
      const file = await capture(`${e.level}-checkpoint-yield`);
      if (process.env.PLAYTEST_ACCEPTANCE_CAPTURES === '1') log({ acceptancePhoto: { file, level: e.level, step: e.step, tick: e.tick, quality: o.quality, zoom: o.zoom, ...await photoPresentation(), sampleEnd: true } });
      break;
    }

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
        if(process.env.PLAYTEST_HANDOVER_AUDIT==='1')await page.waitForFunction('window.__playtestHandoverAudit?.some(s => !s.breached && !s.text.trim() && !s.pin && !s.marker)',null,{timeout:2500}).catch(()=>undefined);
        log({ handover: lastLevel, to: e.level, firstPlayableTick:e.tick,objective:e.objective }); break;
      }
      lastLevel = e.level; levelIndex = o.levels.indexOf(e.level);
      if (levelIndex < 0) { log({ beyondRange: e.level }); break; }
      await startLevel(e);
    }
    if (!run) { if (Date.now() - bootWall > 600_000) { await issue('P0', 'boot', 'No level started within 10 minutes of the menu click'); break; } await hold(400); continue; }
    if (e.phase !== lastPhase) { log({ phase: e.phase, level: e.level, tick: e.tick, panel: e.panel }); lastPhase = e.phase ?? ''; idleScreens = 0; }

    if (e.level === 'L10' && e.phase === 'progression' && e.step === null) {
      const ending = await page.evaluate(() => {
        const m = window.__SS__!.missions.state()!;
        return { level: m.id, phase: m.phase, creditsFinished: !!m.states['credits-finished'], endingPhase: m.epilogue?.phase ?? null, completedLevels: window.__SS__!.campaign.state()?.completedLevels ?? 0 };
      });
      if (!campaignEndingComplete(ending) && campaignEndingWaiting(ending.endingPhase)) {
        // The scripted epilogue and credits are timed mission phases, not a
        // result screen that should be clicked through or reported as stuck.
        idleScreens = 0;
        await press([]); await releaseAim(); await hold(200); continue;
      }
      assert.ok(campaignEndingComplete(ending), `L10 left play without completed credits: ${JSON.stringify(ending)}`);
      await press([]); await releaseAim();
      if (!run.finished) await finishLevel(e);
      log({ done: e.level, ending }); break;
    }

    if (e.phase === 'briefing' || e.phase === 'retry' || e.phase === 'progression') {
      if (e.level === 'L10' && e.phase === 'progression' && e.ending) { idleScreens = 0; await press([]); await releaseAim(); await hold(200); continue; }
      if (e.phase === 'retry' && lastDeathTick !== e.tick) { lastDeathTick = e.tick; run.deaths++; await issue('P3', 'retry', `Mission failed screen: ${e.panel.heading}`); }
      await press([]); await releaseAim();
      if (e.panel.button && !e.loading) { await page.getByTestId('mission-button').click({ timeout: 5000 }).catch(() => undefined); }
      idleScreens++; if (idleScreens === 300) { await issue('P0', 'stuck-screen', `Stuck on the ${e.phase} screen for ~60 s (button ${e.panel.button})`); break; }
      await hold(200); continue;
    }
    if (e.phase === 'result') {
      await press([]); await releaseAim();
      if (!run.finished) await finishLevel(e);
      const last = levelIndex === o.levels.length - 1;
      if (last && o.levels.length > 0) { log({ done: e.level }); if (!o.stopAfterLevel) break; }
      if (e.panel.button && !e.loading) await page.getByTestId('mission-button').click({ timeout: 5000 }).catch(() => undefined);
      idleScreens++; if (idleScreens === 600) { await issue('P0', 'stuck-result', `Result screen did not hand over within ~2 min (button ${e.panel.button})`); break; }
      if (o.stopAfterLevel && idleScreens > 20 && !e.panel.button) { /* waiting for next level */ }
      await hold(200); continue;
    }
    if (e.phase !== 'playing') { await press([]); await releaseAim(); await hold(200); idleScreens++; if (idleScreens === 900) { await issue('P0', 'long-cinematic', `Phase ${e.phase} lasted ~3 min`); break; } continue; }

    // Direct-entry levels can report playing while their loading card still
    // owns input. Wait for it before sending the first wheel or movement input.
    if (e.loading) { await press([]); await releaseAim(); await hold(200); continue; }

    // Playing.
    // Opt-in 1 Hz route trace (r9-l10pace): position plus on-screen living infected, for empty-stretch timing.
    if (process.env.PLAYTEST_ROUTE_TRACE === '1' && e.player && e.tick - lastTrace >= 60) {
      lastTrace = e.tick;
      log({ routeTrace: { level: e.level, step: e.step, tick: e.tick, x: +e.player.x.toFixed(1), z: +e.player.z.toFixed(1), hp: Math.round(e.player.hp), enemies: e.enemies.length, nearest: e.enemies[0] ? +e.enemies[0].d.toFixed(1) : null } });
    }
    if (e.tick - lastShot > Number(process.env.PLAYTEST_SHOT_SECONDS ?? 45) * 60) { lastShot = e.tick; await capture(`${e.level}-t${e.tick}`); }
    if (!zoomed) {
      const quality = await page.evaluate(() => window.__SS__!.getState().render.quality);
      if (e.level === 'L6' && process.env.PLAYTEST_L6_HOLD_AUDIT === '1') await page.evaluate(() => {
        const audit = (window as unknown as { __l6HoldAudit: Record<string, unknown> }).__l6HoldAudit;
        audit.loadedPerf = structuredClone(window.__SS__!.perf());
      });
      assert.equal(quality, o.quality, `Playtest requested ${o.quality} but ${e.level} rendered ${quality}`);
      log({ quality, level: e.level, tick: e.tick });
      if (e.level === 'L6') assertRenderedBodies(await page.evaluate(() => window.__SS__!.crowdFigures().map(f => ({ drawn: f.drawn, joints: !!f.joints }))));
      // Rack check at the first playing tick (the briefing can still show the previous rack).
      run.weaponsStart = e.player?.weapons ?? [];
      const lost = (prevWeapons ?? []).filter(w => !run!.weaponsStart.includes(w) && !/fists|kick|unarmed/.test(w));
      if (lost.length) await issue('P1', 'lost-weapon', `Carried ${lost.join(', ')} at the end of the previous level, not in the rack when ${e.level} starts (rack: ${run.weaponsStart.join(', ')})`);
    }
    if (!zoomed) {
      if (o.weapon && e.player?.weapons.includes(o.weapon) && e.player.current !== o.weapon) {
        const shortcut = weaponKey(o.weapon);
        assert.ok(shortcut, `No weapon shortcut for ${o.weapon}`);
        await press([]); await releaseAim();
        if (e.driving) {
          // L9 starts inside the APC, where the UI locks weapon shortcuts. This
          // explicit diagnostic option selects a carried slot without changing the arsenal.
          await page.evaluate(key => {
            const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
            w.combat!.runner.loadout.input({ move: { x: 0, z: 0 }, aim: null, aimSource: null,
              left: { down: false, held: false, up: false }, right: { down: false, held: false, up: false },
              selector: 0, interact: false, pause: false, selectedWeaponKey: key }, w.tick);
          }, shortcut);
          log({ assist: 'requested starting weapon while driving', weapon: o.weapon, level: e.level });
        } else await page.keyboard.press(`Digit${shortcut}`);
        await hold(300);
        const selected = await page.evaluate(() => { const w = window.__SS__!.getEntity(1)!.weapons!; return w[w.selectedSide].rack[w[w.selectedSide].index]?.id; });
        assert.equal(selected, o.weapon, 'requested carried weapon selected');
        log({ selectedCarriedWeapon: o.weapon, level: e.level, tick: e.tick });
      }
      // Wheel notches change radius by exp(.14). With the launcher the nearest
      // notch can miss 1.5 by > .02 and retries oscillate forever. Set this QA
      // framing explicitly through the camera API, using the equipped weapon's limits.
      const { camera, requestedZoom } = await page.evaluate(({ requested, strict }) => {
        const a = window.__SS__!, limits = a.getState().render.camera.zoomLimits;
        const requestedZoom = Math.max(limits[0], Math.min(limits[1], requested));
        if (!strict) a.camera.zoom(requestedZoom);
        return { camera: a.getState().render.camera, requestedZoom };
      }, { requested: o.zoom, strict: visibleOnly });
      if (!visibleOnly) assert.ok(!needsZoomInput(camera.targetZoom, requestedZoom), `Requested zoom ${requestedZoom}, observed target ${camera.targetZoom} (allowed ${camera.zoomLimits.join('–')}) in ${e.level}`);
      zoomed = true; log({ zoom: camera.zoom, targetZoom: camera.targetZoom, level: e.level });
    }
    if (e.level === 'L5' && e.step === 'emerge' && !e.player?.weapons.includes('weapon.shotgun')) {
      const shotgun = e.weaponPickups?.find(pickup => pickup.action === 'weapon.shotgun');
      if (shotgun) {
        log({ approachVisibleWeapon: shotgun.action, tick: e.tick });
        await walkTowardScreenPoint(shotgun.screen.x, shotgun.screen.y); await hold(200); continue;
      }
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
      if (e.step && !run.steps.some(s => s.id === e.step)) { ring = await markerRing(); ringKey = `${e.step}|${e.marker?.anchor}`; await hold(300); run.steps.push({ id: e.step, text: e.objective, tick: e.tick, marker: { anchor: e.marker?.anchor ?? null, ring, drawn: await drawnRing(), playerY: e.player?.y, pinVisible: await page.getByTestId('minimap-objective').isVisible().catch(() => false) || await page.getByTestId(`mission-pin-${e.step}`).isVisible().catch(() => false) } }); if (visibleOnly || process.env.PLAYTEST_SOFTLOCK_AUDIT === '1') await capture(`${e.level}-step-${e.step}`); }
      if (stuckLogged.size) bootWall = Date.now();
    }
    if (Date.now() - lastRingRead > 2000 && !(e.marker === null || !e.marker.visible)) { lastRingRead = Date.now(); const r = await markerRing(); if (r) ring = r; }
    if (`${e.step}|${e.marker?.anchor}` !== ringKey) { ring = await markerRing(); ringKey = `${e.step}|${e.marker?.anchor}`; log({ marker: e.marker?.anchor, ring }); }
    if (e.level === 'L10' && e.step === 'hold' && ring) cureConsole = { x: ring.x, z: ring.z };
    if (e.level === 'L10' && ['mega', 'release'].includes(e.step ?? '') && !cureConsole) {
      const console = await page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.world.missions!.def.anchors['cure-console']);
      cureConsole = { x: console.x, z: console.z };
      run.assists++; assist('L10 remembered arena landmark after resume', { ...cureConsole, input: 'physical WASD; read-only map landmark' });
    }
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
    if (e.level === 'L5' && e.step === 'look' && e.player) {
      if (l5SearchStop?.key.startsWith('explore:') && e.cue && !searchedL5Places.has(`heard:${e.cue.x}:${e.cue.z}`)) l5SearchStop = null;
      if (!l5SearchStop) {
        // Keep a heard, visible minimap cue after its short sound ping fades.
        // Otherwise every new decision loses the destination mid-approach.
        const cueKey = e.cue && `heard:${e.cue.x}:${e.cue.z}`;
        const next = plannedL5Search && l5Order
          ? l5Survivors.filter(s => !searchedL5Places.has(s.key)).sort((a, b) => l5Order.indexOf(a.key) - l5Order.indexOf(b.key))[0]
          : e.cue && cueKey && !searchedL5Places.has(cueKey)
          ? { key: cueKey, ringAt: [e.cue.x, e.cue.z], place: e.cue.text }
          : plannedL5Search ? l5Survivors.filter(s => !searchedL5Places.has(s.key)).sort((a, b) => Math.hypot(a.ringAt[0] - e.player!.x, a.ringAt[1] - e.player!.z) - Math.hypot(b.ringAt[0] - e.player!.x, b.ringAt[1] - e.player!.z))[0]
            : l5SearchStreets.filter(s => !searchedL5Places.has(s.key)).sort((a, b) => Math.hypot(a.ringAt[0] - e.player!.x, a.ringAt[1] - e.player!.z) - Math.hypot(b.ringAt[0] - e.player!.x, b.ringAt[1] - e.player!.z))[0];
        if (next) {
          l5SearchStop = { key: next.key, x: next.ringAt[0], z: next.ringAt[1] };
          if (next.key.startsWith('explore:')) {
            // Public map intersections can be covered by a wreck. Exploration
            // stops at the reachable street beside it; a heard survivor cue
            // keeps its exact authored discovery destination.
            const requested = { x: l5SearchStop.x, z: l5SearchStop.z };
            const reachable = await page.evaluate(({ player, goal }) => {
              const w = (window.__SCENE__ as unknown as { game: Game }).game.world, radius = w.entities.get(1)!.combat!.radius;
              const nav = w.infected!.nav.forPlayer(radius).withClearance(radius), path: number[] = [];
              const from = nav.nearestCell(player.x, player.z, radius);
              if (!nav.reachPath(from, goal, path, Infinity)) return null;
              const cell = path.at(-1) ?? from;
              return cell >= 0 ? { x: nav.x(cell), z: nav.z(cell) } : null;
            }, { player: e.player, goal: requested });
            if (!reachable) { searchedL5Places.add(next.key); l5SearchStop = null; log({ unreachableStreetExploration: requested, tick: e.tick }); continue; }
            if (Math.hypot(reachable.x - requested.x, reachable.z - requested.z) > .5) {
              run.assists++; assist('reachable public street exploration', { requested, reachable, input: 'physical WASD/mouse; read-only cloned street navigation' });
            }
            Object.assign(l5SearchStop, reachable);
          }
          l5SearchFound = Number(/Survivors found (\d+)\/5/.exec(e.tracker)?.[1] ?? 0);
          if (next.key.startsWith('heard:')) log({ heardL5Cue: { text: next.place, destination: l5SearchStop }, tick: e.tick });
          else if (next.key.startsWith('explore:')) log({ l5StreetExploration: l5SearchStop, tick: e.tick });
          else { run.assists++; assist('planned L5 map search', { place: next.place, destination: l5SearchStop, input: 'physical WASD + mouse/E; static authored map, no hidden survivor-state reads or world writes' }); }
        }
      }
      if (l5SearchStop) {
        ring = { ...l5SearchStop, y: 0 };
        if (Number(/Survivors found (\d+)\/5/.exec(e.tracker)?.[1] ?? 0) > l5SearchFound) {
          searchedL5Places.add(l5SearchStop.key); l5SearchStop = null; l5SearchArrived = 0;
          await press([]); continue;
        }
        if (Math.hypot(e.player.x - ring.x, e.player.z - ring.z) < 2) {
          if (l5SearchStop.key.startsWith('explore:')) {
            searchedL5Places.add(l5SearchStop.key); l5SearchStop = null;
            await press([]); continue;
          }
          if (!l5SearchArrived) {
            l5SearchArrived = Date.now();
            await releaseAim(); await press(['KeyE']); await hold(250); await press([]);
          }
          // The native reveal accepts standing by the door for one second.
          // Revisited places after checkpoint resume may already be empty.
          if (Date.now() - l5SearchArrived >= 1800) {
            searchedL5Places.add(l5SearchStop.key); l5SearchStop = null; l5SearchArrived = 0;
            await press([]); continue;
          }
        } else l5SearchArrived = 0;
      }
    }
    const observed=visibleProgress.update({context:`${e.level}|${e.step}|${e.checkpoint}|${run.deaths}`,text:e.tracker||e.objective,distance:e.distance,player:e.player,marker:ring,enemies:e.enemies.filter(body=>body.drawn),megaBand:e.level==='L10'&&e.step==='mega'?e.megaBand:null,tick:e.tick,nowMs:Date.now()});
    if(observed.reason) {
      lastProgress.tick=e.tick;lastProgress.wall=Date.now();lastProgress.best=e.distance??Infinity;
      log({visibleProgress:{tick:e.tick,text:e.objective,distance:e.distance,player:e.player?{x:e.player.x,z:e.player.z}:null,marker:ring,reason:observed.reason}});
    }
    if(Date.now()-lastObservation>=1000) {
      lastObservation=Date.now();log({observation:{tick:e.tick,step:e.step,checkpoint:e.checkpoint,menu:e.menu,text:e.objective,player:e.player?{x:e.player.x,z:e.player.z,hp:e.player.hp,weapon:e.player.current}:null,driving:e.driving,enemies:e.enemies.map(b=>({id:b.id,d:b.d,hp:b.hp,max:b.max,drawn:b.drawn,x:b.x,z:b.z})),...(e.level==='L6'?{allies:e.allies.filter(b=>b.drawn&&b.hp>0&&!b.corpse).map(b=>({id:b.id,x:b.x,z:b.z,hp:b.hp,kind:b.kind}))}:{}),marker:ring,noProgressSeconds:observed.seconds}});
      // r5-l7: read-only roster audit (following/dead/turned/boarded and the HUD follower alarm) for survivor-loss counts.
      if (e.level === 'L7' && process.env.PLAYTEST_L7_ROSTER_AUDIT === '1') log({ l7Roster: await page.evaluate(() => {
        const w = (window.__SCENE__ as unknown as { game: Game }).game.world, s = w.l7Encounters?.state, p = w.entities.get(1)!.transform;
        const live = s?.roster.filter(r => r.status === 'following') ?? [];
        return { level: w.scenario, tick: w.tick, following: live.length, dead: s?.roster.filter(r => r.status === 'dead').length, turned: s?.roster.filter(r => r.status === 'turned').length,
          near18: live.filter(r => { const f = w.entities.get(r.id); return f && Math.hypot(f.transform.x - p.x, f.transform.z - p.z) <= 18; }).length,
          boarded: w.l7Departure?.state.boarded.length ?? 0, departure: w.l7Departure?.state.phase, blockedBy: w.solids.blockingBody(1)?.id, move: { ...w.inputFrame.move },
          survivor: { variant: w.entities.get(1)!.survivor!.variant, gearTier: w.entities.get(1)!.survivor!.gearTier },
          followers: live.map(r => { const f = w.entities.get(r.id)!; return { id: r.id, x: f.transform.x, z: f.transform.z, hp: f.health.current, state: f.civilian?.state, knockedUntil: f.civilian?.knockedUntil, blockedBy: w.solids.blockingBody(f.id)?.id }; }),
          alarm: s?.alarm && w.tick < s.alarm.until ? s.alarm.text : null };
      }).catch(() => null) });
      if (e.level === 'L5' && process.env.PLAYTEST_METRO_AUDIT === '1') {
        const metro = await page.evaluate(() => {
          const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, s = w.missions!.state.l5!;
          const audit = window as unknown as { __metroTicks?: unknown[] };
          if (!audit.__metroTicks) {
            audit.__metroTicks = [];
            const mission = w.missions!;
            w.events.on('sim.tick', () => {
              if (w.missions !== mission || !s.metroAt) return;
              const door = mission.def.anchors['l5-metro-shutter'];
              audit.__metroTicks!.push({ tick: w.tick, metroAt: s.metroAt, shutterAt: s.shutterAt, doneAt: s.doneAt, phase: s.phase,
                gateOpen: mission.state.gates['l5-metro-shutter'], player: { ...w.entities.get(1)!.transform },
                companion: [...w.entities.iterate()].filter(e => e.companion).map(e => ({ transform: { ...e.transform }, hidden: e.hidden, state: structuredClone(e.companion), locomotion: structuredClone(e.locomotion) })),
                survivors: s.survivors.map(r => { const e = w.entities.get(r.id); return { key: r.key, status: r.status, transform: e && { ...e.transform }, inside: !!e && mission.l5!.insideStation(e.transform) && e.transform.z < door.z - 1 }; }) });
            }, 100);
          }
          return { tick: w.tick, phase: s.phase, metroAt: s.metroAt, shutterAt: s.shutterAt, text: w.missions!.l5!.metroStatus(), input: { effective: w.inputFrame, device: w.deviceInput }, player: { ...w.entities.get(1)!.transform },
            companion: [...w.entities.iterate()].filter(actor => actor.companion).map(actor => ({ transform: { ...actor.transform }, companion: actor.companion })),
            survivors: s.survivors.map(r => { const actor = w.entities.get(r.id)!; return { key: r.key, status: r.status, transform: { ...actor.transform }, ingress: w.missions!.l5!.ingress(actor), civilian: actor.civilian, locomotion: actor.locomotion }; }) };
        });
        log({ metro });
        const shot = metro.shutterAt ? 'closed' : metro.metroAt ? metro.tick - metro.metroAt >= 600 ? 'waiting-10s' : 'arrival' : null;
        if (shot && !metroShots.has(shot)) { metroShots.add(shot); await capture(`metro-${shot}`); }
      }
      if (e.level === 'L4' || process.env.PLAYTEST_COMBAT_AUDIT === '1' || process.env.PLAYTEST_COMPANION_TRACE === '1') {
        const damage = await page.evaluate(() => {
          const observation = window as unknown as { __playtestDamage?: unknown[] };
          return observation.__playtestDamage?.splice(0) ?? [];
        });
        if (damage.length) log({ damage });
        const controls = await page.evaluate(() => {
          const g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
          const p = g.world.entities.get(1)!;
          const runner = g.world.combat!.runner, side = runner.loadout.state.selectedSide, slot = runner.loadout.current(side);
          return { focus: document.activeElement?.tagName, focusElement: document.activeElement?.outerHTML.slice(0, 800), centreElement: document.elementFromPoint(640, 360)?.outerHTML.slice(0, 800),
            device: g.world.deviceInput, pointer: { held: g.input.pointer.isHeld(0), valid: g.input.pointer.valid }, keyboard: [...g.input.keyboard.pressed],
            pendingAdmission: p.pendingAdmission, storyLock: g.world.storyLock, inspection: g.inspect?.enabled, frame: g.world.inputFrame, staggerUntil: p.combat?.staggerUntil, attacks: (window as unknown as { __playtestAttacks: Record<string, number> }).__playtestAttacks,
            selected: side, slot, definition: runner.loadout.definition(slot.id), gunReady: runner.gunReady, intent: g.world.controls.snapshot() };
        });
        log({ controls: { tick: e.tick, keys: [...keysDown], visible: e.enemies.slice(0, 6).map(b => ({ id: b.id, d: b.d, archetype: b.archetype })), ...controls } });
      }

    }
    if (e.distance !== null && e.distance < lastProgress.best - 2) { lastProgress.best = e.distance; lastProgress.wall = Date.now(); }
    const stuckSim = observed.seconds, stuckWall = observed.seconds;
    run.maxNoProgressSeconds=Math.max(run.maxNoProgressSeconds,observed.seconds);
    if (e.player && e.player.hp < lastHp && e.player.hp <= 0) {
      run.deaths++;
      // Automatic checkpoint respawns release the game's device state too.
      // Keep the driver's held-key cache synchronized with that release.
      await press([]); await releaseAim(); l6GroupMemory.rear = null; log({ releasedInputAfterDeath: e.tick, level: e.level });
    }
    if (e.player && e.player.hp <= 0) { await releaseAim(); await press([]); lastHp = 0; await hold(120); continue; }
    lastHp = e.player?.hp ?? 0;
    await watchAllies(e);
    if (process.env.PLAYTEST_L5_GUARD_FIRST === '1' && !l5GuardDone && e.level === 'L5' && e.player) {
      const guard = await page.evaluate(() => {
        const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        const row = w.missions?.state.l5?.survivors.filter(r => r.foundAt > 0).sort((a, b) => a.foundAt - b.foundAt)[0];
        const actor = row && w.entities.get(row.id);
        return row && actor ? { tick: w.tick, foundAt: row.foundAt, id: row.id, status: row.status,
          hp: actor.health.current, at: { ...actor.transform }, playerHp: w.entities.get(1)!.health.current,
          deaths: w.missions!.state.stats.deaths, god: w.combat!.damage.god } : null;
      });
      if (guard) {
        if (!l5GuardStarted) { l5GuardStarted = true; log({ l5GuardStart: guard, policy: 'Stay within five metres for 30 sim seconds and use ordinary mouse fire; physical input only' }); await capture('l5-guard-start'); }
        if (guard.tick >= guard.foundAt + 1800 || guard.hp <= 0 || guard.status !== 'following') {
          l5GuardDone = true; log({ l5GuardResult: guard, protectedSeconds: (guard.tick - guard.foundAt) / 60 }); await capture('l5-guard-result');
        } else {
          if (Math.hypot(guard.at.x - e.player.x, guard.at.z - e.player.z) > 5) {
            const point = await page.evaluate(at => window.__SS__!.input.project(at, 'player'), guard.at);
            await press(wasdToward(e, point.x, point.y));
          } else {
            const engaged = await fight(e); await press([]); if (!engaged) await releaseAim();
          }
          await hold(120); continue;
        }
      }
    }
    // Retry qualification: walk into a visible attack and withhold attacks
    // until one ordinary mortal death, then resume the normal input policy.
    if (l6DeathExercise && e.level === 'L6' && e.player && (e.step === 'stop' || e.step === 'retreat')) {
      const deaths = await page.evaluate(() => window.__SS__!.missions.state()!.stats.deaths);
      if (deaths === 0) {
        await releaseAim();
        const threat = e.enemies.find(body => body.drawn && body.hp > 0 && !body.corpse);
        await press(threat && threat.d > 1.3 ? wasdToward(e, threat.screen.x, threat.screen.y) : []);
        log({ fixture: 'mortal-death-by-input', tick: e.tick, hp: e.player.hp, target: threat?.id });
        await hold(250); continue;
      }
      l6DeathExercise = false; l6GroupMemory.rear = null;
      log({ fixture: 'mortal-death-by-input-complete', tick: e.tick, deaths });
    }

    if (l10DeathExercise && e.level === 'L10' && e.player && e.step === 'mega') {
      const deaths = await page.evaluate(() => window.__SS__!.missions.state()!.stats.deaths);
      if (deaths === 0) {
        if (!l10Mortal) { await page.evaluate(() => window.__SS__!.cheats.god(false)); l10Mortal = true; }
        await releaseAim();
        const threat = e.enemies.find(body => body.drawn && body.hp > 0 && !body.corpse);
        await press(threat && threat.d > 1.3 ? wasdToward(e, threat.screen.x, threat.screen.y) : []);
        log({ fixture: 'l10-mortal-checkpoint-death', tick: e.tick, hp: e.player.hp, target: threat?.id });
        await hold(250); continue;
      }
      l10DeathExercise = false;
      await page.evaluate(() => window.__SS__!.cheats.god(true));
      log({ fixture: 'l10-mortal-checkpoint-restored', tick: e.tick, deaths, player: e.player });
    }

    if (l10PullAway && e.level === 'L10' && e.step === 'mega' && e.player && cureConsole) {
      const goal = { x: cureConsole.x - 110, z: cureConsole.z, y: e.player.y };
      await releaseAim();
      if (Math.hypot(e.player.x - goal.x, e.player.z - goal.z) < 3) {
        l10PullAway = false; await press([]);
        log({ fixture: 'l10-arena-pull-complete', tick: e.tick, player: e.player, goal });
      } else {
        const screen = await page.evaluate(({ p, goal }) => [window.__SS__!.input.project(p, 'player'), window.__SS__!.input.project(goal, 'player')], { p: e.player, goal });
        await press(markerWalkKeys(screen[1].x - screen[0].x, screen[1].y - screen[0].y, (stairFrame++ % 12) / 12));
      }
      await hold(150); continue;
    }
    const watchingEnding = e.level === 'L10' && (e.ending || /Watch the cure spread|Minor Incident/.test(e.objective));
    if(o.noSkip&&observed.seconds>=90&&!watchingEnding) {
      await issue('P0','cannot-finish',`No visible progress for ${observed.seconds.toFixed(1)} s; stopping without advancing the objective`);
      log({abortedNoSkip:true,level:e.level,tick:e.tick,step:e.step});break;
    }
    // Stuck ladder: 20 s confusion (issue), 60 s try E, 120 s state assist, levelMinutes cap → skip step.
    // The HUD distance can point at a moving guidance waypoint (L3 l3-route); the ring itself decides "at the ring".
    const ringDist = ring && e.player ? Math.hypot(ring.x - e.player.x, ring.z - e.player.z) : e.distance;
    const consoleAction = e.level === 'L10' && (e.step === 'hold' || e.step === 'release');
    const atRing = ringDist !== null && ringDist < (consoleAction ? 2 : 4);
    if (stuckSim > 20 && stuckWall > 20 && !watchingEnding) {
      const tag = `${key}|${atRing ? 'ring' : 'nav'}`;
      if (!stuckLogged.has(tag)) { stuckLogged.add(tag); await issue('P2', atRing ? 'stuck-at-ring' : 'stuck-navigating', `${Math.round(stuckSim)} s without objective progress ${atRing ? `standing at the ring (${e.distance?.toFixed(1)} m)` : `(distance ${e.distance?.toFixed(1) ?? 'none'} m, no marker: ${!e.marker?.visible})`}; HUD: "${e.tracker}"`); }
    }
    if (Date.now() > levelDeadline() || stuckSim > 420) {
      const mandatory = e.level === 'L9' || isMandatoryBossObjective(e.level, e.step ?? null);
      await issue('P0', 'cannot-finish', `Driver could not finish step ${e.step} ("${e.objective}") after ${Math.round(stuckSim)} s on it (${o.levelMinutes} min level cap: ${Date.now() > levelDeadline()}); ${o.noSkip || mandatory?'stopping without advancing the objective':'skipping it with the debug objective cheat'}`);
      if(o.noSkip) { log({ abortedNoSkip:true, level:e.level, tick:e.tick, step:e.step }); break; }
      if (e.level === 'L9') {
        await issue('P0', 'mandatory-crossing-stalled', 'The crossing must finish its real crash and crawl before handover; stopping instead of skipping the sequence');
        break;
      }
      // The L10 Mega is a mandatory kill. Completing its objective in debug mode
      // leaves the living boss active, so it kills the courier during the cure
      // step and the mission returns to mega forever. Fail this run explicitly.
      if (isMandatoryBossObjective(e.level, e.step ?? null)) {
        await issue('P0', 'mandatory-boss-stalled', 'The Mega Alpha cannot be skipped safely; stopping instead of advancing with the boss alive');
        log({ abortedMandatoryBoss: true, level: e.level, tick: e.tick, step: e.step }); break;
      }
      run.skipped.push(e.step ?? '?'); assist('skip-step', { step: e.step });
      await page.evaluate(id => window.__SS__!.cheats.completeObjective(id ?? undefined), e.step);
      wallStart = Math.max(wallStart, Date.now() - (o.levelMinutes - 4) * 60_000);
      lastProgress.tick = e.tick; lastProgress.wall = Date.now();
      await hold(500); continue;
    }

    // Cover visible walkers before advancing to the next retreat ring.
    if (e.player) {
      const clearance = escortClearance.sample(e.level, e.step, e.player, ring, e.allies, observed.seconds);
      if (clearance && !e.enemies.some(b => b.d < 3)) {
        await releaseAim();
        if (Math.hypot(clearance.x - e.player.x, clearance.z - e.player.z) > .5) {
          const points = await page.evaluate(({ p, goal }) => [window.__SS__!.input.project(p, 'player'), window.__SS__!.input.project(goal, 'player')], { p: e.player, goal: clearance });
          await press(markerWalkKeys(points[1].x - points[0].x, points[1].y - points[0].y, (stairFrame++ % 12) / 12));
        } else await press([]);
        if (Date.now() - navLog > 3000) { navLog = Date.now(); log({ visibleEscortClearance: clearance, tick: e.tick }); }
        await hold(200); continue;
      }
      const coverRear = e.level === 'L6' && e.step === 'retreat' && /Stay with the group|cover the rear|group waits/i.test(e.objective);
      // The visible column keeps walking at 2.2 m/s while the courier covers it.
      // Advance its remembered track position while covering. The explicit
      // group-waits instruction means the column is paused. Stay with the
      // group instead means the courier strayed; the column keeps walking.
      const rememberedRear = l6GroupMemory.rear && { x: Math.min(263, l6GroupMemory.rear.x + (/group waits|Bring the injured/i.test(e.objective) ? 0 : 2.2 * Math.max(0, e.tick - l6GroupMemory.rear.tick) / 60)), z: l6GroupMemory.rear.z };
      const groupTarget = coverRear && rememberedRear ? { x: rememberedRear.x + 3, z: rememberedRear.z }
        // A repeated bark can outlive the missing-member condition. Follow
        // the objective's actual group check instead of turning back when it
        // already says everyone is nearby (or while boarding owns the group).
        : e.level === 'L7' && e.step === 'corridor' && /Waiting for a survivor/.test(e.objective) && e.followerWarning && e.cue ? e.cue : visibleGroupTarget(e.level, e.player, e.allies, 8, e.step);
      if (e.level === 'L6' && e.step === 'exit' && ring && !e.enemies.some(b => b.d < 3)
        && (!groupTarget || Math.hypot(groupTarget.x - ring.x, groupTarget.z - ring.z) < ringDist!)) {
        // The exit is above two visible stair runs. Clipped ground clicks can
        // lead into their gap; walk the visible bearing from the approach,
        // retaining small lateral corrections instead of rounding to 45°.
        const points = await page.evaluate(({ p, goal }) => {
          const a = window.__SS__!;
          return [a.input.project(p, 'player'), a.input.project(goal, 'player')];
        }, { p: e.player, goal: ring });
        const keys = markerWalkKeys(points[1].x - points[0].x, points[1].y - points[0].y, (stairFrame++ % 12) / 12);
        await releaseAim(); await press(keys); await hold(180);
        if (stairFrame % 12 === 1) log({ visibleStairWalk: e.tick, keys });
        continue;
      }
      if (groupTarget && !(e.level === 'L6' && e.step === 'retreat' && e.player.weapons.includes('weapon.army-mg') && e.enemies.some(b => b.drawn && b.hp > 0 && b.d < 16))) {
        if (e.level === 'L6') {
          const points = await page.evaluate(({ p, goal }) => {
            const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
            const out = { ...goal };
            w.infected!.nav.forPlayer(.45).steer(p, goal, { path: [], goal: -1, pathIndex: 0 }, .45, out, Infinity, true);
            return [a.input.project(p, 'player'), a.input.project(out, 'player')];
          }, { p: e.player, goal: groupTarget });
          await releaseAim(); await press(markerWalkKeys(points[1].x - points[0].x, points[1].y - points[0].y, (stairFrame++ % 12) / 12)); await hold(150); continue;
        }
        const screen = await page.evaluate(at => window.__SS__!.input.project(at, 'destination'), groupTarget);
        const sp = safe(screen.x, screen.y, e); await walkTowardScreenPoint(sp.x, sp.y); await hold(150); continue;
      }
    }
    if (l10ConsoleWalk >= 0 && e.level === 'L10' && e.step === 'release' && e.player) {
      // Placement diagnostic: walk up the visible gun stair, across its deck,
      // and off the corner toward the console. All movement remains WASD.
      const console = cureConsole;
      if (console) {
        const points = [[1.5, -6], [-.2, -6], [-4.5, -6], [-4.5, -4.7], [0, 0], [-1.5, 3], [3, 3], [2, 0]];
        const point = points[l10ConsoleWalk];
        if (point) {
          const goal = { x: console.x - 2 + point[0], z: console.z + point[1], y: e.player.y };
          await releaseAim();
          const distance = Math.hypot(e.player.x - goal.x, e.player.z - goal.z);
          const groundedBesideConsole = l10ConsoleWalk === 4 && distance < 1.5 && e.player.y < 1.2;
          if (distance < .35 || groundedBesideConsole) {
            if (l10ConsoleWalk === 2 && e.player.y < 3.5) throw new Error('Console placement diagnostic did not climb the gun platform');
            log({ fixture: 'l10-console-walk-point', point: l10ConsoleWalk++, groundedBesideConsole, player: e.player, tick: e.tick });
            await press([]);
          } else {
            const screen = await page.evaluate(({ p, goal, approach }) => {
              const a = window.__SS__!, out = { ...goal };
              if (approach) (window.__SCENE__ as unknown as { game: Game }).game.world.infected!.nav.forPlayer(.45).steer(p, goal, { path: [], goal: -1, pathIndex: 0 }, .45, out, 20000, true);
              return [a.input.project(p, 'player'), a.input.project(out, 'player')];
            }, { p: e.player, goal, approach: l10ConsoleWalk === 0 });
            await press(dodgeWalkKeys(screen[1].x - screen[0].x, screen[1].y - screen[0].y));
          }
          await hold(50); continue;
        }
        log({ fixture: 'l10-console-walk-finished', player: e.player, tick: e.tick });
        await capture('L10-console-walk-finished'); l10ConsoleWalk = -1;
      }
    }
    // The explicit console action takes priority over nearby combat. Charge and
    // release require a fresh E press, which a held attack must not starve.
    if (e.level === 'L10' && (e.prompt.includes('console action') || e.step === 'release' && atRing && /Release the cure/.test(e.objective)) && Date.now() - lastE > 2500) {
      lastE = Date.now(); await press([]); await releaseAim();
      await page.keyboard.down('KeyE'); await hold(1400); await page.keyboard.up('KeyE');
      log({ prompt: e.prompt, tick: e.tick }); continue;
    }
    if (e.level === 'L6' && e.step === 'retreat' && e.player?.weapons.includes('weapon.army-mg')) {
      l6CrowdUntil = 0;
      const targets = e.enemies.filter(b => b.drawn && b.hp > 0 && b.d < 16);
      const threat = targets.find(b => b.attacking && e.allies.some(a => a.drawn && a.hp > 0 && !a.corpse && Math.hypot(a.x - b.x, a.z - b.z) < 3)) ?? targets[0];
      if (threat) {
        // Follow the visible station stairs into the track before heading along
        // it. Pure backpedalling from each nearest body circles in the shelter.
        const group = e.allies.filter(a => a.drawn && a.hp > 0 && !a.corpse && a.kind !== 'companion');
        const groupX = group.length ? Math.min(...group.map(a => a.x)) : l6GroupMemory.rear ? Math.min(263, l6GroupMemory.rear.x + (/group waits|Bring the injured/i.test(e.objective) ? 0 : 2.2 * Math.max(0, e.tick - l6GroupMemory.rear.tick) / 60)) : e.player.x;
        const goal = e.player.x < 25 && e.player.z < 13.8 ? { x: 6, z: 15 }
          : ring && /Everyone through|Let everyone pass|group waits/i.test(e.objective) && Math.hypot(e.player.x - ring.x, e.player.z - ring.z) < 8 ? ring
          : e.player.x > groupX + 6 ? { x: e.player.x, z: 15 }
          : { x: Math.min(263, e.player.x + 16), z: 15 };
        const points = await page.evaluate(({ p, goal }) => {
          const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
          const out = { ...goal };
          w.infected!.nav.forPlayer(.45).steer(p, goal, { path: [], goal: -1, pathIndex: 0 }, .45, out, Infinity, true);
          return [a.input.project(p, 'player'), a.input.project(out, 'player')];
        }, { p: e.player, goal });
        const keys = Math.hypot(goal.x - e.player.x, goal.z - e.player.z) < .8 ? [] : markerWalkKeys(points[1].x - points[0].x, points[1].y - points[0].y, (stairFrame++ % 12) / 12);
        if (!l6RetreatRouteLogged) { l6RetreatRouteLogged = true; run.assists++; assist('L6 retreat map route', { via: 'station stairs (6,15), then the track', input: 'physical WASD + mouse, no world writes' }); }
        // Keyboard fire auto-aims along the movement cone. On a retreat that
        // points away from the pursuers; use the same cursor aim as the hold.
        if (e.player.current !== 'weapon.army-mg') {
          await press([]); await releaseAim(); await page.keyboard.press('Digit5'); await hold(100); continue;
        }
        await press(keys); await page.mouse.move(threat.aim.x, threat.aim.y);
        if (aimHeld === null) await page.mouse.down();
        aimHeld = threat.id; await hold(150); continue;
      }
    }
    if (e.level === 'L6' && e.enemies.filter(b => b.d < 1.8).length >= 3) l6CrowdUntil = Date.now() + 650;
    const weapon = e.player && (e.level === 'L6' && Date.now() < l6CrowdUntil && e.player.weapons.includes('weapon.fire-axe') ? 'weapon.fire-axe' : o.weapon && e.player.weapons.includes(o.weapon)
      ? o.weapon
      : campaignCombatWeapon(e.level, e.player.weapons, e.player.emptyWeapons));
    const shortcut = weapon && weaponKey(weapon);
    if (weapon && shortcut && e.player?.current !== weapon) {
      await press([]); await releaseAim();
      await page.keyboard.press(`Digit${shortcut}`); await hold(300);
      log({ selectedCarriedWeapon: weapon, level: e.level, tick: e.tick }); continue;
    }
    const marketEscape = e.level === 'L2' && e.step === 'bridge';
    const marketCrowd = marketEscape && e.enemies.filter(b => b.d < 4).length >= 3;
    // The L7 launcher is a required pickup before the corridor horde. A nearby
    // fight used to pre-empt the objective route and leave the courier firing
    // the army gun at the truck while the launcher sat three metres away.
    const l7Launcher = e.level === 'L7' && !e.player?.weapons.includes('weapon.rocket-launcher')
      ? e.weaponPickups?.find(pickup => pickup.action === 'weapon.rocket-launcher') : undefined;
    if (l7Launcher) {
      await releaseAim();
      const keys = wasdToward(e, l7Launcher.screen.x, l7Launcher.screen.y);
      await press(keys);
      await hold(150);
      continue;
    }
    // Keep the escape route in charge even between dense crowds. Chasing each
    // recovering straggler could pull the driver to the map edge indefinitely.
    if (!marketEscape && await fight(e)) { await hold(120); continue; }
    if (e.driving) {
      if (e.level === 'L9' && l9Path) {
        if (!l9RouteLogged) { l9RouteLogged = true; run.assists++; assist('L9 authored map route', { route: o.l9Route ?? 'open crossing clearance waypoints', input: 'physical WASD; no world writes', waypoints: l9Path }); }
        const car = e.driving;
        while (l9Waypoint < l9Path.length - 1) {
          const a = l9Path[l9Waypoint - 1], b = l9Path[l9Waypoint], c = l9Path[l9Waypoint + 1];
          const angle = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]);
          const turn = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
          const passed = (car.x - b[0]) * (b[0] - a[0]) + (car.z - b[1]) * (b[1] - a[1]) > 0 &&
            Math.abs((car.x - b[0]) * (b[1] - a[1]) - (car.z - b[1]) * (b[0] - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]) < 18;
          if (!passed && Math.hypot(b[0] - car.x, b[1] - car.z) >= 6 + 10 * Math.min(1, turn / (Math.PI / 2))) break;
          l9Waypoint++;
        }
        const goal = l9Path[l9Waypoint], want = -Math.atan2(goal[1] - car.z, goal[0] - car.x);
        const delta = Math.atan2(Math.sin(want - car.yaw), Math.cos(want - car.yaw));
        const recovery = vehicleRecovery.keys(car, Date.now());
        await press(recovery ?? ['KeyW', ...(Math.abs(delta) > .08 ? [delta > 0 ? 'KeyD' : 'KeyA'] : [])]);
      } else if (ring) await drive(e, ring); else await press([]);
      await hold(120); continue;
    }

    if (!visibleOnly && e.level === 'L2' && e.step === 'bridge' && e.player) {
      // Use the known Main Row → Juniper → Elm street walk. Repeated clicks toward a distant
      // bridge pin cut into fenced backyards; this is map-based steering through real keys,
      // with combat, all objectives and the final gate interaction still live.
      const route = l2Routes.direct;
      if (!marketWalkLogged) { marketWalkLogged = true; run.assists++; assist('nav-route', { route: 'Main Row → Juniper → Elm → bridge', input: 'physical WASD; no objective or world writes' }); }
      if (marketLastPosition && Math.hypot(e.player.x - marketLastPosition.x, e.player.z - marketLastPosition.z) > 8) {
        marketWaypoint = route.reduce((best, p, i) => Math.hypot(e.player!.x - p.x, e.player!.z - p.z) < Math.hypot(e.player!.x - route[best].x, e.player!.z - route[best].z) ? i : best, 0);
      }
      marketLastPosition = { x: e.player.x, z: e.player.z };
      while (marketWaypoint < route.length - 1 && Math.hypot(e.player.x - route[marketWaypoint].x, e.player.z - route[marketWaypoint].z) < 2.5) marketWaypoint++;
      const goal = route[marketWaypoint];
      const points = await page.evaluate(({ p, goal }) => {
        const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        const out = { x: goal.x, z: goal.z };
        // The same player navigation used by routed movement locates the street around parked cars.
        w.infected?.nav.steer(p, goal, { path: [], goal: -1, pathIndex: 0 }, .45, out, Infinity, true);
        // A distant point behind the close camera reverses its projection.
        // Preserve the route bearing using a nearby point, as nav-follow does.
        const scale = Math.min(1, 4 / (Math.hypot(out.x - p.x, out.z - p.z) || 1));
        out.x = p.x + (out.x - p.x) * scale; out.z = p.z + (out.z - p.z) * scale;
        return [a.input.project(p, 'player'), a.input.project(out, 'player')];
      }, { p: e.player, goal });
      await releaseAim();
      const keys = wasdToward(e, e.view.w / 2 + points[1].x - points[0].x, e.view.h / 2 + points[1].y - points[0].y);
      if (marketCrowd && e.player.weapons.includes('weapon.fire-axe')) {
        const enemy = e.enemies.find(b => b.d < 3);
        if (enemy) { await page.mouse.move(enemy.screen.x, enemy.screen.y); keys.push('KeyJ'); }
      }
      if (Math.hypot(e.player.x - navPos.x, e.player.z - navPos.z) > .6) navPos = { x: e.player.x, z: e.player.z, wall: Date.now() };
      if (Date.now() - navPos.wall > 3000) {
        const sides = [['KeyW'], ['KeyD'], ['KeyS'], ['KeyA']]; sideStep = (sideStep + 1) % sides.length;
        await press(sides[sideStep]); await hold(500); navPos.wall = Date.now();
        log({ marketStreetBlocked: marketWaypoint, tick: e.tick });
      }
      await press(keys);
      await hold(180);
      if (Date.now() - navLog > 3000) { navLog = Date.now(); log({ marketStreetWalk: marketWaypoint, goal, tick: e.tick }); }
      continue;
    }

    // Escort the person we just fetched, rather than running to the bring ring and leaving them out of view.
    // Only drawn allies update this remembered position; losing sight sends us back to where we last saw them.
    if (escort && e.player) {
      const seen = e.allies.find(b => b.id === escort!.id && b.drawn && b.hp > 0 && !b.corpse);
      if (!seen || seen.d > 4) {
        await press([]);
        if (Date.now() - lastClick > 700) {
          const s = await page.evaluate(at => window.__SS__!.input.project(at, 'destination'), { x: escort.x, z: escort.z });
          const sp = safe(s.x, s.y, e); await walkTowardScreenPoint(sp.x, sp.y); lastClick = Date.now();
          log({ escortWait: escort.id, at: { x: escort.x, z: escort.z }, tick: e.tick });
        }
        await hold(150); continue;
      }
    }

    if (!o.noSkip && stuckSim > 120 && stuckWall > 60 && !assistMode) {
      assistMode = true; run.assists++;
      const truth = await page.evaluate(() => { const a = window.__SS__!, m = a.missions.state()!; return { marker: m.marker, states: m.states, counters: m.counters, checkpoint: m.checkpoint }; });
      assist('state-locate', { why: `stuck ${Math.round(stuckSim)} s`, truth });
      await issue('P1', 'hidden-condition', `Stuck ${Math.round(stuckSim)} s on "${e.objective}"; read mission state to locate the blocker: ${JSON.stringify(truth).slice(0, 400)}`);
    }
    let g = await goalScreen(e);
    if (e.level === 'L5' && e.step === 'look' && l5SearchStop && ring) g = await page.evaluate(p => window.__SS__!.input.project(p, 'destination'), ring);
    if (stuckSim > 60 && (atRing || !g) && Date.now() - lastE > 4000) { lastE = Date.now(); await press([]); await page.keyboard.down('KeyE'); await hold(1600); await page.keyboard.up('KeyE'); continue; }
    // Prompts near the objective (or naming it) get E; side prompts (push a dumpster) are ignored like a player would.
    const relevant = e.prompt && !/^push\b/i.test(e.prompt) && (atRing || (e.distance !== null && e.distance < 6) || /pick|take|grab|open|bar|unbar|play|pack|install|release|board|enter|recover|console|activate/i.test(e.prompt));
    if (relevant && Date.now() - lastE > 2500) { lastE = Date.now(); log({ prompt: e.prompt, tick: e.tick }); await press([]); await page.keyboard.down('KeyE'); await hold(1400); await page.keyboard.up('KeyE'); continue; }
    if (!g && !e.marker?.visible) {
      // No ring/arrow: follow what the minimap shows (L5 "Search <place>" cue pin, or the active step's pin).
      const pin = await page.evaluate(strict => {
        if (strict) {
          const cue = document.querySelector<HTMLElement>('[data-survivor]:not([hidden])');
          const p = window.__SS__!.getEntity(1)?.transform;
          return cue && cue.offsetParent !== null && p ? { x: Number(cue.dataset.worldX), y: p.y, z: Number(cue.dataset.worldZ), from: cue.getAttribute('aria-label') ?? 'visible minimap cue' } : null;
        }
        const lab = window.__SCENE__ as unknown as { game?: { world: { entities: Map<number, { transform: { x: number; z: number } }>; missions?: { def: { anchors: Record<string, { x: number; z: number; y?: number }>; steps: { id: string; anchor: string; waypoint?: boolean }[] }; state: { steps: Record<string, { status: string }>; l5?: { phase: string; survivors: { key: string; status: string }[] } } } } } } | undefined;
        const m = lab?.game?.world.missions, p = lab?.game?.world.entities.get(1)?.transform; if (!m || !p) return null;
        const cue = document.querySelector<HTMLElement>('[data-survivor]:not([hidden])');
        if (m.state.l5 && cue) { const a = m.def.anchors[`l5-ring-${cue.dataset.survivor}`]; return a ? { x: a.x, y: a.y ?? 0, z: a.z, from: `minimap cue ${cue.getAttribute('aria-label')}` } : null; }
        const step = m.def.steps.find(s => m.state.steps[s.id]?.status === 'active' && s.waypoint !== false);
        const pinEl = step && document.querySelector<HTMLElement>(`[data-testid="mission-pin-${step.id}"]:not([hidden])`);
        if (step && pinEl) { const a = m.def.anchors[step.anchor]; return a ? { x: a.x, y: a.y ?? 0, z: a.z, from: `minimap pin ${step.id}` } : null; }
        return null;
      }, visibleOnly);
      if (pin) {
        const changed = !ring || Math.hypot(ring.x - pin.x, ring.z - pin.z) > .5;
        ring = { x: pin.x, y: pin.y, z: pin.z };
        // A new pin: re-evaluate distances against it on the next pass.
        if (changed) { log({ pinGoal: pin, tick: e.tick }); await press([]); continue; }
        // Cue pins use the same movement and stalled-route recovery as an
        // objective arrow. Repeated nearby clicks must not bypass that recovery.
        g = await page.evaluate(q => window.__SS__!.input.project(q, 'destination'), ring);
      } else { await press([]); await hold(200); continue; }
    }
    const arrived = atRing && ringDist! < 1.2;
    // WASD progress is stalled: the player is lost. Locate via the game's nav grid toward the ring and walk it with WASD (logged).
    const moved = e.player ? Math.hypot(e.player.x - lastPos.x, e.player.z - lastPos.z) : 0;
    if (moved > 2.5 && e.player) { lastPos = { x: e.player.x, z: e.player.z, wall: Date.now() }; }
    // Once lost, keep walking the located route for at least 20 s (clicks led back into the same trap otherwise).
    // Far rings: walk the street route (the nav grid stands in for the player's map sense); clicks take over within 25 m.
    const far = !visibleOnly && ringDist !== null && ringDist > 25;
    const stalled = far || (Date.now() - lastPos.wall) / 1000 > 10 || stuckWall > 30 || Date.now() < navUntil;
    const l4Route = e.level === 'L4' && e.step === 'hide' && !!e.route;
    if ((e.level === 'L10' && visibleOnly || l4Route) && !atRing && ring && e.player && Date.now() - lastPos.wall > 3000) {
      // A raised marker can make repeated ground clicks stop on the stair edge.
      // Project both visible positions onto the courier's current floor and
      // walk toward the marker with physical keys, without reading navigation.
      const points = await page.evaluate(({ p, goal }) => {
        const a = window.__SS__!;
        return [a.input.project(p, 'player'), a.input.project(goal, 'player')];
      }, { p: e.player, goal: l4Route
        ? { x: e.player.x + e.route!.dx, z: e.player.z + e.route!.dz } : ring });
      const dx = points[1].x - points[0].x, dy = points[1].y - points[0].y;
      // L4 hide route: follow the floor-relative minimap route; elsewhere rotate the bearing so a blocked one is not repeated.
      const keys = e.route ? wasdToward(e, e.view.w / 2 + dx, e.view.h / 2 + dy) : dodgeWalkKeys(dx, dy, unstickDir++);
      await releaseAim(); await press(keys); await hold(e.route && Math.hypot(e.route.dx, e.route.dz) < 4 ? 250 : 700); await press([]);
      log({ visibleMarkerUnstick: e.tick, keys, guidance: e.marker?.guidance, arrow: e.marker && { x: e.marker.x, y: e.marker.y } }); continue;
    }
    // Being within the four-metre observation band is not arrival. The L1
    // fire-bay lip can still need a detour three metres from the trigger;
    // suppressing route recovery there leaves the blocked bearing unrecovered.
    if ((e.level !== 'L10' || !visibleOnly) && stalled && !arrived && ring && e.player) {
      if (visibleOnly) {
        const points = await page.evaluate(({ p, goal }) => [window.__SS__!.input.project(p, 'player'), window.__SS__!.input.project(goal, 'player')], { p: e.player, goal: ring });
        if (Math.hypot(e.player.x - navPos.x, e.player.z - navPos.z) > .6) navPos = { x: e.player.x, z: e.player.z, wall: Date.now() };
        const blocked = Date.now() - navPos.wall > 2500;
        const keys = blocked ? dodgeWalkKeys(points[1].x - points[0].x, points[1].y - points[0].y, ++unstickDir) : markerWalkKeys(points[1].x - points[0].x, points[1].y - points[0].y, (stairFrame++ % 12) / 12);
        await releaseAim(); await press(keys); await hold(blocked ? 800 : 250);
        if (blocked) { navPos.wall = Date.now() - 1000; log({ visibleDetour: keys, tick: e.tick }); }
        continue;
      }
      if (!navAssist) { navAssist = true; if (!far) navEpisodes++; navUntil = navEpisodes >= 2 ? Infinity : Date.now() + 20_000; if (!far) run.assists++; assist(far ? 'nav-follow' : 'nav-locate', { from: { x: e.player.x, z: e.player.z }, ring, distance: e.distance }); }
      const step = await page.evaluate(({ goal }) => {
        const w = (window.__SCENE__ as unknown as { game?: Game })?.game?.world, player = w?.entities.get(1);
        if (!w?.infected || !player) return null;
        // Route the physical player capsule, not the wider crowd bake. The
        // crowd grid can return a nearest stop on this side of a frontage even
        // though the player's street route reaches the requested destination.
        const p = player.transform, radius = player.combat?.radius ?? .3, nav = w.infected.nav.forPlayer(radius);
        const out = { x: 0, z: 0 }, route = { path: [] as number[], goal: -1, pathIndex: 0 };
        if (!nav.steer(p, goal, route, radius, out, Infinity, true)) return null;
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
      const s = safe(g.x, g.y, e); await walkTowardScreenPoint(s.x, s.y); lastClick = Date.now();
    } else if (arrived) await press([]);
    await hold(150);
  }
  await press([]).catch(() => undefined);
  if (run && !run.finished) {
    const finalView = await see();
    run.wallSeconds = Math.round((Date.now() - wallStart) / 1000);
    run.simSeconds = Math.round((finalView.tick - tickStart) / 60);
    run.weaponsEnd = finalView.player?.weapons ?? [];
  }
  writeFileSync(join(o.out, `runs-${o.tag}.json`), JSON.stringify(runs, null, 2));
  if (process.env.PLAYTEST_COMPANION_TRACE === '1') {
    writeFileSync(join(o.out, `${o.tag}-companion-trace.json`), JSON.stringify(await page.evaluate(() => (window as unknown as { __playtestCompanionTrace?: unknown[] }).__playtestCompanionTrace ?? []), null, 2));
    writeFileSync(join(o.out, `${o.tag}-escort-events.json`), JSON.stringify(await page.evaluate(() => (window as unknown as { __playtestEscortEvents?: unknown[] }).__playtestEscortEvents ?? []), null, 2));
  }
  writeFileSync(join(o.out, `issues-${o.tag}.json`), JSON.stringify(issues, null, 2));
  if (process.env.PLAYTEST_SOFTLOCK_AUDIT === '1') writeFileSync(join(o.out, `${o.tag}-softlocks.json`), JSON.stringify(await page.evaluate('window.__softlockAudit ?? []')));
  if (process.env.PLAYTEST_METRO_AUDIT === '1') writeFileSync(join(o.out, `metro-ticks-${o.tag}.json`), JSON.stringify(await page.evaluate('window.__metroTicks ?? []')));
  let handoverReady=true;
  if(process.env.PLAYTEST_HANDOVER_AUDIT==='1') {
    const audit=await page.evaluate('window.__playtestHandoverAudit') as {elapsedMs:number;text:string;pin:boolean;marker:boolean;breached:boolean}[];
    writeFileSync(join(o.out,`handover-audit-${o.tag}.json`),JSON.stringify(audit,null,2));
    const calm=audit.filter(s=>!s.breached);
    handoverReady=calm.length>0&&calm[0].elapsedMs<=2000&&calm.every(s=>!s.text.trim()&&!s.pin&&!s.marker);
  }
  if (cpu) {
    const cpuEndedAt = await page.evaluate(() => performance.now());
    const { profile } = await cpu.send('Profiler.stop');
    writeFileSync(join(o.out, `${o.tag}.cpuprofile`), JSON.stringify({ ...profile, performanceStartedAt: cpuStartedAt, performanceEndedAt: cpuEndedAt, performanceNavigationStartMs: cpuNavigationStartMs })); await cpu.detach();
  }
  if (cpu || shaderGuard) {
    writeFileSync(join(o.out, `${o.tag}-clicks.json`), JSON.stringify(await page.evaluate(() => (window as unknown as { __playtestClicks: unknown[] }).__playtestClicks), null, 2));
    writeFileSync(join(o.out, `${o.tag}-builds.json`), JSON.stringify(await page.evaluate(() => (window as unknown as { __playtestBuilds: unknown[] }).__playtestBuilds), null, 2));
    writeFileSync(join(o.out, `${o.tag}-inputs.json`), JSON.stringify(await page.evaluate(() => (window as unknown as { __playtestInputs: unknown[] }).__playtestInputs)));
  }
  const longFrames = await page.evaluate(() => (window as unknown as { __playtestFrames: LongFrame[] }).__playtestFrames);
  if (process.env.PLAYTEST_ACCEPTANCE_LEDGER === '1') {
    writeFileSync(join(o.out, `${o.tag}-acceptance-ledger.json`), JSON.stringify(await page.evaluate('window.__acceptanceInputLedger ?? []'), null, 2));
    writeFileSync(join(o.out, `${o.tag}-audio.json`), JSON.stringify({ browserOutputMuted: cueAudio, ...await page.evaluate(() => window.__SS__!.audio.snapshot()) }, null, 2));
  }
  if (process.env.PLAYTEST_THREAT_AUDIT === '1') writeFileSync(join(o.out, `${o.tag}-threat.json`), JSON.stringify(await page.evaluate('window.__threatPlaytestAudit')));
  if (visibleOnly) writeFileSync(join(o.out, `${o.tag}-audit.json`), JSON.stringify(await page.evaluate('window.__finalE2eAudit ?? []'), null, 2));
  writeFileSync(join(o.out, `${o.tag}-frames.json`), JSON.stringify(longFrames, null, 2));
  writeFileSync(join(o.out, `${o.tag}-completion.json`), JSON.stringify(await page.evaluate(() => ({
    levels: (window as unknown as { __playtestCompleted?: unknown[] }).__playtestCompleted ?? [],
    campaign: window.__SS__!.campaign.state(), mission: window.__SS__!.missions.state(),
    backend: window.__SS__!.getState().render.backend, quality: window.__SS__!.getState().render.quality, camera: window.__SS__!.getState().render.camera,
  })), null, 2));
  if (process.env.PLAYTEST_FRAME_GATE === '1') assert.deepEqual(longFrames.filter(f => f.playMs > 200 && f.level && o.levels.includes(f.level)), [], 'No gameplay frame may exceed 200 ms');
  if (shaderGuard) {
    const builds = await page.evaluate(() => (window as unknown as { __playtestBuilds: { level: string; phase: string; loading: boolean }[] }).__playtestBuilds);
    assert.deepEqual(builds.filter(b => o.levels.includes(b.level) && b.phase === 'playing' && !b.loading), [], 'No node builds after level warm-up');
  }
  assert.ok(handoverReady,'L8 must have no objective, destination pin or minimap marker during the calm after handover (L8-02)');
  return { runs, issues, yielded };
  } finally {
    if (process.env.PLAYTEST_THREAT_AUDIT === '1' && !page.isClosed()) {
      await page.evaluate('window.__threatAudit').then(data => writeFileSync(join(o.out, `${o.tag}-l3l4-threat.json`), JSON.stringify(data))).catch(error => log({ threatAuditError: String(error) }));
    }
    if (process.env.PLAYTEST_L6_HOLD_AUDIT === '1' && !page.isClosed()) {
      await page.evaluate('window.__l6HoldAudit').then(data => writeFileSync(join(o.out, `${o.tag}-l6-hold.json`), JSON.stringify(data))).catch(error => log({ l6AuditError: String(error) }));
    }
    if (visibleOnly && !page.isClosed()) {
      await page.evaluate<{ audit: unknown[]; frames: LongFrame[] }>('({ audit: window.__finalE2eAudit ?? [], frames: window.__playtestFrames ?? [] })').then(data => {
        writeFileSync(join(o.out, `${o.tag}-audit.json`), JSON.stringify(data.audit, null, 2));
        writeFileSync(join(o.out, `${o.tag}-frames.json`), JSON.stringify(data.frames, null, 2));
      }).catch(error => log({ observerCleanupError: String(error) }));
    }
    await observeWithin(context.close(), 10_000).catch(error => log({ cleanupError: String(error) }));
  }
}

// CLI: tsx tools/playtest/session.ts '<json SessionOptions>'
if (process.argv[1]?.endsWith('session.ts')) {
  const options = JSON.parse(process.argv[2]) as SessionOptions;
  runSession(options).then(r => { console.log(JSON.stringify({ runs: r.runs.map(x => ({ level: x.level, finished: x.finished, skipped: x.skipped, wall: x.wallSeconds })), issues: r.issues.length })); process.exit(0); },
    error => { console.error(error); process.exit(1); });
}
