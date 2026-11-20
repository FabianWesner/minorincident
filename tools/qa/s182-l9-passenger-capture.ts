import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { Object3D } from 'three';

const out = 'test-results/s182-l9-passenger'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high' });
try {
  await session.open();
  await session.page.addStyleTag({ content: 'html:not([data-scene-hud]) .mission-subtitle { visibility: visible !important; }' });
  const setup = await session.page.evaluate(async () => {
    const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
    await api.loadLevel('L9', { seed: 1, progression: 'L9-default' }); api.pause(); api.missions.begin(); api.cheats.god(true); api.camera.zoom(1.5);
    await api.step(1); await api.screenshotReady();
    const m = game.world.missions!, driver = m.l9!.driving.state;
    return { subtitle: m.state.subtitle?.id, samId: driver.samId, sam: game.world.entities.get(driver.samId)?.transform };
  });
  if (setup.subtitle !== 'L9.briefing' || !setup.samId) throw new Error(`Unexpected setup ${JSON.stringify(setup)}`);
  const frames: { frame: number; jpeg: Buffer }[] = [], speakers: { visible: boolean; projection: number[]; hand?: number[] }[] = [];
  for (let i = 0; i < 5; i++) {
    await session.page.evaluate(() => window.__SS__!.step(60));
    frames.push({ frame: i, jpeg: await session.snapshot() });
    writeFileSync(`${out}/frame-${i}.jpg`, frames[i].jpeg);
    speakers.push(await session.page.evaluate(id => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const vehicles = game.view.labProbes().vehicles as unknown as { occupants: Map<number, { visible: boolean; model: Object3D }> };
      const occupant = vehicles.occupants.get(id), head = occupant?.model.getObjectByName('head');
      if (!head || !occupant) throw new Error('Sam has no rendered head');
      const p = head.getWorldPosition(head.position.clone());
      const hand = occupant.model.getObjectByName('handR');
      return { visible: occupant.visible, world: p.toArray(), projection: game.view.project(p.x, p.y, p.z), hand: hand?.getWorldPosition(hand.position.clone()).toArray() };
    }, setup.samId));
  }
  await session.makeSheet(frames, `${out}/sheet.jpg`, 420, 240);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ setup, speakers, errors: session.errors }, null, 2));
  if (speakers.some(s => !s.visible || Math.abs(s.projection[0]) > 1 || Math.abs(s.projection[1]) > 1)) throw new Error('Sam left the frame');
  const firstHand = speakers[0].hand;
  if (!firstHand || !speakers.some(s => s.hand && Math.hypot(...s.hand.map((v, i) => v - firstHand[i])) > .02)) throw new Error('Sam did not gesture');
  if (session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
