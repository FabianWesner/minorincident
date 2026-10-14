import { performance } from 'node:perf_hooks';
import { MeshLambertNodeMaterial, Scene } from 'three/webgpu';
import { Lighting } from '../../src/render/Lighting';
import { Materials } from '../../src/render/Materials';

const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
const material = materials.get('sidewalk'), reference = MeshLambertNodeMaterial.prototype.customProgramCacheKey;
const measure = (fn: () => string) => {
  for (let i = 0; i < 2000; i++) fn();
  const start = performance.now();
  for (let i = 0; i < 100_000; i++) fn();
  return performance.now() - start;
};
try {
  const rounds = [];
  for (let i = 0; i < 5; i++) {
    const originalMs = measure(() => reference.call(material));
    const optimizedMs = measure(() => material.customProgramCacheKey());
    rounds.push({ originalMs, optimizedMs });
  }
  console.log(JSON.stringify({ calls: 100_000, rounds }));
} finally { materials.dispose(); lighting.dispose(); }
