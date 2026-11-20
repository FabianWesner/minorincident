import { mkdirSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';

const out = 'docs/reports/s181-signs'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ tier: process.argv[2] as 'high' | 'low', backend: 'webgl2', viewport: { width: 1280, height: 720 } });
try {
  await session.open();
  await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  const target = await session.page.evaluate(async level => {
    const a = window.__SS__!; await a.loadLevel(level, { seed: 1 }); a.pause();
    const shape = window as unknown as { __SCENE__: { game: { world: { districts: { districts: Array<{ id: string; origin: [number, number]; layout: { buildings: Array<{ label: string; aabb: { min: number[]; max: number[] } }> } }> } } } } };
    const g = shape.__SCENE__.game;
    const districtId = level === 'L10' ? 'D-CURE' : 'D-ZOO', label = level === 'L10' ? 'Research laboratory' : 'Primate House';
    const d = g.world.districts.districts.find(row => row.id === districtId)!, b = d.layout.buildings.find(row => row.label.toLowerCase() === label.toLowerCase())!;
    const x = (b.aabb.min[0] + b.aabb.max[0]) / 2 + d.origin[0] + (level === 'L10' ? 16.23 : 0), z = (level === 'L10' ? (b.aabb.min[2] + b.aabb.max[2]) / 2 : b.aabb.max[2] + .045) + d.origin[1], y = level === 'L10' ? 3.85 : Math.max(1.65, Math.min(3.1, b.aabb.min[1] + (b.aabb.max[1] - b.aabb.min[1]) * .55));
    a.camera.cinematic({ target: [x, y, z], position: [x + 5.5, y + 2.7, z + 9] }, true); await a.screenshotReady();
    return { districtId, label, x, y, z, signs: a.getState().render.districts?.signs };
  }, process.argv[3] ?? 'L10');
  for (const zoom of [1, 1.5]) {
    await session.page.evaluate(async z => { window.__SS__!.camera.zoom(z); await window.__SS__!.screenshotReady(); }, zoom);
    const file = `${out}/${process.argv[3] === 'L8' ? 'L8-primate-house' : 'L10-research-laboratory'}-${process.argv[2]}-z${zoom}.jpg`;
    await session.page.screenshot({ path: file, type: 'jpeg', quality: 92 }); console.log(JSON.stringify({ file, zoom, target }));
  }
} finally { await session.close(); stopServer(); }
