import { writeFileSync } from 'node:fs';
import { measureHorde } from '../performance/sim';
const results = [];
for (const count of [100, 200] as const) results.push(await measureHorde(`perf-horde-${count}`, 3600, 1));
writeFileSync(process.argv[2], JSON.stringify(results, null, 2));
