import type { Page } from '@playwright/test';
import { PNG } from 'pngjs';

const luminance = (r: number, g: number, b: number) => {
  const c = [r, g, b].map(v => v / 255 <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
};
/** Measure the actual companion silhouette against a 1.5 m ground ring, outside the courier's fill. */
export async function companionReadability(page: Page) {
  const setup = await page.evaluate(async () => {
    const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
    const dog = [...game.world.entities.iterate()].find(e => e.companion)!;
    if (!dog) throw new Error('No companion in readability fixture');
    const p = dog.transform, ground = game.world.districts?.groundHeight(p.x, p.z) ?? 0;
    await a.screenshotReady();
    return { id: dog.id, at: { x: p.x, y: p.y, z: p.z }, ring: Array.from({ length: 16 }, (_, i) => a.camera.project(p.x + 1.5 * Math.cos(i * Math.PI / 8), ground + .03, p.z + 1.5 * Math.sin(i * Math.PI / 8))) };
  });
  const image = PNG.sync.read(await page.locator('canvas').first().screenshot());
  // Render a depth-tested mask with the existing ID materials, bypassing grade/bloom exactly as the courier mask does.
  const maskData = await page.evaluate(id => {
    const view = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game.view;
    const v = view as unknown as { npcs: import('../../src/render/npc/NpcView').NpcView; idPlayer: import('three/webgpu').Material; idBackground: import('three/webgpu').Material };
    const root = v.npcs.heroRoot(id)!;
    const saved = new Map<import('three/webgpu').Mesh, import('three/webgpu').Material | import('three/webgpu').Material[]>();
    const background = view.scene.background, backgroundNode = view.scene.backgroundNode, shadow = view.renderer.shadowMap.enabled, depthTest = v.idPlayer.depthTest;
    v.idPlayer.depthTest = true;
    view.scene.background = null; view.scene.backgroundNode = null; view.renderer.shadowMap.enabled = false;
    view.scene.traverse(node => {
      const mesh = node as import('three/webgpu').Mesh;
      if (!mesh.isMesh) return;
      saved.set(mesh, mesh.material);
      let dog = false;
      for (let p: import('three/webgpu').Object3D | null = mesh; p; p = p.parent) if (p === root) dog = true;
      mesh.material = dog ? v.idPlayer : v.idBackground;
    });
    view.renderer.render(view.scene, view.camera);
    const data = view.renderer.domElement.toDataURL('image/png').split(',')[1];
    for (const [mesh, material] of saved) mesh.material = material;
    view.scene.background = background; view.scene.backgroundNode = backgroundNode; view.renderer.shadowMap.enabled = shadow; v.idPlayer.depthTest = depthTest;
    return data;
  }, setup.id);
  const mask = PNG.sync.read(Buffer.from(maskData, 'base64'));
  await page.evaluate(() => window.__SS__!.screenshotReady());
  let sum = 0, pixels = 0;
  for (let i = 0; i < mask.data.length; i += 4) if (mask.data[i] > 240 && mask.data[i + 1] < 20 && mask.data[i + 2] > 240) { sum += luminance(image.data[i], image.data[i + 1], image.data[i + 2]); pixels++; }
  const ring = setup.ring.filter(p => Math.abs(p[0]) < .99 && Math.abs(p[1]) < .99).map(p => {
    const x = Math.round((p[0] + 1) * image.width / 2), y = Math.round((1 - p[1]) * image.height / 2);
    if (x < 0 || x >= image.width || y < 0 || y >= image.height) throw new Error('Companion ring outside viewport');
    const i = (y * image.width + x) * 4;
    return luminance(image.data[i], image.data[i + 1], image.data[i + 2]);
  });
  if (ring.length < 8) throw new Error('Fewer than eight visible companion background samples');
  const subject = sum / pixels, background = ring.reduce((a, b) => a + b, 0) / ring.length;
  return { pixels, backgroundSamples: ring.length, subject, background, contrast: (subject + .05) / (background + .05), setup };
}
