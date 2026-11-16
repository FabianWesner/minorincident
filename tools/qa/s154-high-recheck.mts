import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runSession, type SessionOptions } from '../playtest/session';

// Boot the unrelated L1 title backdrop at LOW. The unchanged driver next
// selects HIGH through title settings, then verifies HIGH on level entry.
// Only the first configuration read (the initial URL) receives LOW.
const level = process.argv[2] ?? 'L4';
if (level !== 'L4' && level !== 'L6') throw new Error('Expected L4 or L6');
const out = resolve(`test-results/s154-lowexits/gpu-high-${level.toLowerCase()}-menu`);
mkdirSync(out, { recursive: true });
let qualityReads = 0;
const options: SessionOptions = {
  origin: 'http://127.0.0.1:5045', out, levels: [level],
  get quality() { return qualityReads++ === 0 ? 'low' : 'high'; },
  zoom: 1.5, heroine: 'female', profile: `${out}/profile`,
  levelMinutes: 9, noSkip: true, entry: 'debug',
  stopAfterLevel: false, tag: 'high-menu',
};
const result = await runSession(options);
writeFileSync(`${out}/summary.json`, JSON.stringify({ bootQuality: 'low', gameplayQuality: 'high', ...result }, null, 2));
if (!result.runs.some(r => r.level === level && r.finished && !r.skipped.length)) process.exitCode = 1;
