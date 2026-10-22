import { afterEach, expect, test, vi } from 'vitest';
import { spawnSync } from 'node:child_process';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn(() => ({ status: 0 })) }));
vi.mock('node:fs', async importOriginal => ({ ...await importOriginal<typeof import('node:fs')>(), mkdirSync: vi.fn(), writeFileSync: vi.fn(), copyFileSync: vi.fn() }));
const originalArgv = process.argv, originalExitCode = process.exitCode;
afterEach(() => { process.argv = originalArgv; process.exitCode = originalExitCode; vi.unstubAllEnvs(); vi.clearAllMocks(); vi.resetModules(); });

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
  expect(browser).toContain('--workers=1');
  expect(browser).toContain('@perf');
  const perf = commands.find(command => command.includes('tools/perf/quiet-run.sh'))!;
  expect(perf).toContain('--workers=1');
  expect(perf.find(part => part.includes('T-E07-physical-budget'))).toContain('@perf');
  const staticCheck = commands.find(command => command.includes('npm run typecheck && npm run lint'))!;
  expect(staticCheck.slice(0, 2)).toEqual(['sh', 'tools/remote/run.sh']);
  const build = commands.find(command => command.includes('build'))!;
  expect(build.slice(0, 2)).toEqual(['sh', 'tools/remote/run.sh']);
  expect(build).toContain('--pull'); expect(build).toContain('dist');
});

for (const [epic, visualTitles] of [
  ['E22', ['T-E22-ride-smooth-webgl-high @E22', 'T-E22-12-special-charge-high @E22-AC12', '@E22 no army-line rebuild prompts webgpu high zoom 1', '@E22 line-broken cellar guidance webgpu low zoom 0.5', '@E22 @camera-hotfix L4 refuge framing and debug HUD webgpu high', 'T-E22-blank @E22 viewport webgpu', '@E22 L4 war: mouse WASD stick webgpu high zoom 1', 'T-E22-cellar-pos @E22', 'T-E02-webgpu-canvas @smoke @E02']],
  ['E23', ['T-E23-17 @E23 @E23-AC17', 'PO #21b @E23', 'PO #26 #28 @E23 survivor health and moving radar dots webgpu high zoom 1', 'T-fix-l5-start @E23', 'T-fix-l5-ingress @E23', 'T-E23-cellar-pos @E23', 'T-E02-webgpu-game-canvas @smoke @E02']],
  ['E24', ['T-E24-15-matrix @E24-AC15', 'T-E24-18-phone-panel @E24-AC18', 'T-E29-16-browser @E24-AC14', 'PO34 service gate explains the crate task with one bar webgpu high @E24', 'interaction panel stays inside @E24', 'T-E02-webgpu-level-transitions @smoke @E02']],
] as const) test(`${epic} remote verification keeps capture/pixel checks on one native browser`, async () => {
  process.argv = ['node', 'tools/verify.ts', epic];
  vi.stubEnv('MI_VERIFY_REMOTE_SIM', '1'); vi.stubEnv('MI_VERIFY_REMOTE_E2E', '1');
  await import('../../../tools/verify');
  const commands = vi.mocked(spawnSync).mock.calls.map(([command, args]) => [command, ...args as string[]]);
  const sims = commands.filter(command => command.includes('vitest'));
  expect(sims).toHaveLength(1); expect(sims[0].slice(0, 2)).toEqual(['sh', 'tools/remote/run.sh']);
  const remote = commands.find(command => command[1] === 'tools/remote/run.sh' && command.some(arg => arg.includes('npx playwright')))!;
  expect(remote).toBeDefined(); expect(remote).toContain('E2E_UNITS=1'); expect(remote).toContain('E2E_ADMISSION_TIMEOUT_SECONDS=3600'); expect(remote.some(arg => arg.includes('sh tools/e2e-lock.sh npx playwright'))).toBe(true); expect(remote.some(arg => arg.includes('--workers=1'))).toBe(true);
  const native = commands.find(command => command[1] === 'tools/e2e-lock.sh' && command.includes('playwright'))!;
  expect(native).toContain('--workers=1');
  const pattern = new RegExp(native[native.indexOf('--grep') + 1]);
  const excludedPattern = new RegExp(remote.at(-1)!.match(/--grep-invert '([^']+)'/)![1]);
  for (const title of visualTitles) {
    expect(pattern.test(title), title).toBe(true);
    expect(excludedPattern.test(title), `remote excludes ${title}`).toBe(true);
  }
  for (const browser of commands.filter(command => command.includes('playwright')))
    expect(browser).toContain('--workers=1');
});

test('E22 retains a remote browser failure and still records native visual/perf gates', async () => {
  process.argv = ['node', 'tools/verify.ts', 'E22'];
  vi.stubEnv('MI_VERIFY_REMOTE_SIM', '1'); vi.stubEnv('MI_VERIFY_REMOTE_E2E', '1');
  for (let i = 0; i < 4; i++) vi.mocked(spawnSync).mockReturnValueOnce({ status: 0 } as ReturnType<typeof spawnSync>);
  vi.mocked(spawnSync).mockReturnValueOnce({ status: 7 } as ReturnType<typeof spawnSync>);
  await import('../../../tools/verify');
  const commands = vi.mocked(spawnSync).mock.calls.map(([command, args]) => [command, ...args as string[]]);
  expect(process.exitCode).toBe(7);
  expect(commands.some(command => command[1] === 'tools/e2e-lock.sh' && command.includes('playwright'))).toBe(true);
  if (process.platform === 'darwin') expect(commands.some(command => command[1] === 'tools/perf/quiet-run.sh')).toBe(true);
});
