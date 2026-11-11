/** Native wide infected path audit across the complete campaign.
 * node --import tsx/esm tools/qa/wide-body-audit.ts [report.json]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { runnerLevels, runLevel } from '../sim-runner/levels';
import { cureEncounters, curePaceEncounters, cureEncounterSlots, cureEncounterSpot } from '../../src/levels/L10/encounters';
import { LevelNineSetPieces } from '../../src/sim/missions/LevelNineSetPieces';
import { crossing } from '../../src/levels/L9/district';
import { followFrustum } from '../sim-runner/l3Bots';
import { l4CollapseGroups } from '../../src/data/l4';
import { l4AlphaEmergence } from '../../src/levels/L4/layout';
import { l7Encounters } from '../../src/data/l7';
import { l5Wanderers } from '../../src/data/l5';
import { l6Entries, l6Doors } from '../../src/data/l6';
import { l3 } from '../../src/data/l3';
import type { L3StreetChoice } from '../../src/debug/bot/LevelThreeBot';
import { l9Groups, l9SetPieces, l9SetPieceTuning } from '../../src/data/l9';
import { infectedDef } from '../../src/data/infected';
import { megaAlpha } from '../../src/data/megaAlpha';
import { NavGrid, type Wall } from '../../src/sim/ai/NavGrid';
import type { SimWorld } from '../../src/sim/world/SimWorld';

const margin = .1;
const wide = (archetype: string, variant?: string) => archetype === 'infected.mega-alpha' || variant === megaAlpha.asset ||
  ['infected.brute', 'infected.butcher', 'infected.armored', 'infected.alpha'].includes(archetype);
type Spawn = { id: number; archetype: string; variant?: string; radius: number; x: number; z: number; tick: number; player: { x: number; z: number }; cohort: string; source: string; active?: boolean; wave?: string; objective?: string; route?: number[]; pathGrid?: NavGrid };
type Coverage = { expected: string[]; observed: string[]; missing: string[] };
type LevelResult = { coverage?: Coverage; route?: string; level: string; outcome: string; spawns: number; checks: number; unreachable: Spawn[]; narrowOpenings: { x: number; z: number; width: number; required: number; pathDistance: number; walls: string[]; bodies: number[] }[]; encounters: Spawn[] };

type AuditWall = Wall & { sourceId?: string };
function fullWalls(world: SimWorld): AuditWall[] {
  if (!world.chunks) return [...world.infected!.nav.walls];
  return world.districts!.districts.flatMap(d => [
    ...d.decay.colliders.filter(c => !c.walkable).map(c => ({ aabb: c.aabb, id: c.id })),
    ...d.blockers.map(blocker => ({ aabb: blocker, id: 'layout-blocker' })),
  ].filter(({ aabb }) => !aabb.physicsOnly).map(({ aabb: a, id }) => ({ x: (a.min[0] + a.max[0]) / 2 + d.origin[0], z: (a.min[2] + a.max[2]) / 2 + d.origin[1], y: (a.min[1] + a.max[1]) / 2,
      halfY: (a.max[1] - a.min[1]) / 2, halfX: (a.max[0] - a.min[0]) / 2, halfZ: (a.max[2] - a.min[2]) / 2,
      sourceId: id,
      navBlocker: a.navBlocker, ...(a.navFootprint ? { navFootprint: { ...a.navFootprint, x: a.navFootprint.x + d.origin[0], z: a.navFootprint.z + d.origin[1] } } : {}) })));
}
function path(nav: NavGrid, from: {x:number;z:number}, to: {x:number;z:number}): number[] | null {
  const a = nav.nearestCell(from.x, from.z, nav.clearance), b = nav.nearestCell(to.x, to.z), cells: number[] = [];
  return a >= 0 && b >= 0 && nav.path(a, b, cells, Infinity) ? [a, ...cells] : null;
}
function clearanceFor(row: Spawn): number { return row.radius + margin; }

const report: LevelResult[] = [];
const selectedLevels = process.env.WIDE_BODY_LEVELS?.split(',') as typeof runnerLevels[number][] | undefined;
const scenarios = runnerLevels.filter(level => !selectedLevels || selectedLevels.includes(level)).flatMap<{ level: typeof runnerLevels[number]; l9Route: string | undefined; l9Detour: boolean | undefined }>(level => level === 'L9'
  ? crossing.routes.flatMap(route => [false, true].map(detour => ({ level, l9Route: route.id, l9Detour: detour })))
  : [{ level, l9Route: undefined, l9Detour: undefined }]);
const streetScenarios = scenarios.flatMap(scenario => (scenario.level === 'L3' ? ['blvd', 'commerce', 'oak'] as const : ['auto'] as const).map(street => ({ ...scenario, street: street as L3StreetChoice })));
for (const { level, l9Route, l9Detour, street } of streetScenarios) {
  const spawns: Spawn[] = [];
  const seenWideIds = new Set<number>();
  const playerRoute: { x: number; z: number }[] = [];
  let outcome = 'not-run';
  let coverage: Coverage | undefined;
  let authoredSource: string | undefined;
  const l6FixtureObserved = new Set<number>();
  const restoreSources: (() => void)[] = [];
  let audit: Pick<LevelResult, 'unreachable' | 'narrowOpenings'> = { unreachable: [], narrowOpenings: [] };
  const run = await runLevel(level, 'newbie', 1, level === 'L10' ? 3600 : 2400, street, undefined, undefined, 0, {
    quality: 'high', l9Route, l9Detour,
    beforeBegin(world) {
      const ai = world.infected!, spawn = ai.spawn.bind(ai);
      if (level === 'L9') {
        const prototype = LevelNineSetPieces.prototype as unknown as Record<'stage' | 'stall', (this: unknown, ...args: unknown[]) => unknown>;
        for (const method of ['stage', 'stall'] as const) {
          const original = prototype[method];
          prototype[method] = function (this: unknown, ...args: unknown[]) {
            const previous = authoredSource;
            authoredSource = method === 'stage' ? String(args[2]) : 'stall-rush';
            try { return original.apply(this, args); } finally { authoredSource = previous; }
          } as typeof original;
          restoreSources.push(() => { prototype[method] = original as typeof prototype[typeof method]; });
        }
      }
      const recordWide = (entity: (typeof ai.active)[number], source: string) => {
        if (!wide(entity.archetype, entity.infected?.variant) || seenWideIds.has(entity.id)) return;
        seenWideIds.add(entity.id);
        const objective = world.missions?.def.steps.find(step => world.missions!.state.steps[step.id].status === 'active')?.id;
        spawns.push({ id: entity.id, archetype: entity.archetype, variant: entity.infected?.variant, radius: entity.infected?.variant === megaAlpha.asset ? megaAlpha.radius : entity.combat!.radius,
          x: entity.transform.x, z: entity.transform.z, tick: world.tick, player: { x: world.entities.get(1)!.transform.x, z: world.entities.get(1)!.transform.z },
          cohort: authoredSource ?? (level === 'L7' ? `pack-${entity.infected!.pack}` : `${level}-tick-${world.tick}`), source, active: true, wave: entity.infected?.cureRegion ?? (entity.infected?.territory ? 'territory' : undefined), objective });
      };
      const checkRoutes = () => {
        const targets = [...playerRoute, { x: world.entities.get(1)!.transform.x, z: world.entities.get(1)!.transform.z }];
        const grids = new Map<number, NavGrid>();
        for (const row of spawns) {
          if (row.route || !row.active) continue;
          const entity = world.entities.get(row.id);
          if (!entity?.infected || entity.health.current <= 0) continue;
          // Prove the authored spawn can reach the route; a later AI relocation
          // or scripted walk must not silently replace the start of this check.
          const from = { x: row.x, z: row.z };
          const source = row.variant === megaAlpha.asset && world.megaPursuit ? world.megaPursuit.grid
            : level === 'L4' && row.radius > .4 ? (ai as unknown as { wideNav?: NavGrid }).wideNav ?? ai.nav.withClearance(.7) : ai.nav;
          if (source.cell(from.x, from.z) < 0) continue;
          let nav = grids.get(Math.round((row.radius + margin) * 100));
          if (!nav) { nav = source.clearance >= row.radius + margin ? source : source.withClearance(row.radius + margin); grids.set(Math.round((row.radius + margin) * 100), nav); }
          for (const target of targets) {
            if (source.cell(target.x, target.z) < 0) continue;
            const cells = path(nav, from, target);
            if (cells) { row.route = cells; row.pathGrid = nav; break; }
          }
        }
      };
      playerRoute.push({ x: world.entities.get(1)!.transform.x, z: world.entities.get(1)!.transform.z });
      const update = world.update.bind(world);
      let l8FixtureInjected = false;
      let l6FixtureInjected = false;
      world.update = (...args: Parameters<typeof world.update>) => {
        if (level === 'L6' && !l6FixtureInjected && world.missions?.l6) {
          l6FixtureInjected = true;
          const player = world.entities.get(1)!, original = { ...player.transform };
          const move = (x: number, z: number) => {
            Object.assign(player.transform, { x, z }); world.spatial.set(1, x, z);
            world.physics.playerBody!.setTranslation(player.transform, true);
            world.physics.playerBody!.setNextKinematicTranslation(player.transform);
            followFrustum(world);
          };
          const subway = world.missions.l6 as unknown as { spawn(count: number, doors: number[], wave: number): number };
          for (const entry of l6Entries) {
            const door = l6Doors[entry.door];
            move(door.x - 24, 15);
            subway.spawn(entry.count, [entry.door], 4);
            if (world.missions!.state.l6!.spawnLog.some(row => row.wave === 4 && row.door === entry.door && spawns.some(body => body.id === row.id && body.tick === row.tick))) l6FixtureObserved.add(entry.door);
            move(door.x, 15);
            playerRoute.push({ x: door.x, z: 15 });
            checkRoutes();
          }
          Object.assign(player.transform, original); move(original.x, original.z);
        }
        if (level === 'L8' && !l8FixtureInjected && world.missions?.l8) {
          l8FixtureInjected = true;
          // Exercise the authored outlet heavy roles once the mission's prepared
          // outlet geometry exists; the ordinary bot may not visit every region.
          // The east outlet is intentionally sealed behind the zebra gate until
          // its arena clears, so audit the connected route state after authored
          // gates open instead of treating a pre-encounter lockdown as a jam.
          const zoo = world.missions.l8 as unknown as { state: { outlets: unknown[]; arenas: { phase: number }[] }; release(outlet: unknown, index: number, alpha: boolean): void; bosses: { updateGates(): void } };
          for (const arena of zoo.state.arenas) arena.phase = 3;
          zoo.bosses.updateGates();
          for (const index of [0, 1, 2, 3]) {
            const outlet = zoo.state.outlets[index];
            if (!outlet) continue;
            zoo.release(outlet, index, index < 3);
            world.tick++;
          }
          checkRoutes();
        }
        const result = update(...args);
        for (const entity of ai.active) recordWide(entity, 'active infected census');
        if (world.tick % 600 === 0) { const p = world.entities.get(1)!.transform; playerRoute.push({ x: p.x, z: p.z }); checkRoutes(); }
        return result;
      };
      ai.spawn = ((archetype, position, opts, conversion) => {
        const id = spawn(archetype, position, opts, conversion), entity = world.entities.get(id)!;
        recordWide(entity, new Error().stack?.split('\n').slice(2, 5).map(line => line.trim()).join(' <- ') ?? 'unknown');
        checkRoutes();
        return id;
      }) as typeof ai.spawn;
      const release = ai.release.bind(ai);
      ai.release = ((entity, ...args) => {
        seenWideIds.delete(entity.id);
        const row = [...spawns].reverse().find(entry => entry.id === entity.id && entry.active);
        if (row) row.active = false;
        return release(entity, ...args);
      }) as typeof ai.release;
    },
    beforeDispose(world) {
      for (const restore of restoreSources) restore();
      const walls = fullWalls(world);
      if (level === 'L3') {
        const expected = l3.density.alphas.map((_, index) => `route-alpha-${index}`);
        const admitted = world.missions!.state.l3?.alphaAt ?? [];
        const observed = expected.filter((_, index) => admitted[index] > 0);
        coverage = { expected, observed, missing: expected.filter(id => !observed.includes(id)) };
      }
      if (level === 'L4') {
        const state = world.missions!.state.l4!;
        const expected = l4AlphaEmergence.map(entry => `alpha/${entry.anchor}`);
        const observed = state.alphaAnchors.map(anchor => `alpha/${anchor}`);
        for (const [x, z, , , kind] of l4CollapseGroups) {
          if (!kind) continue;
          const id = `collapse/${x},${z}`;
          expected.push(id);
          if (state.pendingDoor.some(entry => entry.home.x === x && entry.home.z === z && spawns.some(body => body.id === entry.id))) observed.push(id);
        }
        coverage = { expected, observed, missing: expected.filter(id => !observed.includes(id)) };
      }
      if (level === 'L5') {
        const expected = l5Wanderers.flatMap(group => {
          const role = group.alpha ? 'infected.alpha' : group.archetype;
          return role && wide(role) ? Array.from({ length: group.n }, (_, index) => `${role}/${group.at.join(',')}/${index}`) : [];
        });
        const counts = new Map<string, number>();
        for (const row of spawns.filter(row => row.tick === 0)) counts.set(row.archetype, (counts.get(row.archetype) ?? 0) + 1);
        const observed = expected.filter(id => { const role = id.split('/')[0], remaining = counts.get(role) ?? 0; counts.set(role, remaining - 1); return remaining > 0; });
        coverage = { expected, observed, missing: expected.filter(id => !observed.includes(id)) };
      }
      if (level === 'L6') {
        const expected = l6Entries.map(entry => `hatch-${entry.door}`);
        const ledger = world.missions!.state.l6!.spawnLog;
        const observed = l6Entries.filter(entry => l6FixtureObserved.has(entry.door) || ledger.some(row => row.wave === 4 && row.door === entry.door && spawns.some(body => body.id === row.id && body.tick === row.tick))).map(entry => `hatch-${entry.door}`);
        coverage = { expected, observed, missing: expected.filter(id => !observed.includes(id)) };
      }
      if (level === 'L7') {
        const quotas = [[l7Encounters.firstStreetGroup, 1], [l7Encounters.firstStreetGroup + 1, 1], [l7Encounters.firstStreetGroup + 3, 1], [l7Encounters.finalGroup, 2]];
        const expected = quotas.flatMap(([group, count]) => Array.from({ length: count }, (_, slot) => `pack-${group}/alpha-${slot}`));
        const observed = quotas.flatMap(([group, count]) => Array.from({ length: Math.min(count, spawns.filter(row => row.cohort === `pack-${group}` && row.archetype === 'infected.alpha').length) }, (_, slot) => `pack-${group}/alpha-${slot}`));
        coverage = { expected, observed, missing: expected.filter(id => !observed.includes(id)) };
      }
      if (level === 'L9') {
        // Road formations cycle brute/armored roles; shortcut groups author Alphas.
        const expected = l9Groups.filter(g => g.route === l9Route && (g.alphas > 0 || g.route === 'road' && g.runners >= 3)).map(g => g.id);
        const ledger = world.missions!.l9!.state.encounters;
        const observed = expected.filter(id => ledger?.spawned.includes(id));
        for (const id of [...l9SetPieces.filter(piece => ['leapers', 'thrower', 'stall-ambush'].includes(piece.kind)).map(piece => piece.id), 'stall-rush']) {
          expected.push(id);
          const quota = id.startsWith('leapers-') ? l9SetPieceTuning.leaper.count : id === 'stall-ambush' ? 2 : id === 'stall-rush' ? l9SetPieceTuning.stall.rush.filter(role => wide(role)).length : 1;
          if (spawns.filter(row => row.cohort === id).length >= quota) observed.push(id);
        }
        coverage = { expected, observed, missing: expected.filter(id => !observed.includes(id)) };
      }
      if (level === 'L10' && world.chunks) {
        const bounds = world.districts!.nav;
        const base = new NavGrid({ width: bounds.max[0] - bounds.min[0], depth: bounds.max[1] - bounds.min[1] }, walls, .3,
          { x: (bounds.max[0] + bounds.min[0]) / 2, z: (bounds.max[1] + bounds.min[1]) / 2 }, null, .5);
        for (const tier of ['high', 'low'] as const) for (const group of [...cureEncounters, ...curePaceEncounters]) {
          for (const slot of cureEncounterSlots(group, tier).filter(slot => wide(slot.archetype))) {
            const at = cureEncounterSpot(base, slot), radius = infectedDef(slot.archetype).radius;
            const row: Spawn = { id: -spawns.length - 1, archetype: slot.archetype, radius, x: at?.x ?? slot.x, z: at?.z ?? slot.z,
              tick: world.tick, player: { x: group.at[0], z: group.at[1] }, cohort: `${group.id}/${tier}`, source: `cureEncounterSlots:${slot.key}`, active: false };
            const nav = base.withClearance(radius + margin);
            const cells = at && path(nav, at, row.player);
            if (cells) { row.route = cells; row.pathGrid = nav; }
            spawns.push(row);
          }
        }
      }
      if (level === 'L9' && world.chunks) {
        // L9 encounter packs can spawn several streamed districts behind the APC;
        // validate against the full authored road extent, not the last resident window.
        const bounds = world.districts!.nav, ground = { width: bounds.max[0] - bounds.min[0], depth: bounds.max[1] - bounds.min[1] };
        const center = { x: (bounds.max[0] + bounds.min[0]) / 2, z: (bounds.max[1] + bounds.min[1]) / 2 }, grids = new Map<number, NavGrid>();
        for (const row of spawns) {
          if (row.route) continue;
          const clearance = row.radius + margin, key = Math.round(clearance * 100);
          let nav = grids.get(key); if (!nav) { nav = new NavGrid(ground, walls, clearance, center, null, .5); grids.set(key, nav); }
          for (const target of playerRoute) {
            const cells = path(nav, { x: row.x, z: row.z }, target);
            if (cells) { row.route = cells; row.pathGrid = nav; break; }
          }
        }
      }
      const unreachable = spawns.filter(row => !row.route);
      const narrowOpenings: LevelResult['narrowOpenings'] = [];
      const apertures: { x: number; z: number; width: number; walls: string[] }[] = [];
      for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
        const a = walls[i], b = walls[j];
        if (a.y - a.halfY > 1.8 || a.y + a.halfY < .05 || b.y - b.halfY > 1.8 || b.y + b.halfY < .05) continue;
        const horizontal = a.halfX > a.halfZ * 2 && b.halfX > b.halfZ * 2;
        const vertical = a.halfZ > a.halfX * 2 && b.halfZ > b.halfX * 2;
        if (!horizontal && !vertical) continue;
        const overlap = horizontal ? Math.min(a.x + a.halfX, b.x + b.halfX) - Math.max(a.x - a.halfX, b.x - b.halfX)
          : Math.min(a.z + a.halfZ, b.z + b.halfZ) - Math.max(a.z - a.halfZ, b.z - b.halfZ);
        if (overlap <= 0) continue;
        const width = horizontal ? Math.abs(a.z - b.z) - a.halfZ - b.halfZ : Math.abs(a.x - b.x) - a.halfX - b.halfX;
        if (width < 0 || width >= 1.4) continue;
        const x = horizontal ? (Math.max(a.x - a.halfX, b.x - b.halfX) + Math.min(a.x + a.halfX, b.x + b.halfX)) / 2 : (a.x + b.x) / 2;
        const z = horizontal ? (a.z + b.z) / 2 : (Math.max(a.z - a.halfZ, b.z - b.halfZ) + Math.min(a.z + a.halfZ, b.z + b.halfZ)) / 2;
        if (!apertures.some(p => Math.hypot(p.x - x, p.z - z) < .5)) apertures.push({ x, z, width, walls: [a.sourceId ?? 'unlabelled', b.sourceId ?? 'unlabelled'] });
      }
      for (const row of spawns) {
        const route = row.route; if (!route || !row.pathGrid) continue;
        const nav = row.pathGrid;
        const pathPoints = route.map(cell => ({ x: nav.x(cell), z: nav.z(cell) }));
        for (const opening of apertures) {
          const { x, z, width } = opening;
          const pathDistance = Math.min(...pathPoints.map(p => Math.hypot(p.x - x, p.z - z)));
          if (width >= 2 * clearanceFor(row) || pathDistance > .6) continue;
          const existing = narrowOpenings.find(item => Math.hypot(item.x - x, item.z - z) < .5 && Math.abs(item.width - width) < .25);
          if (existing) { if (!existing.bodies.includes(row.id)) existing.bodies.push(row.id); }
          else narrowOpenings.push({ x, z, width, required: 2 * clearanceFor(row), pathDistance, walls: opening.walls, bodies: [row.id] });
        }
      }
      audit = { unreachable, narrowOpenings };
    },
  });
  outcome = run.outcome;
  report.push({ level, ...(level === 'L3' ? { route: street } : {}), ...(l9Route ? { route: `${l9Route}/${l9Detour ? 'detour' : 'main'}` } : {}), outcome, ...(coverage ? { coverage } : {}), spawns: spawns.length, checks: spawns.length, ...audit, encounters: spawns.map(row => ({ id: row.id, archetype: row.archetype, variant: row.variant, radius: row.radius, x: row.x, z: row.z, tick: row.tick, player: row.player, cohort: row.cohort, source: row.source, reachable: !!row.route, activeAtEnd: row.active, ...(row.wave ? { wave: row.wave } : {}), ...(row.objective ? { objective: row.objective } : {}) })) });
  console.log(`[wide-body] ${level}${level === 'L3' ? `/${street}` : ''}${l9Route ? `/${l9Route}/${l9Detour ? 'detour' : 'main'}` : ''}: ${outcome}; ${spawns.length} wide spawns, ${audit.unreachable.length} unreachable, ${audit.narrowOpenings.length} narrow openings`);
}
const output = process.argv[2] ?? 'test-results/qa-wide-body/report.json';
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ radiusMargin: margin, scope: selectedLevels ?? runnerLevels, note: 'Runtime encounter coverage uses the native campaign runner; each authored wide infected spawn is tested from its authored spawn to player route samples every ten simulation seconds on the sim navigation window baked with body radius plus margin. Streamed levels are checked as their navigation windows move. Narrow openings are paired ground-level collision boxes bordering the sampled path.', levels: report }, null, 2) + '\n');
if (report.some(level => level.unreachable.length || level.narrowOpenings.length || level.coverage?.missing.length)) process.exitCode = 1;
