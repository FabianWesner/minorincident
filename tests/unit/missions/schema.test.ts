import { expect, test } from 'vitest';
import { validateMission } from '../../../src/sim/missions/schema';
import type { MissionDef } from '../../../src/sim/missions/types';
export const minimalMission = (): MissionDef => ({
  id: 'mission-sandbox', briefing: 'Test mission', anchors: { goal: { x: 5, z: 0, radius: 2 } }, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [], checkpoints: [], cinematics: {},
  steps: [{ id: 'reach', type: 'reach', text: 'Reach the goal', anchor: 'goal', start: { kind: 'start' }, complete: { kind: 'volume', anchor: 'goal', edge: 'inside' }, fail: [] }], finish: ['reach'], onStart: [], onComplete: [],
});
test('T-E12-01 @E12 @E12-AC01 rejects broken graphs, unknown IDs, and missing triggers', () => {
  expect(validateMission(minimalMission())).toEqual([]);
  const cycle = minimalMission(); cycle.steps[0].start = { kind: 'objectives', ids: ['reach'], mode: 'all' }; expect(validateMission(cycle)).toContain('Unreachable objective: reach');
  const unknown = minimalMission(); unknown.steps[0].start = { kind: 'objectives', ids: ['missing'], mode: 'all' }; unknown.steps[0].anchor = 'missing'; unknown.onStart = [{ kind: 'radio', id: 'missing' }, { kind: 'spawn', group: 'missing' }];
  expect(validateMission(unknown)).toEqual(expect.arrayContaining(['Unknown objective: missing', 'Unknown anchor: missing', 'Unknown dialogue: missing', 'Unknown group: missing']));
  for (const key of ['start', 'complete', 'fail'] as const) { const broken = minimalMission(); delete (broken.steps[0] as unknown as Record<string, unknown>)[key]; expect(validateMission(broken).join()).toMatch(/Missing/); }
  const duplicate = minimalMission(); duplicate.steps.push(structuredClone(duplicate.steps[0])); expect(validateMission(duplicate).join()).toMatch(/Duplicate/);
  const timer = minimalMission(); timer.steps[0].timer = NaN; expect(validateMission(timer)).toContain('Invalid objective timer');
});
