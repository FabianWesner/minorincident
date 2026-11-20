import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer } from './session';

const spec = JSON.parse(readFileSync('specs/scenes/catalog/s183-flame-fight.json', 'utf8')) as SceneSpec;
spec.script = [
  { frame: 0, actor: 'courier', do: { select: 'LEFT' } },
  { frame: 0, actor: 'courier', do: { aim: 'target', seconds: 8 } },
  { frame: 30, actor: 'courier', do: { attack: 'target', seconds: 6, move: [0, 0] } },
];
const session = new SceneSession({ backend: 'webgl2' });
const out = 'test-results/s183-flame-alloc'; mkdirSync(out, { recursive: true });
try {
  await session.open(); await session.load(spec);
  await session.page.evaluate(() => { window.__SS__!.cheats.infiniteCharges(true); window.__SS__!.cheats.god(true); });
  await session.step(100);
  const cdp = await session.page.context().newCDPSession(session.page);
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 512, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  for (let i = 0; i < 60; i++) await session.step(5);
  const profile = await cdp.send('HeapProfiler.stopSampling'); await cdp.detach();
  const state = await session.page.evaluate(() => ({ attacks: window.__SS__!.events(0).filter(e => e.type === 'combat.attack' && e.actionId === 'weapon.flamethrower').length, vfx: window.__SS__!.getState().render.vfx }));
  writeFileSync(`${out}/profile.json`, JSON.stringify({ profile, state, errors: session.errors }));
  if (session.errors.length) throw new Error(session.errors.join('\n'));
  console.log(JSON.stringify({ attacks: state.attacks, jet: !!state.vfx!.blasts.flameJet, errors: session.errors }));
} finally { await session.close(); stopServer(); }
