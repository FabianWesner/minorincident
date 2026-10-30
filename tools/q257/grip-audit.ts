import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, stopServer } from '../scenelab/session';
const session = new SceneSession({ tier: 'high', viewport: { width: 900, height: 700 }, query: { skin: '1' } });
const output = resolve('docs/reports/q257/grips'); mkdirSync(output, { recursive: true }); const rows = [];
try {
  await session.open();
  for (const model of ['npc.civilian-man-b', 'npc.civilian-woman-a']) {
    await session.load({ name: 'q257-rendered-grip', ground: 'sidewalk', time: 'L1', dof: false, size: 20, actors: [{ id: 'holder', kind: 'pedestrian', at: [0, 0], look: { model, handProp: 'coffee', accessories: ['none'] }, state: 'idle' }], camera: { mode: 'pose', position: [3, 1.5, 2], target: [0, .85, 0] } });
    await session.page.evaluate(() => window.__SS__!.settings.set({ vfx: false })); await session.step(60);
    for (const lod of ['lod0', 'lod1'] as const) {
      const result = await session.page.evaluate(async ({ model, lod }) => {
        const path = '/node_modules/three/build/three.module.js'; const { Matrix4, Vector3, Triangle } = await import(/* @vite-ignore */ path) as typeof import('three');
        type Batch = { model: string; lod: string; mesh: import('three').InstancedMesh; poses: { pose: (frame: number, outgoing: number, weight: number) => Float32Array }; bakedClip: { parts: string[]; binds: Float32Array } };
        const lab = window.__SCENE__ as unknown as { game: { view: { npcs: { civilians: { visibility: { band: () => string }; batches: Batch[]; loadHero: (model: string) => void }; ready: () => Promise<void> }; labProbes: () => { heldProps: { entity: number; hand: Float32Array; geometry: import('three').BufferGeometry; matrix: import('three').Matrix4 }[] } } } };
        const npc = lab.game.view.npcs, crowd = npc.civilians; crowd.loadHero(model); await npc.ready(); crowd.visibility.band = () => lod;
        await window.__SCENE__!.step(3); await window.__SCENE__!.ready(); await window.__SS__!.screenshotReady();
        const batch = crowd.batches.find(b => b.model === model && b.lod === lod)!; const geometry = batch.mesh.geometry;
        const parts = geometry.getAttribute('_parts'), skin = geometry.getAttribute('_skin'), position = geometry.getAttribute('_gripPosition'), overlay = geometry.getAttribute('_overlay'), variant = geometry.getAttribute('_variant');
        const packedBlend = variant.getW(0), pose = batch.poses.pose(overlay.getW(0), Math.floor(packedBlend / 2), packedBlend % 2), instance = new Matrix4(); batch.mesh.getMatrixAt(0, instance);
        const matrices = batch.bakedClip.parts.map((_, i) => new Matrix4().fromArray(pose, i * 16).multiply(new Matrix4().fromArray(batch.bakedClip.binds, i * 16)).premultiply(instance));
        const handPart = batch.bakedClip.parts.indexOf('handR'), hand: import('three').Vector3[] = [], raw = new Vector3();
        for (let i = 0; i < position.count; i++) if (parts.getX(i) === handPart && parts.getY(i) < 0) {
          const packed = skin.getX(i), w = [0, skin.getY(i), skin.getZ(i), skin.getW(i) % 1]; w[0] = 1 - w[1] - w[2] - w[3]; const joints = [handPart, packed % 32, Math.floor(packed / 32) % 32, Math.floor(packed / 1024)], point = new Vector3();
          for (let k = 0; k < 4; k++) if (w[k]) point.add(raw.fromBufferAttribute(position, i).applyMatrix4(matrices[joints[k]]).multiplyScalar(w[k])); hand.push(point);
        }
        const prop = lab.game.view.labProbes().heldProps[0], p = prop.geometry.getAttribute('position'), index = prop.geometry.index, triangle = new Triangle(), closest = new Vector3(); let gap = Infinity; let nearest: number[][] = [];
        for (const point of hand) for (let t = 0; t < (index?.count ?? p.count); t += 3) {
          triangle.a.fromBufferAttribute(p, index ? index.getX(t) : t).applyMatrix4(prop.matrix); triangle.b.fromBufferAttribute(p, index ? index.getX(t + 1) : t + 1).applyMatrix4(prop.matrix); triangle.c.fromBufferAttribute(p, index ? index.getX(t + 2) : t + 2).applyMatrix4(prop.matrix);
          triangle.closestPointToPoint(point, closest); const distance = point.distanceTo(closest); if (distance < gap) { gap = distance; nearest = [point.toArray(), closest.toArray()]; }
        }
        return { model, lod, gapCm: gap * 100, nearest, handVertices: hand.length };
      }, { model, lod });
      rows.push(result); console.log(result); await session.page.screenshot({ path: resolve(output, `${model}-${lod}.jpg`), type: 'jpeg', quality: 95 });
    }
  }
  writeFileSync(resolve(output, 'rendered-contact.json'), JSON.stringify({ rows, errors: session.errors }, null, 2) + '\n');
} finally { await session.close(); stopServer(); }
