import { readFileSync } from 'node:fs';
const file = process.argv[2] ?? `${process.env.TMPDIR ?? '/tmp'}/mi-waits.jsonl`;
let rows;
try { rows = readFileSync(file, 'utf8').split(/\n/).filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { console.error('Skipped an incomplete wait record'); return []; } }); }
catch { console.error(`No wait log found: ${file}`); process.exit(1); }
const groups = new Map();
for (const row of rows) {
  const at = row.at ?? row.ts;
  if (!at || !Number.isFinite(row.waitMs)) continue;
  const hour = new Date(at).toISOString().slice(0, 13), key = `${hour}\t${row.lane}\t${row.kind ?? row.lock}`;
  const values = groups.get(key) ?? []; values.push(row.waitMs); groups.set(key, values);
}
console.log('hour (UTC)\tlane\tresource\tcount\tmean ms\tp95 ms\tmax ms');
for (const [key, values] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  values.sort((a, b) => a - b); const mean = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  console.log(`${key}\t${values.length}\t${mean}\t${values[Math.ceil(values.length * .95) - 1]}\t${values.at(-1)}`);
}
