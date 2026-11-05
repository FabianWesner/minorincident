// Build a Git revision against identical installed dependencies without copying a repository.
// Unchanged public assets are borrowed; changed public files come from the selected Git tree.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { build } from 'vite';

const [revision, output] = process.argv.slice(2);
assert(revision && output, 'Usage: node tools/perf/build-revision.mjs <revision> <test-results/output>');
const root = resolve('.'), outDir = resolve(output);
assert(outDir.startsWith(resolve('test-results') + '/'), 'Revision builds belong under test-results/');
const git = (...args) => execFileSync('git', args, { maxBuffer: 128 * 1024 * 1024 });
const commit = git('rev-parse', '--verify', revision).toString().trim();
for (const path of ['package-lock.json', 'index.html', 'vite.config.ts', 'tools/build/load-plugins.ts']) {
  assert(readFileSync(path).equals(git('show', `${commit}:${path}`)), `${path} differs: this helper needs a matching dependency/build contract`);
}
const files = new Set(git('ls-tree', '-r', '--name-only', commit, 'src').toString().trim().split('\n').filter(path => /\.(ts|js|json|css)$/.test(path)));
for (const path of git('diff', '--name-only', commit, '--', 'src').toString().trim().split('\n').filter(Boolean)) {
  assert(/\.(ts|js|json|css)$/.test(path) && !path.includes('.worker.'), `Unsupported changed source asset/worker: ${path}`);
}
const sources = {};
const revisionSource = () => ({ name: 'revision-source', enforce: 'pre', load(id) {
    if (/[?&](url|raw|worker|sharedworker)(?:&|$)/.test(id)) return null;
    const path = relative(root, id.split('?')[0]);
    if (!files.has(path)) return null;
    const code = git('show', `${commit}:${path}`);
    sources[path] = createHash('sha256').update(code).digest('hex');
    return code.toString();
  } });
await build({ configLoader: 'runner', define: { __BUILD_COMMIT__: JSON.stringify(commit.slice(0, 9)) },
  plugins: [revisionSource()], worker: { plugins: () => [revisionSource()] },
  build: { outDir, copyPublicDir: false, emptyOutDir: true } });
const changes = git('diff', '--name-only', commit, '--', 'public').toString().trim().split('\n').filter(Boolean);
const overlays = {};
function borrow(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`, target = resolve(outDir, relative('public', path));
    if (changes.includes(path)) {
      if (!git('ls-tree', commit, '--', path).length) continue;
      const bytes = git('show', `${commit}:${path}`); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes);
      overlays[path] = createHash('sha256').update(bytes).digest('hex');
    } else if (changes.some(changed => changed.startsWith(path + '/'))) { mkdirSync(target, { recursive: true }); borrow(path); }
    else if (!existsSync(target)) { mkdirSync(dirname(target), { recursive: true }); symlinkSync(resolve(path), target, entry.isDirectory() ? 'dir' : 'file'); }
  }
}
borrow('public');
// Content-addressed bakes can disappear from the current tree after a rebuild.
// Restore the revision's deleted public files as well as overlaying changed ones.
for (const path of git('diff', '--name-only', '--diff-filter=D', commit, '--', 'public').toString().trim().split('\n').filter(Boolean)) {
  const bytes = git('show', `${commit}:${path}`), target = resolve(outDir, relative('public', path));
  mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes);
  overlays[path] = createHash('sha256').update(bytes).digest('hex');
}
writeFileSync(`${outDir}/revision-build.json`, JSON.stringify({ commit, dependencySha256: createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),
  sources, publicOverlays: overlays, publicPolicy: 'Unchanged tracked public files are symlinks to the current checkout.' }, null, 2) + '\n');
console.log(`Built ${commit} in ${outDir}; ${Object.keys(sources).length} source files from Git, ${Object.keys(overlays).length} public overlays.`);
