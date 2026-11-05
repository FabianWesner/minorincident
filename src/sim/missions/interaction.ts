import { LevelSixSubway } from './LevelSixSubway';
import type { MissionDef, MissionState, ObjectiveDef, Trigger } from './types';

/**
 * Active mission interactions. The input predicate (`Mission.interactStepInRange`) and the presentation rings
 * (`InteractionView`) both read this list, so a ring is drawn exactly where an `E` press would count.
 */
export interface ActiveInteraction {
  step: ObjectiveDef;
  /** The interact trigger that completes the step (stand in `anchor`'s radius and hold). */
  trigger: Extract<Trigger, { kind: 'interact' }>;
  /** Whether the ground ring is drawn: optional (easter-egg) steps stay quiet, except the L2 axe rack. */
  ring: boolean;
}

export function interactTrigger(t: Trigger): Extract<Trigger, { kind: 'interact' }> | undefined {
  if (t.kind === 'interact') return t;
  if (t.kind === 'all') for (const child of t.triggers) { const found = interactTrigger(child); if (found) return found; }
  return undefined;
}

export function activeInteractions(mission: { def: MissionDef; state: MissionState; l10?: unknown }): ActiveInteraction[] {
  const { def, state } = mission, out: ActiveInteraction[] = [];
  // L10: the console is a scripted `hold` step, but pressing E at the console starts the charge.
  if (mission.l10 && state.steps.hold.status === 'active' && !state.states['charge-active'] && def.anchors['cure-console']) {
    const hold = def.steps.find(s => s.id === 'hold')!;
    const trigger = { kind: 'interact', anchor: 'cure-console', seconds: .6 } as const;
    out.push({ step: { ...hold, text: 'Activate the dispersal console', type: 'interact', complete: trigger }, trigger, ring: true });
  }
  for (const step of def.steps) {
    const trigger = state.steps[step.id]?.status === 'active' ? interactTrigger(step.complete) : undefined;
    if (trigger) out.push({ step: { ...step, complete: trigger }, trigger, ring: !step.optional || (step.id === 'axe' && step.complete.kind === 'interact' && step.complete.anchor === 'l2-axe-rack') });
  }
  return out;
}

/** True while `p` is within an active, ringed interaction's anchor (presentation: which entity wears the ground ring). */
export function isRingedInteraction(mission: { def: MissionDef; state: MissionState; l10?: unknown }, p: { x: number; z: number }): boolean {
  if (mission.state.phase !== 'playing') return false;
  return activeInteractions(mission).some(i => {
    const anchor = mission.def.anchors[i.trigger.anchor];
    return i.ring && !!anchor && Math.hypot(anchor.x - p.x, anchor.z - p.z) <= 0.75;
  });
}

/** L6: only the open gate targeted by the group's current waypoint offers its prompt. */
export function isCurrentOpenL6Gate(state: { marker?: string; leaderX: number; waypoint?: { x: number; z: number }; gates: { id: number; x: number; closedAt: number }[] } | undefined, id: number): boolean {
  if (!state || state.marker !== 'l6-next') return false;
  if (state.waypoint) return state.gates.some(g => !g.closedAt && g.id === id && Math.hypot(LevelSixSubway.gateWait(g.x).x - state.waypoint!.x, LevelSixSubway.gateWait(g.x).z - state.waypoint!.z) < .1);
  const next = state.gates.filter(g => !g.closedAt && g.x >= state.leaderX - 3).sort((a, b) => a.x - b.x)[0];
  return next?.id === id;
}

/** Same, read from the running mission. */
export function l6GateIsCurrent(mission: { def: MissionDef; state: MissionState } | null | undefined, id: number): boolean {
  const l6 = mission?.state.l6;
  return isCurrentOpenL6Gate(mission && l6 && mission.state.marker ? { ...l6, marker: mission.state.marker, waypoint: mission.def.anchors['l6-next'] } : undefined, id);
}
