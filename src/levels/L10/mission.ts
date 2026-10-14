import type { Anchor, MissionDef, ObjectiveDef, ScriptAction, Trigger } from '../../sim/missions/types';

/** D1–D4 supply these anchor names in D-CURE. No geometry or encounter spawning lives here. */
export const cureRegions = [
  { id: 'crash-outskirts', checkpoint: 'cure-crash', minutes: 3, routeMetres: 250 },
  { id: 'residential-fringe', checkpoint: 'cure-residential', weapon: 'weapon.pistol', weaponLabel: 'handgun', minutes: 6, routeMetres: 600 },
  { id: 'industrial-area', checkpoint: 'cure-industrial', weapon: 'weapon.shotgun', weaponLabel: 'shotgun', minutes: 7, routeMetres: 750 },
  { id: 'military-zone', checkpoint: 'cure-military', weapon: 'weapon.army-mg', weaponLabel: 'machine gun', minutes: 7, routeMetres: 800 },
  { id: 'research-campus', checkpoint: 'cure-research-entry', minutes: 6, routeMetres: 550 },
  { id: 'destroyed-corridor', checkpoint: 'cure-corridor', weapon: 'weapon.rocket-launcher', weaponLabel: 'rocket launcher', minutes: 8, routeMetres: 1000 },
  { id: 'dispersal-complex', checkpoint: 'cure-complex', minutes: 10, routeMetres: 350 },
] as const;
export const cureCheckpoints = [...cureRegions.map(r => r.checkpoint), 'cure-research', 'cure-disperse-ready'];
export const cureAnchorNames = [...cureCheckpoints, 'cure-terminal', 'cure-canister', 'cure-install', 'cure-console'] as const;

/** Finale controllers own these booleans. Charge-ready means 3,600 eligible ticks; credits-finished follows the playable epilogue. */
/** Elapsed eligible simulation ticks (durations, not absolute timestamps), available to S7/S9. */
export const cureCounters = ['charge-ticks', 'epilogue-ticks'];
export const cureStates = ['charge-active', 'console-held', 'terminal-read', 'cure-carried', 'cure-installed', 'charge-ready', 'mega-dead', 'cure-released', 'epilogue-finished', 'credits-finished'];
/** Optional anchors let region lanes land independently. Missing anchors cannot complete spatial objectives. */
export function levelTenMission(resolve: (name: string) => Anchor | undefined): MissionDef {
  const crash = resolve('cure-crash');
  if (!crash) throw new Error('Missing mission anchor: cure-crash');
  const anchors: Record<string, Anchor> = { 'cure-crash': crash };
  for (const name of cureAnchorNames) { const at = resolve(name); if (at) anchors[name] = at; }
  const def: MissionDef = { id: 'L10', briefing: 'Find the airborne cure and bring it to the dispersal complex.', anchors, actors: {}, groups: {}, gates: {}, items: ['cure-canister'], states: [...cureStates, 'anchor-unavailable'], counters: [...cureCounters], checkpoints: [...cureCheckpoints], cinematics: {}, steps: [], finish: ['credits'], onStart: [{ kind: 'checkpoint', id: 'cure-crash' }], onComplete: [] };
  const step = (id: string, text: string, name: string, complete: Trigger, actions: ScriptAction[] = [], type: ObjectiveDef['type'] = 'custom') => {
    const previous = def.steps.at(-1);
    def.steps.push({ id, text, type, anchor: anchors[name] ? name : 'cure-crash', waypoint: !!anchors[name], start: previous ? { kind: 'objectives', ids: [previous.id], mode: 'all' } : { kind: 'start' }, complete, fail: [], onComplete: actions });
  };
  const spatial = (name: string, interact = false): Trigger => anchors[name] ? interact ? { kind: 'interact', anchor: name, seconds: .6 } : { kind: 'volume', anchor: name, edge: 'inside' } : { kind: 'state', key: 'anchor-unavailable', equals: true };
  const flag = (key: string): Trigger => ({ kind: 'state', key, equals: true });
  // Arrival is explicit; grants and checkpoint capture share one tick-end transaction.
  step('crash', 'Leave the wreck on foot', 'cure-crash', spatial('cure-crash'));
  for (const region of cureRegions.slice(1, 4)) if ('weapon' in region) step(region.id, `Recover the ${region.weaponLabel} at the checkpoint`, region.checkpoint, spatial(region.checkpoint, true), [{ kind: 'arsenal', add: [region.weapon], remove: [] }, { kind: 'checkpoint', id: region.checkpoint }], 'interact');
  step('research-campus', 'Reach the research campus', 'cure-research-entry', spatial('cure-research-entry'), [{ kind: 'checkpoint', id: 'cure-research-entry' }], 'reach');
  step('research', 'Play the research recording', 'cure-terminal', spatial('cure-terminal', true), [{ kind: 'state', key: 'terminal-read', value: true }, { kind: 'radio', id: 'L10.research' }], 'interact');
  step('cure', 'Pack the cure and carry it to the dispersal complex', 'cure-canister', spatial('cure-canister', true), [{ kind: 'grant', item: 'cure-canister' }, { kind: 'state', key: 'cure-carried', value: true }], 'interact');
  step('research-exit', 'Deliver the cure — leave the laboratory', 'cure-research', spatial('cure-research'), [{ kind: 'checkpoint', id: 'cure-research' }], 'reach');
  step('destroyed-corridor', 'Carry the cure through the corridor — recover the rocket launcher', 'cure-corridor', spatial('cure-corridor', true), [{ kind: 'arsenal', add: ['weapon.rocket-launcher'], remove: [] }, { kind: 'checkpoint', id: 'cure-corridor' }], 'interact');
  step('dispersal-complex', 'Deliver the backpack cure to the dispersal complex', 'cure-complex', spatial('cure-complex'), [{ kind: 'checkpoint', id: 'cure-complex' }], 'reach');
  step('install', 'Install the cure in the dispersal device', 'cure-install', { kind: 'all', triggers: [flag('cure-carried'), spatial('cure-install', true)] }, [{ kind: 'state', key: 'cure-installed', value: true }, { kind: 'state', key: 'cure-carried', value: false }, { kind: 'checkpoint', id: 'cure-disperse-ready' }], 'interact');
  step('hold', 'Charge the system nearby and kill the Mega Alpha', 'cure-console', { kind: 'all', triggers: [flag('charge-active'), { kind: 'count', key: 'charge-ticks', atLeast: 3600 }, flag('charge-ready'), flag('mega-dead'), flag('cure-installed')] });
  step('release', 'Release the cure at the console', 'cure-console', { kind: 'all', triggers: [flag('cure-released'), spatial('cure-console', true)] }, [], 'interact');
  step('epilogue', 'Watch the cure spread — keep exploring', 'cure-console', flag('epilogue-finished'));
  step('credits', 'Minor Incident', 'cure-console', flag('credits-finished'));
  return def;
}
