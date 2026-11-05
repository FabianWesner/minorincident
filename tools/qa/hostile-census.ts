/** Production campaign roster audit; uses existing cases' load path without adding test cases.
 * Query probes originate at the actor to isolate eligibility from authored cover/attack reach. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { infectedDef, infectedDefinitions } from '../../src/data/infected';
import { missionIds } from '../../src/levels/missions';
import { cureEncounters, cureEncounterSlots, cureEncounterSpot } from '../../src/levels/L10/encounters';
import { missionControls } from '../../src/sim/missions/controls';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { clickable } from '../../src/input/ClickPick';
import { loadLevel } from '../../tests/qa/invariants/world';

const out = process.argv[2] ?? 'test-results/followups-25/hostile-census.json';
const rows: { level: string; tier: string; stage: string; hostiles: number; entities: unknown[] }[] = [];
const failures: unknown[] = [], unavailable: unknown[] = [];
function inspect(world: SimWorld, level: string, tier: string, stage: string) {
  const hostiles = [...world.entities.iterate()].filter(e => e.faction === 'infected' && (!e.health || e.health.current > 0) && !e.hidden && !e.infected?.hidden && !e.corpse && !e.pendingAdmission);
  const entities = hostiles.map(e => {
    const problems: string[] = [], query = world.combat!.query;
    if (!e.infected) problems.push('missing infected brain');
    if (!(e.health?.max > 0 && Number.isFinite(e.health.current))) problems.push('invalid health');
    if (!(e.combat && e.combat.radius > 0 && Number.isFinite(e.combat.radius))) problems.push('missing hit volume');
    if (!query.nearby(e.transform, .001).includes(e.id)) problems.push('missing spatial registration');
    if (!infectedDef(e.archetype).bar) problems.push('missing bar definition');
    if (!clickable(e)) problems.push('excluded from click picking');
    if (!query.melee(1, e.transform, { x: 1, z: 0 }, .001, 360, 1000).some(hit => hit.id === e.id)) problems.push('excluded from melee query');
    const excluded = new Set([...world.entities.iterate()].filter(other => other.id !== e.id).map(other => other.id));
    if (query.ray(1, e.transform, { x: 1, z: 0 }, .001, excluded)?.id !== e.id) problems.push('excluded from shot query');
    const hp = e.health?.current;
    const amount = world.combat!.damage.apply({ sourceId: 1, targetId: e.id, attackId: 1_000_000 + e.id, actionId: 'weapon.fire-axe', origin: e.transform, direction: { x: 1, z: 0 }, base: .01, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
    if (!(amount > 0 && e.health.current < hp)) problems.push('melee damage rejected');
    const row = { id: e.id, archetype: e.archetype, model: e.appearance?.asset ?? e.infected?.model ?? e.infected?.variant, hp, radius: e.combat?.radius, amount, problems };
    if (problems.length) failures.push({ level, tier, stage, ...row });
    return row;
  });
  rows.push({ level, tier, stage, hostiles: entities.length, entities });
  console.log(`${level}/${tier}/${stage}: ${entities.length} hostile infected`);
}
const step = (world: SimWorld, ticks = 120) => { world.combat!.damage.god = true; for (let tick = 0; tick < ticks; tick++) world.update(); };
for (const tier of ['high', 'low'] as const) for (const level of missionIds) {
  const initial = await loadLevel(level, 1, tier);
  const checkpoints = ['start', ...initial.missions!.def.checkpoints.filter(id => id !== 'start')];
  initial.dispose();
  for (const checkpoint of checkpoints) {
    const world = await loadLevel(level, 1, tier);
    try {
      if (checkpoint !== 'start') {
        try { world.missions!.loadCheckpoint(checkpoint); }
        catch (error) { if (String(error).includes('Unknown checkpoint')) { unavailable.push({ level, tier, checkpoint }); continue; } throw error; }
      }
      step(world); inspect(world, level, tier, checkpoint);
    } finally { world.dispose(); }
  }
  // Exercise the full shared hostile catalog under each level's combat rules, including
  // levels whose later waves cannot be reconstructed by an authored checkpoint alone.
  {
    const world = await loadLevel(level, 1, tier);
    try {
      world.combat!.damage.god = true;
      for (const e of [...world.infected!.active]) world.infected!.release(e);
      const nav = world.infected!.nav, player = world.entities.get(1)!.transform;
      for (const def of infectedDefinitions) {
        const cell = nav.nearestCell(player.x + 8, player.z, def.radius);
        if (cell < 0) throw new Error(`${level}: no catalog probe cell for ${def.id}`);
        const id = world.infected!.spawn(def.id, { x: nav.x(cell), z: nav.z(cell) }, { perched: false, birds: 1, ...(level === 'L10' && def.id === 'infected.alpha' ? { cureRegion: 'industrial-area' as const } : {}) });
        const e = world.entities.get(id)!;
        if (e.infected?.hidden) { missionControls(world).teleport(id, { x: player.x + 2, z: player.z }); step(world, 6); }
        if (e.infected?.hidden) failures.push({ level, tier, stage: 'catalog', archetype: def.id, error: 'ambusher not activated' });
        if (e.pendingAdmission) failures.push({ level, tier, stage: 'catalog', archetype: def.id, error: 'probe not admitted' });
        inspect(world, level, tier, `catalog:${def.id}`);
        world.infected!.release(e);
      }
    } finally { world.dispose(); }
  }
  if (level === 'L8') {
    const world = await loadLevel(level, 1, tier);
    try {
      const animals = [...world.entities.iterate()].filter(e => e.civilian?.zooAnimal);
      for (const e of animals) world.npcs!.civilians.outbreak!.turnNow(e);
      // Inspect immediately: distant converted animals may correctly sleep on the next chunk update.
      inspect(world, level, tier, 'native-zoo-conversions');
      const species = new Set(animals.filter(e => e.faction === 'infected').map(e => e.archetype));
      for (const speciesName of ['lion', 'gorilla', 'elephant', 'zebra', 'flamingo']) if (!species.has(`infected.${speciesName}`)) failures.push({ level, tier, stage: 'native-zoo-conversions', missing: speciesName });
    } finally { world.dispose(); }
  }
  if (level === 'L10') for (const group of cureEncounters) {
    const world = await loadLevel(level, 1, tier);
    try {
      world.tick = 7200;
      missionControls(world).teleport('player', { x: group.at[0], z: group.at[1] });
      world.chunks!.update();
      // Same visible encounter fixture as Scene Lab: production slots, placement and spawn;
      // bypass only the off-screen admission gate, which cannot admit a group around a test camera.
      const spawned = [];
      for (const slot of cureEncounterSlots(group, tier)) {
        const at = cureEncounterSpot(world.infected!.nav, slot, () => true, 129);
        if (at) spawned.push(world.infected!.spawn(slot.archetype, at, { state: 'idle', ...(slot.archetype === 'infected.alpha' ? { cureRegion: group.region } : {}) }));
      }
      inspect(world, level, tier, `encounter:${group.id}`);
      if (!spawned.length) failures.push({ level, tier, stage: group.id, error: 'authored group not instantiated' });
    } finally { world.dispose(); }
  }
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ rows, failures, unavailable, note: 'Unavailable checkpoint IDs have no standalone reconstruction; native L8 conversion and every L10 encounter are audited separately. Query probes isolate target eligibility; gameplay cover is retained in real-input runs.' }, null, 2) + '\n');
console.log(`Hostile census: ${rows.length} populations, ${rows.reduce((n, row) => n + row.hostiles, 0)} actors, ${failures.length} failures; ${out}`);
if (failures.length) process.exitCode = 1;
