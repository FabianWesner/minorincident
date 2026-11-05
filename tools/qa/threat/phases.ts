import type { RunnerLevel } from '../../sim-runner/levels';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

// Deliberate semantic inventory, checked against the loaded mission definitions.
// Custom/reach objectives frequently imply combat or escort without using those words/types.
export const threatSteps: Record<RunnerLevel, Record<string, string>> = {
  L1: {}, // The escape objective is a one-tick alarm milestone; phase/spread owns L1-08.
  L2: {}, // Doors are forced before the ambush; collapse/escape own L2-07/12.
  L3: { defend: 'combat; L3-03' },
  L4: { hold: 'combat; L4-07' },
  L5: { look: 'combat; L5-05' },
  L6: { stop: 'combat; L6-05' },
  L7: { corridor: 'combat; L7-05' },
  L8: { escape: 'breach combat; L8-06' },
  L9: {}, // Driving hazard rows are not combat phases and cannot use attacks/min.
  L10: { hold: 'assault combat; L10-11' },
};

const threatPhases: Record<RunnerLevel, readonly string[]> = {
  L1: ['spread'], L2: ['collapse', 'escape'], L3: [], L4: [], L5: [], L6: [], L7: [], L8: [], L9: [], L10: [],
};

export interface Phase { key: string; label: string; threat: boolean }
export function phases(world: SimWorld, level: RunnerLevel): Phase[] {
  const mission = world.missions!;
  // The final objective is already achieved. Gates can safely isolate the
  // courier during the required invulnerable ending; that is no longer a
  // combat reachability window (G-20).
  if (mission.state.runOutUntil !== undefined) return [{ key: 'phase/run-out', label: 'level-end run-out', threat: false }];
  const rows = mission.def.steps.filter(step => mission.state.steps[step.id]?.status === 'active').map(step => ({
    key: `step/${step.id}`, label: `${step.id}: ${step.text}`, threat: !!threatSteps[level][step.id],
  }));
  const s = mission.state;
  let controller: string | undefined = s.l1?.phase ?? s.l2?.phase ?? s.l3?.phase ?? s.l4?.phase ?? s.l5?.phase ?? s.l6?.phase;
  if (level === 'L7') controller = world.l7Departure!.state.phase === 'waiting' ? world.l7Encounters!.state.started ? 'encounters' : 'pickup' : world.l7Departure!.state.phase;
  if (level === 'L8') controller = world.vehicles?.active === mission.l8!.state.carId ? 'boarding' : mission.l8!.state.breachedAt ? 'breached' : 'sanctuary';
  if (level === 'L9') controller = mission.l9?.state.phase;
  if (controller) rows.push({ key: `phase/${controller}`, label: `controller: ${controller}`, threat: threatPhases[level].includes(controller) });
  return rows;
}
