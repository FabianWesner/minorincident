import { readFileSync } from 'node:fs';
/** q249 froze its shoulder band to the pre-head-edit height, per file/member. */
const references = new Map<string, number>();
for (let batch = 1; batch <= 5; batch++) {
  const data = JSON.parse(readFileSync(`docs/reports/q249/rollout/batch-${batch}.json`, 'utf8'));
  for (const entry of data.receipts) for (const file of entry.files) for (const figure of file.figures) references.set(`${file.path}:${figure.rootName ?? ''}`, figure.heightBefore);
}
for (const row of JSON.parse(readFileSync('docs/reports/q249/pilot-2/ratios.json', 'utf8')).rows) references.set(`${row.output}:`, row.heightBefore);
export function headReference(path: string, rootName?: string): number {
  const height = references.get(`${path}:${rootName ?? ''}`);
  if (!height) throw Error(`Missing q249 shoulder reference: ${path} ${rootName ?? ''}`);
  return height;
}
