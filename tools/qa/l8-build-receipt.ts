/** Record the static QA bundle immediately after build:qa on committed source. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { provenance } from './accept/probe';
const out = process.argv[2] ?? 'docs/reports/p1-l8rework/browser-build.json';
const dirty = execFileSync('git', ['diff', '--name-only', '--', 'src', 'layouts', 'public/assets/layouts'], { encoding: 'utf8' }).trim();
if (dirty) throw Error('Commit application source before recording its built receipt');
const artifactSha256 = Object.fromEntries(readdirSync('dist/build').filter(name => name.endsWith('.js')).sort().map(name => {
  const file = `dist/build/${name}`; return [file, createHash('sha256').update(readFileSync(file)).digest('hex')];
}));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ ...provenance(), artifactSha256, method: 'Recorded immediately after build:qa; both browser tiers serve these unchanged static files.' }, null, 2) + '\n');
console.log(JSON.stringify({ out, assets: Object.keys(artifactSha256).length }));
