import { afterEach, expect, test, vi } from 'vitest';
import { spawnSync } from 'node:child_process';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn(() => ({ status: 0 })) }));
vi.mock('node:fs', async importOriginal => ({ ...await importOriginal<typeof import('node:fs')>(), mkdirSync: vi.fn(), writeFileSync: vi.fn(), copyFileSync: vi.fn() }));
const originalArgv = process.argv;
afterEach(() => { process.argv = originalArgv; vi.unstubAllEnvs(); vi.clearAllMocks(); vi.resetModules(); });

test('E07 remote verification isolates timing on Hetzner, pulls evidence and keeps browsers locked locally', async () => {
  process.argv = ['node', 'tools/verify.ts', 'E07'];
  vi.stubEnv('MI_VERIFY_REMOTE_SIM', '1');
  vi.stubEnv('MI_VERIFY_REMOTE_BROWSER', '');
  await import('../../../tools/verify');
  const commands = vi.mocked(spawnSync).mock.calls.map(([command, args]) => [command, ...args as string[]]);
  const sims = commands.filter(command => command.includes('vitest'));
  expect(sims).toHaveLength(2);
  for (const command of sims) expect(command.slice(0, 2)).toEqual(['sh', 'tools/remote/run.sh']);
  const timing = sims.find(command => command.includes('T-E07-11'))!;
  expect(timing).toContain('tools/remote/timing-isolated.sh');
  expect(timing).toContain('test-results/epics/E07/vitest-timing.json');
  expect(timing).toContain('--pull');
  expect(timing).toContain('--maxWorkers=1');
  const browser = commands.find(command => command.includes('playwright'))!;
  expect(browser.slice(0, 2)).toEqual(['sh', 'tools/e2e-lock.sh']);
});
