/** Q-279/Q-281: real L4 checkpoint, progressed arsenal and original campaign actors.
 * The saved fixture and every placement/army-fire isolation are recorded in evidence.json.
 * Uses only the shared headless browser pool. Run: SCENE_PORT=4874 npx tsx tools/qa/uat-l4-infected.ts
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, encodeWebm, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
const out = resolve('test-results/uat-l4-infected');
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high', query: { ui: '1', test: '1' } });
const evidence: Record<string, unknown> = {};
const store = () => writeFileSync(`${out}/evidence.json`, JSON.stringify({ ...evidence, errors: session.errors }, null, 2));
try {
  await session.open(); const page = session.page;
  await page.addInitScript('window.__name = fn => fn');
  const initial = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L4', { seed: 1, progression: 'L4-default', checkpoint: 'turn' });
    a.pause(); a.camera.zoom(.65);
    document.documentElement.setAttribute('data-scene-hud', '');
    document.querySelectorAll('#hud,.hud').forEach(e => e.setAttribute('data-scene-hud', ''));
    const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
    const soldier = w.entities.get(w.missions!.state.l4!.soldierIds[1])!;
    soldier.civilian!.ally!.follow = { targetId: 1, slot: 0, minM: 2, maxM: 5, engageM: 7, leashM: 10, moveMs: 4.5 };
    soldier.civilian!.ally!.hold = false; soldier.civilian!.ally!.post = null; soldier.civilian!.ally!.run = null;
    a.teleport(1, { x: -17, z: 3 }); a.teleport(soldier.id, { x: -15, z: 5 }); w.npcs!.companion.respawnNear();
    // Let the authored alarm population arrive; isolate the later combat from allied damage.
    for (const e of w.entities.iterate()) if (e.civilian?.ally) { e.civilian.ally.nextAttack = w.tick + 100000; e.civilian.ally.strikeAt = 0; }
    w.combat!.damage.god = true;
    const idleSince = new Map<number, number>(); let maxNonReactTicks = 0;
    for (let tick = 0; tick < 600; tick++) {
      a.vfx.stepRender(1 / 60); await a.step(1);
      const player = w.entities.get(1)!;
      for (const e of w.infected!.active) {
        const b = e.infected!, close = Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) <= 6;
        const exempt = e.health.current <= 0 || e.hidden || e.emerging || e.infectionRise || e.pendingAdmission || b.grabUntil > w.tick || b.specialAttack || e.combat!.staggerUntil > w.tick;
        const reacting = ['chase', 'attack', 'search', 'stagger'].includes(b.state) || b.l1?.mode === 'chase' || b.l1?.mode === 'bite';
        if (!close || exempt || reacting) { idleSince.delete(e.id); continue; }
        if (!idleSince.has(e.id)) idleSince.set(e.id, w.tick);
        const elapsed = w.tick - idleSince.get(e.id)!; maxNonReactTicks = Math.max(maxNonReactTicks, elapsed);
        if (elapsed > 180) throw new Error(`L4 hostile ${e.id} ${e.archetype} ignored the player within 6m for ${elapsed} ticks at ${JSON.stringify(e.transform)}`);
      }
    }
    a.campaign.save();
    const campaign = a.campaign.state()!, resume = w.missions!.saveResume();
    const native = ['infected.riot', 'infected.firefighter', 'infected.hazmat'].map(archetype => {
      const e = w.infected!.active.find(e => e.archetype === archetype && e.health.current > 0 && e.infected!.scripted && Math.hypot(e.transform.x - e.infected!.scripted.x, e.transform.z - e.infected!.scripted.z) < .65)!;
      if (!e) throw new Error(`No arrived native ${archetype}`);
      return { id: e.id, archetype, at: { ...e.transform }, script: { ...e.infected!.scripted! }, state: e.infected!.state, heard: e.infected!.heardTargetId };
    });
    return { scenario: w.scenario, gear: w.entities.get(1)!.survivor!.gearTier, campaign, resume, native, soldier: soldier.id, corgi: [...w.entities.iterate()].find(e => e.companion)!.id, saveStatus: g.saves.load().status, maxNonReactTicks };
  });
  writeFileSync(`${out}/progressed-save.json`, JSON.stringify({ campaign: initial.campaign, resume: initial.resume }));
  evidence.fixture = { scenario: initial.scenario, gearTier: initial.gear, soldier: initial.soldier, corgi: initial.corgi, nativeSources: initial.native, saveStatus: initial.saveStatus, isolation: 'Original authored L4 arrivals translated with their scripted endpoints into the open plaza; unrelated infected removed and allied fire delayed. Full mission, collision, party, input and renderer remain active.' };
  evidence.nearbyAggroWatchdog = { monitoredTicks: 600, maximumNonReactTicks: initial.maxNonReactTicks, allowedTicks: 180, radiusM: 6 };
  assert.ok(initial.gear >= 2); assert.equal(initial.saveStatus, 'ok');
  assert.ok(initial.campaign.ownedActions.includes('weapon.army-mg'));
  // Audit every real living campaign arrival, then let the saved resume restore
  // their original positions. No props or production spawn rules are altered.
  evidence.nativeAudit = await page.evaluate(async () => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
    const actors = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected!.hidden && !e.pendingAdmission);
    const audit: { id: number; archetype: string; scripted: boolean; emerging: boolean; model?: string; bar: boolean; damage: number }[] = [];
    for (const e of actors) e.hidden = true;
    for (const e of w.entities.iterate()) if (e.civilian) e.hidden = true;
    a.teleport(1, { x: -17, z: 3 }); a.camera.zoom(1);
    for (const [index, e] of actors.entries()) {
      const source = { scripted: !!e.infected!.scripted, emerging: !!e.emerging, model: e.infected!.variant };
      delete e.hidden; delete e.emerging; delete e.infectionRise;
      a.teleport(e.id, { x: -16, z: 3 }); e.transform.yaw = 0;
      g.view.update(1); await a.screenshotReady();
      const bar = g.view.getState().healthBars!.bars.some(b => b.id === e.id);
      const damage = w.combat!.damage.apply({ attackId: 10_000 + index, actionId: 'weapon.army-mg', sourceId: 1, targetId: e.id,
        origin: { x: -19, z: 3 }, shotOrigin: { x: -19, z: 3 }, direction: { x: 1, z: 0 }, base: 1, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
      audit.push({ id: e.id, archetype: e.archetype, ...source, bar, damage });
      e.hidden = true;
    }
    return audit;
  });
  const audit = evidence.nativeAudit as { id: number; bar: boolean; damage: number }[];
  assert.ok(audit.length > 0);
  assert.ok(audit.every(e => e.bar && e.damage > 0), `every native hostile must show a bar and take flank damage: ${JSON.stringify(audit.filter(e => !e.bar || e.damage <= 0))}`);
  store();
  const contactSetup = async (baseline: boolean) => page.evaluate(async ({ initial, baseline }) => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
    w.missions!.loadResume(initial.resume); w.combat!.damage.god = false;
    const selected = new Set(initial.native.map(e => e.id));
    for (const e of [...w.infected!.active]) if (!selected.has(e.id)) w.infected!.release(e);
    for (const e of w.entities.iterate()) if (e.civilian && e.id !== initial.soldier) e.hidden = true;
    a.teleport(1, { x: -17, z: 3 }); a.teleport(initial.soldier, { x: -15, z: 5 }); a.teleport(initial.corgi, { x: -18.5, z: 4.5 });
    const spots = [{ x: -16, z: 3 }, { x: -17, z: 4 }, { x: -18, z: 3 }];
    for (let i = 0; i < initial.native.length; i++) {
      const source = initial.native[i], e = w.entities.get(source.id)!, at = spots[i];
      a.teleport(e.id, at);
      e.infected!.scripted = { x: at.x + source.script.x - source.at.x, z: at.z + source.script.z - source.at.z };
      e.infected!.state = 'alerted'; e.infected!.until = w.tick;
      e.health.current = e.health.max; delete e.hidden; delete e.emerging; delete e.infectionRise;
    }
    const ai = w.infected! as unknown as { noticeDuringApproach: (...args: unknown[]) => void };
    const old = ai.noticeDuringApproach;
    if (baseline) ai.noticeDuringApproach = () => {};
    const before = w.tick, hp = w.entities.get(1)!.health.current;
    try { if (baseline) for (let tick = 0; tick < 180; tick++) { a.vfx.stepRender(1 / 60); await a.step(1); } }
    finally { ai.noticeDuringApproach = old; }
    return { before, hp, after: w.tick, hpAfter: w.entities.get(1)!.health.current, hits: a.events(before).filter(e => e.type === 'infected.attack' && selected.has(e.sourceId) && e.targetId === 1), states: initial.native.map(e => ({ id: e.id, state: w.entities.get(e.id)?.infected?.state, script: w.entities.get(e.id)?.infected?.scripted })) };
  }, { initial, baseline });
  evidence.before = await contactSetup(true); store();
  await session.screenshot(`${out}/contact-before.png`);
  const fixed = await contactSetup(false); const contactFrames: Buffer[] = [], contactCells: { frame: number; jpeg: Buffer }[] = [];
  for (let frame = 0; frame < 180; frame += 6) {
    await page.evaluate(async () => { for (let tick = 0; tick < 6; tick++) { window.__SS__!.vfx.stepRender(1 / 60); await window.__SS__!.step(1); } });
    const jpeg = await session.snapshot(); contactFrames.push(jpeg);
    if (frame % 30 === 0) contactCells.push({ frame, jpeg });
  }
  evidence.after = await page.evaluate(({ before, ids }) => {
    const a = window.__SS__!;
    return { before, after: a.tick(), hp: a.getEntity(1)!.health.current, hits: a.events(before).filter(e => e.type === 'infected.attack' && ids.includes(e.sourceId) && e.targetId === 1), party: a.query({}).filter(e => e.companion || e.civilian?.ally?.follow).map(e => ({ id: e.id, archetype: e.archetype, hp: e.health.current })) };
  }, { before: fixed.before, ids: initial.native.map(e => e.id) });
  encodeWebm(contactFrames, `${out}/contact-fixed.webm`, 10); await session.makeSheet(contactCells, `${out}/contact-sheet.jpg`); store();
  evidence.barsAfterContact = await page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.view.getState().healthBars);
  await session.screenshot(`${out}/contact-fixed.png`);
  // Counter fixture: same progressed L4 save and one live, full-health riot.
  const shield = await page.evaluate(async initial => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
    w.missions!.loadResume(initial.resume); w.combat!.damage.god = false;
    for (const e of [...w.infected!.active]) w.infected!.release(e);
    a.camera.zoom(1);
    for (const e of w.entities.iterate()) if (e.civilian && e.id !== initial.soldier) e.hidden = true;
    a.teleport(1, { x: -20, z: 3 }); a.teleport(initial.soldier, { x: -21, z: 5 }); a.teleport(initial.corgi, { x: -21, z: 1.5 });
    const id = a.spawn('infected.riot', { x: -17, z: 3 }, { yaw: Math.PI, state: 'chase' });
    const e = w.entities.get(id)!; e.infected!.scripted = { x: -17, z: 3 };
    a.input.set({ aim: { x: 1, z: 0 }, aimPoint: { x: -17, z: 3 }, right: { down: true, held: true, up: false } });
    g.audio.graph.output.gain.value = 0; g.audio.set({ muted: false }, false);
    await a.audio.unlock(); a.audio.clearLog();
    const before = w.tick; for (let tick = 0; tick < 18; tick++) { a.vfx.stepRender(1 / 60); await a.step(1); }
    const hits = a.events(before).filter(e => e.type === 'combat.hit' && e.targetId === id);
    return { id, before, clangs: a.audio.snapshot().cues.filter(c => c.cue === 'impact.body.metal').length, max: e.health.max, frontHp: e.health.current, blocked: hits.filter(e => 'blocked' in e && e.blocked).length, glances: hits.filter(e => 'shieldGlance' in e && e.shieldGlance).length, breaks: hits.filter(e => 'shieldBreak' in e && e.shieldBreak).length, label: document.querySelector('[data-testid=shield-block]')?.textContent, labelVisible: !!document.querySelector<HTMLElement>('[data-testid=shield-block]')?.offsetParent && getComputedStyle(document.querySelector('[data-testid=shield-block]')!).visibility !== 'hidden' };
  }, initial);
  evidence.shieldFront = shield; store(); await session.screenshot(`${out}/shield-front.png`);
  const frontFrames: Buffer[] = [await session.snapshot()];
  let shieldBroken = false, breakFrame = 0;
  for (let frame = 0; frame < 300 && !shieldBroken; frame += 6) {
    shieldBroken = await page.evaluate(async ({ id, before }) => {
      const a = window.__SS__!;
      const e = a.getEntity(id)!, p = a.getEntity(1)!;
      a.input.set({ aim: { x: e.transform.x - p.transform.x, z: e.transform.z - p.transform.z }, aimPoint: e.transform, right: { down: false, held: true, up: false } });
      for (let tick = 0; tick < 6; tick++) { a.vfx.stepRender(1 / 60); await a.step(1); }
      return a.events(before).some(e => e.type === 'combat.hit' && e.targetId === id && e.shieldBreak);
    }, { id: shield.id, before: shield.before });
    frontFrames.push(await session.snapshot());
    breakFrame = frame + 6;
  }
  await page.evaluate(() => window.__SS__!.input.clear());
  evidence.shieldBreak = await page.evaluate(({ id, before }) => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    return { tick: a.tick(), event: a.events(before).find(e => e.type === 'combat.hit' && e.targetId === id && e.shieldBreak), hp: a.getEntity(id)!.health.current, max: a.getEntity(id)!.health.max, bars: g.view.getState().healthBars };
  }, { id: shield.id, before: shield.before });
  evidence.shieldBreakFrame = breakFrame; store(); await session.screenshot(`${out}/shield-break.png`);
  await page.evaluate(async () => { const a = window.__SS__!; for (let i = 0; i < 10; i++) { a.vfx.stepRender(1 / 60); await a.step(1); } });
  await session.screenshot(`${out}/shield-open.png`);
  let frontKilled = false;
  for (let frame = 0; frame < 300 && !frontKilled; frame += 6) {
    frontKilled = await page.evaluate(async id => {
      const a = window.__SS__!, e = a.getEntity(id)!, p = a.getEntity(1)!;
      a.input.set({ aim: { x: e.transform.x - p.transform.x, z: e.transform.z - p.transform.z }, aimPoint: e.transform, right: { down: false, held: true, up: false } });
      for (let i = 0; i < 6; i++) { a.vfx.stepRender(1 / 60); await a.step(1); }
      return a.getEntity(id)!.health.current <= 0;
    }, shield.id);
    frontFrames.push(await session.snapshot());
  }
  evidence.frontOnlyFight = await page.evaluate(({ id, start }) => {
    const a = window.__SS__!, e = a.getEntity(id)!; a.input.clear();
    return { seconds: (a.tick() - start) / 60, hp: e.health.current, playerHp: a.getEntity(1)!.health.current, events: a.events(start).filter(e => e.type === 'combat.hit' && e.targetId === id) };
  }, { id: shield.id, start: shield.before });
  encodeWebm(frontFrames, `${out}/mp-front-kill.webm`, 10);
  assert.ok(frontKilled, 'Frontal MP fire alone must defeat the riot');
  const fightFixture = await page.evaluate(() => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    a.teleport(1, { x: -14, z: 3 });
    const id = a.spawn('infected.riot', { x: -17, z: 3 }, { yaw: 0, state: 'chase' });
    return { id, start: g.world.tick };
  });
  const start = fightFixture.start;
  const fightFrames: Buffer[] = [], fightCells: { frame: number; jpeg: Buffer }[] = []; let killed = false;
  for (let frame = 0; frame < 600 && !killed; frame += 6) {
    killed = await page.evaluate(async ({ id, frame }) => {
      const a = window.__SS__!, e = a.getEntity(id)!, p = a.getEntity(1)!;
      const angle = Math.atan2(p.transform.z - e.transform.z, p.transform.x - e.transform.x) + .9;
      const dx = e.transform.x + Math.cos(angle) * 1.3 - p.transform.x, dz = e.transform.z + Math.sin(angle) * 1.3 - p.transform.z, d = Math.hypot(dx, dz) || 1;
      a.input.set({ move: { x: dx / d, z: dz / d }, aim: { x: e.transform.x - p.transform.x, z: e.transform.z - p.transform.z }, aimPoint: { x: e.transform.x, z: e.transform.z }, right: { down: frame === 0, held: true, up: false } });
      for (let tick = 0; tick < 6; tick++) { a.vfx.stepRender(1 / 60); await a.step(1); } return a.getEntity(id)!.health.current <= 0;
    }, { id: fightFixture.id, frame });
    const jpeg = await session.snapshot(); fightFrames.push(jpeg); if (frame % 30 === 0) fightCells.push({ frame, jpeg });
  }
  evidence.mgFight = await page.evaluate(({ id, start }) => {
    const a = window.__SS__!, e = a.getEntity(id)!, events = a.events(start);
    a.input.clear();
    return { start, end: a.tick(), seconds: (a.tick() - start) / 60, hp: e.health.current, recoverAt: e.infected!.recoverAt,
      hits: events.filter(e => e.type === 'combat.hit' && e.targetId === id), shots: events.filter(e => e.type === 'combat.attack' && e.sourceId === 1), player: a.getEntity(1)!.transform };
  }, { id: fightFixture.id, start });
  encodeWebm(fightFrames, `${out}/mp-circle-kill.webm`, 10); await session.makeSheet(fightCells, `${out}/mp-circle-sheet.jpg`); store();
  await session.screenshot(`${out}/mp-kill.png`);
  const before = evidence.before as { hits: unknown[]; hp: number; hpAfter: number };
  const after = evidence.after as { hits: { sourceId: number; tick: number }[]; before: number; hp: number };
  assert.equal(before.hits.length, 0); assert.equal(before.hpAfter, before.hp);
  assert.ok(initial.native.every(e => after.hits.some(h => h.sourceId === e.id && h.tick - after.before <= 180)));
  const visibleBars = (evidence.barsAfterContact as { bars: { id: number }[] }).bars;
  assert.ok(initial.native.every(e => visibleBars.some(bar => bar.id === e.id)), 'every live native L4 hostile in the combat frame must have a rendered bar');
  assert.ok(after.hp < before.hp);
  const fight = evidence.mgFight as { hp: number; recoverAt: number; hits: { amount: number; sourceId: number; actionId: string }[] };
  assert.equal(fight.hp, 0); assert.equal(fight.recoverAt, -1);
  assert.ok(fight.hits.filter(h => h.amount > 0).every(h => h.sourceId === 1 && h.actionId === 'weapon.army-mg'));
  console.log(JSON.stringify({ fixture: evidence.fixture, before: evidence.before, after: evidence.after, shieldFront: evidence.shieldFront, fight: { seconds: (evidence.mgFight as { seconds: number }).seconds, killed } }));
  assert.ok(shield.glances > 0); assert.ok(shield.clangs > 0, 'Front chip fire must play metal clang'); assert.ok(shield.labelVisible, 'Shield strain caption must be visible'); assert.ok(shield.frontHp < shield.max, 'front fire must move the health bar'); assert.equal(shield.label, 'SHIELD STRAIN · CHIP');
  assert.ok(shieldBroken, 'A sustained frontal MP burst must break the shield'); assert.ok((evidence.shieldBreak as { event: unknown }).event); assert.ok(killed, 'MP circle must defeat the live riot within 10 s');
  assert.deepEqual(session.errors, []);
} finally { store(); await session.close(); stopServer(); }
