import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Object3D } from 'three';
import type { Game } from '../../src/Game';
import type { PawContacts } from '../../src/render/characters/PawContacts';
import { readSpec, SceneSession, stopServer, writeJson } from './session';

/** Same pet trot, with a close tracking camera for readable before/after paw captures. */
const out = process.argv[2], baseline = process.argv[3] === 'baseline';
if (!out) throw new Error('Pass an output directory and optionally baseline');
const oldFile = resolve('.cache/polish-26-paws-before.ts');
if (baseline) {
  mkdirSync('.cache', { recursive: true });
  const source = execFileSync('git', ['show', 'e8be46ebd:src/render/characters/PawContacts.ts'], { encoding: 'utf8' });
  writeFileSync(oldFile, source.replace("'./footSoles'", "'../src/render/characters/footSoles'"));
}
const session = new SceneSession({ backend: 'webgl2', tier: 'low' });
try {
  await session.open();
  await session.load({ ...readSpec('specs/scenes/catalog/dog-pet-trot.json'), trace: true,
    camera: { mode: 'close', target: 'dog-run', radius: 5, azimuth: 45 } });
  if (baseline) await session.page.evaluate(async url => {
    const { PawContacts: Before } = await import(/* @vite-ignore */ url) as { PawContacts: new(root: Object3D) => PawContacts };
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    const npcs = g.view.labProbes().npcs as unknown as { heroes: Map<number, { root: Object3D; animator: { contacts: PawContacts } }> };
    for (const id of [3, 4]) {
      const hero = npcs.heroes.get(id)!; hero.animator.contacts.restore(); hero.animator.contacts = new Before(hero.root);
    }
  }, `/@fs${oldFile}`);
  const cells = [];
  for (let frame = 0; frame <= 150; frame++) {
    if ([60, 78, 90, 120, 150].includes(frame)) await session.screenshot(`${out}/frame-${frame}.png`);
    if (frame % 15 === 0) cells.push({ frame, jpeg: await session.snapshot() });
    if (frame < 150) await session.step(1);
  }
  await session.makeSheet(cells, `${out}/sheet.jpg`);
  const metrics = await session.page.evaluate(() => window.__SCENE__!.metrics());
  writeJson(`${out}/metrics.json`, { baseline, metrics, consoleErrors: session.errors });
  console.log(JSON.stringify({ baseline, consoleErrors: session.errors }));
} finally { await session.close(); stopServer(); }
