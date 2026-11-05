import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { emptyInput } from '../../../src/input/InputFrame';
import { Minigun } from '../../../src/sim/combat/Minigun';
import { MegaPursuit } from '../../../src/sim/ai/MegaPursuit';
import { barEligible, followerBarCap } from '../../../src/render/HealthBars';
import { infectedDefinitions } from '../../../src/data/infected';
import { survivor } from '../../../src/data/survivor';
import { loadLevel, type RunnerLevel } from '../../sim-runner/levels';
import { runL1 } from '../../sim-runner/l1Bots';
import { loadL2 } from '../../sim-runner/l2Bots';
import { l1v2 } from '../../../src/data/l1v2';
import type { Clause } from './evaluate';
import type { Tier } from './probe';
import { finaleFixtures } from './finale-fixtures';
import { axeFixture } from './axe-fixture';
import { pickupApproachFixture, pickupApproachPass } from './pickup-approach-fixture';
import { batteryFixtures } from './battery-fixtures';
import { edgeFixtures } from './edge-fixtures';
import { l4TimingFixtures } from './l4-fixtures';
import { l1SpreadProbe, l1SpreadChecks } from './l1-spread';
import { l3FallbackProbe } from './l3-fallback';
import { shotgunStart, shotgunDamage } from './fix53-shotgun';
import { l5Alphas, l5AlphasPass } from './fix53-l5-alphas';
import { l6Trajectories, firstBreachPass } from './fix53-l6-trajectories';
import { l3PressureProbe } from './l3-pressure';

export const fixtureHash = () => createHash('sha256').update(readFileSync(new URL('./fix53-l6-trajectories.ts', import.meta.url))).update(readFileSync(new URL('./fix53-l5-alphas.ts', import.meta.url))).update(readFileSync(new URL('./fix53-fists.ts', import.meta.url))).update(readFileSync(new URL('./fix53-shotgun.ts', import.meta.url))).update(readFileSync(new URL('./pickup-approach-fixture.ts', import.meta.url))).update(readFileSync(new URL('./fixtures.ts', import.meta.url))).update(readFileSync(new URL('./l1-spread.ts', import.meta.url))).update(readFileSync(new URL('./l3-fallback.ts', import.meta.url))).update(readFileSync(new URL('./l3-pressure.ts', import.meta.url))).update(readFileSync(new URL('./l4-fixtures.ts', import.meta.url))).update(readFileSync(new URL('./finale-fixtures.ts', import.meta.url))).update(readFileSync(new URL('./axe-fixture.ts', import.meta.url))).update(readFileSync(new URL('./battery-fixtures.ts', import.meta.url))).update(readFileSync(new URL('./edge-fixtures.ts', import.meta.url))).update(readFileSync('tools/sim-runner/l2Bots.ts')).update(readFileSync('tools/sim-runner/l3Bots.ts')).update(readFileSync('tools/sim-runner/l6Bots.ts')).update(readFileSync('tests/fixtures/scenarios/infected.ts')).update(readFileSync('tests/fixtures/scenarios/combat-arena.ts')).update(readFileSync('tools/qa/fix55-l2-visibility.ts')).update(existsSync('docs/reports/fix55-a/L2-06-visibility.json') ? readFileSync('docs/reports/fix55-a/L2-06-visibility.json') : 'missing-visibility-evidence').digest('hex');
export interface FixtureReceipt { version: 1; level: RunnerLevel; tier: Tier; sourceHash: string; fixtureHash: string; checks: Clause[]; errors: string[]; observations?: Record<string, unknown> }
async function arena(tier: Tier, scenario = 'horde-arena') {
  const world = new SimWorld(); await world.init();
  try { world.loadScenario(scenario, 1); world.infected?.director.setTier(tier); return world; }
  catch (error) { world.dispose(); throw error; }
}
const step = (world: SimWorld, ticks: number) => { for (let i = 0; i < ticks; i++) world.update(); };

/** Controlled mechanics fixtures use actual production classes/transactions, independently of the completion bot.
 * These do not establish renderer pixels, route clarity, real browser input or difficulty. */
export async function runFixtures(level: RunnerLevel, tier: Tier, sourceHash: string, path: string): Promise<FixtureReceipt> {
  const result: FixtureReceipt = { version: 1, level, tier, sourceHash, fixtureHash: fixtureHash(), checks: [], errors: [] };
  const add = (id: string, clause: string, value: unknown, target: string, pass: boolean | undefined) => result.checks.push({ id, clause, value, target, status: pass === undefined ? 'NOT CHECKED' : pass ? 'PASS' : 'FAIL', tier, policy: 'controlled-fixture', receipt: path });
  async function fixture(name: string, run: () => Promise<void> | void) { try { await run(); } catch (error) { result.errors.push(`${name}: ${String(error)}`); } }
  if (level === 'L2' || level === 'L3') await fixture('production input batteries', async () => { result.observations = {}; await batteryFixtures(level, tier, add, result.observations); });
  if (level === 'L2') await fixture('pedestrian runner panic propagation', async () => {
    const cases = [];
    for (let index = 0; index < 4; index++) {
      const { world, mission } = await loadL2(1, tier);
      try {
        const ids = mission.state.l2!.benchIds, runner = world.entities.get(ids[index])!;
        const outbreak = world.npcs!.civilians.outbreak!;
        for (let tick = 0; tick < 30; tick++) { world.applyInput(emptyInput(), 'keyboard'); world.update(); }
        const p = runner.transform;
        outbreak.panic(runner, { x: p.x - Math.cos(p.yaw) * 5, z: p.z + Math.sin(p.yaw) * 5 });
        const exposed = new Map<number, { firstSeen: number; reacted: number | null }>();
        for (let tick = 0; tick < 600; tick++) {
          for (const id of ids) {
            const e = world.entities.get(id)!;
            if (id === runner.id || exposed.has(id) || e.civilian?.state !== 'calm' || e.civilian.story || !runner.motion || runner.motion.speed < 2) continue;
            const dx = p.x - e.transform.x, dz = p.z - e.transform.z, distance = Math.hypot(dx, dz);
            const facing = (dx * Math.cos(e.transform.yaw) - dz * Math.sin(e.transform.yaw)) / (distance || 1);
            if (distance <= l1v2.civilians.noticeRangeM && facing >= Math.cos(l1v2.civilians.noticeConeDeg * Math.PI / 360) &&
              world.combat!.query.visible(e.transform, p, runner.id) && (!outbreak.blockers || outbreak.blockers.clear(e.transform, p))) {
              exposed.set(id, { firstSeen: world.tick, reacted: null });
            }
          }
          world.applyInput(emptyInput(), 'keyboard'); world.update();
          for (const [id, sample] of exposed) if (sample.reacted === null && world.entities.get(id)!.civilian!.state !== 'calm') sample.reacted = world.tick;
        }
        cases.push({ runner: runner.id, index, neighbors: [...exposed].map(([id, sample]) => ({ id, ...sample })) });
      } finally { world.dispose(); }
    }
    const neighbors = cases.flatMap(c => c.neighbors);
    add('L2-13', 'native visible runner-to-calm pedestrian propagation', { cases, observedNeighbors: neighbors.length },
      'Existing calm neighbors with actual clear sight of a runner moving>=2m/s react by the next production perception poll (6 ticks); no injected actors or other panic stimulus',
      neighbors.length > 0 && neighbors.every(n => n.reacted !== null && n.reacted - n.firstSeen <= 6));
  });
  if (level === 'L2') await fixture('rendered ambush visibility', () => {
    const path = 'docs/reports/fix55-a/L2-06-visibility.json';
    type Actor = { id: number; projectedBounds: number[][] };
    type Sample = { tick: number; afterS: number; actors: Actor[] };
    type Cell = { tier: string; zoom: number; backend: string; quality: string; doorsOpenAt: number; tick: number; afterS: number; actors: Actor[]; samples: Sample[] };
    const evidence = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as { sourceHash: string; toolSha256: string; rows: Cell[] } : null;
    const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
    const matches = evidence?.sourceHash === sourceHash && evidence.toolSha256 === sha('tools/qa/fix55-l2-visibility.ts');
    for (const zoom of [.5, 1.5]) {
      const cell = evidence?.rows.find(row => row.tier === tier && row.zoom === zoom);
      const qualified = matches && cell?.backend === 'webgl' && cell.quality === tier && cell.afterS === .5 && cell.samples.length === 31 &&
        cell.samples.every((sample, i) => sample.tick === cell.doorsOpenAt + i && Math.abs(sample.afterS - i / 60) < 1e-9);
      const allOffscreen = qualified && cell.actors.length > 0 && cell.samples.every(sample => sample.actors.every(actor =>
        actor.projectedBounds.length === 3 && actor.projectedBounds.every(bounds => bounds.length === 2 && bounds.every(Number.isFinite) && bounds[0] <= bounds[1]) &&
        actor.projectedBounds.some(bounds => bounds[1] < -1 || bounds[0] > 1)));
      // A conservative body box outside a frustum plane proves absence.
      // Box overlap would require a pixel check; it cannot establish a PASS.
      add('L2-06', `actual follow-camera first-half-second visibility at zoom${zoom}`,
        { qualified, allOffscreen, samples: cell?.samples.length, firstTick: cell?.samples[0]?.tick, lastTick: cell?.tick, path, sha256: evidence ? sha(path) : null },
        'first ambush visible in actual camera within0.5s after doorsOpen', allOffscreen ? false : undefined);
    }
  });
  if (level === 'L5' || level === 'L6' || level === 'L7' || level === 'L9') await fixture('campaign edge cases', async () => { result.observations ??= {}; await edgeFixtures(level, tier, add, result.observations); });
  if (level === 'L4') await fixture('L4 camera and bar timers', () => l4TimingFixtures(tier, add));

  if (level === 'L3') await fixture('L3 exact fallback boundaries', async () => {
    const cases = await l3FallbackProbe(tier);
    add('L3-04', 'controlled first-of fallback boundaries', cases, '3turned /8inside /3600ticks; exact threshold and priority; station cohort excluded', cases.every(test => test.pass));
  });
  if (level === 'L3') await fixture('L3 forward pressure admission', async () => {
    const pressure = await l3PressureProbe(tier);
    result.observations = { ...result.observations, forwardPressure: pressure };
    add('L3-10', 'native idle pressure schedule and offscreen source band', pressure.batches, 'idle≥20s;25–75 queued;source15–35m behind and offscreen', pressure.queuedPass);
    add('L3-10', 'native idle pressure actual admissions per full ten-second window', pressure.windows, '25–75 actual admissions per10s, distinct from pending demand', pressure.windows.length ? pressure.windows.every(w => w.actualAdmissions >= 25 && w.actualAdmissions <= 75) : undefined);
    add('L3-10', 'native pressure queued admissions stop on advance', pressure.resumed, 'pressure clock cleared and zero unadmitted pressure entries after advancing', pressure.stoppedOnAdvance);
  });
  if (level === 'L1') await fixture('L1 remote spread census', async () => {
    const spread = await l1SpreadProbe(tier), checks = l1SpreadChecks(spread);
    const counts = spread.report.infectedAfterExit;
    add('L1-07', 'remote idle initial five infected', counts[0], 'exactly5 at release', checks.initialFive);
    add('L1-07', 'remote idle living infected at120s', counts[120], '≥15 at+120s', checks.at120);
    add('L1-07', 'remote idle living infected at240s', counts[240], '≥25 at+240s', checks.at240);
    add('L1-07', 'remote idle every additional turn follows a bite', { turns: spread.spreadTurns, directSpawns: spread.directSpawns }, 'every new turn has a preceding bite on the same ID; no direct additions', checks.bitesOnly);
    add('L1-07', 'remote observer remains undisturbed', { deaths: spread.report.deaths, damage: spread.report.damage, knockdowns: spread.report.knockdowns, kills: spread.report.kills }, 'zero deaths, damage and player knockdowns/kills', checks.observerSafe);
    add('L1-05', 'native accident event order and sequence clock', checks.accidentSequence, 'flicker→blast→ringing→smoke→screams within8s', checks.accidentSequencePass);
    result.observations = { ...result.observations, spread };
  });
  if (level === 'L1') await fixture('L1 ordinary bat acquisition', async () => {
    const world = await loadLevel('L1', 1, undefined, 0, { quality: tier });
    try {
      const mission = world.missions!, garage = mission.def.anchors['garage-bat'];
      const ownsBat = () => world.entities.get(1)!.weapons?.LEFT.rack.some(slot => slot.id === 'weapon.bat') ?? false;
      const initialBat = ownsBat(), trace: { first: { tick: number; x: number; z: number; distance: number; step: string } | null } = { first: null };
      const exits = new Map<number, { id: number; start: { x: number; z: number; tick: number }; end: { x: number; z: number; tick: number; headingDeg: number } | null }>();
      const report = runL1(world, mission, 'complete', { maxSeconds: 360, onTick: () => {
        const l1 = mission.state.l1!, door = l1.labExit;
        if (door) for (const id of l1.exitIds) {
          const e = world.entities.get(id);
          if (!e || e.health.current <= 0 || e.hidden || e.pendingAdmission) continue;
          const p = e.transform;
          // Observe crossing the front-door plane, then the first four metres
          // of actual departure. Authored headings do not prove AI motion.
          if ((p.x - door.x) * door.nx + (p.z - door.z) * door.nz < 1) continue;
          const exit = exits.get(id);
          if (!exit) exits.set(id, { id, start: { x: p.x, z: p.z, tick: world.tick }, end: null });
          else if (!exit.end && Math.hypot(p.x - exit.start.x, p.z - exit.start.z) >= 4)
            exit.end = { x: p.x, z: p.z, tick: world.tick, headingDeg: Math.atan2(p.z - exit.start.z, p.x - exit.start.x) * 180 / Math.PI };
        }
        if (!trace.first && ownsBat()) {
          const p = world.entities.get(1)!.transform;
          trace.first = { tick: world.tick, x: p.x, z: p.z, distance: Math.hypot(p.x - garage.x, p.z - garage.z), step: mission.state.steps.weapon.status };
        }
      } });
      const value = { initialBat, first: trace.first, garage, outcome: report.outcome, deaths: report.deaths };
      add('L1-13', 'ordinary first bat acquisition at garage', value, 'no initial bat; first ownership inside the garage interaction radius after its objective', !initialBat && report.outcome === 'complete' && !!trace.first && trace.first.distance <= garage.radius && trace.first.step === 'completed');
      const crossings = [...exits.values()], headings = crossings.flatMap(exit => exit.end ? [exit.end.headingDeg] : []);
      const gap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin((a - b) * Math.PI / 180), Math.cos((a - b) * Math.PI / 180))) * 180 / Math.PI;
      const separated = headings.some((a, i) => headings.slice(i + 1).some((b, j) => headings.slice(i + j + 2).some(c => Math.min(gap(a, b), gap(a, c), gap(b, c)) >= 60)));
      add('L1-06', 'observed front-door crossing order and departure headings', { technicianId: mission.state.l1!.techId, crossings, separated },
        '5 front-door crossings; technician physically first;≥3 actual departure headings separated by≥60 degrees',
        crossings.length === 5 && crossings[0].id === mission.state.l1!.techId && headings.length === 5 && separated);
      result.observations = { ...result.observations, batAcquisition: { ...value, report } };
    } finally { world.dispose(); }
  });
  if (level === 'L1') await fixture('L1 tier run speeds', async () => {
    const world = await arena(tier);
    try {
      world.scenario = 'L1'; world.infected!.configureL1v2();
      const cells: { id: number; tier: string; speed: number; upper: number }[] = [];
      // Absolute E19/acceptance bounds, independent of the production tuning.
      for (const [speedTier, base] of [['frail', 4.7], ['average', 5.3], ['athletic', 5.6]] as const) {
        for (let i = 0; i < 100; i++) {
          const id = world.infected!.spawn('infected.runner', { x: 10, z: 0 }, { tier: speedTier });
          const entity = world.entities.get(id)!;
          cells.push({ id, tier: speedTier, speed: entity.infected!.l1!.runSpeed, upper: base * 1.04 });
          world.infected!.release(entity);
        }
      }
      add('L1-09', 'production L1 tier run-speed bounds', cells, 'every speed≥4.4 m/s and≤its tier base×1.04 (4.7/5.3/5.6 m/s)',
        cells.length === 300 && cells.every(cell => cell.speed >= 4.4 - 1e-9 && cell.speed <= cell.upper + 1e-9));
      const faster = cells.filter(cell => cell.speed > 4.5).length;
      add('L1-09', 'equal-tier spawn share faster than4.5m/s', { perTier: 100, total: cells.length, faster, percent: faster * 100 / cells.length },
        '≥85% of an equal tier mix faster than the4.5 m/s player', faster / cells.length >= .85);
    } finally { world.dispose(); }
  });

  await fixture('health bar eligibility', async () => {
    const world = await arena(tier);
    try {
      const id = world.infected!.spawn('infected.runner', { x: 10, z: 0 }), specimen = world.entities.get(id)!;
      const cells = ['infected.alpha', 'infected.lion', 'infected.gorilla', 'infected.elephant', 'infected.zebra', 'infected.flamingo'].map(archetype => {
        const e = structuredClone(specimen); e.archetype = archetype;
        const flag = !!infectedDefinitions.find(def => def.id === archetype)!.bar;
        e.transform.x = 15; const near = barEligible(e, { x: 0, z: 0 }, flag);
        e.transform.x = 15.01; const farHealthy = barEligible(e, { x: 0, z: 0 }, flag);
        e.health.current--; const farDamaged = barEligible(e, { x: 0, z: 0 }, flag);
        e.health.current = 0; const dead = barEligible(e, { x: 0, z: 0 }, flag);
        delete e.infected; e.faction = 'civilian'; e.health.current = e.health.max; const healthyAnimal = barEligible(e, { x: 0, z: 0 }, flag);
        return { archetype, near, farHealthy, farDamaged, dead, healthyAnimal };
      });
      add('G-24', 'production enemy-bar eligibility at distance/health boundaries', cells, 'near/full and far/damaged true; far/full, dead and healthy animals false', cells.every(cell => cell.near && !cell.farHealthy && cell.farDamaged && !cell.dead && !cell.healthyAnimal));
      // A real civilian component supplies all fields expected by the production eligibility function.
      const followers: EntitySnapshot[] = Array.from({ length: 35 }, (_, i) => ({ ...structuredClone(specimen), id: 1000 + i, faction: 'civilian', infected: undefined, hidden: false,
        civilian: { state: 'calm', ambient: false, adult: true, pet: null, owner: null, variant: '', routine: '', waypoints: [], waypoint: 0, pauseUntil: 0, entered: 0, until: 0, downTicks: 0, eyesGlow: false, veins: 0, attacker: 0, threat: { x: 0, z: 0 }, path: [], goal: -1, pathIndex: 0, gore: false, knockedUntil: 0, survivor: { key: `fixture-${i}`, mode: 'follow', leader: 1, slot: i, cover: false, waitAt: 0, foundAt: 0 } } }));
      const visible = followers.filter(e => barEligible(e, { x: 0, z: 0 }, false, true)).length;
      add('G-12', '35-follower production eligibility and cap', { eligible: visible, cap: String(followerBarCap) }, '35/35 eligible; no finite follower cap (pixels still unreviewed)', visible === 35 && followerBarCap >= 35);
    } finally { world.dispose(); }
  });

  await fixture('approach pickups without E', async () => {
    const cells = [];
    for (const shelf of [false, true]) {
      const world = await arena(tier);
      try {
        const id = world.combat!.pickups.spawn('weapon.bat', { x: 3.5, z: 0 }, false, { retain: true, interactTicks: 60, ...(shelf ? { surfaceY: .8 } : {}) });
        const at = { ...world.entities.get(id)!.transform }; let distance: number | null = null;
        const stop = world.events.on('pickup.collected', event => { if (event.type === 'pickup.collected' && 'pickupId' in event && event.pickupId === id) { const p = world.entities.get(1)!.transform; distance = Math.hypot(p.x - at.x, p.z - at.z); } });
        for (let tick = 0; tick < 90 && distance === null; tick++) { world.applyInput({ ...emptyInput(), move: { x: 1, z: 0 } }, 'keyboard'); world.update(); }
        world.applyInput(emptyInput(), 'keyboard'); step(world, 120); stop();
        const events = world.events.events().filter(event => event.type === 'pickup.collected' && 'pickupId' in event && event.pickupId === id);
        cells.push({ shelf, distance, ePressed: false, collected: events.length, originalEntityRemaining: !!world.entities.get(id) });
      } finally { world.dispose(); }
    }
    add('G-10', 'isolated ground/shelf weapon approach with E continuously false', cells, 'one collection per specimen; ground≤1.5 m; shelf≤2.2 m', cells.every(cell => cell.distance !== null && cell.distance <= (cell.shelf ? 2.2 : 1.5) + 1e-6 && cell.collected === 1));
    add('G-11', 'pickup remains removed for 120 ticks after transaction', cells, 'one transaction and no original entity', cells.every(cell => cell.collected === 1 && !cell.originalEntityRemaining));
  });

  if (level === 'L6') await fixture('all pickup classes while walking without E or clicks', async () => {
    const cells = await pickupApproachFixture(tier);
    add('G-10', 'moving approach collection for every pickup class', cells, '16/16 cells: seven weapons ground/shelf, medkit, authored L6 headlamp; moving; E/clicks false; one transaction and actual item effect; ground≤1.5m, shelf≤2.2m', pickupApproachPass(cells));
  });

  if (level === 'L2') await fixture('axe single and roundhouse', async () => {
    const cells = await axeFixture(tier), crowd = cells.find(cell => cell.count === 3)!;
    add('L2-10', 'axe single/roundhouse target selection', cells, 'single swing with1–2 nearby; roundhouse hits all3', cells.every(cell => cell.count < 3 ? cell.style === 'single' && cell.hitIds.length >= 1 : cell.style === 'roundhouse' && cell.hitIds.length === 3));
    add('L2-10', 'axe measured roundhouse displacement', crowd.pushes, 'each of3 targets pushed≥2 m', crowd.pushes.length === 3 && crowd.pushes.every(push => push.metres >= 2));
  });

  if (level === 'L6') await fixture('actual first breach shelter-floor arrivals', async () => {
    const value = await l6Trajectories(tier);
    add('L6-03', 'actual first breach bang clock and six shelter-floor arrivals', value, 'breach30–40s; bang≥1.5s before; at least6 actual bodies reach authored shelter floor before second breach; canonical control identical', firstBreachPass(value));
  });

  if (level === 'L5') await fixture('living Alpha reachability after ordinary cellar exit', async () => {
    const value = await l5Alphas(tier);
    add('L5-04', 'living Alphas have body-clear routes after actual cellar exit', value, 'at least2 living Alphas; every actual body has a legal path to the street courier', l5AlphasPass(value));
  });

  if (level === 'L5') await fixture('initial shotgun approach and close-shell incapacitation', async () => {
    const start = await shotgunStart(tier), regular = await shotgunDamage(tier, 'infected.runner'), alpha = await shotgunDamage(tier, 'infected.alpha');
    add('L5-01', 'authored shotgun start distance and moving approach pickup', start, 'start≤3m; moving E-free approach; shelf collection≤2.2m; exactly one collection', start.pass);
    add('L5-01', 'one close shotgun shell incapacitates60HP regular', regular, 'one actual shell; native60HP specimen incapacitated', regular.pass);
    add('L5-01', 'two close shotgun shells incapacitate300HP Alpha within0.6s', alpha, 'two actual shells; native300HP Alpha incapacitated≤0.6s from first action start including raise', alpha.pass);
  });

  if (['L1', 'L3', 'L4', 'L5'].includes(level)) await fixture('native weapon incapacitation', async () => {
    const cases = level === 'L1' ? ['weapon.fists', 'weapon.bat'] : level === 'L3' ? ['weapon.handgun'] : level === 'L5' ? ['weapon.shotgun'] : ['weapon.army-mg'];
    for (const weapon of cases) for (const flank of level === 'L4' ? [false, true] : [false]) {
      const world = await arena(tier);
      try {
        world.scenario = level; const ai = world.infected!, player = world.entities.get(1)!;
        const ranged = !['weapon.fists', 'weapon.bat'].includes(weapon), at = { x: ranged ? 6 : 1.3, z: 0 };
        const id = ai.spawn(level === 'L4' ? 'infected.riot' : 'infected.runner', at, { state: 'idle', yaw: flank ? Math.PI / 2 : Math.PI });
        const enemy = world.entities.get(id)!;
        if (level === 'L3') enemy.health.current = enemy.health.max = 40;
        const initialHp = enemy.health.current;
        ai.update = () => {}; // Isolate weapon mechanics; this is not a mortal fight policy.
        world.combat!.setLoadout([weapon], ['weapon.kick']);
        for (let tick = 0; tick < 1200 && enemy.health.current > 0; tick++) {
          const dx = enemy.transform.x - player.transform.x, dz = enemy.transform.z - player.transform.z, distance = Math.hypot(dx, dz) || 1;
          world.setInput({ move: !ranged && distance > 1.1 ? { x: dx / distance, z: dz / distance } : { x: 0, z: 0 }, aimSource: 'keyboard', aim: { x: dx / distance, z: dz / distance }, aimPoint: { x: enemy.transform.x, z: enemy.transform.z }, left: { down: false, held: true, up: false } }); world.update();
        }
        const hits = world.events.events().filter(event => event.type === 'combat.hit' && event.targetId === id && event.amount > 0);
        const value = { weapon, flank, initialHp, endHp: enemy.health.current, hitCount: hits.length, seconds: world.tick / 60, hpAmounts: hits.map(event => event.type === 'combat.hit' ? event.amount : 0), isolatedAI: true };
        if (level === 'L1') add('L1-13', `${weapon} hits to incapacitate native regular`, value, weapon === 'weapon.fists' ? '6–7 hits' : '2 hits', enemy.health.current <= 0 && (weapon === 'weapon.fists' ? hits.length >= 6 && hits.length <= 7 : hits.length === 2));
        if (level === 'L3') add('L3-01', 'handgun hits versus40 HP specimen', value, '2 hits', enemy.health.current <= 0 && hits.length === 2);
        if (level === 'L4') add('L4-11', `${flank ? 'flank' : 'front'} MG isolated riot incapacitation`, value, flank ? '≤2 s' : '≤6 s and positive frontal damage', enemy.health.current <= 0 && world.tick / 60 <= (flank ? 2 : 6) && hits.length > 0);
        if (level === 'L5') add('L5-01', 'shotgun shells versus native regular', value, 'native result; full approach/Alpha timing row still open', undefined);
      } finally { world.dispose(); }
    }
  });

  if (level === 'L10') {
    await fixture('finale predicate and cure', () => finaleFixtures(tier, add));
    await fixture('dog attacks', async () => {
      const world = await arena(tier);
      try {
        const id = world.infected!.spawn('infected.dog', { x: 1, z: 0 }, { state: 'chase' }), dog = world.entities.get(id)!;
        const hits: { tick: number; amount: number; reach: number; attackId: number }[] = [];
        world.events.on('combat.hit', event => { if (event.type === 'combat.hit' && event.sourceId === id && event.targetId === 1) { const p = world.entities.get(1)!; hits.push({ tick: event.tick, amount: event.amount, reach: Math.hypot(dog.transform.x - p.transform.x, dog.transform.z - p.transform.z), attackId: event.attackId }); } });
        step(world, 600);
        const telegraphs = world.events.events().filter(event => event.type === 'telegraph' && event.sourceId === id);
        const values = { speedRatio: dog.infected!.speed / survivor.speed, hits, telegraphs };
        add('L10-06', 'native dog speed ratio', values.speedRatio, '1.1× run', Math.abs(values.speedRatio - 1.1) < 1e-6);
        add('L10-06', 'actual dog hit damage/reach', hits, '10 HP each; reach≤2 m', hits.length ? hits.every(hit => hit.amount === 10 && hit.reach <= 2) : undefined);
        add('L10-06', 'actual dog telegraph duration', telegraphs, '≥0.6 s', telegraphs.length ? telegraphs.every(event => event.type === 'telegraph' && 'duration' in event && event.duration >= .6) : undefined);
        const cooldowns = hits.slice(1).map((hit, index) => (hit.tick - hits[index].tick) / 60 - .65);
        add('L10-06', 'dog cooldown between hit and next windup', cooldowns, '≥2 s', cooldowns.length ? cooldowns.every(seconds => seconds >= 2 - 1 / 60) : undefined);
      } finally { world.dispose(); }
    });
    await fixture('minigun state machine', () => {
      const gun = new Minigun(); gun.spin = 1;
      let rounds = 0; for (let tick = 0; tick < 60; tick++) rounds += gun.step(true);
      add('L10-10', 'minigun rounds and heat per full-speed second', { rounds, heat: gun.heat }, '20 rounds; heat+0.125', rounds === 20 && Math.abs(gun.heat - .125) < 1e-6);
      for (let tick = 0; tick < 600 && !gun.locked; tick++) gun.step(true);
      add('L10-10', 'minigun overheat lock', gun.snapshot(), 'locked at100%', gun.locked && gun.heat === 1);
      gun.restore({ heat: .4, locked: true });
      const lockedAt40 = gun.locked; gun.step(false);
      add('L10-10', 'minigun unlock threshold', { lockedAt40, afterCooling: gun.snapshot() }, 'still locked at40%, unlock below40%', lockedAt40 && gun.heat < .4 && !gun.locked);
    });
    await fixture('Mega damage thresholds', async () => {
      const world = await arena(tier, 'mega-course');
      try {
        const boss = new MegaPursuit(world, { introduceTick: null });
        const id = boss.introduce({ x: 8, z: 0 }), entity = world.entities.get(id)!;
        const hp = entity.health.max, conventional: number[] = [], rockets: number[] = [];
        const hit = (attackId: number, rocket: boolean) => world.combat!.damage.apply({ attackId, actionId: rocket ? 'weapon.rocket-launcher' : 'weapon.rotary-minigun', sourceId: 1, targetId: id, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 99999, multiplier: 1, type: rocket ? 'explosive' : 'bullet', knockback: 0, stagger: 0, direct: rocket });
        for (let i = 0; i < 20; i++) { hit(i + 1, false); conventional.push(entity.health.current); }
        entity.health.current = hp;
        for (let i = 0; i < 10; i++) { hit(100 + i, true); rockets.push(entity.health.current); }
        add('L10-12', 'Mega conventional damage floor', { hp, remaining: conventional }, 'never below90% HP', conventional.every(value => value >= .9 * hp));
        add('L10-12', 'Mega direct rocket9/10 HP threshold', { hp, remaining: rockets }, 'survives9; dies on10', rockets.slice(0, 9).every(value => value > 0) && rockets[9] <= 0);
        boss.dispose();
      } finally { world.dispose(); }
    });
  }
  return result;
}
