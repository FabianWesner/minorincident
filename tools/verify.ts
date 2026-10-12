import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { selectionFor } from './verify-selection';

const target = process.argv[2];
const selection = selectionFor(target);
const output = `test-results/epics/${target}`;
mkdirSync(output, { recursive: true });
// E07's Alpha wall-clock fixtures stay on the Mac when functional sims run remotely.
const alphaTiming = ['tests/sim/ai/director.test.ts', 'tests/sim/performance/alpha.test.ts', 'tests/sim/performance/alpha-physical.test.ts'];
const e18GpuPattern = '@perf|@E18-AC01|crowd-drawn|crowd variety|crowd-close-lod|T-E18-04-browser|T-E13-05|S-01|S-02';
const infectedGpuPattern = 'alpha-(?:asset|physical|support)[.]spec[.]ts|crowd-(?:drawn|feel|visible-outbreak)[.]spec[.]ts|health-bars[.]spec[.]ts|infected-visibility[.]spec[.]ts|controls-playtest[.]spec[.]ts|l4-boot[.]spec[.]ts|T-E13-05|S-01|T-E07-12|T-E07-13';
const gpuSelectionPattern = `^(?=.*(?:${selection.pattern}|T-E07-physical-budget))(?=.*(?:${infectedGpuPattern}))`;
const splitAlphaTiming = target === 'E07' && process.env.MI_VERIFY_REMOTE_SIM === '1';
const splitE18Timing = target === 'E18' && process.env.MI_VERIFY_REMOTE_SIM === '1';
const simPattern = splitAlphaTiming ? `^(?!.*T-E07-11).*(?:${selection.pattern})` : splitE18Timing ? `^(?!.*(?:@E18-AC02|@perf)).*(?:${selection.pattern})` : selection.pattern;
const simArgs = ['vitest', 'run', '-t', selection.pattern, '--maxWorkers=1', '--reporter=default', '--reporter=json', `--outputFile=${output}/vitest.json`];
if (splitAlphaTiming || splitE18Timing) simArgs[3] = simPattern;
// Keep heavy simulation work off the shared Mac while browser/GPU gates stay local.
const simCommand = process.env.MI_VERIFY_REMOTE_SIM === '1'
  ? ['sh', 'tools/remote/run.sh', process.cwd(), '--pull', `${output}/vitest.json`, '--', 'npx', ...simArgs]
  : ['sh', 'tools/sim-lock.sh', 'npx', ...simArgs];
// Capture and pixel assertions need the native GPU; other browser checks run remotely.
const l4VisualPattern = 'T-E22-18|T-E22-19|T-E22-boot|T-E13-05|S-02|S-01|T-E07-crowd-drawn|20 infected corpses remain drawn';
const l5VisualPattern = 'T-E23-17|T-E23-18|T-E23-19b|T-E23-E1|T-E23-15v|T-E23-12-browser|T-E23-12e|T-E13-05|S-02|S-01|T-E07-crowd-drawn|20 infected corpses remain drawn|T-E22-boot';
const l7VisualPattern = 'S-01|S-02|T-E13-05|T-E07-crowd-drawn|20 infected corpses remain drawn|T-E22-boot';
const l7GpuSelectionPattern = `^(?=.*(?:${selection.pattern}))(?=.*(?:${l7VisualPattern}))`;
const commands: string[][] = [
  ['npm', 'run', 'typecheck'], ['npm', 'run', 'lint'],
  // These lane checks share a preview build with their queued browser runs.
  // Keep rebuilding dist from deleting chunks underneath an active capture.
  target === 'E23' || target === 'E25' || target === 'E26' || target === 'E27' || target === 'E28'
    ? ['sh', 'tools/e2e-lock.sh', 'npm', 'run', 'build']
    : ['npm', 'run', 'build'],
  // Timing fixtures must not compete with other Vitest workers on the shared Mac.
  ...(splitAlphaTiming ? [['sh', 'tools/sim-lock.sh', 'npx', 'vitest', 'run', ...alphaTiming, '-t', 'T-E07-11', '--maxWorkers=1', '--reporter=default', '--reporter=json', `--outputFile=${output}/vitest-timing.json`]] : []),
  ...(splitE18Timing ? [['sh', 'tools/sim-lock.sh', 'npx', 'vitest', 'run', '-t', `^(?=.*(?:${selection.pattern}))(?=.*(?:@E18-AC02|@perf))`, '--maxWorkers=1', '--reporter=default', '--reporter=json', `--outputFile=${output}/vitest-timing.json`]] : []),
  simCommand,
  // Keep E07 visual/counter probes on the Mac; offload its remaining browser checks.
  ...(target === 'E07' && process.env.MI_VERIFY_REMOTE_BROWSER === '1'
    ? [
      ['sh', 'tools/remote/run.sh', process.cwd(), '--pull', 'test-results/playwright/results.json', '--env', `E2E_PORT=${process.env.E2E_PORT ?? 3400 + process.pid % 1000}`, '--', 'sh', '-c', 'npm run build && npx playwright test --grep "$1" --grep-invert "$2" --workers=1', 'sh', selection.pattern, infectedGpuPattern],
      ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', gpuSelectionPattern, '--workers=1'],
    ]
    : target === 'E10'
    ? [
      ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern, '--grep-invert', '@E10-AC06', '--workers=2'],
      // Native GPU load timing stays headless: run once, after the other browser checks.
      ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', 'tests/perf/district-load.spec.ts', '--grep', '@E10-AC06', '--project=chromium', '--workers=2'],
    ]
    : target === 'E19'
      ? [
        ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern, '--grep-invert', 'M1-22|T-E19-24', '--workers=2'],
        // Transition frame budgets must not compete with another context loading GPU programs.
        ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', 'tests/perf/l1-transitions.spec.ts', 'tests/perf/l1-spots.spec.ts', '--project=chromium', '--workers=1'],
      ]
    : target === 'E18'
      ? [
        ...(process.env.MI_VERIFY_REMOTE_BROWSER === '1' ? [
          ['sh', 'tools/remote/run.sh', process.cwd(), '--pull', `${output}/playwright-remote.json`, '--env', `E2E_PORT=${process.env.E2E_PORT ?? 33793}`, '--', 'sh', '-c', `npm run build && npx playwright test --grep '${selection.pattern}' --grep-invert '${e18GpuPattern}|@E18-AC08|@E18-AC09|WebGPU low tier parity' --project=chromium --workers=1; status=$?; cp test-results/playwright/results.json ${output}/playwright-remote.json; exit $status`],
          ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', `^(?=.*(?:${selection.pattern}))(?=.*(?:${e18GpuPattern}))`, '--grep-invert', '@E18-AC08|@E18-AC09|WebGPU low tier parity', '--workers=2'],
        ] : [['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern, '--grep-invert', '@E18-AC08|@E18-AC09|WebGPU low tier parity', '--workers=2']]),
        // Frame budgets and CPU-throttled profiles use native GPU headless Chrome, one worker.
        ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', 'tests/perf/e18-desktop.spec.ts', 'tests/perf/e18-devices.spec.ts', 'tests/perf/horde-budget.spec.ts', '--project=chromium', '--workers=1'],
      ]
      : target === 'E20'
        ? [
          ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern, '--grep-invert', 'T-E20-20', '--workers=2'],
          // The rescue-peak frame budgets (desktop high, throttled phone low) run alone on the native GPU.
          ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', 'tests/perf/l2-budgets.spec.ts', '--project=chromium', '--workers=1'],
        ]
      : target === 'E21'
        ? [
          ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern, '--grep-invert', 'T-E21-21', '--workers=2'],
          // The station-attack and Boulevard frame budgets (desktop high, throttled phone low) run alone on the native GPU.
          ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', 'tests/perf/l3-budgets.spec.ts', '--project=chromium', '--workers=1'],
        ]
      : target === 'E22'
        ? [
          ...(process.env.MI_VERIFY_REMOTE_E2E === '1'
            ? [
              ['sh', 'tools/remote/run.sh', process.cwd(), '--env', `E2E_PORT=${process.env.E2E_PORT ?? 3388}`, '--pull', 'test-results/playwright/results.json', '--', 'sh', '-c', `npm run build && npx playwright test --grep '${selection.pattern}' --grep-invert '@perf|${l4VisualPattern}' --project=chromium --workers=1`],
              ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', `^(?=.*(?:${selection.pattern}))(?=.*(?:${l4VisualPattern}))`, '--project=chromium', '--workers=1'],
            ]
            : [['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern, '--grep-invert', '@perf', '--project=chromium', '--workers=1']]),
          // Hetzner runs the functional gates; native Metal timing stays on the Mac.
          ...(process.platform === 'darwin' ? [['sh', 'tools/perf/quiet-run.sh', 'npx', 'playwright', 'test', 'tests/perf/l4-budgets.spec.ts', '--project=chromium', '--workers=1']] : []),
        ]
      : target === 'E23' || target === 'E24'
        ? [
          ...(target === 'E23' && process.env.MI_VERIFY_REMOTE_E2E === '1'
            ? [
              ['sh', 'tools/remote/run.sh', process.cwd(), '--pull', `${output}/playwright-remote.json`, '--env', `E2E_PORT=${process.env.E2E_PORT ?? 3388}`, '--', 'sh', '-c', `mkdir -p ${output} && npm run build && npx playwright test --grep '${selection.pattern}' --grep-invert '@perf|${l5VisualPattern}' --workers=1; status=$?; cp test-results/playwright/results.json ${output}/playwright-remote.json; exit $status`],
              ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', l5VisualPattern, '--workers=2'],
            ]
            : [['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern, '--grep-invert', '@perf', '--workers=1']]),
          // Reserve all configured browser slots for the native GPU frame budgets.
          ['sh', 'tools/perf/quiet-run.sh', 'npx', 'playwright', 'test', target==='E24'?'tests/perf/l6-budgets.spec.ts':'tests/perf/l5-budgets.spec.ts', '--project=chromium', '--workers=1'],
        ]
      : target === 'E25'
        ? [
          ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern, '--grep-invert', 'T-E25-14', '--workers=1'],
          // Lighting frame budgets (desktop high, throttled phone low) run alone on the native GPU.
          ['sh', 'tools/perf/quiet-run.sh', 'npx', 'playwright', 'test', 'tests/perf/e25-lighting.spec.ts', 'tests/perf/e25-light-lab.spec.ts', '--project=chromium', '--workers=1'],
        ]
      : target === 'E27'
        ? [
          ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern, '--grep-invert', '@perf', '--workers=1'],
          ['sh', 'tools/perf/quiet-run.sh', 'npx', 'playwright', 'test', 'tests/perf/explosions.spec.ts', '--project=chromium', '--workers=1'],
        ]
        : target === 'E29' || target === 'E31'
          ? [
            ...(process.env.MI_VERIFY_REMOTE_E2E === '1'
              ? [
                ['sh', 'tools/remote/run.sh', process.cwd(), '--env', `E2E_PORT=${process.env.E2E_PORT ?? 3400 + process.pid % 1000}`, '--pull', 'test-results/playwright/results.json', '--', 'sh', '-c', `npm run build && npx playwright test --grep '${selection.pattern}' --grep-invert '@perf|${l7VisualPattern}' --workers=1`],
                ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', l7GpuSelectionPattern, '--workers=1'],
              ]
              : [['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern, '--grep-invert', '@perf', '--workers=1']]),
            // Native Metal timing belongs on the Mac; Hetzner verifies the functional gates.
            ...(target === 'E29' && process.platform === 'darwin' ? [['sh', 'tools/perf/quiet-run.sh', 'npx', 'playwright', 'test', 'tests/perf/l7-rocket.spec.ts', 'tests/perf/l7-district.spec.ts', 'tests/perf/l7-encounters.spec.ts', '--project=chromium', '--workers=1']] : []),
          ]
        : [['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern, ...(target === 'E26' || target === 'E28' ? ['--workers=1'] : [])]]),
];
const checks: { command: string[]; exitCode: number | null }[] = [];
for (const [command, ...args] of commands) {
  console.log(`\nVerifying ${target}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (target === 'E07' && process.env.MI_VERIFY_REMOTE_BROWSER === '1' && (args.includes('playwright') || args.some(a => a.includes('npx playwright test')))) copyFileSync('test-results/playwright/results.json', `${output}/playwright-${args.includes('tools/remote/run.sh') ? 'headless' : 'gpu'}.json`);
  if (target === 'E10' && args.includes('playwright')) copyFileSync('test-results/playwright/results.json', `${output}/playwright-${args.includes('@E10-AC06') && !args.includes('--grep-invert') ? 'gpu' : 'headless'}.json`);
  if (target === 'E19' && args.includes('playwright')) copyFileSync('test-results/playwright/results.json', `${output}/playwright-${args.includes('tests/perf/l1-transitions.spec.ts') ? 'gpu' : 'headless'}.json`);
  if (target === 'E18' && args.includes('playwright')) copyFileSync('test-results/playwright/results.json', `${output}/playwright-${args.includes('tests/perf/e18-desktop.spec.ts') ? 'gpu' : 'headless'}.json`);
  if ((target === 'E23' || target === 'E24') && args.includes('playwright')) copyFileSync('test-results/playwright/results.json', `${output}/playwright-${args.some(a=>a==='tests/perf/l5-budgets.spec.ts'||a==='tests/perf/l6-budgets.spec.ts') ? 'gpu' : 'headless'}.json`);
  if ((target === 'E25' || target === 'E27') && args.includes('playwright')) copyFileSync('test-results/playwright/results.json', `${output}/playwright-${args.includes('tools/perf/quiet-run.sh') ? 'gpu' : 'headless'}.json`);
  if (target === 'E31' && (args.includes('playwright') || args.some(a => a.includes('npx playwright test')))) copyFileSync('test-results/playwright/results.json', `${output}/playwright-${args.includes('tools/remote/run.sh') ? 'headless' : 'gpu'}.json`);
  checks.push({ command: [command, ...args], exitCode: result.status });
  writeFileSync(`${output}/checks.json`, JSON.stringify({ target, ...selection, checks }, null, 2) + '\n');
  if (result.error || result.status !== 0) {
    process.exitCode = result.status || 1;
    // E18 still records the local GPU gate when a headless/manual criterion fails.
    if (target !== 'E18' || !args.includes('playwright')) break;
  }
}
