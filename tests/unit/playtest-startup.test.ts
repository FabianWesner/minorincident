import { expect, test, vi } from 'vitest';
import { preset } from '../../src/sim/progression/Campaign';
import { validateSave } from '../../src/sim/progression/Save';
import { assertRenderedBodies, campaignEndingComplete, isMandatoryBossObjective, observeWithin, playtestSave, shouldResumePause } from '../../tools/playtest/startup';

test('#99 fists seed persists only fists and kick while retaining campaign progress', () => {
  const source = preset('L6-default'), save = playtestSave(source, 'male', 'fists');
  expect(save.racks).toEqual({ LEFT: ['weapon.fists'], RIGHT: ['weapon.kick'] });
  // Earned ownership must remain consistent with completed levels and upgrade prerequisites.
  expect(save.ownedActions).toEqual(source.ownedActions);
  expect(save.upgrades).toEqual(source.upgrades);
  expect(save.character).toBe('male');
  expect(save.unlockedLevel).toBe(6);
  expect(save.completedLevels).toBe(source.completedLevels);
  expect(source.racks.LEFT).toContain('weapon.fire-axe');
  expect(playtestSave(source, 'female', 'weapons').racks).toEqual(source.racks);
});

test('#99 an empty handover frame is valid; visible bodies still require rendered joints', () => {
  expect(() => assertRenderedBodies([])).not.toThrow();
  expect(() => assertRenderedBodies([{ drawn: false }])).not.toThrow();
  expect(() => assertRenderedBodies([{ drawn: true, joints: {} }])).not.toThrow();
  expect(() => assertRenderedBodies([{ drawn: true }])).toThrow('rendered-body observations');
});

test('#99 the fists profile satisfies the real campaign save validator', () => {
  const source = preset('L6-default');
  expect(validateSave(source)).toBe(true);
  expect(validateSave(playtestSave(source, 'male', 'fists'))).toBe(true);
});

test('#99 the input driver resumes a visible pause menu during play', () => {
  expect(shouldResumePause('pause',false)).toBe(true);
  expect(shouldResumePause('pause',true)).toBe(false);
  expect(shouldResumePause(null,false)).toBe(false);
  expect(shouldResumePause('title',false)).toBe(false);
  expect(shouldResumePause('settings',false)).toBe(false);
});

test('the input driver never debug-skips the mandatory L10 Mega objective', () => {
  expect(isMandatoryBossObjective('L10', 'mega')).toBe(true);
  expect(isMandatoryBossObjective('L10', 'release')).toBe(false);
  expect(isMandatoryBossObjective('L9', 'mega')).toBe(false);
  expect(isMandatoryBossObjective(null, null)).toBe(false);
});

test('automatic L10 progression is success only after the actual credits and campaign completion', () => {
  const done = { level: 'L10', phase: 'progression', creditsFinished: true, endingPhase: 'done', completedLevels: 10 };
  expect(campaignEndingComplete(done)).toBe(true);
  expect(campaignEndingComplete({ ...done, creditsFinished: false })).toBe(false);
  expect(campaignEndingComplete({ ...done, endingPhase: 'credits' })).toBe(false);
  expect(campaignEndingComplete({ ...done, completedLevels: 9 })).toBe(false);
  expect(campaignEndingComplete({ ...done, level: 'L9' })).toBe(false);
  expect(campaignEndingComplete({ ...done, phase: 'playing' })).toBe(false);
});

test('an unresponsive renderer fails within the observation budget and clears its timer', async () => {
  vi.useFakeTimers();
  try {
    const blocked = observeWithin(new Promise<never>(() => {}), 100);
    const failure = expect(blocked).rejects.toThrow('browser renderer is unresponsive');
    await vi.advanceTimersByTimeAsync(100);
    await failure;
    expect(vi.getTimerCount()).toBe(0);
    expect(await observeWithin(Promise.resolve('frame'))).toBe('frame');
    expect(vi.getTimerCount()).toBe(0);
    await expect(observeWithin(Promise.reject(new Error('Target closed')))).rejects.toThrow('Target closed');
    expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});
