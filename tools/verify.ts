import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { selectionFor } from './verify-selection';

const target = process.argv[2];
const selection = selectionFor(target);
const output = `test-results/epics/${target}`;
mkdirSync(output, { recursive: true });
const simArgs = ['vitest', 'run', '-t', selection.pattern, '--maxWorkers=1', '--reporter=default', '--reporter=json', `--outputFile=${output}/vitest.json`];
// Keep heavy simulation work off the shared Mac while browser/GPU gates stay local.
const simCommand = process.env.MI_VERIFY_REMOTE_SIM === '1'
  ? ['sh', 'tools/remote/run.sh', process.cwd(), '--pull', `${output}/vitest.json`, '--', 'npx', ...simArgs]
  : ['sh', 'tools/sim-lock.sh', 'npx', ...simArgs];
// Capture and pixel assertions need the native GPU; other browser checks run remotely.
const l5VisualPattern = 'T-E23-17|T-E23-18|T-E23-19b|T-E23-E1|T-E23-15v|T-E23-12-browser|T-E23-12e|T-E13-05|S-02|S-01|T-E07-crowd-drawn|20 infected corpses remain drawn|T-E22-boot';
const commands: string[][] = [
  ['npm', 'run', 'typecheck'], ['npm', 'run', 'lint'],
  // These lane checks share a preview build with their queued browser runs.
  // Keep rebuilding dist from deleting chunks underneath an active capture.
  target === 'E23' || target === 'E25' || target === 'E26' || target === 'E27' || target === 'E28'
    ? ['sh', 'tools/e2e-lock.sh', 'npm', 'run', 'build']
    : ['npm', 'run', 'build'],
  // Timing fixtures must not compete with other Vitest workers on the shared Mac.
  simCommand,
  ...(target === 'E10'
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
        ['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern, '--grep-invert', '@E18-AC08|@E18-AC09|WebGPU low tier parity', '--workers=2'],
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
        : [['sh', 'tools/e2e-lock.sh', 'npx', 'playwright', 'test', '--grep', selection.pattern, ...(target === 'E26' || target === 'E28' ? ['--workers=1'] : [])]]),
];
const checks: { command: string[]; exitCode: number | null }[] = [];
for (const [command, ...args] of commands) {
  console.log(`\nVerifying ${target}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (target === 'E10' && args.includes('playwright')) copyFileSync('test-results/playwright/results.json', `${output}/playwright-${args.includes('@E10-AC06') && !args.includes('--grep-invert') ? 'gpu' : 'headless'}.json`);
  if (target === 'E19' && args.includes('playwright')) copyFileSync('test-results/playwright/results.json', `${output}/playwright-${args.includes('tests/perf/l1-transitions.spec.ts') ? 'gpu' : 'headless'}.json`);
  if (target === 'E18' && args.includes('playwright')) copyFileSync('test-results/playwright/results.json', `${output}/playwright-${args.includes('tests/perf/e18-desktop.spec.ts') ? 'gpu' : 'headless'}.json`);
  if ((target === 'E23' || target === 'E24') && args.includes('playwright')) copyFileSync('test-results/playwright/results.json', `${output}/playwright-${args.some(a=>a==='tests/perf/l5-budgets.spec.ts'||a==='tests/perf/l6-budgets.spec.ts') ? 'gpu' : 'headless'}.json`);
  if ((target === 'E25' || target === 'E27') && args.includes('playwright')) copyFileSync('test-results/playwright/results.json', `${output}/playwright-${args.includes('tools/perf/quiet-run.sh') ? 'gpu' : 'headless'}.json`);
  checks.push({ command: [command, ...args], exitCode: result.status });
  writeFileSync(`${output}/checks.json`, JSON.stringify({ target, ...selection, checks }, null, 2) + '\n');
  if (result.error || result.status !== 0) {
    process.exitCode = result.status || 1;
    // E18 still records the local GPU gate when a headless/manual criterion fails.
    if (target !== 'E18' || !args.includes('playwright')) break;
  }
}
