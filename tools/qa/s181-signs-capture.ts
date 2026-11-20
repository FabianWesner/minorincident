import { mkdirSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = 'docs/reports/s181-signs'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ tier: process.argv[2] as 'high' | 'low', backend: 'webgl2', viewport: { width: 1280, height: 720 } });
try {
  await session.open();
  await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  const target = await session.page.evaluate(async level => {
    const a = window.__SS__!; await a.loadLevel(level.startsWith('L9') ? 'L9' : level.startsWith('L10') ? 'L10' : level, { seed: 1 }); a.pause();
    const shape = window as unknown as { __SCENE__: { game: { world: { districts: { districts: Array<{ id: string; origin: [number, number]; layout: { buildings: Array<{ id: string; label: string; aabb: { min: number[]; max: number[] } }> } }> } } } } };
    const g = shape.__SCENE__.game;
    const districtId = level.startsWith('L10') ? 'D-CURE' : level === 'D-MAIN' ? 'D-MAIN' : level.startsWith('L9') ? 'D-CROSSING' : 'D-ZOO', label = level === 'L10' ? 'Research laboratory' : level === 'L10M' ? 'Motor pool' : level === 'L10S' ? 'Security' : level === 'L10W' ? 'Depot warehouse' : level === 'D-MAIN' ? 'Joe’s Diner' : level === 'L9' ? 'Roadside diner' : level === 'L9W' ? 'Roadside workshop' : level === 'L9G' ? 'Abandoned highway stop' : level === 'L9S' ? 'Roadside shop' : 'Primate House';
    const d = g.world.districts.districts.find(row => row.id === districtId)!, b = d.layout.buildings.find(row => row.label.toLowerCase() === label.toLowerCase())!;
    const placement = (gameDistrict => gameDistrict.layout.placements.find(row => row.id === b.id)!)(g.world.districts.districts.find(row => row.id === districtId)! as unknown as { layout: { placements: { id: string; position: [number, number, number] }[] } });
    const special = level === 'L10M' || level === 'L10S' || level === 'L10W';
    const x = (special ? placement.position[0] : (b.aabb.min[0] + b.aabb.max[0]) / 2) + d.origin[0] + (level === 'L10' ? 16.23 : level === 'L10M' ? 4.45 : level === 'L10S' ? 4.69 : level === 'L10W' ? 12.61 : level === 'D-MAIN' ? 2.785 : level === 'L9G' ? 1 : level.startsWith('L9') ? 0 : 5.08), z = (special ? placement.position[2] : (b.aabb.min[2] + b.aabb.max[2]) / 2) + d.origin[1] - (level === 'L9' ? 2.785 : level === 'L9W' ? 1.53 : level === 'L9G' ? -.995 : level === 'L9S' ? 4.25 : level === 'L10S' ? .25 : 0), y = level === 'L10' ? 3.85 : level === 'L10M' ? 4.3 : level === 'L10S' ? 4.38 : level === 'L10W' ? 5.75 : level === 'L9W' || level === 'L9G' ? 3.25 : 3;
    if (level !== 'D-MAIN') a.missions.begin();
    const game = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game;
    if (level === 'D-MAIN' || level.startsWith('L9') || special) a.camera.cinematic({ target: [x, y, z], position: level.startsWith('L9') ? [x - 4, y + 2, z - 9] : [x + 9, y + 2, z - 4] }, true);
    else { a.teleport('player', { x: x + 1, z: z + 1 }); a.camera.follow(); game.view.view.reset(game.world.entities.get(1)!.transform, true); }
    await a.screenshotReady();
    return { districtId, label, x, y, z, signs: a.getState().render.districts?.signs };
  }, process.argv[3] ?? 'L10');
  for (const zoom of [1, 1.5]) {
    await session.page.evaluate(async z => { window.__SS__!.camera.zoom(z); await window.__SS__!.screenshotReady(); }, zoom);
    const file = `${out}/${process.argv[3] === 'L8' ? 'L8-primate-house' : process.argv[3] === 'D-MAIN' ? 'L2-diner' : process.argv[3] === 'L9' ? 'L9-diner' : process.argv[3] === 'L9W' ? 'L9-workshop' : process.argv[3] === 'L9G' ? 'L9-highway-stop' : process.argv[3] === 'L9S' ? 'L9-shop' : process.argv[3]?.startsWith('L10') && process.argv[3] !== 'L10' ? process.argv[3] : 'L10-research-laboratory'}-${process.argv[2]}-z${zoom}.jpg`;
    await session.page.screenshot({ path: file, type: 'jpeg', quality: 92 }); console.log(JSON.stringify({ file, zoom, target }));
  }
} finally { await session.close(); stopServer(); }
