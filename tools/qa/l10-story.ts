import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadLevel, runLevel } from '../sim-runner/levels';
import { followTenFrustum } from '../sim-runner/l10';
import { provenance } from './accept/probe';
import { cureCorgiToy, cureEscapeGaps, cureHangar, cureHangarConversation } from '../../src/data/l10Story';
import { cureHangarWeapons } from '../../src/levels/L10/mission';
import { cureWeaponPickups } from '../../src/levels/L10/encounters';
import { cure } from '../../src/levels/L10/district';
import { emptyInput } from '../../src/input/InputFrame';
import { cureRadius } from '../../src/data/cureDust';
import { catalog } from '../../src/data/actions/catalog';
import { megaAlpha } from '../../src/data/megaAlpha';
import { encodeSave, decodeSave, validateSave } from '../../src/sim/progression/Save';
import type { SimWorld } from '../../src/sim/world/SimWorld';

const outputIndex = process.argv.indexOf('--out');
const out = outputIndex >= 0 ? process.argv[outputIndex + 1] : 'docs/reports/eg-l10-story/evidence/story-probe.json';
const finaleOnly = process.env.L10_STORY_FINAL_ONLY === '1';
const tiers = (process.env.L10_STORY_TIERS ?? 'low,high').split(',') as ('low' | 'high')[];
const rows: unknown[] = [], checks: { tier: string; name: string; pass: boolean; observed?: unknown }[] = [];
const check = (tier: string, name: string, pass: boolean, observed?: unknown) => { checks.push({ tier, name, pass, observed: observed === undefined ? undefined : structuredClone(observed) }); };
function place(w: SimWorld, x: number, z: number): void {
  const at = { x, y: .705 + (w.districts?.groundHeight(x, z) ?? 0), z };
  Object.assign(w.entities.get(1)!.transform, at); w.physics.playerBody!.setTranslation(at, true);
  w.player!.locomotion.reset(); Object.assign(w.previousPlayer!, w.entities.get(1)!.transform);
  w.spatial.set(1, x, z); w.chunks!.update();
}
function advance(w: SimWorld, ticks: number): void { for (let n = 0; n < ticks; n++) { followTenFrustum(w); w.update(); } }
for (const tier of tiers) {
  const fixture: Record<string, unknown> = { tier, method: 'Controlled production-world fixtures; placements/objective advances are explicitly injected. Native route below uses inputs only.' };
  let w: SimWorld | undefined;
  try {
    w = await loadLevel('L10', 1, undefined, 0, { quality: tier });
    w.combat!.damage.god = true;
    place(w, cureCorgiToy.x - 4, cureCorgiToy.z); advance(w, 10);
    const toy = w.entities.get(w.l10Encounters!.state.toy ?? 0);
    if (toy) { place(w, toy.transform.x, toy.transform.z); advance(w, 1); }
    check(tier, 'optional house toy is collected once without a weapon slot', !!toy?.pickup && 'collected' in toy.pickup && toy.pickup.collected && w.missions!.state.items.includes('corgi-toy'));
    const found = [];
    for (const pickup of cureWeaponPickups) {
      const [x, z] = cure.anchors[pickup.anchor];
      place(w, x - 3, z); advance(w, 10);
      const entity = w.entities.get(w.l10Encounters!.state.weapons![pickup.id]);
      if (!entity) { check(tier, `placed ${pickup.id} exists`, false); continue; }
      const at = { ...entity.transform }, nav = w.infected!.nav.forPlayer(.35), path: number[] = [];
      const reachable = nav.path(nav.cell(x - 3, z), nav.cell(at.x, at.z), path, Infinity);
      place(w, at.x, at.z); advance(w, 1);
      const retained = w.entities.get(1)!.weapons!.RIGHT.rack.some(slot => slot.id === pickup.action);
      advance(w, 20);
      const gone = !w.entities.get(entity.id);
      check(tier, `${pickup.id} is reachable and collected on approach once`, reachable && retained && gone, { at, reachable, retained, gone });
      found.push({ id: pickup.id, action: pickup.action, at });
    }
    fixture.pickups = found;
    const gaps = [];
    for (const gap of cureEscapeGaps) {
      place(w, gap.x - 3, gap.z); advance(w, 1);
      const grid = w.infected!.nav, centre = { x: gap.x, z: gap.z };
      const route = (nav: typeof grid) => {
        const cells: number[] = [], connected = nav.path(nav.cell(gap.x - 3, gap.z), nav.cell(gap.x + 3, gap.z), cells, Infinity);
        let metres = 0;
        for (let i = 1; i < cells.length; i++) metres += Math.hypot(nav.x(cells[i]) - nav.x(cells[i - 1]), nav.z(cells[i]) - nav.z(cells[i - 1]));
        return { connected, metres };
      };
      const result = { at: centre, courierClear: grid.clear(centre.x, centre.z, .35), megaClear: w.megaPursuit!.grid.clear(centre.x, centre.z, megaAlpha.radius), courierRoute: route(grid.forPlayer(.35)), megaRoute: route(w.megaPursuit!.grid) };
      gaps.push(result); check(tier, `gap ${gap.x} fits courier and excludes Mega`, result.courierClear && !result.megaClear && result.courierRoute.connected && result.megaRoute.connected && result.courierRoute.metres < 16 && result.megaRoute.metres > result.courierRoute.metres + 50, result);
    }
    place(w, cureHangar.centre.x, 59); advance(w, 1);
    const m = w.missions!;
    while (m.state.steps.research.status !== 'active') m.completeObjective();
    place(w, cureHangar.terminal.x + 2, cureHangar.terminal.z);
    const lines: string[] = [];
    const stop = w.events.on('dialogue.line', e => { if (e.type === 'dialogue.line') lines.push(e.id); });
    advance(w, cureHangarConversation.reduce((n, line) => n + line[1], 0) + 5); stop();
    check(tier, 'hangar conversation completes in order with Reyes fallback', cureHangarConversation.every(([id], i) => lines[i] === (id.startsWith('L10.sam-') ? `${id}.reyes` : id)), lines);
    const cast = Object.entries(m.state.actors).filter(([key]) => key.startsWith('hangar-')).map(([key, id]) => ({ key, id, model: w!.entities.get(id)?.civilian?.model, hp: w!.entities.get(id)?.health.current }));
    check(tier, 'six living researchers, guards and continuity speaker are present', cast.length === 6 && cast.every(e => (e.hp ?? 0) > 0), cast);
    const path: number[] = [], nav = w.infected!.nav;
    check(tier, 'hangar entrance connects to indoor handoff', nav.path(nav.cell(cureHangar.outside.x, cureHangar.outside.z), nav.cell(cureHangar.canister.x, cureHangar.canister.z), path, Infinity), { cells: path.length });
    place(w, cureHangar.canister.x + 1, cureHangar.canister.z); advance(w, 5);
    const player = w.entities.get(1)!, racks = () => [...player.weapons!.LEFT.rack, ...player.weapons!.RIGHT.rack].map(slot => slot.id);
    check(tier, 'cure handoff restores every campaign weapon and the prototype into selectable racks', m.state.states['cure-carried'] && cureHangarWeapons.every(id => racks().includes(id)), racks());
    const resume = m.saveResume(), save = structuredClone(w.progression!.campaign!); save.cureResume = resume;
    const decoded = decodeSave(encodeSave(save));
    check(tier, 'full hangar inventory and conversation survive save validation and codec', validateSave(save) && decoded.status === 'ok' &&
      JSON.stringify(decoded.save.racks) === JSON.stringify(save.racks) && decoded.save.ownedActions.includes('weapon.hunting-rifle'));
    const bossId = w.megaPursuit!.introduce(cureHangar.outside), boss = w.entities.get(bossId)!;
    let hitSequence = 0;
    const hit = (id: string, base: number, type: 'bullet' | 'explosive' | 'status' = 'bullet') => w!.combat!.damage.apply({ attackId: ++hitSequence, actionId: id, sourceId: 1, targetId: bossId, origin: player.transform, direction: { x: 1, z: 0 }, base, multiplier: 1, type, direct: true, knockback: 0, stagger: .5 });
    const initialHp = boss.health.current;
    for (let n = 0; n < 12; n++) hit('weapon.rocket-launcher', 180, 'explosive');
    check(tier, 'walk Mega cannot be killed even by repeated direct rockets', boss.health.current === initialHp && boss.health.current > 0, { initialHp, hp: boss.health.current });
    const safeHp = player.health.current;
    w.combat!.damage.god = false;
    w.combat!.damage.apply({ attackId: 0, actionId: 'infected.claw', sourceId: bossId, targetId: 1, origin: boss.transform, direction: { x: 1, z: 0 }, base: 35, multiplier: 1, type: 'melee', direct: true, knockback: 0, stagger: 0 });
    check(tier, 'hangar boundary protects courier from outside attacks', player.health.current === safeHp);
    w.combat!.damage.god = true;
    m.state.states['cure-installed'] = true;
    const damage: Record<string, number> = {};
    for (const id of cureHangarWeapons.filter(id => catalog[id].damage > 0)) {
      boss.health.current = boss.health.max;
      damage[id] = hit(id, catalog[id].damage, id === 'weapon.rocket-launcher' ? 'explosive' : 'bullet');
    }
    check(tier, 'every damaging carried weapon can hurt the finale Mega', Object.values(damage).every(n => n > 0), damage);
    place(w, 4002, -27); advance(w, 1);
    const device = w.entities.get(m.state.actors['arena-gate-switch']);
    check(tier, 'arena has both fuel hazards and an accessible gate switch', !!device?.interactable &&
      [0, 1].every(i => !!w!.entities.get(m.state.actors[`arena-fuel-${i}`])) &&
      w.infected!.nav.clear(device!.transform.x, device!.transform.z, .35));
    if (device?.interactable) {
      device.interactable.completed = true;
      Object.assign(boss.transform, { x: 4002, z: 1 }); w.spatial.set(boss.id, 4002, 1);
      const beforeGate = boss.health.current;
      m.l10!.update();
      check(tier, 'powered gate damages and interrupts the finale Mega once', m.state.states['gate-spent'] && boss.health.current === beforeGate - 900 && boss.combat!.staggerUntil >= w.tick + 180,
        { beforeGate, after: boss.health.current, staggerUntil: boss.combat!.staggerUntil });
    }
    m.state.states['charge-active'] = true; m.state.states['charge-ready'] = true; m.state.counters['charge-ticks'] = 3600;
    const before = Object.keys(w.l10Encounters!.state.spawned).length;
    advance(w, 1200);
    const after = Object.keys(w.l10Encounters!.state.spawned).length;
    check(tier, 'reinforcements continue after charge-ready', after > before, { before, after, assaultTicks: w.l10Encounters!.state.assaultTicks });
    const gun = w.mountedGun!;
    const bossPose = { ...boss.transform };
    place(w, gun.placement.x, gun.placement.z); player.transform.y = gun.placement.y + .78;
    gun.mounted = true; gun.aim.x = 1; gun.aim.z = 0; w.combat!.damage.god = false;
    Object.assign(boss.transform, { x: player.transform.x + 2, y: .7, z: player.transform.z });
    const shieldHit = () => w!.combat!.damage.apply({ attackId: ++hitSequence, actionId: 'infected.claw', sourceId: bossId, targetId: 1, origin: boss.transform, direction: { x: -1, z: 0 }, base: 35, multiplier: 1, type: 'melee', knockback: 2, stagger: 1 });
    const shieldHp = player.health.current; shieldHit();
    check(tier, 'mounted platform rejects ground melee without stunlock', player.health.current === shieldHp && player.combat!.staggerUntil <= w.tick);
    Object.assign(boss.transform, { x: player.transform.x - 2, y: player.transform.y });
    const rear = shieldHit();
    check(tier, 'stair climber can contest the gun from behind with reduced damage', rear > 0 && rear <= 35 * .25 && player.combat!.staggerUntil <= w.tick, rear);
    gun.mounted = false; Object.assign(boss.transform, bossPose); w.combat!.damage.god = true;
    // A labelled stationary capability fixture: production AI must climb the real stair, never acquire deck support below it.
    const foot = { x: 4002.2, z: -33 }, climber = w.infected!.spawn('infected.runner', foot, { state: 'chase' });
    for (const other of [...w.infected!.active]) if (other.id !== climber) { other.health.current = 0; w.infected!.down(other, true); }
    const mountedAt = { x: gun.placement.x - .78, y: gun.placement.y + .78, z: gun.placement.z };
    Object.assign(player.transform, mountedAt); w.physics.playerBody!.setTranslation(mountedAt, true); w.spatial.set(1, mountedAt.x, mountedAt.z);
    gun.mounted = true; w.infected!.pursueTarget(climber, 1);
    const climb: { x: number; y: number; z: number }[] = [];
    for (let tick = 0; tick < 600; tick++) { advance(w, 1); if (tick % 10 === 0) climb.push({ ...w.entities.get(climber)!.transform }); }
    const entered = climb.find(at => at.y > 1.5), reachedDeck = climb.some(at => at.y >= 3.6);
    check(tier, 'infected reaches the manned raised platform by its stair', reachedDeck && !!entered && Math.abs(entered.z + 33) < 2.5 && entered.x >= 3995 && entered.x <= 4004, { entered, reachedDeck, climb });
    gun.mounted = false;

    m.loadResume(resume);
    const restored = w.entities.get(1)!;
    check(tier, 'production resume restores indoor cast, completed dialogue, cure and every selectable weapon', m.state.states['cure-carried'] &&
      m.state.states['hangar-dialogue-done'] && cureHangarWeapons.every(id => [...restored.weapons!.LEFT.rack, ...restored.weapons!.RIGHT.rack].some(slot => slot.id === id)) &&
      Object.entries(m.state.actors).filter(([key, id]) => key.startsWith('hangar-') && w!.entities.get(id)?.health.current).length === 6);
    const sam = structuredClone(w.entities.get(m.state.actors['hangar-sam'])!);
    sam.civilian!.model = 'npc.civilian-man-a';
    sam.civilian!.survivor = { key: 'sam', mode: 'hidden', slot: 0, leader: 0, cover: false, waitAt: 0, foundAt: 0 };
    w.progression!.campaign!.crossingHandover!.shelteredPassengers = [sam];
    w.entities.remove(m.state.actors['hangar-sam']); delete m.state.actors['hangar-sam'];
    m.state.states['story-initialized'] = false; m.state.states['hangar-cast'] = false;
    const continuity: string[] = [], stopContinuity = w.events.on('dialogue.line', e => { if (e.type === 'dialogue.line') continuity.push(e.id); });
    m.l10!.story.update(); stopContinuity();
    check(tier, 'living post-crash Sam keeps his radio lines and identity model', m.state.states['sam-alive'] &&
      continuity.includes('L10.farmstead') && w.entities.get(m.state.actors['hangar-sam'])?.civilian?.model === sam.civilian!.model, continuity);
    // Explicit release fixture; only the setup injects a position/state. Movement uses ordinary inputs.
    place(w, 4006, -24);
    for (const step of Object.values(m.state.steps)) step.status = 'completed'; m.state.steps.epilogue.status = 'active'; m.state.steps.credits.status = 'pending';
    const cell = w.infected!.nav.nearestCell(4008, -22, .4);
    const humanId = w.infected!.spawn('infected.runner', { x: w.infected!.nav.x(cell), z: w.infected!.nav.z(cell) });
    m.state.states['cure-released'] = true; m.l10!.cure.release();
    const start = { ...w.entities.get(1)!.transform };
    w.setInput({ ...emptyInput(), move: { x: 1, z: 0 } }); advance(w, 180); w.setInput(emptyInput());
    const recovered = w.entities.get(humanId);
    check(tier, 'green tide restores living infected as healthy same-ID people', !!recovered?.civilian && !recovered.infected && recovered.health.current > 0, { humanId, archetype: recovered?.archetype, hp: recovered?.health.current });
    check(tier, 'courier can walk among recovering people during release', Math.hypot(w.entities.get(1)!.transform.x - start.x, w.entities.get(1)!.transform.z - start.z) > 1 && !w.storyLock);
    advance(w, 65 * 60 - 180);
    check(tier, 'title starts within 65 seconds after delivery and compressed panorama', m.state.epilogue?.phase === 'title' && m.state.states['delivery-notified'] && m.state.cureFront!.radius === cureRadius(m.state.cureFront!.elapsed), { phase: m.state.epilogue?.phase, elapsed: m.state.cureFront!.elapsed });
    advance(w, 5 * 60 + 89 * 60);
    check(tier, 'readable credits remain for at least 89 seconds', m.state.epilogue?.phase === 'credits', m.state.epilogue);
    advance(w, 8 * 60);
    check(tier, 'credits finish through thanks and record a skippable repeat view', m.state.states['credits-finished'] && m.l10!.epilogue.canSkip);
    fixture.gaps = gaps; fixture.lines = lines; fixture.cast = cast; fixture.damage = damage;
  } catch (error) { fixture.error = String(error); check(tier, 'controlled fixtures execute', false, String(error)); }
  finally { w?.dispose(); }
  rows.push(fixture);
  if (process.env.L10_STORY_SKIP_ROUTE === '1') continue;
  try {
  const sightings: { tick: number; region: string; distance: number }[] = [], moved = new Set<number>(), firstSeen = new Set<number>(), idleEntries: number[] = [];
  let mounts = 0, minigunKills = 0, shortestRocket = Infinity, closeRocketBlasts = 0, mannedDamage = 0;
  const trace: unknown[] = [], deaths: unknown[] = [], recentHits: unknown[] = [];
  let finalState: unknown;
  let lastRegion = '', firstMegaSeen: number | null = null, fullArsenal = false;
  const run = await runLevel('L10', 'complete', 1, finaleOnly ? 360 : 1500, 'auto', undefined, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      world.events.on('mounted-gun.mounted', () => mounts++);
      world.events.on('combat.kill', e => { if (e.type === 'combat.kill' && e.actionId === 'weapon.rotary-minigun') minigunKills++; });
      world.events.on('combat.attack', e => {
        if (e.type !== 'combat.attack' || e.actionId !== 'weapon.rocket-launcher') return;
        const boss = world.megaPursuit?.entity();
        if (boss) shortestRocket = Math.min(shortestRocket, Math.hypot(boss.transform.x - e.position.x, boss.transform.z - e.position.z));
      });
      world.events.on('explosion', e => { if (e.type === 'explosion' && e.sourceId === 1 && /rocket/.test(e.defId) && Math.hypot(e.position.x - world.entities.get(1)!.transform.x, e.position.z - world.entities.get(1)!.transform.z) < 6) closeRocketBlasts++; });
      world.events.on('combat.hit', e => { if (e.type === 'combat.hit' && e.targetId === 1) { if (world.mountedGun?.mounted) mannedDamage += e.amount; recentHits.push({ tick: e.tick, action: e.actionId, amount: e.amount }); if (recentHits.length > 8) recentHits.shift(); } });
      world.events.on('player.died', () => deaths.push({ tick: world.tick, hits: [...recentHits] }));
      const update = world.update.bind(world);
      let finalePrepared = false;
      world.update = () => {
        if (finaleOnly && !finalePrepared && world.missions!.state.phase === 'playing') {
          finalePrepared = true;
          place(world, 4002, -20);
          while (world.missions!.state.steps.install.status !== 'active') world.missions!.completeObjective();
          world.player!.restoreVitals(world.tick);
          world.megaPursuit!.introduce({ x: 3945, z: -25 });
        }
        update(); const p = world.entities.get(1)!;
        for (const e of world.infected!.active) {
          if ((e.motion?.speed ?? 0) > .1) moved.add(e.id);
          if (e.health.current <= 0 || e.hidden || e.infected?.hidden || !world.infected!.director.inFrame(e.transform, 1, true) || world.infected!.director.occluded(e.transform)) continue;
          if (e.infected?.pursuit) {
            firstMegaSeen ??= world.tick / 60;
            const d = Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z), region = String(Math.floor(p.transform.x / 500));
            if (d < 30 && region !== lastRegion) { sightings.push({ tick: world.tick, region, distance: d }); lastRegion = region; }
          } else if (!firstSeen.has(e.id)) { firstSeen.add(e.id); if (!moved.has(e.id)) idleEntries.push(e.id); }
        }
        if (world.missions!.state.states['cure-carried']) {
          const ids = [...p.weapons!.LEFT.rack, ...p.weapons!.RIGHT.rack].map(s => s.id);
          fullArsenal ||= cureHangarWeapons.every(id => ids.includes(id));
        }
        if (world.tick % 1800 === 0) trace.push({ seconds: world.tick / 60, step: world.missions!.def.steps.find(step => world.missions!.state.steps[step.id].status === 'active')?.id, player: { ...p.transform, hp: p.health.current }, charge: world.missions!.state.counters['charge-ticks'], gun: world.mountedGun?.snapshot(), mega: world.megaPursuit?.snapshot() });
      };
    },
    beforeDispose: world => { finalState = { mission: world.missions!.state, gun: world.mountedGun?.snapshot(), mega: world.megaPursuit?.snapshot(), player: world.entities.get(1)!.transform }; },
  });
  check(tier, 'native ordinary-input route reaches credits', run.completed, { outcome: run.outcome, blocker: run.blocker, time: run.time, deaths: run.deaths });
  if (!finaleOnly) check(tier, 'Mega visibly enters widest frame within three minutes', firstMegaSeen !== null && firstMegaSeen <= 180, firstMegaSeen);
  if (!finaleOnly) check(tier, 'persistent Mega produces recurring close encounters in distinct route sections', sightings.length >= 3, sightings);
  if (!finaleOnly) check(tier, 'no ordinary infected first enters the widest frame standing idle', idleEntries.length === 0 && firstSeen.size > 0, { idleEntries, seen: firstSeen.size });
  if (!finaleOnly) check(tier, 'natural handoff gives the whole selectable arsenal', fullArsenal);
  check(tier, 'competent finale uses mounted gun to shred crowds', mounts > 0 && minigunKills > 0, { mounts, minigunKills });
  check(tier, 'no close-range ground rocket exploit', shortestRocket >= 10 && closeRocketBlasts === 0, { shortestTarget: Number.isFinite(shortestRocket) ? shortestRocket : 'no rockets', closeRocketBlasts });
  if (finaleOnly) check(tier, 'competent final fight wins without deaths', run.completed && run.deaths === 0, { deaths: run.deaths, outcome: run.outcome });
  rows.push({ tier, method: finaleOnly ? 'Explicit healthy full-arsenal arena setup; all subsequent fighting/movement/interaction uses ordinary inputs, no god mode or teleport.' : 'Unprotected production LevelTenBot; ordinary keyboard movement, aim, selection and interaction only.', run, mounts, minigunKills, shortestRocket, closeRocketBlasts, mannedDamage, sightings, firstMegaSeen, idleEntries, trace, deaths, finalState });
  console.log(`[l10-story] ${tier}: ${run.outcome}, ${Math.round(run.time)}s, ${run.deaths} deaths; close sightings=${sightings.length}`);
  } catch (error) { check(tier, 'native route executes', false, String(error)); rows.push({ tier, routeError: String(error) }); }
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ ...provenance(), checks, rows }, null, 2) + '\n');
console.log(`[l10-story] ${checks.filter(c => c.pass).length}/${checks.length} checks pass; ${out}`);
if (checks.some(c => !c.pass)) process.exitCode = 1;
