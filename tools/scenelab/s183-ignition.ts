import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer } from './session';

const spec = JSON.parse(readFileSync('specs/scenes/catalog/s183-flame-fight.json', 'utf8')) as SceneSpec;
const session = new SceneSession({ backend: 'webgl2', viewport: { width: 1280, height: 720 } });
const out = 'test-results/s183-flame-ignition'; mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  await session.open(); await session.load(spec); await session.step(29);
  for (let frame = 30; frame <= 55; frame++) {
    await session.step(1); await session.screenshot(`${out}/${frame}.png`);
    const state = await session.page.evaluate(() => ({ attacks: window.__SS__!.events(0).filter(e => e.type === 'combat.attack' && e.actionId === 'weapon.flamethrower').length, vfx: window.__SS__!.getState().render.vfx }));
    rows.push({ frame, ...state });
  }
  writeFileSync(`${out}/evidence.json`, JSON.stringify({ rows, errors: session.errors }, null, 2));
  if (session.errors.length) throw new Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
