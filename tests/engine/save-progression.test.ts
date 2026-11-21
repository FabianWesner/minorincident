// Save, load, Continue and the level handovers: one code path carries the courier's arsenal, upgrades and
// world state through all ten levels. A regression here costs players their weapons (P1 10-20: "I lost the shotgun").
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, test, vi } from 'vitest';
import { epilogueSurvivorLines } from '../../src/data/epilogueSurvivors';
import { action, catalog } from '../../src/data/actions/catalog';
import { l2WeaponPickup } from '../../src/data/l2';
import { l3WeaponPickup } from '../../src/data/l3';
import { l4 } from '../../src/data/l4';
import { l5DroppedWeapons, l5WeaponPickup } from '../../src/data/l5';
import { l7Rocket } from '../../src/data/l7';
import { transactArsenal } from '../../src/sim/progression/arsenal';
import { emptyInput } from '../../src/input/InputFrame';
import { Loadout } from '../../src/sim/combat/Loadout';
import { beginRewards, debugCampaign, finishRewards, gearTier, newCampaign, pickUpgrades, preset, resetCampaignStoryForReplay, revealCards, type CampaignSave, type Level } from '../../src/sim/progression/Campaign';
import { campaignLoadout, restoreSelectedAction } from '../../src/sim/progression/apply';
import { completeCampaignLevel, recordL8Transport } from '../../src/sim/progression/carryover';
import { commitCrossingHandover } from '../../src/sim/progression/crossingHandover';
import { decodeSave, encodeSave, SaveStore, validateSave } from '../../src/sim/progression/Save';
import { migrateCureResume } from '../../src/sim/progression/cureSave';
import { debugFlagEnabled } from '../../src/ui/debugFlag';
import { loadLevel } from '../../tools/sim-runner/levels';
import { cureHangarWeapons, levelTenMission } from '../../src/levels/L10/mission';
import { surrenderHeavyWeapons } from '../../src/sim/missions/L8Gate';
import { weaponKey } from '../../src/data/weaponKeys';
import { overlapsBuilding, overlapsPaving, overlapsRoad } from '../../src/levels/districts/validate';
import { cureEvacuationLane } from '../../src/levels/L10/vignettes';
import { cureEncounterSlots, curePaceEncounters } from '../../src/levels/L10/encounters';

const result = { time: 1, kills: 0, knockdowns: 0, damage: 0, deaths: 0, rescued: 0, optionalObjectives: [] };
function legacyL10PaceCheckpointsMigrate(): void {
  for (const [x, expected] of [[2900, 'cure-research'], [3100, 'l10-quarantine-gate'], [3300, 'l10-convoy-7'], [3600, 'l10-field-hospital'], [3800, 'cure-complex']] as const) {
    const snapshot = { state: { checkpoint: 'cure-pace-12', states: {}, counters: {} }, entities: [{ id: 1, transform: { x, z: 0 } }] };
    const migrated = migrateCureResume({ current: structuredClone(snapshot), checkpoint: structuredClone(snapshot) }) as { current: typeof snapshot; checkpoint: typeof snapshot };
    expect(migrated.current.state.checkpoint, `saved at x=${x}`).toBe(expected);
    expect(migrated.checkpoint.state.checkpoint, `retry at x=${x}`).toBe(expected);
    expect((migrated.current.state.states as Record<string, boolean>)['l10-overpass-mega']).toBe(x >= 3320);
    expect((migrated.checkpoint.state.states as Record<string, boolean>)['l10-overpass-mega']).toBe(x >= 3320);
  }
  for (const x of [3319, 3320, 3379]) {
    const snapshot = { state: { checkpoint: 'l10-convoy-7', states: {}, counters: {} }, entities: [{ id: 1, transform: { x, z: 95 } }] };
    const migrated = migrateCureResume({ current: snapshot, checkpoint: snapshot }) as { current: typeof snapshot };
    expect((migrated.current.state.states as Record<string, boolean>)['l10-overpass-mega']).toBe(x >= 3320);
  }
  const modern = { state: { checkpoint: 'l10-convoy-7', states: { 'l10-overpass-mega': false }, counters: {} }, entities: [{ id: 1, transform: { x: 3340, z: 95 } }] };
  const retained = migrateCureResume({ current: modern, checkpoint: modern }) as { current: typeof modern };
  expect(retained.current.state.states['l10-overpass-mega']).toBe(false);
}
/** The slice of a world that completeCampaignLevel reads: the player's two racks and the selected action. */
const fakeWorld = (racks: CampaignSave['racks'], selectedAction = 'weapon.handgun') => ({
  entities: { get: (id: number) => id === 1 ? { weapons: { selectedSide: racks.RIGHT.includes(selectedAction) ? 'RIGHT' : 'LEFT', LEFT: { index: racks.LEFT.indexOf(selectedAction), rack: racks.LEFT.map(id => ({ id })) }, RIGHT: { index: racks.RIGHT.indexOf(selectedAction), rack: racks.RIGHT.map(id => ({ id })) } } } : undefined, iterate: () => [][Symbol.iterator]() },
}) as never;
const resume = (save: CampaignSave, level: number) => { const l = campaignLoadout(save, level as Level); return new Loadout(l.LEFT, l.RIGHT, undefined, l.size); };

test('L1–L10 starts clamp progressed saves and fresh handovers to story weapons, keeping eligible carry-over and selection', async () => {
  legacyL10PaceCheckpointsMigrate();
  const hangarSave = preset('L10-default');
  hangarSave.ownedActions.push('weapon.bat', 'weapon.army-mg', 'weapon.flashbang', 'weapon.grenade');
  hangarSave.racks.LEFT.push('weapon.bat'); hangarSave.racks.RIGHT.push('weapon.grenade', 'weapon.army-mg', 'weapon.flashbang');
  const combat = { rackCapacity: 32, runner: { loadout: new Loadout(['weapon.fire-axe'], ['weapon.fire-axe']) }, setLoadout(left: string[], right: string[]) { this.runner.loadout = new Loadout(left, right, undefined, 32); } };
  const hangarWorld = { scenario: 'L10', progression: { campaign: hangarSave }, combat, events: { emit() {} }, tick: 0 };
  transactArsenal(hangarWorld as never, cureHangarWeapons, ['weapon.bat', 'weapon.army-mg', 'weapon.flashbang']);
  expect(combat.runner.loadout.activeEntries().map(entry => entry.id).sort()).toEqual([...cureHangarWeapons].sort());
  expect(hangarSave.ownedActions).toContain('ability.corgi-lure');

  // The public pause overlay accepts both query spellings used in production reports.
  expect(['1', 'true'].map(value => debugFlagEnabled(new URLSearchParams(`debug=${value}`)))).toEqual([true, true]);
  expect(['', '0', 'false'].map(value => debugFlagEnabled(new URLSearchParams(`debug=${value}`)))).toEqual([false, false, false]);
  expect(debugFlagEnabled(new URLSearchParams())).toBe(false);
  const finished = preset('L10-default'); finished.completedLevels = 10;
  finished.world = { infectionCleared: { level: 10, releasedAt: 123, epilogueSeen: true } };
  finished.cureResume = { current: {} } as CampaignSave['cureResume']; finished.l9Crash = {} as NonNullable<CampaignSave['l9Crash']>;
  resetCampaignStoryForReplay(finished);
  expect(finished.world?.infectionCleared).toBeUndefined(); expect(finished.cureResume).toBeUndefined();
  expect(finished.l9Crash).toBeUndefined(); expect(finished.completedLevels).toBe(10);
  const bat = 'weapon.bat', axe = 'weapon.fire-axe', handgun = 'weapon.handgun', mg = 'weapon.army-mg', shotgun = 'weapon.shotgun', rifle = 'weapon.assault-rifle', rocket = 'weapon.rocket-launcher';
  // Expected story boundaries are independent of the production pickup declarations below.
  const expected = [[], [bat], [bat,axe], [axe,handgun], [axe,handgun,mg], [axe,handgun,mg,shotgun], [axe,handgun,mg,rifle], [axe,handgun,mg,shotgun,rocket], [axe,handgun,rifle], []];
  const expectedSides = [
    { LEFT:['weapon.fists'], RIGHT:['weapon.kick'] }, { LEFT:[bat], RIGHT:['weapon.kick'] },
    { LEFT:[bat,axe], RIGHT:['weapon.kick'] }, { LEFT:[axe], RIGHT:[handgun] },
    { LEFT:[axe], RIGHT:[handgun,mg] }, { LEFT:[axe], RIGHT:[handgun,mg,shotgun] },
    { LEFT:[axe], RIGHT:[handgun,mg,rifle] }, { LEFT:[axe], RIGHT:[handgun,mg,shotgun] },
    { LEFT:[axe], RIGHT:[handgun,rifle] }, { LEFT:['weapon.fists'], RIGHT:['weapon.kick'] },
  ];
  const pickups: Record<number, string[]> = { 1:[bat], 2:[l2WeaponPickup], 3:[l3WeaponPickup], 4:[l4.machineGun.id], 5:[...new Set([l5WeaponPickup, ...l5DroppedWeapons.map(p => p.actionId)])], 7:[l7Rocket.action] };
  const weapons = (racks: CampaignSave['racks']) => [...new Set([...racks.LEFT,...racks.RIGHT].filter(id => !['weapon.fists','weapon.kick'].includes(id) && catalog[id].category !== 'ability'))].sort();
  const fresh = newCampaign();
  for (let level = 1; level <= 10; level++) {
    const progressed = preset('L10-default'); progressed.completedLevels = 10;
    progressed.racks = { LEFT:[bat,axe,'weapon.pistol','weapon.knife'], RIGHT:[rocket,rifle,shotgun,mg,handgun,'weapon.smg'] };
    progressed.ownedActions = [...new Set([...progressed.ownedActions,...Object.keys(catalog).filter(id=>id.startsWith('weapon.') && id!=='weapon.rotary-minigun'),...progressed.racks.LEFT,...progressed.racks.RIGHT])];
    progressed.selectedAction = handgun;
    expect(validateSave(progressed), `L${level} finished-L10 fixture`).toBe(true);
    const checkpoint = structuredClone(level===1?newCampaign():preset(`L${level}-default` as `L${2|3|4|5|6|7|8|9|10}-default`));
    checkpoint.racks={LEFT:[axe,bat,'weapon.knife'],RIGHT:[rocket,rifle,shotgun,mg,handgun,'weapon.smg']};
    checkpoint.ownedActions=[...new Set([...checkpoint.ownedActions,...checkpoint.racks.LEFT,...checkpoint.racks.RIGHT])];
    checkpoint.selectedAction=handgun;
    expect(validateSave(checkpoint), `L${level} mid-level checkpoint fixture`).toBe(true);
    let boundary = campaignLoadout(fresh, level);
    for (const save of [progressed, fresh, checkpoint]) {
      const decoded = decodeSave(JSON.stringify(save));
      expect(decoded.status, `L${level} save reload`).toBe('ok');
      const loadout = campaignLoadout(save, level);
      expect(weapons(loadout), `L${level} ${save === fresh ? 'fresh handover' : 'finished L10 save'}`).toEqual([...expected[level - 1]].sort());
      const actualSides = { LEFT:loadout.LEFT.filter(id=>catalog[id].category!=='ability'), RIGHT:loadout.RIGHT.filter(id=>catalog[id].category!=='ability') };
      const openingSides = level===8 ? { LEFT:[axe], RIGHT:[handgun,mg,shotgun,rocket] } : expectedSides[level-1];
      expect(actualSides, `L${level} authored rack order for each save`).toEqual(openingSides);
      const live = new Loadout(loadout.LEFT, loadout.RIGHT, undefined, loadout.size), selected = restoreSelectedAction(live, save);
      if (save.selectedAction && [...loadout.LEFT,...loadout.RIGHT].includes(save.selectedAction)) expect(selected, `L${level} carry selection`).toBe(save.selectedAction);
      expect(live.current(live.state.selectedSide).id).toBe(selected);
      if (save === fresh) { boundary = loadout; fresh.selectedAction = selected; }
    }
    if (level === 10) break;
    // Finish a fresh run having collected this level's authored pickups, through the real handover/save function.
    const holding = { LEFT:boundary.LEFT.filter(id => id !== 'weapon.fists' && catalog[id].category !== 'ability'), RIGHT:boundary.RIGHT.filter(id => catalog[id].category !== 'ability') };
    for (const id of pickups[level] ?? []) {
      const side = catalog[id].category === 'melee' ? 'LEFT' : 'RIGHT';
      if (!holding[side].includes(id)) holding[side].push(id);
      if (!fresh.ownedActions.includes(id)) fresh.ownedActions.push(id);
    }
    const selected = pickups[level]?.at(-1) ?? fresh.selectedAction;
    if (level === 9) {
      const held = new Loadout(holding.LEFT, holding.RIGHT, undefined, 6).state;
      const world = { entities: { get: () => ({ weapons:held, health:{ current:100,max:100 }, transform:{ x:0,y:.7,z:0,yaw:0 } }), iterate: () => [][Symbol.iterator]() }, missions:{ l9:{ state:{ finished:true,preCrashDurability:0 } } }, combat:{ projectiles:[], setLoadout:vi.fn() }, progression:{ pickups:[],campaign:fresh } };
      completeCampaignLevel(fresh, 9, result, world as never);
    } else completeCampaignLevel(fresh, level as Level, result, fakeWorld(holding, selected));
    expect(validateSave(fresh), `L${level} handover save`).toBe(true);
  }
  // Each saved state gets the same authored list, and the L8 gate takes only the rocket.
  const l8 = preset('L8-default'), l8Start = campaignLoadout(l8, 8);
  expect([...l8Start.LEFT,...l8Start.RIGHT].filter(id=>id.startsWith('weapon.')&&!['weapon.fists','weapon.kick'].includes(id)).sort()).toEqual([axe,handgun,mg,shotgun,rocket].sort());
  const finishedL6 = preset('L10-default'); finishedL6.completedLevels = 10;
  finishedL6.ownedActions = [...new Set([...finishedL6.ownedActions,...Object.keys(catalog).filter(id=>id.startsWith('weapon.') && id!=='weapon.rotary-minigun')])];
  finishedL6.racks = { LEFT:[bat,axe], RIGHT:[rocket,rifle,shotgun,mg,handgun] }; finishedL6.selectedAction=rocket;
  const replay = await loadLevel('L6', 1, finishedL6, 0, { quality:'low' });
  try {
    const actual = replay.combat!.runner.loadout.state;
    expect(actual.LEFT.rack.map(slot=>slot.id)).toEqual([axe]);
    expect(actual.RIGHT.rack.map(slot=>slot.id)).toEqual([handgun,mg,shotgun]);
    expect(actual.RIGHT.rack[actual.RIGHT.index].id).toBe(handgun);
  } finally { replay.dispose(); }
  const { Game } = await import('../../src/Game');
  // Native checkpoint sweep shares this campaign progression regression's case budget.
  for (let level = 1; level <= 10; level++) {
    const save = level === 1 ? newCampaign() : preset(`L${level}-default` as `L${2|3|4|5|6|7|8|9|10}-default`);
    const world = await loadLevel(`L${level}` as `L${1|2|3|4|5|6|7|8|9|10}`, 1, save, 0, { quality: 'low' });
    try {
      const checkpointWeapons = world.combat!.runner.loadout.state;
      expect({ LEFT:checkpointWeapons.LEFT.rack.map(slot=>slot.id).filter(id=>catalog[id].category!=='ability'), RIGHT:checkpointWeapons.RIGHT.rack.map(slot=>slot.id).filter(id=>catalog[id].category!=='ability') }, `L${level} actual initialized rack`).toEqual(expectedSides[level-1]);
      const defaultSelected = expectedSides[level-1].RIGHT.find(id=>id!=='weapon.kick') ?? expectedSides[level-1].LEFT.filter(id=>id!=='weapon.fists').sort((a,b)=>action(b).tier-action(a).tier)[0] ?? 'weapon.fists';
      expect(save.selectedAction, `L${level} authored selected weapon`).toBe(defaultSelected);
      expect(world.combat!.runner.loadout.current(checkpointWeapons.selectedSide).id, `L${level} live selected weapon`).toBe(defaultSelected);
      const checkpoints = world.missions!.def.checkpoints;
      for (const checkpoint of checkpoints) {
        world.missions!.checkpoint(checkpoint);
        const candidate = structuredClone(save);
        if (level === 9) candidate.l9Crash = world.missions!.l9!.save();
        if (level === 10) candidate.cureResume = { ...world.missions!.saveResume(true), cameraZoom: 1 };
        expect(validateSave(candidate), `L${level} checkpoint ${checkpoint}`).toBe(true);
        const context = { campaign: structuredClone(save), appliedCampaign: null, world, loading: false,
          view: { view: { getState: () => ({ targetZoom: 1 }) } }, saves: { write: (value: CampaignSave) => validateSave(value) } };
        context.appliedCampaign = context.campaign as never;
        expect(Game.prototype.saveCampaign.call(context as never), `L${level} actual saveCampaign at ${checkpoint}`).toBe(true);

      }
      if (level === 9) {
        const l9 = world.missions!.l9!;
        const living = l9.save();
        world.player!.damage(100000, world.tick, true);
        const dead = structuredClone(save); dead.l9Crash = l9.save();
        expect(dead.l9Crash.player.health.current).toBe(0);
        expect(validateSave(dead), 'death interval must not be persisted as a living crash resume').toBe(false);
        dead.l9Crash = living; dead.settings.quality = 'low';
        expect(validateSave(dead), 'settings can retain the previous living resume during death').toBe(true);
        const context = { campaign: dead, appliedCampaign: dead, world, loading: false,
          saves: { write: (value: CampaignSave) => validateSave(value) } };
        expect(Game.prototype.saveCampaign.call(context as never), 'actual settings save during death retains living resume').toBe(true);
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        context.saves.write = () => { throw new Error('storage unavailable'); };
        expect(Game.prototype.saveCampaign.call(context as never), 'save failure returns without interrupting gameplay').toBe(false);
        expect(log).toHaveBeenCalled(); log.mockClear();
        context.saves.write = () => false;
        expect(Game.prototype.saveCampaign.call(context as never), 'storage rejection also remains nonfatal').toBe(false);
        expect(log).toHaveBeenCalled(); log.mockRestore();

        world.entities.get(1)!.health.current = living.player.health.current;
        for (const phase of ['driving', 'approach', 'fall', 'impact', 'crawl', 'done'] as const) {
          l9.state.phase = phase; l9.state.finished = phase === 'done';
          const car = world.entities.get(l9.state.carId)!;
          if (['impact', 'crawl', 'done'].includes(phase)) { car.vehicle!.damage = 'exploded'; car.vehicle!.driver = null; }
          else { car.vehicle!.damage = 'normal'; car.vehicle!.driver = 1; }
          const candidate = structuredClone(save); candidate.l9Crash = l9.save();
          expect(validateSave(candidate), `L9 phase ${phase}`).toBe(true);
        }
      }
    } finally { world.dispose(); }
  }
  await checkCheckpointRacks();
});

/** Checkpoint restore keeps the rack reached at L8 and L10, including authored arsenal changes. */
async function checkCheckpointRacks() {
  const ids = (world: Awaited<ReturnType<typeof loadLevel>>) => ({
    LEFT: world.combat!.runner.loadout.state.LEFT.rack.map(slot => slot.id),
    RIGHT: world.combat!.runner.loadout.state.RIGHT.rack.map(slot => slot.id),
  });
  const l8Save = preset('L8-default');
  const l8 = await loadLevel('L8', 1, l8Save, 0, { quality: 'low' });
  try {
    surrenderHeavyWeapons(l8, l8.missions!);
    l8.missions!.checkpoint('sanctuary');
    const expected = { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.handgun', 'weapon.army-mg', 'weapon.shotgun'] };
    expect(ids(l8)).toEqual(expected);
    l8.combat!.setLoadout(['weapon.bat'], ['weapon.rocket-launcher']);
    l8.missions!.restore('sanctuary');
    expect(ids(l8)).toEqual(expected);
    expect(l8.progression!.campaign!.racks).toEqual(expected);
  } finally { l8.dispose(); }

  const l10Save = preset('L10-default');
  const l10 = await loadLevel('L10', 1, l10Save, 0, { quality: 'low' });
  try {
    const expectedBase = { LEFT: ['weapon.fists', 'weapon.machete'], RIGHT: ['weapon.kick'] };
    transactArsenal(l10, ['weapon.machete'], []);
    const field = l10.hazards!.fieldFire!, cell = field.cells[0];
    expect(cell).toBeDefined();
    const roadDistrict = l10.districts!.districts.find(d => d.layout.roads.edges.some(e => e.points.length > 1))!;
    const road = roadDistrict.layout.roads.edges.find(e => e.points.length > 1)!;
    const roadPoint = { x: road.points[0][0] + roadDistrict.origin[0], z: road.points[0][1] + roadDistrict.origin[1] };
    expect(l10.hazards!.ignitePatch(roadPoint, .65, 5)).toBeNull();
    const cure = l10.districts!.districts.find(d => d.id === 'D-CURE')!;
    const evacuation = cureEvacuationLane(cure.decay.placements);
    expect(evacuation.length).toBeGreaterThan(0);
    const polygon = evacuation[0].polygon;
    const evacuationPoint = { x: polygon.reduce((n, p) => n + p[0], 0) / polygon.length + cure.origin[0], z: polygon.reduce((n, p) => n + p[1], 0) / polygon.length + cure.origin[1] };
    expect(l10.hazards!.ignitePatch(evacuationPoint, .65, 5)).toBeNull();
    for (const district of l10.districts!.districts) for (const c of field.cells.filter(c => c.id.startsWith(`${district.id}/`))) {
      const x = c.x - district.origin[0], z = c.z - district.origin[1];
      const halfX = c.halfX ?? 5, halfZ = c.halfZ ?? 5;
      expect(overlapsRoad(district.layout, { min: [x - halfX, 0, z - halfZ], max: [x + halfX, 0, z + halfZ] }), c.id).toBe(false);
      expect(overlapsPaving(district.layout, { min: [x - halfX, 0, z - halfZ], max: [x + halfX, 0, z + halfZ] }), c.id).toBe(false);
      expect(overlapsBuilding(district.layout, { min: [x - halfX, 0, z - halfZ], max: [x + halfX, 0, z + halfZ] }), c.id).toBe(false);
    }
    field.ignite(cell, l10.tick); field.update(l10.tick + 420);
    const vegetation = l10.hazards!.vegetationFire!, tree = vegetation.objects[0];
    expect(tree).toBeDefined();
    l10.hazards!.ignitePatch(tree, .65, 5);
    expect(tree.state).toBe('burning');
    vegetation.update(l10.tick + 600);
    l10.missions!.checkpoint('cure-crash');
    l10.progression!.campaign!.cureResume = l10.missions!.saveResume(true);
    expect(validateSave(l10.progression!.campaign!), 'burned ground checkpoint remains a valid campaign save').toBe(true);
    const savedFire = decodeSave(encodeSave(l10.progression!.campaign!));
    expect(savedFire.status).toBe('ok');
    if (savedFire.status === 'ok') expect(savedFire.save.cureResume?.checkpoint.fieldFire?.find(c => c.id === cell.id)?.state).toBe('scorched');
    cell.state = 'intact'; tree.state = 'intact';
    l10.combat!.setLoadout(['weapon.fire-axe'], ['weapon.rocket-launcher']);
    l10.missions!.state.states['l10-overpass-mega'] = true;
    l10.missions!.restore('cure-crash');
    expect(l10.missions!.state.states['l10-overpass-mega'], 'a retry before the overpass does not replay the beat').toBe(true);
    expect(cell.state).toBe('scorched'); expect(tree.state).toBe('charred');
    expect(ids(l10)).toEqual(expectedBase);
    expect(l10.progression!.campaign!.racks).toEqual(expectedBase);

    transactArsenal(l10, cureHangarWeapons, ['weapon.bat', 'weapon.army-mg', 'weapon.flashbang']);
    l10.missions!.checkpoint('cure-research');
    const expectedHangar = { LEFT: ['weapon.fists', 'weapon.machete'], RIGHT: ['weapon.handgun', 'weapon.shotgun', 'weapon.assault-rifle', 'weapon.hunting-rifle', 'weapon.nail-gun', 'weapon.flamethrower', 'weapon.rocket-launcher', 'weapon.molotov', 'weapon.pipe-bomb'] };
    // The fists/kick fallback is removed when a melee weapon is granted, as in the live L10 arsenal transaction.
    expectedHangar.LEFT = ['weapon.machete'];
    expect(ids(l10)).toEqual(expectedHangar);
    l10.combat!.setLoadout(['weapon.fire-axe'], ['weapon.bat']);
    l10.missions!.restore('cure-research');
    expect(ids(l10)).toEqual(expectedHangar);
    expect(l10.progression!.campaign!.racks).toEqual(expectedHangar);
    const megaId = l10.megaPursuit!.introduce({ x: 620, z: 0 });
    l10.missions!.checkpoint('cure-disperse-ready');
    l10.entities.get(megaId)!.health.current = 0;
    l10.megaPursuit!.state.mode = 'dead';
    l10.missions!.restore('cure-disperse-ready');
    expect(l10.megaPursuit!.state.mode, 'a later Mega kill survives an arena checkpoint retry').toBe('dead');
    expect(l10.megaPursuit!.entity()!.health.current).toBe(0);
    const group = curePaceEncounters.find(g => g.id === 'setpiece-quarantine-gate')!;
    const slots = cureEncounterSlots(group, 'low'), ledger = l10.l10Encounters!.state.spawned;
    const defender = l10.entities.get(l10.infected!.spawn('infected.runner', { x: 620, z: 0 }))!;
    const player = l10.entities.get(1)!; player.transform.x = 3031;
    for (const slot of slots.slice(0, -1)) ledger[`${slot.key}:0`] = defender.id;
    l10.missions!.l10!.story.update();
    expect(l10.missions!.state.states['l10-gate-checkpoint'], 'unadmitted wave prevents checkpoint').toBe(false);
    ledger[`${slots.at(-1)!.key}:0`] = defender.id;
    l10.missions!.l10!.story.update();
    expect(l10.missions!.state.states['l10-gate-checkpoint'], 'standing defender prevents checkpoint').toBe(false);
    defender.health.current = 0; defender.infected!.recoverAt = l10.tick + 600;
    l10.missions!.l10!.story.update();
    expect(l10.missions!.state.states['l10-gate-checkpoint'], 'downed cohort permits checkpoint').toBe(true);
    expect(defender.infected!.recoverAt, 'checkpoint does not remove recovery').toBe(l10.tick + 600);
  } finally { l10.dispose(); }
}

test('selection fallback: lost or empty weapons fall back to the best usable owned weapon, never an empty finite gun', () => {
  const oldLure = preset('L3-default'); oldLure.selectedAction = 'ability.corgi-lure';
  const oldLoadout = new Loadout(['weapon.fire-axe'], ['ability.corgi-lure', 'weapon.handgun']);
  oldLure.ownedActions.push('weapon.handgun');
  expect(restoreSelectedAction(oldLoadout, oldLure)).toBe('weapon.handgun');
  const lost = preset('L8-default'); lost.selectedAction = 'weapon.shotgun';
  lost.ownedActions = lost.ownedActions.filter(id => id !== 'weapon.shotgun'); lost.racks.RIGHT = lost.racks.RIGHT.filter(id => id !== 'weapon.shotgun');
  const r = resume(lost, 9); restoreSelectedAction(r, lost);
  expect(r.current(r.state.selectedSide).id).toBe('weapon.handgun'); // L9's authored first ranged weapon; the launcher is gone after L8

  const save = newCampaign(); save.ownedActions.push('weapon.bat', 'weapon.fire-axe', 'weapon.pistol', 'weapon.smg');
  const loadout = new Loadout(['weapon.bat', 'weapon.fire-axe'], ['weapon.pistol', 'weapon.smg']);
  expect(restoreSelectedAction(loadout, save)).toBe('weapon.pistol');
  loadout.state.RIGHT.rack[0].magazine = 0; expect(restoreSelectedAction(loadout, save)).toBe('weapon.smg');
  loadout.state.RIGHT.rack[1].magazine = 0; expect(restoreSelectedAction(loadout, save)).toBe('weapon.fire-axe');
  save.ownedActions = save.ownedActions.filter(id => id !== 'weapon.fire-axe'); expect(restoreSelectedAction(loadout, save)).toBe('weapon.bat');
  expect(loadout.state.LEFT.swapUntil).toBe(0); expect(loadout.state.RIGHT.swapUntil).toBe(0);

  // A finite MG carried in empty is skipped; the real bottomless campaign MG stays usable at zero counters.
  const mg = preset('L5-default'); mg.selectedAction = 'weapon.army-mg'; mg.ownedActions.push('weapon.pipe-bomb');
  const finite = new Loadout(['weapon.fire-axe'], ['weapon.army-mg', 'weapon.handgun', 'weapon.pipe-bomb'], id => id === 'weapon.army-mg' ? { ...action(id), magazine: 6, reloadTime: 1 } : action(id));
  finite.state.RIGHT.rack[0].magazine = 0; finite.state.RIGHT.rack[2].charges = 0;
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  expect(restoreSelectedAction(finite, mg)).toBe('weapon.handgun');
  const bottomless = new Loadout(mg.racks.LEFT, mg.racks.RIGHT);
  expect(restoreSelectedAction(bottomless, mg)).toBe('weapon.army-mg');
});

test('bare hands are innate and hidden while carrying melee; the L8 sanctuary gate takes the launcher', async () => {
  const save = preset('L8-default');
  expect([...save.racks.LEFT, ...save.racks.RIGHT]).not.toContain('weapon.fists');
  const live = campaignLoadout(save, 8), input = new Loadout(live.LEFT, live.RIGHT, undefined, live.size);
  expect(live.LEFT).toEqual(['weapon.fire-axe']);
  input.input({ ...emptyInput(), selectedWeaponKey: 1 }, 1);
  expect(input.current(input.state.selectedSide).id).toBe('weapon.fire-axe');
  save.selectedAction = 'weapon.fists';
  expect(restoreSelectedAction(resume(save, 8), save)).toBe('weapon.rocket-launcher');
  // PO 2026-11-10: the launcher arrives at L8 but the gate soldier collects it; L9 never offers it, even to an older save still carrying it.
  const rocket = 'weapon.rocket-launcher', stale = preset('L8-default');
  expect(campaignLoadout(stale, 8).RIGHT).toContain(rocket);
  expect(campaignLoadout(stale, 9).RIGHT).not.toContain(rocket);
  stale.selectedAction = rocket; stale.completedLevels = 7;
  completeCampaignLevel(stale, 8, result, fakeWorld(stale.racks, rocket));
  expect([...stale.racks.LEFT, ...stale.racks.RIGHT, ...stale.ownedActions, stale.selectedAction]).not.toContain(rocket);
  expect(validateSave(stale)).toBe(true); expect(decodeSave(JSON.stringify(stale)).status).toBe('ok');
  expect([...preset('L9-default').racks.RIGHT, ...preset('L9-default').ownedActions]).not.toContain(rocket);
  expect(cureHangarWeapons).toContain(rocket);
  const world = await loadLevel('L8', 1, preset('L8-default'), 0, { quality: 'low' }), lines: string[] = [];
  try {
    // The level start runs the gate beat: the soldier's line first, the HUD line naming the weapon four seconds later.
    expect(world.missions!.state.subtitle?.id).toBe('L8.gate-soldier');
    world.events.on('dialogue.line', event => { if (event.type === 'dialogue.line') lines.push(event.id); });
    for (let i = 0; i < 5 * 60; i++) world.update();
    expect(world.entities.get(1)!.weapons!.RIGHT.rack.map(s => s.id)).not.toContain(rocket);
    expect([...world.entities.get(1)!.weapons!.LEFT.rack,...world.entities.get(1)!.weapons!.RIGHT.rack].map(s=>s.id).filter(id=>!['weapon.fists','weapon.kick'].includes(id)).sort()).toEqual(['weapon.fire-axe','weapon.handgun','weapon.army-mg','weapon.shotgun'].sort());
    expect(world.progression!.campaign!.ownedActions).not.toContain(rocket);
    expect(lines).toContain('L8.gate-toast');
  } finally { world.dispose?.(); }
});

test('save decoding: presets round-trip, v0 migrates, corrupt/unknown data and storage errors fail safely', () => {
  const oldWeapons = { ...newCampaign(), version: 1, racks: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.nail-gun', 'weapon.army-mg', 'weapon.flashbang'] },
    ownedActions: ['weapon.fists', 'weapon.kick', 'weapon.fire-axe', 'weapon.handgun', 'weapon.nail-gun', 'weapon.army-mg', 'weapon.flashbang'], selectedAction: 'weapon.flashbang' };
  const migratedWeapons = decodeSave(JSON.stringify(oldWeapons));
  expect(migratedWeapons.status).toBe('ok');
  if (migratedWeapons.status === 'ok') {
    const loadout = new Loadout(migratedWeapons.save.racks.LEFT, migratedWeapons.save.racks.RIGHT);
    expect(restoreSelectedAction(loadout, migratedWeapons.save)).toBe('weapon.molotov');
    expect(migratedWeapons.save.ownedActions).not.toContain('weapon.flashbang');
    expect(migratedWeapons.save.racks.RIGHT).toContain('weapon.molotov');
    expect(weaponKey('weapon.nail-gun')).toBe(7);
    expect(weaponKey('weapon.army-mg')).toBe(4);
  }
  for (const level of [2, 3, 4, 5, 6, 7, 8, 10] as const) {
    const save = preset(`L${level}-default`);
    if (level === 6) {
      expect(save.ownedActions).toContain('weapon.shotgun');
      expect(campaignLoadout(save, 6).RIGHT, 'default L6 retains the actual L5 shotgun handover').toContain('weapon.shotgun');
    }
    expect(validateSave(save), `L${level}`).toBe(true);
    expect(decodeSave(JSON.stringify(save)), `L${level}`).toEqual({ status: 'ok', save });
    const legacy = { ...save, settings: { ...save.settings, controlMode: 'obsolete-value' } };
    const decodedLegacy = decodeSave(JSON.stringify(legacy));
    expect(decodedLegacy.status, `L${level} legacy control setting`).toBe('ok');
    if (decodedLegacy.status === 'ok') expect(decodedLegacy.save.settings).not.toHaveProperty('controlMode');
    expect(save.unlockedLevel, `L${level}`).toBe(level);
  }
  const save = preset('L5-default');
  const { unlockedLevel, ...rest } = save;
  expect(decodeSave(JSON.stringify({ ...rest, version: 0, level: unlockedLevel }))).toEqual({ status: 'ok', save });
  for (const data of ['{', 'null', '[]', JSON.stringify({ ...save, version: 99 }), JSON.stringify({ ...save, ownedActions: [...save.ownedActions, 'toString'] }), JSON.stringify({ ...save, upgrades: ['unknown'] }), JSON.stringify({ ...save, racks: { LEFT: ['unknown'], RIGHT: [] } })])
    expect(decodeSave(data).status, data.slice(0, 40)).not.toBe('ok');
  const broken = new SaveStore({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } });
  expect(broken.load().status).toBe('error'); expect(broken.write(save)).toBe(false); expect(broken.clear()).toBe(false);
  const entries = new Map<string, string>();
  const store = new SaveStore({ getItem: k => entries.get(k) ?? null, setItem: (k, v) => { entries.set(k, v); }, removeItem: k => { entries.delete(k); } });
  expect(store.write(save)).toBe(true);
  expect(store.load()).toEqual({ status: 'ok', save });
  expect(encodeSave(save)).toBe(JSON.stringify(save));
  const large = preset('L10-default');
  large.usage['weapon.rotary-minigun'] = 204;
  expect(validateSave(large), 'mounted gun usage is known without granting a carried weapon').toBe(true);
  expect(large.ownedActions).not.toContain('weapon.rotary-minigun');
  expect(validateSave({ ...large, usage: { 'weapon.unknown-mounted-gun': 1 } })).toBe(false);
  large.results = { L9: { ...result, optionalObjectives: Array.from({ length: 1024 }, (_, i) => `${i}:${'cure 雪 🧟\u0000'.repeat(32)}`) } };
  expect(validateSave(large)).toBe(true);
  const encoded = encodeSave(large);
  expect(JSON.stringify(large).length).toBeGreaterThan(65536);
  expect(encoded.length).toBeLessThan(65536);
  expect(decodeSave(encoded)).toEqual({ status: 'ok', save: large });
  expect(store.write(large)).toBe(true);
  expect(store.load()).toEqual({ status: 'ok', save: large });
  expect(decodeSave(encoded.slice(0, -20)).status).toBe('error');

  // s178 (PO 2026-11-19): the difficulty persists with the campaign save; absent (older saves) means simple,
  // unknown values are rejected, a debug level-list start keeps it (level-select rule) and applyCampaign
  // copies it onto the live world at every level boundary.
  const fresh = newCampaign('female', 1);
  expect(validateSave(fresh), 'a save without the field (pre-s178) stays valid').toBe(true);
  const decodedFresh = decodeSave(JSON.stringify(fresh));
  expect(decodedFresh.status).toBe('ok');
  if (decodedFresh.status === 'ok') expect(decodedFresh.save.difficulty).toBeUndefined();
  const hard: CampaignSave = { ...fresh, difficulty: 'hard' };
  expect(validateSave(hard)).toBe(true);
  expect(decodeSave(encodeSave(hard))).toEqual({ status: 'ok', save: hard });
  expect(validateSave({ ...fresh, difficulty: 'nightmare' as never })).toBe(false);
  expect(decodeSave(encodeSave({ ...fresh, difficulty: 'nightmare' as never })).status).toBe('error');
  expect(debugCampaign(3, hard).difficulty, 'a debug level-list start keeps the difficulty').toBe('hard');
  expect(debugCampaign(3, fresh).difficulty).toBeUndefined();

  const cure = preset('L10-default'), definition = levelTenMission(() => ({ x: 0, z: 0, radius: 2 }));
  const checkpoint = {
    tick: 1, combatSequence: 0, arsenal: { ownedActions: cure.ownedActions, racks: cure.racks },
    state: { id: 'L10', phase: 'playing', checkpoint: 'cure-crash', actors: {}, gates: {}, items: [], volumes: [], killedBosses: [], completedObjectives: [],
      steps: Object.fromEntries(definition.steps.map(s => [s.id, { status: 'pending', started: 0, interaction: 0, kills: [], events: {} }])),
      states: Object.fromEntries(definition.states.map(s => [s, false])), counters: Object.fromEntries(definition.counters.map(s => [s, 0])),
      stats: { ...result, optionalObjectives: large.results!.L9!.optionalObjectives } },
    entities: [{ id: 1, transform: { x: 0, y: .7, z: 0, yaw: 0 }, health: { current: 40, max: 40 }, survivor: { checkpoint: { x: 0, z: 0 } },
      weapons: { LEFT: { rack: cure.racks.LEFT.map(id => ({ id })) }, RIGHT: { rack: cure.racks.RIGHT.map(id => ({ id })) } } }],
  } as unknown as NonNullable<CampaignSave['cureResume']>['current'];
  cure.cureResume = { current: checkpoint, checkpoint: structuredClone(checkpoint), cameraZoom: 1 };
  expect(validateSave(cure)).toBe(true);
  expect(store.write(cure)).toBe(true);
  const compact = entries.get('minor-incident.campaign')!;
  expect(compact.startsWith('minor-incident.checkpoint1:')).toBe(true);
  expect(store.load()).toEqual({ status: 'ok', save: cure });
  // A checkpoint event can export one detached snapshot as both records.
  // Storage must preserve the same bytes and decode independent retry data.
  cure.cureResume.checkpoint = cure.cureResume.current;
  expect(store.write(cure)).toBe(true);
  expect(entries.get('minor-incident.campaign')).toBe(compact);
  cure.cureResume.checkpoint = structuredClone(cure.cureResume.current);
  const restored = store.load();
  if (restored.status !== 'ok') throw new Error('Checkpoint did not load');
  restored.save.cureResume!.current.entities[0].health.current--;
  expect(restored.save.cureResume!.checkpoint.entities[0].health.current).toBe(40);
  expect(decodeSave(compact.slice(0, -5)).status).toBe('error');
  expect(decodeSave('minor-incident.checkpoint1:[null,{},{}]').status).toBe('error');
  const limited = new SaveStore({ getItem: k => entries.get(k) ?? null, removeItem: k => { entries.delete(k); }, setItem: (k, v) => {
    if (v.startsWith('minor-incident.checkpoint1:')) throw new Error('quota');
    entries.set(k, v);
  } });
  expect(limited.write(cure)).toBe(true);
  expect(entries.get('minor-incident.campaign')!.startsWith('minor-incident.gzip1:')).toBe(true);
  expect(limited.load()).toEqual({ status: 'ok', save: cure });
  cure.cureResume.current.entities[0].health.current--;
  expect(store.write(cure)).toBe(true);
  expect(entries.get('minor-incident.campaign')!.startsWith('minor-incident.gzip1:')).toBe(true);
  expect(store.load()).toEqual({ status: 'ok', save: cure });

  // r28: saves written by the PROD builds (b59 = 2741447, b60 = 1938e59a) at every level. Players must never lose a campaign
  // because a mission was reworked: level-select saves and L9 crash records decode as written; an L10 resume record that
  // no longer matches the mission definition (b59 steps) is dropped, keeping gear and progress, never the whole save.
  const dir = new URL('../fixtures/saves/compat/', import.meta.url);
  const read = (name: string) => gunzipSync(readFileSync(new URL(name, dir))).toString();
  const expand = (text: string) => { const s = JSON.parse(text); if (s.cureResume?.checkpoint === '$same') s.cureResume.checkpoint = structuredClone(s.cureResume.current); return JSON.stringify(s); };
  for (const tag of ['b59', 'b60']) {
    const campaign = JSON.parse(readFileSync(new URL(`${tag}-campaign.json`, dir), 'utf8')) as Record<string, string>;
    for (let level = 2; level <= 10; level++) {
      const r = decodeSave(campaign[`L${level}`]);
      expect(r.status, `${tag} L${level}`).toBe('ok');
      expect(r.status === 'ok' && r.save.unlockedLevel).toBe(level);
    }
    const crash = decodeSave(read(`${tag}-l9-crash-driving.json.gz`));
    expect(crash.status, `${tag} l9 crash`).toBe('ok');
    expect(crash.status === 'ok' && !!crash.save.l9Crash && !crash.dropped).toBe(true);
  }
  const l10 = (name: string) => decodeSave(expand(read(name)));
  for (const name of ['b59-l10-01-cure-crash', 'b59-l10-06-cure-research']) {
    const r = l10(`${name}.json.gz`);
    expect(r.status, name).toBe('ok');
    expect(r.status === 'ok' && r.dropped, name).toEqual(['cureResume']);
    expect(r.status === 'ok' && r.save.crossingHandover && r.save.unlockedLevel === 10 && r.save.ownedActions.includes('weapon.fire-axe') && r.save.cureResume === undefined, name).toBeTruthy();
  }
  for (const name of ['b60-l10-01-cure-crash', 'b60-l10-27-cure-disperse-ready']) {
    const r = l10(`${name}.json.gz`);
    expect(r.status, name).toBe('ok');
    expect(r.status === 'ok' && !r.dropped && !!r.save.cureResume, name).toBe(true);
  }
  // A damaged campaign (not just a stale resume record) still fails safely.
  expect(decodeSave(JSON.stringify({ ...JSON.parse(expand(read('b60-l10-01-cure-crash.json.gz'))), seed: 'x' })).status).toBe('error');
});

// N10: the destructive L9 -> L10 crossing commits once, after the crawl, and Continue resumes the committed save.
test('crossing handover: needs the finished crawl, commits once, drops weapons and transport, keeps passengers and the corgi', () => {
  const rack = (ids: string[]) => ({ rack: ids.map(id => ({ id })) });
  const make = (finished: boolean) => {
    const player = { id: 1, transform: { x: 3, y: .7, z: 4, yaw: 1 }, health: { current: 10, max: 100 }, survivor: { scriptedClip: 'crawl', knockdown: { started: 0, until: 120 }, attack: { started: 0, endsAt: 120 }, animation: 'knockdown', animationTick: 30 }, weapons: { LEFT: rack(['weapon.bat']), RIGHT: rack(['weapon.shotgun']) } };
    const pose = { x: 1, y: .7, z: 2, yaw: 0 };
    const corgi = { id: 7, kind: 'companion', archetype: 'char.corgi', companion: { path: [], courage: 1, until: 0, barkAt: 0, hurtAt: 0 }, health: { current: 8, max: 8 }, transform: pose };
    const rider = { id: 8, kind: 'civilian', health: { current: 40, max: 50 }, transform: pose }, dead = { id: 9, kind: 'civilian', health: { current: 0, max: 50 }, transform: pose };
    const pickup = { id: 20, pickup: { actionId: 'weapon.shotgun' } }, crate = { id: 21, pickup: { kind: 'supply' } };
    const entities = new Map<number, unknown>([[1, player], [7, corgi], [8, rider], [9, dead], [20, pickup], [21, crate]]);
    const projectiles = [{}, {}], setLoadout = vi.fn(), removed: number[] = [];
    const world = {
      tick: 120,
      missions: { l9: { state: { finished, preCrashDurability: 55 } } },
      entities: { get: (id: number) => entities.get(id), iterate: () => entities.values(), remove: (id: number) => { removed.push(id); entities.delete(id); } },
      getEntity: (id: number) => entities.get(id), spatial: new Map<number, unknown>(),
      combat: { projectiles, setLoadout }, progression: { pickups: [{}], campaign: undefined as unknown },
    };
    const save = preset('L8-default');
    save.transport = { occupants: [{ id: 1 }, corgi, rider, dead] } as never;
    return { save, world, player, projectiles, setLoadout, removed };
  };
  const early = make(false);
  expect(() => commitCrossingHandover(early.save, early.world as never), 'premature commit').toThrow('completed crawl');
  expect(early.save.crossingHandover).toBeUndefined();
  expect(early.save.transport).toBeDefined();

  const { save, world, player, projectiles, setLoadout, removed } = make(true);
  const before = [...new Set([...save.ownedActions, 'weapon.bat', 'weapon.shotgun'])].filter(id => catalog[id].category !== 'ability');
  commitCrossingHandover(save, world as never);
  expect(player.survivor.scriptedClip, 'L10 handover releases the completed L9 crawl pose').toBeUndefined();
  expect(player.survivor.knockdown).toBeUndefined(); expect(player.survivor.attack).toBeUndefined();
  expect(player.survivor.animation, 'handover starts ordinary on-foot locomotion').toBe('idle'); expect(player.survivor.animationTick).toBe(120);
  expect(player.health.current, 'handover restores ordinary on-foot health').toBe(100);
  const handover = save.crossingHandover!;
  expect(handover.applied && handover.checkpoint).toBe('cure-crash');
  expect([...handover.lostWeapons].sort(), 'every combat weapon is lost').toEqual(before.sort());
  expect(handover.preCrashDurability).toBe(55);
  expect(handover.shelteredPassengers.map(e => e.id), 'living non-companion passengers shelter').toEqual([8]);
  expect(handover.corgi?.id, 'the corgi comes along').toBe(7);
  expect(save.racks).toEqual({ LEFT: ['weapon.fists'], RIGHT: ['weapon.fists'] });
  expect(save.selectedAction).toBe('weapon.fists');
  expect(save.ownedActions.filter(id => catalog[id].category !== 'ability')).toEqual(['weapon.fists']);
  expect([save.completedLevels, save.unlockedLevel]).toEqual([9, 10]);
  expect([save.transport, save.pending, save.l9Crash], 'transport and L9 state are removed').toEqual([undefined, undefined, undefined]);
  expect([projectiles.length, removed, world.progression.pickups], 'projectiles and weapon pickups are cleared (other pickups stay)').toEqual([0, [20], []]);
  expect(setLoadout).toHaveBeenCalledWith(['weapon.fists'], ['weapon.fists']);
  expect(player.health.current, 'healed').toBe(100);

  const snapshot = structuredClone(save), healthAfter = player.health.current;
  player.health.current = 5;
  commitCrossingHandover(save, world as never);
  expect(save, 'a repeated commit changes nothing').toEqual(snapshot);
  expect(player.health.current).toBe(5); expect(healthAfter).toBe(100);

  const continued = decodeSave(JSON.stringify(save));
  expect(continued.status, 'Continue loads the committed save').toBe('ok');
  expect((continued as { save: CampaignSave }).save.crossingHandover).toEqual(save.crossingHandover);
  expect(validateSave(save)).toBe(true);
  // Replaying L8 from this post-crash save must not persist a second transport.
  const pose = { x: 0, y: .7, z: 0, yaw: 0 }, health = { current: 100, max: 100 };
  const transport = { tick: 0, infiniteCharges: true,
    vehicle: { id: 2, archetype: 'vehicle.military-apc', transform: pose, health, vehicle: { driver: 1, passengers: [] } },
    occupants: [{ id: 1, transform: pose, health }],
  } as never;
  expect(recordL8Transport(save, transport)).toBe(false);
  completeCampaignLevel(save, 8, result, fakeWorld(save.racks, 'weapon.fire-axe'));
  expect(save.transport).toBeUndefined();
  expect(validateSave(save)).toBe(true);
  expect(decodeSave(JSON.stringify(save)).status).toBe('ok');
  const preCrashReplay = preset('L9-default');
  expect(recordL8Transport(preCrashReplay, transport)).toBe(true);
  completeCampaignLevel(preCrashReplay, 8, result, fakeWorld(preCrashReplay.racks, 'weapon.fire-axe'));
  expect(decodeSave(JSON.stringify(preCrashReplay)).status).toBe('ok');
});

test('rewards: a saved reward screen round-trips at each phase and cannot be claimed twice; gear tiers follow the default path', () => {
  const save = newCampaign(); save.ownedActions.push('weapon.bat');
  beginRewards(save, 1); expect(validateSave(save)).toBe(true);
  revealCards(save); expect(validateSave(save)).toBe(true);
  pickUpgrades(save, save.pending!.cards.slice(0, 2)); expect(validateSave(save)).toBe(true);
  finishRewards(save, save.racks);
  expect(() => beginRewards(save, 1)).toThrow();
  expect([2, 3, 4, 5, 6].map(level => gearTier(preset(`L${level as 2 | 3 | 4 | 5 | 6}-default`)))).toEqual([0, 1, 2, 3, 4]);
  // Ending credits name the L8 survivors who got out and remember the ones lost.
  expect(epilogueSurvivorLines(['dale', 'rosa', 'okafor', 'mia', 'sam'])).toEqual(['Dale, Rosa, Mr. Okafor, Mia, Sam: safe at the evacuation point.']);
  expect(epilogueSurvivorLines(['rosa', 'mia'])).toEqual(['Rosa, Mia: safe at the evacuation point.', 'Remembered: Dale, Mr. Okafor, Sam.']);
  expect(epilogueSurvivorLines(undefined)).toEqual([]);
});
