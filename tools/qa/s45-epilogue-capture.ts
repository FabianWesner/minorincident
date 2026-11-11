/** Capture the L10 epilogue fixture at both framing scales and quality/backend combinations. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
const backend = process.env.S45_BACKEND as 'webgl2' | 'webgpu';
const tier = process.env.S45_TIER as 'low' | 'high';
const zoom = Number(process.env.S45_ZOOM ?? 1);
const label = process.env.S45_LABEL ?? 'after';
const out = `test-results/s45-epilogue/${label}/${backend}-${tier}-z${zoom}`;
mkdirSync(out, { recursive: true });
const spec = readSpec('tests/scenes/catalog/qa-l10-epilogue.json');
spec.actors!.push({ id: 'corgi', kind: 'corgi', at: [4003, -9] });
spec.camera = { mode: 'game', target: 'courier', zoom };
const session = new SceneSession({ backend, tier, query: { loadProfile: '2' } });
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  await session.load(spec); await session.ready();
  await session.step(1080); await session.screenshot(`${out}/closing.png`);
  await session.step(720); await session.screenshot(`${out}/pullout-mid.png`);
  await session.step(360); await session.screenshot(`${out}/pullout-end.png`);

  writeFileSync(`${out}/receipt.json`, JSON.stringify({ backend, tier, zoom, errors: session.errors }, null, 2));
  if (session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
