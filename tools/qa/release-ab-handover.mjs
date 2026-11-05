/** Existing campaign handover probe, with matching carried saves on both served artifacts. */
import { resolve } from 'node:path';
const targets = process.argv[2] ?? '2,3,4,5,6,7,8,9,10', backend = process.argv[3] ?? 'webgpu';
for (const [side, origin] of [['prod', 'http://127.0.0.1:4902'], ['candidate', 'http://127.0.0.1:4901']]) {
  process.argv = [process.execPath, process.argv[1], origin, resolve('test-results/release-ab-1101/handovers', side), targets, 'low', backend];
  await import(new URL(`../perf/campaign-handover-time.ts?releaseSide=${side}`, import.meta.url).href);
}
