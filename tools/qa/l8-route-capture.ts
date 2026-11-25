/** Mortal L8 playthrough with physical WASD, weapon shortcuts and held mouse fire.
 * The shared policy only proposes directions; no frame injection or world edits. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { launchBrowser } from '../browser-pool/client';
import { SceneSession, stopServer } from '../scenelab/session';
import { dodgeWalkKeys } from '../playtest/input';
import { weaponKey } from '../../src/data/weaponKeys';
import type { Game } from '../../src/Game';
import { provenance } from './accept/probe';
const build = provenance();
const captureToolSha256 = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
const tier = process.argv[2] === 'high' ? 'high' : 'low';
const out = process.env.L8_CAPTURE_OUT ?? `docs/reports/p1-l8rework/browser-${tier}`; mkdirSync(out, { recursive: true });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const session = new SceneSession({ tier, backend: 'webgl2', seed: 1, viewport: { width: 1280, height: 720 }, query: { ui: '1' } });
const frames: unknown[] = [], captures: string[] = [], down = new Set<string>();
const weaponPictures = new Set<string>();
const storyPictures = new Set<string>();
const animalPictures = new Set<string>();
let specialCursor = 0, animalHitCursor = 0;
let firing = false, lastArena = '', lastPhase = -1, lastTick = -1;
try {
  await session.open(browser);
  await session.page.evaluate(async tier => {
    const ss = window.__SS__!; await ss.loadLevel('L8', { seed: 1, progression: 'L8-default' });
    ss.settings.set({ quality: tier as 'low' | 'high' }); ss.pause(); ss.missions.begin();
    document.documentElement.dataset.sceneHud = '1';
    document.querySelectorAll<HTMLElement>('#hud,.hud').forEach(e => { e.dataset.sceneHud = '1'; });
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    const audit = { attacks: [] as unknown[], hits: [] as unknown[], lines: [] as unknown[], specials: [] as unknown[], animalHits: [] as unknown[] };
    (window as unknown as { l8Audit: typeof audit }).l8Audit = audit;
    game.world.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1) audit.attacks.push({ tick: e.tick, id: e.actionId, arena: game.world.missions!.l8!.state.arenas.find(a => a.phase > 0 && a.phase < 3)?.id }); });
    game.world.events.on('combat.hit', e => { if (e.type === 'combat.hit' && e.sourceId === 1) audit.hits.push({ tick: e.tick, id: e.actionId, target: e.targetId, amount: e.amount, arena: game.world.missions!.l8!.state.arenas.find(a => a.ids.includes(e.targetId))?.id }); });
    game.world.events.on('infected.special', e => { if (e.type === 'infected.special') { const arena = game.world.missions!.l8!.state.arenas.find(a => a.ids.includes(e.sourceId))?.id; if (arena) audit.specials.push({ tick: e.tick, arena, move: e.move, stage: e.stage }); } });
    game.world.events.on('combat.hit', e => { if (e.type === 'combat.hit' && e.targetId === 1 && e.amount > 0) { const arena = game.world.missions!.l8!.state.arenas.find(a => a.ids.includes(e.sourceId))?.id, move = game.world.entities.get(e.sourceId)?.infected?.specialAttack?.move; if (arena && move) audit.animalHits.push({ tick: e.tick, arena, move, amount: e.amount }); } });
    game.world.events.on('dialogue.line', e => { if (e.type === 'dialogue.line') audit.lines.push({ tick: e.tick, id: e.id }); });
  }, tier);
  for (let n = 0; n < 7200; n++) {
    const row = await session.page.evaluate(({ specialCursor, animalHitCursor }) => {
      const ss = window.__SS__!, state = ss.getState(), player = ss.getEntity(1)!, zoo = state.l8!;
      const plan = ss.bot.plan(), p = player.transform, active = zoo.arenas.find(a => a.phase !== 3);
      let move = { ...plan.frame.move };
      const elephant = active?.id === 'elephant' && active.phase > 0 ? ss.getEntity(active.ids[0]) : undefined;
      const tell = elephant?.infected?.specialAttack;
      // Keyboard directions are coarser than native steering. Reposition into
      // the open east yard between tells instead of fighting at the north gate.
      if (elephant && elephant.health.current > 0 && tell?.stage !== 'telegraph' && tell?.stage !== 'active' && (p.x < 104 || p.z < 56 || p.z > 69)) {
        const dx = 108 - p.x, dz = 62 - p.z, d = Math.hypot(dx, dz) || 1; move = { x: dx / d, z: dz / d };
      }
      const origin = ss.input.project(p, 'player'), direction = ss.input.project({ x: p.x + move.x * 8, z: p.z + move.z * 8 }, 'player');
      const target = plan.target && ss.input.project(plan.target, 'player');
      const entries = (window.__SCENE__ as unknown as { game: Game }).game.world.combat!.runner.loadout.activeEntries();
      const cinematic = (state.mission as { cinematic?: { id: string; elapsed: number } })?.cinematic;
      const audit = (window as unknown as { l8Audit: { attacks: { id: string; arena?: string }[]; hits: { id: string; arena?: string; amount: number }[]; specials: unknown[]; animalHits: unknown[] } }).l8Audit;
      // Exercise the rear-kick counter in ordinary play: walk behind a live
      // zebra for at most 20 seconds, then resume the normal combat policy.
      const auditState = audit as Omit<typeof audit, 'specials'> & { zebraRearAt?: number; specials: { move: string }[] };
      if (active?.id === 'zebra' && active.phase === 1) auditState.zebraRearAt ??= ss.tick();
      const rearTactic = active?.id === 'zebra' && active.phase === 1 && auditState.zebraRearAt !== undefined
        && ss.tick() - auditState.zebraRearAt < 1200 && !auditState.specials.some(event => event.move === 'zebra.kick');
      if (rearTactic) {
        const zebra = active.ids.map(id => ss.getEntity(id)).find(e => e && e.health.current > 0);
        if (zebra) {
          const dx = zebra.transform.x - Math.cos(zebra.transform.yaw) * 1.5 - p.x;
          const dz = zebra.transform.z + Math.sin(zebra.transform.yaw) * 1.5 - p.z;
          const length = Math.hypot(dx, dz); move = length > .4 ? { x: dx / length, z: dz / length } : { x: 0, z: 0 };
        }
      }
      const habitatState = auditState as typeof auditState & { zebraHabitatAt?: number };
      if (active?.id === 'zebra' && auditState.specials.some(event => event.move === 'zebra.kick')) habitatState.zebraHabitatAt ??= ss.tick();
      const habitatTactic = active?.id === 'zebra' && active.phase === 1 && habitatState.zebraHabitatAt !== undefined && ss.tick() - habitatState.zebraHabitatAt < 1200;
      if (habitatTactic) {
        const dx = 51 - p.x, dz = 25 - p.z, length = Math.hypot(dx, dz);
        move = length > 1 ? { x: dx / length, z: dz / length } : { x: 0, z: 0 };
      }
      const guns = ['weapon.handgun', 'weapon.shotgun', 'weapon.army-mg', 'weapon.rocket-launcher'];
      const needed = active?.phase ? guns.find(id => audit.attacks.filter(e => e.arena === active.id && e.id === id).length < 2 || !audit.hits.some(e => e.arena === active.id && e.id === id && e.amount > 0)) : undefined;
      const choice = entries[plan.slot];
      const bossTarget = plan.target && active?.ids.some(id => { const e = ss.getEntity(id); return e && Math.hypot(e.transform.x - plan.target!.x, e.transform.z - plan.target!.z) < .1; });
      const safeNeeded = needed === 'weapon.rocket-launcher' && plan.target && Math.hypot(plan.target.x - p.x, plan.target.z - p.z) < 8 ? undefined : needed;
      const weapon = choice?.id === 'weapon.fire-axe' ? choice.id : bossTarget ? safeNeeded ?? choice?.id : choice?.id;
      return { tick: ss.tick(), phase: (state.mission as { phase: string })?.phase, player: p, hp: player.health.current,
        move: cinematic ? { x: 0, z: 0 } : move, dx: rearTactic || habitatTactic ? ss.input.project({ x: p.x + move.x * 8, z: p.z + move.z * 8 }, 'player').x - origin.x : direction.x - origin.x, dy: rearTactic || habitatTactic ? ss.input.project({ x: p.x + move.x * 8, z: p.z + move.z * 8 }, 'player').y - origin.y : direction.y - origin.y, target, fire: !cinematic && !rearTactic && !!(plan.frame.left.held || plan.frame.right.held), interact: !cinematic && plan.frame.interact,
        weapon: cinematic ? undefined : weapon, actualWeapon: entries.find(e => e.side === player.weapons!.selectedSide && e.index === player.weapons![e.side].index)?.id,
        damagedWeapons: [...new Set(audit.hits.filter(e => e.arena === active?.id && e.amount > 0).map(e => e.id))], marker: (state.mission as { marker?: string })?.marker,
        cinematic, wallBreached: !!zoo.arenas.find(a => a.id === 'elephant')?.breachAt, haleKeys: !!(state.mission as { states: Record<string, boolean> })?.states['hale-keys'], haleFallen: !!(state.mission as { states: Record<string, boolean> })?.states['hale-fallen'], hale: ss.getEntity(zoo.haleId)?.transform, boarding: !active ? zoo.roster.map(id => ss.getEntity(id)).filter(e => e && e.health.current > 0 && !e.infected && e.passengerOf === undefined).map(e => ({ id: e!.id, at: e!.transform })) : undefined, carrier: active && ss.getEntity(active.carrier)?.transform, animal: active && ss.getEntity(active.ids[0])?.transform, arena: active?.id ?? 'boarding', arenaPhase: active?.phase ?? 3, arenaHP: active?.ids.map(id => ss.getEntity(id)?.health.current), arenas: zoo.arenas.map(a => ({ id: a.id, phase: a.phase })),
        objective: [...document.querySelectorAll('[data-testid=objective-text],[data-testid=mission-tracker]')].map(e => e.textContent).find(text => text?.trim()) ?? '', departed: (state.mission as { states: Record<string, boolean> })?.states.departed,
        specials: audit.specials.slice(specialCursor), animalHits: audit.animalHits.slice(animalHitCursor), specialCount: audit.specials.length, animalHitCount: audit.animalHits.length,
        animalMoves: active?.ids.map(id => ss.getEntity(id)?.infected?.specialAttack).filter(a => a && ['zebra.kick', 'gorilla.pound', 'gorilla.grab-slam'].includes(a.move)).map(a => ({ move: a!.move, stage: a!.stage, startTick: a!.startTick, activeTick: a!.activeTick })) ?? [],
      };
    }, { specialCursor, animalHitCursor });
    specialCursor = row.specialCount; animalHitCursor = row.animalHitCount;
    for (const move of row.animalMoves) if (move.stage === 'telegraph' && row.tick >= (move.startTick + move.activeTick) / 2) {
      const key = `${move.move}-telegraph`;
      if (!animalPictures.has(key)) { const file = `natural-${row.arena}-${move.move}-telegraph-tick-${row.tick}.jpg`; await session.page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 80 }); captures.push(file); animalPictures.add(key); }
    }
    const moveStages = row.specials as { tick: number; arena: string; move: string; stage: string }[];
    for (const event of moveStages) if (['zebra.kick', 'gorilla.pound', 'gorilla.grab-slam'].includes(event.move) && ['telegraph', 'active'].includes(event.stage)) {
      const key = `${event.move}-${event.stage}`;
      if (!animalPictures.has(key)) { const file = `natural-${event.arena}-${event.move}-${event.stage}-tick-${row.tick}.jpg`; await session.page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 80 }); captures.push(file); animalPictures.add(key); }
    }
    const animalHits = row.animalHits as { tick: number; arena: string; move: string; amount: number }[];
    for (const event of animalHits) if (['zebra.kick', 'gorilla.pound', 'gorilla.grab-slam'].includes(event.move)) {
      const key = `${event.move}-hit`;
      if (!animalPictures.has(key)) { const file = `natural-${event.arena}-${event.move}-hit-${event.tick}.jpg`; await session.page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 80 }); captures.push(file); animalPictures.add(key); }
    }
    if (row.arena === 'zebra' && row.arenaPhase === 1 && Math.hypot(row.player.x - 60, row.player.z - 32) < 8 && !storyPictures.has('zebra-habitat')) {
      const file = `natural-zebra-habitat-tick-${row.tick}.jpg`; await session.page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 80 }); captures.push(file); storyPictures.add('zebra-habitat');
    }
    if (row.arena === 'zebra' && row.arenaPhase === 1 && Math.hypot(row.player.x - 51, row.player.z - 25) < 2 && !storyPictures.has('zebra-fittings')) {
      const file = `natural-zebra-fittings-tick-${row.tick}.jpg`; await session.page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 80 }); captures.push(file); storyPictures.add('zebra-fittings');
    }
    for (const [beat, occurred] of [['wall-breach', row.wallBreached], ['hale-keys', row.haleKeys], ['hale-fallen', row.haleFallen], ['hale-mid', row.cinematic?.id === 'l8-hale' && row.cinematic.elapsed >= 48]] as const) {
      if (occurred && !storyPictures.has(beat)) {
        const file = `${beat}-tick-${row.tick}.jpg`; await session.page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 75 }); captures.push(file); storyPictures.add(beat);
      }
    }
    if (lastArena && row.arena !== lastArena) { const file = `${lastArena}-cleared-tick-${row.tick}.jpg`; await session.page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 75 }); captures.push(file); }
    if (row.arena !== lastArena || row.arenaPhase !== lastPhase) {
      const file = `${row.arena}-phase-${row.arenaPhase}-tick-${row.tick}.jpg`;
      await session.page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 75 }); captures.push(file);
      lastArena = row.arena; lastPhase = row.arenaPhase;
      console.log(JSON.stringify({ tier, tick: row.tick, arena: row.arena, phase: row.arenaPhase, hp: row.hp }));
    }
    const weaponPicture = row.weapon && row.damagedWeapons.includes(row.weapon) ? `${row.arena}-${row.weapon}` : '';
    if (weaponPicture && !weaponPictures.has(weaponPicture)) {
      if (firing) { await session.page.mouse.up(); firing = false; }
      await session.page.evaluate(() => window.__SS__!.step(8));
      const file = `${weaponPicture}-tick-${row.tick}.jpg`; await session.page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 75 }); captures.push(file); weaponPictures.add(weaponPicture);
    }
    if (n % 250 === 0) console.log(JSON.stringify({ tier, progress: row.tick, arena: row.arena, phase: row.arenaPhase, hale: row.hale, carrier: row.carrier, animal: row.animal }));
    if (n % 50 === 0) { frames.push(row); writeFileSync(`${out}/progress.json`, JSON.stringify({ tier, captures, frames }, null, 2)); }
    if (row.departed || row.phase === 'progression' || row.phase === 'result') break;
    const keys = Math.hypot(row.move.x, row.move.z) > .05 ? dodgeWalkKeys(row.dx, row.dy) : [];
    for (const key of [...down]) if (!keys.includes(key)) { await session.page.keyboard.up(key); down.delete(key); }
    for (const key of keys) if (!down.has(key)) { await session.page.keyboard.down(key); down.add(key); }
    if (row.weapon && row.weapon !== row.actualWeapon) {
      const key = weaponKey(row.weapon); if (key) { await session.page.keyboard.press(`Digit${key}`); }
    }
    if (row.target) await session.page.mouse.move(Math.max(1, Math.min(1278, row.target.x)), Math.max(1, Math.min(718, row.target.y)));
    const fire = row.fire && !!row.target;
    if (fire && !firing) { await session.page.mouse.down(); firing = true; }
    if (!fire && firing) { await session.page.mouse.up(); firing = false; }
    if (row.interact) await session.page.keyboard.press('KeyE');
    await session.page.evaluate(() => window.__SS__!.step(12));
    if (n % 100 === 0 && row.tick === lastTick) throw Error(`simulation stopped at ${row.tick}`);
    if (n % 100 === 0) lastTick = row.tick;
  }
  const result = await session.page.evaluate(() => {
    const ss = window.__SS__!, state = ss.getState();
    return { state: { tick: ss.tick(), quality: state.render.quality, backend: state.render.backend, mission: state.mission, zoo: state.l8, boarding: state.l8 && { passengers: ss.getEntity(state.l8.carId)?.vehicle?.passengers, actors: [1, ...state.l8.roster, ...state.l8.guards, ...state.l8.arenas.flatMap(a => a.ids), ...[...(window.__SCENE__ as unknown as { game: Game }).game.world.entities.iterate()].filter(e => e.companion).map(e => e.id)].map(id => ss.getEntity(id)) } }, audit: (window as unknown as { l8Audit: unknown }).l8Audit };
  });
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...build, captureToolSha256, tier, method: 'Physical WASD, Digit weapon shortcuts, LMB aiming/firing and E. Paused fixed-step presentation, mortal courier and NPCs. Shared policy is read only; no injected input, teleport, health edits or objective changes.', captures, frames, errors: session.errors, ...result }, null, 2));
  if (!(result.state.mission as { states?: Record<string, boolean> })?.states?.departed || session.errors.length) process.exitCode = 1;
  console.log(JSON.stringify({ tier, out, errors: session.errors, complete: (result.state.mission as { states?: Record<string, boolean> })?.states?.departed }));
} finally { await session.close(); await browser.close(); stopServer(); }
