/* eslint-disable @typescript-eslint/no-explicit-any -- QA tool inspects untyped save JSON */
// Diagnose why a stored save fails validateSave. Usage: npx tsx tools/qa/r28-diag-save.ts <file.json.gz|json>
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeSave, migrate, validateSave } from '../../src/sim/progression/Save';
import { validCureCheckpoint } from '../../src/sim/progression/cureSave';
import { cureCheckpoints, levelTenMission } from '../../src/levels/L10/mission';
import { gunzipSync as gunzipSync2, strFromU8, strToU8 } from 'three/addons/libs/fflate.module.js';
const f = process.argv[2];
const b = readFileSync(f);
const text = f.endsWith('.gz') ? gunzipSync(b).toString() : b.toString();
const r = decodeSave(text);
console.log(f, r.status);
if (r.status === 'ok') process.exit(0);
let raw: any;
let plain = text;
// Same unwrapping as decodeSave (gzip1 / checkpoint1 records), so the failing clause can be located.
if (plain.startsWith('minor-incident.gzip1:')) plain = strFromU8(gunzipSync2(strToU8(plain.slice(21), true)));
if (plain.startsWith('minor-incident.checkpoint1:')) {
  const [campaign, view, current] = JSON.parse(plain.slice(27));
  raw = { ...campaign, cureResume: { ...view, current, checkpoint: structuredClone(current) } };
} else raw = JSON.parse(plain);
const m: any = migrate(raw);
console.log('version', m.version, 'unlocked', m.unlockedLevel, 'completed', m.completedLevels, 'keys', Object.keys(m));
console.log('validateSave', validateSave(m));
for (const n of ['current', 'checkpoint']) {
  const c = m.cureResume?.[n];
  if (!c) continue;
  console.log(n, 'valid', validCureCheckpoint(c), 'phase', c.state?.phase, 'checkpoint', c.state?.checkpoint);
  const def = levelTenMission(() => ({ x: 0, z: 0, radius: 2 }));
  console.log(' ckpt known', cureCheckpoints.includes(c.state.checkpoint));
  console.log(' missing states', def.states.filter((k: string) => typeof c.state.states[k] !== 'boolean'));
  console.log(' bad counters', def.counters.filter((k: string) => !Number.isSafeInteger(c.state.counters[k])));
  console.log(' bad steps', def.steps.filter((s: any) => !c.state.steps[s.id]).map((s: any) => s.id));
  console.log(' bad items', c.state.items.filter((i: string) => !def.items.includes(i)));
  console.log(' bad objectives', c.state.completedObjectives.filter((i: string) => !def.steps.some((s: any) => s.id === i)));
  console.log(' arsenal', JSON.stringify(c.arsenal), 'entities', c.entities.length);
}
