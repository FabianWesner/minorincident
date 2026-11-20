import { mkdirSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = 'docs/reports/s181-signs'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ tier: process.argv[2] as 'high' | 'low', backend: 'webgl2', viewport: { width: 1280, height: 720 } });
try {
  await session.open();
  await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  const target = await session.page.evaluate(async level => {
    const a = window.__SS__!; await a.loadLevel(level === 'L9W' ? 'L9' : level, { seed: 1 }); a.pause();
    const shape = window as unknown as { __SCENE__: { game: { world: { districts: { districts: Array<{ id: string; origin: [number, number]; layout: { buildings: Array<{ label: string; aabb: { min: number[]; max: number[] } }> } }> } } } } };
    const g = shape.__SCENE__.game;
    const districtId = level === 'L10' ? 'D-CURE' : level === 'D-MAIN' ? 'D-MAIN' : level.startsWith('L9') ? 'D-CROSSING' : 'D-ZOO', label = level === 'L10' ? 'Research laboratory' : level === 'D-MAIN' ? 'Joe’s Diner' : level === 'L9' ? 'Roadside diner' : level === 'L9W' ? 'Roadside workshop' : 'Primate House';
    const d = g.world.districts.districts.find(row => row.id === districtId)!, b = d.layout.buildings.find(row => row.label.toLowerCase() === label.toLowerCase())!;
    const x = (b.aabb.min[0] + b.aabb.max[0]) / 2 + d.origin[0] + (level === 'L10' ? 16.23 : level === 'D-MAIN' ? 2.785 : level.startsWith('L9') ? 0 : 5.08), z = (b.aabb.min[2] + b.aabb.max[2]) / 2 + d.origin[1] - (level === 'L9' ? 2.785 : level === 'L9W' ? 1.53 : 0), y = level === 'L10' ? 3.85 : level === 'L9W' ? 3.25 : 3;
    if (level !== 'D-MAIN') a.missions.begin();
    const game = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game;
    if (level === 'D-MAIN' || level.startsWith('L9')) a.camera.cinematic({ target: [x, y, z], position: level.startsWith('L9') ? [x - 4, y + 2, z - 9] : [x + 9, y + 2, z - 4] }, true);
    else { a.teleport('player', { x: x + 1, z: z + 1 }); a.camera.follow(); game.view.view.reset(game.world.entities.get(1)!.transform, true); }
    await a.screenshotReady();
    return { districtId, label, x, y, z, signs: a.getState().render.districts?.signs };
  }, process.argv[3] ?? 'L10');
  for (const zoom of [1, 1.5]) {
    await session.page.evaluate(async z => { window.__SS__!.camera.zoom(z); await window.__SS__!.screenshotReady(); }, zoom);
    const file = `${out}/${process.argv[3] === 'L8' ? 'L8-primate-house' : process.argv[3] === 'D-MAIN' ? 'L2-diner' : process.argv[3] === 'L9' ? 'L9-diner' : process.argv[3] === 'L9W' ? 'L9-workshop' : 'L10-research-laboratory'}-${process.argv[2]}-z${zoom}.jpg`;
    await session.page.screenshot({ path: file, type: 'jpeg', quality: 92 }); console.log(JSON.stringify({ file, zoom, target }));
  }
} finally { await session.close(); stopServer(); }
