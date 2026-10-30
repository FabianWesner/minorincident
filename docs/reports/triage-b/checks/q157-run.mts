import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const { runLevel } = await import(pathToFileURL(resolve('tools/sim-runner/levels.ts')).href);
let result;
const report = await runLevel('L6', 'complete', 1, 1200, 'auto', undefined, (world, outcome) => {
  result = {
    rescued: outcome.rescued, survivorsIn: outcome.survivorsIn, survivors: outcome.survivors,
    roster: world.missions.state.l6.survivors.map(s => ({ key: s.key, status: s.status, injured: s.injured }))
  };
});
const receipt = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), level: 'L6', seed: 1, policy: 'complete', completed: report.completed, deaths: report.deaths, time: report.time, result };
writeFileSync(process.argv[2], JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ revision: receipt.revision.slice(0, 9), completed: receipt.completed, deaths: receipt.deaths, time: receipt.time, rescued: result?.rescued, survivorsIn: result?.survivorsIn }));
if (!report.completed) process.exitCode = 1;
