import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { expect, test } from 'vitest';

test('T-E01-01b @E01 @E01-AC01 typecheck, lint and build exit zero without warnings', () => {
  mkdirSync('test-results/epics/E01/logs', { recursive: true });
  for (const command of ['typecheck', 'lint', 'build']) {
    const result = spawnSync('npm', ['run', command], { encoding: 'utf8' });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    writeFileSync(`test-results/epics/E01/logs/${command}.txt`, output);
    expect(result.status, output).toBe(0);
    expect(output).not.toMatch(/\bwarning\b|\bWARN\b|npm warn/i);
  }
  expect(readdirSync('dist', { recursive: true }).filter((path) => String(path).endsWith('.html')).sort()).toEqual(['index.html', 'perf-device.html', 'preview/index.html']);
  // API remains an opt-in chunk, outside the default entry and eager dependency graph.
  const html = readFileSync('dist/index.html', 'utf8');
  // Hashed bundles live under /build/ (immutable CDN caching, see public/_headers).
  const eagerScripts = [...html.matchAll(/(?:src|href)="(\/build\/[^\"]+\.js)"/g)].map((match) => match[1]);
  expect(eagerScripts.length).toBeGreaterThan(0);
  for (const path of eagerScripts) {
    expect(basename(path)).not.toMatch(/testApi|Debug/);
    expect(readFileSync(`dist${path}`, 'utf8')).not.toContain('__SS__');
  }
}, 180_000); // Includes three builds/checks on the shared development Mac.
