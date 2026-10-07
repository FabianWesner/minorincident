import { dialogue } from '../../data/dialogue';
import { objectiveTypes, type MissionDef, type ScriptAction, type Trigger } from './types';

/** Boot-time validation; returns actionable errors for authoring fixtures and campaign data. */
export function validateMission(def: MissionDef): string[] {
  const errors: string[] = [], ids = new Set<string>();
  const ref = (id: string, collection: object | string[], label: string): void => {
    if (Array.isArray(collection) ? !collection.includes(id) : !Object.hasOwn(collection, id)) errors.push(`Unknown ${label}: ${id}`);
  };
  for (const step of def.steps) {
    if (!step.id || ids.has(step.id)) errors.push(`Duplicate/empty objective ID: ${step.id}`);
    ids.add(step.id);
  }
  const positive = (value: number, label: string): void => { if (!Number.isFinite(value) || value <= 0) errors.push(`Invalid ${label}`); };
  const trigger = (t: Trigger | undefined): void => {
    if (!t) { errors.push('Missing trigger'); return; }
    switch (t.kind) {
      case 'start': break;
      case 'objectives':
        if (!t.ids.length || !['all', 'any'].includes(t.mode)) errors.push('Invalid objective trigger');
        t.ids.forEach(id => ref(id, [...ids], 'objective')); break;
      case 'volume': ref(t.anchor, def.anchors, 'anchor'); if (t.actor) ref(t.actor, def.actors, 'actor'); if (!['inside', 'enter', 'exit'].includes(t.edge)) errors.push('Invalid volume edge'); break;
      case 'interact': ref(t.anchor, def.anchors, 'anchor'); positive(t.seconds, 'interaction duration'); if (t.actor) ref(t.actor, def.actors, 'actor'); break;
      case 'kills': t.actors.forEach(id => ref(id, def.actors, 'actor')); if (!t.actors.length) errors.push('Missing kill targets'); if (t.count !== undefined) { positive(t.count, 'kill count'); if (t.count > t.actors.length || !Number.isInteger(t.count)) errors.push('Invalid kill count'); } break;
      case 'hold': ref(t.anchor, def.anchors, 'anchor'); positive(t.seconds, 'hold duration'); break;
      case 'destroy': ref(t.actor, def.actors, 'actor'); break;
      case 'timer': positive(t.seconds, 'timer'); break;
      case 'dead': ref(t.actor, def.actors, 'actor'); break;
      case 'escort': case 'drive': ref(t.actor, def.actors, 'actor'); ref(t.anchor, def.anchors, 'anchor'); break;
      case 'items': if (!t.ids.length) errors.push('Missing item IDs'); t.ids.forEach(id => ref(id, def.items, 'item')); break;
      case 'state': ref(t.key, def.states, 'state'); break;
      case 'count': ref(t.key, def.counters, 'counter'); positive(t.atLeast, 'count'); break;
      case 'event': if (!t.type) errors.push('Missing event type'); if (t.actor) ref(t.actor, def.actors, 'actor'); positive(t.count, 'event count'); break;
      case 'all': case 'any': if (!t.triggers.length) errors.push('Missing triggers'); t.triggers.forEach(trigger); break;
      default: errors.push('Unknown trigger kind');
    }
  };
  const actions = (list: ScriptAction[]): void => { for (const a of list) switch (a.kind) {
    case 'spawn': ref(a.group, def.groups, 'group'); break;
    case 'migration': ref(a.group, def.groups, 'group'); ref(a.to, def.anchors, 'anchor'); break;
    case 'gate': ref(a.id, def.gates, 'gate'); break;
    case 'radio': ref(a.id, dialogue, 'dialogue'); break;
    case 'cinematic': ref(a.id, def.cinematics, 'cinematic'); break;
    case 'checkpoint': ref(a.id, def.checkpoints, 'checkpoint'); break;
    case 'grant': ref(a.item, def.items, 'item'); break;
    case 'marker': ref(a.anchor, def.anchors, 'anchor'); break;
    case 'state': ref(a.key, def.states, 'state'); break;
    case 'tier': if (!Number.isInteger(a.tier) || a.tier < 0 || a.tier > 5) errors.push('Invalid tier'); break;
    case 'timeOfDay': if (!['L1','L2','L3','L4','L5','L6','golden'].includes(a.value)) errors.push('Invalid time of day'); break;
    default: errors.push('Unknown action kind');
  } };
  if (def.deadline) { positive(def.deadline.seconds, 'mission deadline'); if (!Number.isFinite(def.deadline.retryGraceSeconds) || def.deadline.retryGraceSeconds < 0) errors.push('Invalid retry grace'); }
  for (const [id, a] of Object.entries(def.anchors)) if (![a.x, a.z, a.radius].every(Number.isFinite) || a.radius <= 0) errors.push(`Invalid anchor: ${id}`);
  for (const a of Object.values(def.actors)) { ref(a.anchor, def.anchors, 'anchor'); positive(a.hp, 'actor HP'); }
  for (const group of Object.values(def.groups)) group.forEach(id => ref(id, def.actors, 'actor'));
  for (const gate of Object.values(def.gates)) ref(gate.anchor, def.anchors, 'anchor');
  for (const c of Object.values(def.cinematics)) { positive(c.seconds, 'cinematic duration'); if (![...c.position, ...c.target].every(Number.isFinite)) errors.push('Invalid camera pose'); actions(c.actions); }
  for (const s of def.steps) {
    if (!objectiveTypes.includes(s.type)) errors.push(`Unknown objective type: ${s.type}`);
    if (!s.text) errors.push('Missing objective text'); ref(s.anchor, def.anchors, 'anchor');
    trigger(s.start); trigger(s.complete);
    if (!s.fail) errors.push('Missing fail triggers'); else s.fail.forEach(f => { trigger(f.trigger); if (!['timeout','escort-died','target-destroyed','player-died'].includes(f.reason)) errors.push('Unknown fail reason'); });
    if (s.timer !== undefined) positive(s.timer, 'objective timer');
    actions(s.onStart ?? []); actions(s.onComplete ?? []); actions(s.onFail ?? []);
  }
  if (!def.finish.length) errors.push('Missing finish objectives'); def.finish.forEach(id => ref(id, [...ids], 'objective'));
  actions(def.onStart); actions(def.onComplete);
  const requireCompatibleChoices = (required: string[]): void => {
    const choices=new Set<string>();
    for(const id of required){const choice=def.steps.find(s=>s.id===id)?.choice;if(choice){if(choices.has(choice))errors.push(`Unreachable choice conjunction: ${choice}`);choices.add(choice);}}
  };
  requireCompatibleChoices(def.finish);
  for(const s of def.steps)if(s.start?.kind==='objectives'&&s.start.mode==='all')requireCompatibleChoices(s.start.ids);
  const reachable = new Set<string>();
  for (let pass = 0; pass < def.steps.length; pass++) for (const s of def.steps) {
    if (s.start?.kind === 'start' || s.start?.kind === 'state' || (s.start?.kind === 'objectives' && s.start.ids.length && (s.start.mode === 'all' ? s.start.ids.every(id => reachable.has(id)) : s.start.ids.some(id => reachable.has(id))))) reachable.add(s.id);
  }
  for (const s of def.steps) if (!reachable.has(s.id)) errors.push(`Unreachable objective: ${s.id}`);
  return errors;
}
