import { dialogue } from '../../data/dialogue';
import type { Anchor, MissionDef, ObjectiveDef, ScriptAction, Trigger } from '../../sim/missions/types';

/** D1–D4 supply these anchor names in D-CURE. No geometry or encounter spawning lives here. */
export const cureRegions = [
  { id: 'crash-outskirts', chapter: 'Crash site and corn fields', checkpoint: 'cure-crash', minutes: 2, routeMetres: 250 },
  { id: 'residential-fringe', chapter: 'Farmstead and town edge', checkpoint: 'cure-residential', minutes: 3, routeMetres: 600 },
  { id: 'industrial-area', chapter: 'Broken farms and workshops', checkpoint: 'cure-industrial', minutes: 3, routeMetres: 750 },
  { id: 'military-zone', chapter: 'Restricted military zone', checkpoint: 'cure-military', minutes: 3, routeMetres: 800 },
  { id: 'research-campus', chapter: 'Safe research hangar', checkpoint: 'cure-research-entry', minutes: 2, routeMetres: 550 },
  { id: 'destroyed-corridor', chapter: 'Dispersal route', checkpoint: 'cure-corridor', minutes: 1, routeMetres: 1000 },
  { id: 'dispersal-complex', chapter: 'Dispersal complex', checkpoint: 'cure-complex', minutes: 1, routeMetres: 350 },
] as const;
export const cureCheckpoints = [...cureRegions.map(r => r.checkpoint), 'cure-research', 'cure-disperse-ready'];
export const cureAnchorNames = [...cureCheckpoints, 'cure-terminal', 'cure-canister', 'cure-install', 'cure-console', 'industrial-yard', 'military-breach'] as const;

/** Finale controllers own these booleans. Charge-ready means 3,600 eligible ticks; credits-finished follows the playable epilogue. */
/** Elapsed eligible simulation ticks (durations, not absolute timestamps), available to S7/S9. */
export const cureCounters = ['charge-ticks', 'epilogue-ticks'];
export const cureStates = ['charge-active', 'console-held', 'terminal-read', 'cure-carried', 'cure-installed', 'charge-ready', 'mega-dead', 'cure-released', 'epilogue-finished', 'credits-finished'];
/** The safe hangar returns the whole pre-crash arsenal and issues the experimental final weapon. */
export const cureHangarWeapons = ['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg', 'weapon.shotgun', 'weapon.rocket-launcher', 'weapon.pipe-bomb', 'weapon.hunting-rifle', 'weapon.nail-gun', 'weapon.machete', 'weapon.molotov', 'weapon.assault-rifle', 'weapon.flashbang', 'weapon.flamethrower'];
/** Optional anchors let region lanes land independently. Missing anchors cannot complete spatial objectives. */
export function levelTenMission(resolve: (name: string) => Anchor | undefined): MissionDef {
  const crash = resolve('cure-crash');
  if (!crash) throw new Error('Missing mission anchor: cure-crash');
  const anchors: Record<string, Anchor> = { 'cure-crash': crash };
  for (const name of cureAnchorNames) { const at = resolve(name); if (at) anchors[name] = at; }
  if (anchors['cure-console']) anchors['cure-mega'] = { ...anchors['cure-console'] };
  for (const name of ['epilogue-survivors', 'epilogue-walk', 'epilogue-camera-target']) { const at = resolve(name); if (at) anchors[name] = at; }
  // The final existing approach lane is a bounded collapse tableau, outside the release disc.
  const arrival = resolve('dispersal-horizon');
  if (arrival) anchors['epilogue-approach'] = arrival;
  const def: MissionDef = { id: 'L10', briefing: dialogue['L10.briefing'], anchors, actors: {}, groups: {}, gates: {}, items: ['cure-canister'], states: [...cureStates, 'anchor-unavailable'], counters: [...cureCounters], checkpoints: [...cureCheckpoints], cinematics: {}, steps: [], finish: ['credits'], onStart: [{ kind: 'checkpoint', id: 'cure-crash' }, { kind: 'radio', id: 'L10.farmstead' }], onComplete: [] };
  const step = (id: string, text: string, name: string, complete: Trigger, actions: ScriptAction[] = [], type: ObjectiveDef['type'] = 'custom') => {
    const previous = def.steps.at(-1);
    def.steps.push({ id, text, type, anchor: anchors[name] ? name : 'cure-crash', waypoint: !!anchors[name], start: previous ? { kind: 'objectives', ids: [previous.id], mode: 'all' } : { kind: 'start' }, complete, fail: [], onComplete: actions });
  };
  const spatial = (name: string, interact = false): Trigger => anchors[name] ? interact ? { kind: 'interact', anchor: name, seconds: .6 } : { kind: 'volume', anchor: name, edge: 'inside' } : { kind: 'state', key: 'anchor-unavailable', equals: true };
  const flag = (key: string): Trigger => ({ kind: 'state', key, equals: true });
  // Arrival is explicit; grants and checkpoint capture share one tick-end transaction.
  step('crash', 'Get away from the river', 'cure-crash', spatial('cure-crash'));
  step('farmstead', 'Find a way through the farms', 'cure-residential', spatial('cure-residential'), [{ kind: 'checkpoint', id: 'cure-residential' }], 'reach');
  step('farm-route', 'Cross the broken farms', 'industrial-yard', spatial('industrial-yard'), [
    { kind: 'checkpoint', id: 'cure-industrial' }, { kind: 'radio', id: 'L10.hide-gap' },
  ], 'reach');
  step('restricted-zone', 'Get through the restricted zone', 'military-breach', spatial('military-breach'), [
    { kind: 'checkpoint', id: 'cure-military' }, { kind: 'radio', id: 'L10.armory' },
  ], 'reach');
  step('research-hangar', 'Enter the hangar', 'cure-research-entry', spatial('cure-research-entry'), [{ kind: 'checkpoint', id: 'cure-research-entry' }], 'reach');
  step('research', 'Hear the researchers’ account', 'cure-terminal', spatial('cure-terminal', true), [{ kind: 'state', key: 'terminal-read', value: true }, { kind: 'radio', id: 'L10.research' }], 'interact');
  step('cure', 'Take the cure and re-equip for the delivery', 'cure-canister', spatial('cure-canister', true), [
    { kind: 'grant', item: 'cure-canister' }, { kind: 'state', key: 'cure-carried', value: true },
    { kind: 'arsenal', add: cureHangarWeapons, remove: [] }, { kind: 'radio', id: 'L10.hangar-handover' },
  ], 'interact');
  step('research-exit', 'Carry the cure out of the hangar', 'cure-research', spatial('cure-research'), [{ kind: 'checkpoint', id: 'cure-research' }], 'reach');
  step('delivery-corridor', 'Carry the cure to the dispersal complex', 'cure-corridor', spatial('cure-corridor'), [{ kind: 'checkpoint', id: 'cure-corridor' }], 'reach');
  step('dispersal-complex', 'Bring the cure to the dispersal complex', 'cure-complex', spatial('cure-complex'), [{ kind: 'checkpoint', id: 'cure-complex' }], 'reach');
  step('install', 'Install the cure in the dispersal device', 'cure-install', { kind: 'all', triggers: [flag('cure-carried'), spatial('cure-install', true)] }, [{ kind: 'state', key: 'cure-installed', value: true }, { kind: 'state', key: 'cure-carried', value: false }, { kind: 'checkpoint', id: 'cure-disperse-ready' }], 'interact');
  step('hold', 'Charge the dispersal system', 'cure-console', { kind: 'all', triggers: [flag('charge-active'), { kind: 'count', key: 'charge-ticks', atLeast: 3600 }, flag('charge-ready'), flag('cure-installed')] });
  step('mega', 'Kill the Mega Alpha', 'cure-mega', flag('mega-dead'));
  // Pursuit position is AI-only; the player gets the distance ring and text.
  def.steps.at(-1)!.waypoint = false;
  step('release', 'Release the cure at the console', 'cure-console', flag('cure-released'), [], 'interact');
  step('epilogue', 'Watch the cure spread', 'cure-console', flag('epilogue-finished'));
  step('credits', 'Minor Incident', 'cure-console', flag('credits-finished'));
  def.steps.slice(-2).forEach(s => { s.waypoint = false; });
  return def;
}
