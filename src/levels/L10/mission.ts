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
export const cureAnchorNames = [...cureCheckpoints, 'cure-terminal', 'cure-canister', 'cure-install', 'cure-console', 'river-exit', 'r4-r5-seam'] as const;

/** Finale controllers own these booleans. Charge-ready means 3,600 eligible ticks; credits-finished follows the playable epilogue. */
/** Elapsed eligible simulation ticks (durations, not absolute timestamps), available to S7/S9. */
export const cureCounters = ['charge-ticks', 'epilogue-ticks', 'story-region', 'hangar-line', 'hangar-line-ticks'];
export const cureStates = ['charge-active', 'console-held', 'terminal-read', 'cure-carried', 'cure-installed', 'charge-ready', 'mega-dead', 'cure-released', 'epilogue-finished', 'credits-finished', 'story-initialized', 'sam-alive', 'gap-hint', 'hangar-radio', 'hangar-cast', 'hangar-dialogue-done', 'arena-equipped', 'gate-spent', 'delivery-notified'];
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
  const def: MissionDef = { id: 'L10', briefing: dialogue['L10.briefing'], anchors, actors: {}, groups: {}, gates: {}, items: ['cure-canister'], states: [...cureStates, 'anchor-unavailable'], counters: [...cureCounters], checkpoints: [...cureCheckpoints], cinematics: {}, steps: [], finish: ['credits'], onStart: [{ kind: 'checkpoint', id: 'cure-crash' }], onComplete: [] };
  const step = (id: string, text: string, name: string, complete: Trigger, actions: ScriptAction[] = [], type: ObjectiveDef['type'] = 'custom') => {
    const previous = def.steps.at(-1);
    def.steps.push({ id, text, type, anchor: anchors[name] ? name : 'cure-crash', waypoint: !!anchors[name], start: previous ? { kind: 'objectives', ids: [previous.id], mode: 'all' } : { kind: 'start' }, complete, fail: [], onComplete: actions });
  };
  const spatial = (name: string, interact = false): Trigger => anchors[name] ? interact ? { kind: 'interact', anchor: name, seconds: .6 } : { kind: 'volume', anchor: name, edge: 'inside' } : { kind: 'state', key: 'anchor-unavailable', equals: true };
  const flag = (key: string): Trigger => ({ kind: 'state', key, equals: true });
  // Arrival is explicit; grants and checkpoint capture share one tick-end transaction.
  step('crash', 'Get away from the river', 'river-exit', spatial('river-exit'));
  step('farmstead', 'Find a way through the farms', 'cure-military', spatial('cure-military'), [], 'reach');
  step('restricted-zone', 'Get through the restricted zone', 'r4-r5-seam', spatial('r4-r5-seam'), [], 'reach');
  step('research-hangar', 'Enter the hangar', 'cure-research-entry', spatial('cure-research-entry'), [{ kind: 'checkpoint', id: 'cure-research-entry' }], 'reach');
  step('research', 'Enter the hangar', 'cure-terminal', flag('hangar-dialogue-done'), [{ kind: 'state', key: 'terminal-read', value: true }]);
  step('cure', 'Bring the cure to the dispersal complex', 'cure-canister', spatial('cure-canister'), [
    { kind: 'grant', item: 'cure-canister' }, { kind: 'state', key: 'cure-carried', value: true },
    { kind: 'arsenal', add: cureHangarWeapons, remove: [] }, { kind: 'checkpoint', id: 'cure-research' },
  ], 'collect');
  step('research-exit', 'Bring the cure to the dispersal complex', 'cure-research', spatial('cure-research'), [{ kind: 'checkpoint', id: 'cure-research' }], 'reach');
  step('delivery-corridor', 'Bring the cure to the dispersal complex', 'cure-corridor', spatial('cure-corridor'), [{ kind: 'checkpoint', id: 'cure-corridor' }], 'reach');
  step('dispersal-complex', 'Bring the cure to the dispersal complex', 'cure-complex', spatial('cure-complex'), [{ kind: 'checkpoint', id: 'cure-complex' }], 'reach');
  step('install', 'Install the cure', 'cure-install', { kind: 'all', triggers: [flag('cure-carried'), spatial('cure-install', true)] }, [{ kind: 'state', key: 'cure-installed', value: true }, { kind: 'state', key: 'cure-carried', value: false }, { kind: 'checkpoint', id: 'cure-disperse-ready' }], 'interact');
  step('hold', 'Hold the console', 'cure-console', { kind: 'all', triggers: [flag('charge-active'), { kind: 'count', key: 'charge-ticks', atLeast: 3600 }, flag('charge-ready'), flag('cure-installed')] });
  step('mega', 'Kill the Mega Alpha', 'cure-mega', flag('mega-dead'));
  // The real-position minimap dot tracks the boss; it has no objective waypoint.
  def.steps.at(-1)!.waypoint = false;
  step('release', 'Release the cure', 'cure-console', flag('cure-released'), [], 'interact');
  step('epilogue', 'Watch the cure spread', 'cure-console', flag('epilogue-finished'));
  step('credits', 'Minor Incident', 'cure-console', flag('credits-finished'));
  def.steps.slice(-2).forEach(s => { s.waypoint = false; });
  return def;
}
