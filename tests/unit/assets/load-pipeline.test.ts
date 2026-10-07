import { afterEach, expect, test, vi } from 'vitest';
import { LoadGate } from '../../../src/assets/loadGate';
import { assetUrl } from '../../../src/assets/assetUrl';
import { assetVersions, versionedDirs } from '../../../tools/build/load-plugins';
import { parseHeaders } from '../../../tools/performance/cdn-server';
import { readFileSync } from 'node:fs';

afterEach(() => { vi.unstubAllGlobals(); });

test('@load open gate passes immediately; paced gate releases one heavy step per frame', async () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal('setTimeout', (callback: () => void) => { callback(); return 0; });
  const gate = new LoadGate(), released: number[] = [];
  await gate.wait();
  gate.setPaced(true);
  for (const i of [1, 2, 3]) void gate.wait().then(() => released.push(i));
  expect(gate.pending).toBe(3); expect(frames).toHaveLength(1);
  frames.shift()!(0); await Promise.resolve(); expect(released).toEqual([1]);
  frames.shift()!(0); await Promise.resolve(); expect(released).toEqual([1, 2]);
  gate.setPaced(false); await Promise.resolve(); expect(released).toEqual([1, 2, 3]);
});

test('@load asset URLs carry content versions only when the build provides them', () => {
  expect(assetUrl('/assets/models/bld.house-a.glb')).toBe('/assets/models/bld.house-a.glb');
  expect(assetUrl('/assets/models/x.glb?v=1')).toBe('/assets/models/x.glb?v=1');
  const versions = assetVersions();
  expect(Object.keys(versions).some(path => path.startsWith('/assets/layouts/') && path.endsWith('.glb'))).toBe(true);
  for (const path of Object.keys(versions)) expect(versionedDirs.some(dir => path.startsWith(`/assets/${dir}/`))).toBe(true);
  expect(Object.values(versions).every(hash => /^[0-9a-f]{10}$/.test(hash))).toBe(true);
});

test('@load caching headers: immutable hashed bundles, long-lived versioned asset directories only', () => {
  const rules = parseHeaders(readFileSync('public/_headers', 'utf8'));
  const cache = (path: string) => rules.filter(rule => rule.pattern.test(path)).flatMap(rule => rule.headers).filter(([name]) => name === 'cache-control').map(([, value]) => value);
  expect(cache('/build/index-abc123.js')).toEqual(['public, max-age=31536000, immutable']);
  for (const dir of versionedDirs) expect(cache(`/assets/${dir}/file.glb`)[0]).toMatch(/max-age=86400/);
  // Unversioned paths (index.html, UI images) keep revalidation.
  for (const path of ['/', '/index.html', '/assets/ui/portrait-corgi.png']) expect(cache(path)).toEqual([]);
});
