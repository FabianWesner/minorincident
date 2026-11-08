import { fork } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const run = seed => new Promise((resolve, reject) => {
  const child = fork(fileURLToPath(new URL('../../../tools/qa/threat/stageJobs.ts', import.meta.url)), [], {
    execArgv: ['--import', 'tsx/esm'], env: { ...process.env, MI_THREAT_STAGE_WORKER: '1' },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  let result;
  child.once('error', reject);
  child.once('message', value => { result = value; child.disconnect(); });
  child.once('exit', code => code === 0 && result?.native && !result.error ? resolve({ seed, ...result.native }) : reject(new Error(`L4 seed ${seed}: ${result?.error ?? code}`)));
  child.send({ id: `L4/skilled/${seed}`, level: 'L4', kind: 'native', seed, passive: false });
});
const settled = await Promise.allSettled([2, 3].map(run));
const failed = settled.find(result => result.status === 'rejected');
if (failed) throw failed.reason;
const results = settled.map(result => result.value);
writeFileSync(process.argv[2] ?? '/tmp/r9-l4-extra.json', JSON.stringify(results, null, 2)+'\n');
