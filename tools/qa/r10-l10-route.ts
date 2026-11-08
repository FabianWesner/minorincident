/** Physical tools/playtest run from a versioned L10 checkpoint, against a pinned QA build.
 * Shared browser pool via runSession -> launchProfile (one migrated context).
 * E2E_PORT=3897 sh tools/e2e-lock.sh node --import tsx tools/qa/r10-l10-route.ts after low 1 corridor label 360
 * PLAYTEST_NO_FRAME_TIMING=0 enables ordinary render-frame timings for quiet A/B runs. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { preview } from 'vite';
import { decodeSave, SAVE_KEY } from '../../src/sim/progression/Save';
import { runSession } from '../playtest/session';

const [side, tier, zoom, checkpoint, label, seconds = '360'] = process.argv.slice(2);
if (!['before', 'after'].includes(side) || !['low', 'high'].includes(tier) || !['1', '1.5'].includes(zoom) || !['military', 'corridor'].includes(checkpoint) || !label) throw new Error('side tier zoom checkpoint label seconds');
const out = resolve(`test-results/r10-l10/${label}`), profile = `${out}/profile`;
mkdirSync(profile, { recursive: true });
const port = Number(process.env.E2E_PORT ?? 3897);
if (port === 3300) throw new Error('Private QA port required');
const dist = resolve(`test-results/r10-l10/${side === 'after' ? 'final' : 'before'}-dist`), origin = `http://127.0.0.1:${port}`;
const path = `docs/reports/sweep-c5/L10-05/seeds/L10-05-${tier}-cure-${checkpoint}-save.json.gz`;
const bytes = execFileSync('git', ['show', `HEAD:${path}`]);
const decoded = decodeSave(gunzipSync(bytes).toString());
if (decoded.status !== 'ok') throw new Error('Invalid checkpoint seed');
decoded.save.settings.quality = tier as 'low' | 'high';
writeFileSync(`${profile}/pool-storage.json`, JSON.stringify({ cookies: [], origins: [{ origin, localStorage: [{ name: SAVE_KEY, value: JSON.stringify(decoded.save) }] }] }));
writeFileSync(`${out}/source.json`, JSON.stringify({ side, tier, zoom, checkpoint, dist, indexSha256: createHash('sha256').update(readFileSync(`${dist}/index.html`)).digest('hex'), checkpointSha256: createHash('sha256').update(bytes).digest('hex'), physicalInput: true }, null, 2));
Object.assign(process.env, { PLAYTEST_BACKEND: 'webgl2', PLAYTEST_GOD: '1', PLAYTEST_ROUTE_TRACE: '1', PLAYTEST_NO_FRAME_TIMING: process.env.PLAYTEST_NO_FRAME_TIMING ?? '1', PLAYTEST_ACCEPTANCE_CAPTURES: '0', PLAYTEST_SHOT_SECONDS: process.env.PLAYTEST_SHOT_SECONDS ?? '20' });
const server = await preview({ configFile: false, build: { outDir: dist }, preview: { host: '127.0.0.1', port, strictPort: true } });
try {
  const result = await runSession({ origin, out, profile, levels: ['L10'], quality: tier as 'low' | 'high', zoom: Number(zoom), heroine: 'female',
    entry: 'continue', noSkip: true, levelMinutes: 12, sampleSeconds: Number(seconds), saveOnYield: true, stopAfterLevel: true, tag: label });
  writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2));
} finally { await server.close(); }
