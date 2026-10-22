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

for (const [epic, visualTitles] of [
  ['E22', ['T-E22-ride-smooth-webgl-high @E22', 'T-E22-12-special-charge-high @E22-AC12']],
  ['E23', ['T-E23-17 @E23 @E23-AC17']],
  ['E24', ['T-E24-15-matrix @E24-AC15', 'T-E24-18-phone-panel @E24-AC18']],
] as const) test(`${epic} remote verification keeps capture/pixel checks on one native browser`, async () => {
  process.argv = ['node', 'tools/verify.ts', epic];
  vi.stubEnv('MI_VERIFY_REMOTE_SIM', '1'); vi.stubEnv('MI_VERIFY_REMOTE_E2E', '1');
  await import('../../../tools/verify');
  const commands = vi.mocked(spawnSync).mock.calls.map(([command, args]) => [command, ...args as string[]]);
  const sims = commands.filter(command => command.includes('vitest'));
  expect(sims).toHaveLength(1); expect(sims[0].slice(0, 2)).toEqual(['sh', 'tools/remote/run.sh']);
  const remote = commands.find(command => command[1] === 'tools/remote/run.sh' && command.some(arg => arg.includes('npx playwright')))!;
  expect(remote).toBeDefined(); expect(remote.some(arg => arg.includes('--workers=1'))).toBe(true);
  const native = commands.find(command => command[1] === 'tools/e2e-lock.sh' && command.includes('playwright'))!;
  expect(native).toContain('--workers=1');
  const pattern = new RegExp(native[native.indexOf('--grep') + 1]);
  for (const title of visualTitles) {
    expect(pattern.test(title), title).toBe(true);
    const name = title.split(' ')[0].replace(/-webgl-high$|-charge-high$|-matrix$|-phone-panel$/, '');
    expect(remote.some(arg => arg.includes(name)), `remote excludes native ${name}`).toBe(true);
  }
  for (const browser of commands.filter(command => command.includes('playwright')))
    expect(browser).toContain('--workers=1');
});
