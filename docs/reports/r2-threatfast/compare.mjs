import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function compare(before, after) {
  const differences = [], levels = {}, ignored = [];
  let leaves = 0, floatsWithinNoise = 0, maxAbsoluteDifference = 0;
  const metadata = new Set(['revision', 'mainRevision', 'sourceMatchesMain', 'workers', 'seconds']);
  function walk(a, b, path = '') {
    if (typeof a === 'number' && typeof b === 'number') {
      leaves++;
      const delta = Math.abs(a - b), tolerance = 1e-8 + 1e-12 * Math.max(Math.abs(a), Math.abs(b));
      maxAbsoluteDifference = Math.max(maxAbsoluteDifference, delta);
      if (delta > tolerance) differences.push({ path, before: a, after: b, delta });
      else if (delta) floatsWithinNoise++;
      return;
    }
    if (Array.isArray(a) !== Array.isArray(b)) {
      leaves++;
      differences.push({ path, beforeType: Array.isArray(a) ? 'array' : typeof a, afterType: Array.isArray(b) ? 'array' : typeof b });
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) differences.push({ path, beforeLength: a.length, afterLength: b.length });
      for (let i = 0; i < Math.min(a.length, b.length); i++) walk(a[i], b[i], `${path}[${i}]`);
      return;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const child = path ? `${path}.${key}` : key;
        if ((!path && metadata.has(key)) || (/^levels\[\d+\]$/.test(path) && key === 'wallSeconds')) { ignored.push(child); continue; }
        if (!(key in a) || !(key in b)) differences.push({ path: child, before: a[key], after: b[key] });
        else walk(a[key], b[key], child);
      }
      return;
    }
    leaves++;
    if (a !== b) differences.push({ path, before: a, after: b });
  }
  walk(before, after);
  for (let i = 0; i < before.levels.length; i++) {
    const prefix = `levels[${i}]`;
    levels[before.levels[i].level] = { identical: !differences.some(row => row.path.startsWith(prefix)), beforeFlags: before.levels[i].passiveFlags, afterFlags: after.levels[i]?.passiveFlags };
  }
  return { identical: differences.length === 0, comparedLeaves: leaves, floatsWithinNoise, maxAbsoluteDifference, ignoredMetadata: ignored, levels, differences };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [beforePath, afterPath, outputPath] = process.argv.slice(2);
  const load = path => { const bytes = readFileSync(path); return JSON.parse((path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString()); };
  const before = load(beforePath), after = load(afterPath);
  const result = { before: { path: beforePath, sha256: createHash('sha256').update(readFileSync(beforePath)).digest('hex'), revision: before.revision, seconds: before.seconds }, after: { path: afterPath, sha256: createHash('sha256').update(readFileSync(afterPath)).digest('hex'), revision: after.revision, seconds: after.seconds }, ...compare(before, after) };
  writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ identical: result.identical, comparedLeaves: result.comparedLeaves, differences: result.differences.length }));
  process.exitCode = result.identical ? 0 : 1;
}
