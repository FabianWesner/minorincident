import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('direct Node scenario tools keep QA scenarios without a Vite build macro', () => {
  const script = `
    import assert from 'node:assert/strict';
    import { loadScenarioDefinition } from './src/levels/loader.ts';
    for (const hooks of [undefined, true, false]) {
      if (hooks === undefined) delete globalThis.__QA_HOOKS__;
      else globalThis.__QA_HOOKS__ = hooks;
      assert.equal(loadScenarioDefinition('civ-street').name, 'civ-street');
      if (hooks === false) assert.throws(() => loadScenarioDefinition('lookdev'), /Unknown scenario/);
      else assert.equal(loadScenarioDefinition('lookdev').name, 'lookdev');
    }
    console.log('scenario tools passed');
  `;
  expect(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { encoding: 'utf8' })).toContain('scenario tools passed');
});
