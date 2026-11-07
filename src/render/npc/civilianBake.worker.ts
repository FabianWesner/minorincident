import type { PreparedCivilian } from './prepareCivilianGeometry';
import type { DeathPoseRepair } from '../characters/deathPose';
import type { Group } from 'three/webgpu';
import { decompressCivilianBake } from '../../assets/bakeCompression';
import files from '../../assets/civilianBakes.json';

// Fetch the CPU modules alongside the delivered buffers, once per worker.
const bakeData = import('../../assets/civilianBakeData');
const deathPoses = import('../characters/deathPose');

/** Death-pose floor searches belong beside the worker bake, before ownership transfers. */
async function repairDeath(baked: PreparedCivilian, model: string): Promise<DeathPoseRepair | undefined> {
  const { repairDeathPoses, deathReach } = await deathPoses;
  const prone = /^inf\.(mega-)?alpha/.test(model);
  if (!repairDeathPoses(baked.clip, baked.geometry, { prone })) return;
  return { prone, reach: deathReach.get(baked.clip)! };
}

const worker = globalThis as unknown as { onmessage: (event: MessageEvent<{ model: string; lod: 'lod0' | 'lod1' | 'lod2'; cpuRate: number; source?: boolean; infected?: boolean }>) => void; postMessage(value: unknown, transfer?: Transferable[]): void };
worker.onmessage = async ({ data }) => {
  const start = performance.now(); let downloads = 0;
  let root: Group | undefined, dispose: ((root: Group) => void) | undefined;
  try {
    const path = (files as Record<string, string>)[`${data.model}:${data.lod}${data.infected ? ':infected' : ''}`];
    if (!data.source && path && typeof DecompressionStream !== 'undefined') {
      try {
        const before = performance.now();
        const response = await fetch(path);
        if (!response.ok) throw Error('Unavailable civilian bake');
        const compressed = await response.arrayBuffer(); downloads += performance.now() - before;
        const inflateStart = performance.now(); performance.measure('civilian:download', { start: before, end: inflateStart });
        const bytes = await decompressCivilianBake(compressed);
        performance.measure('civilian:inflate', { start: inflateStart, end: performance.now() });
        const { decodeCivilianBake } = await bakeData;
        const baked = decodeCivilianBake(bytes), deathPose = await repairDeath(baked, data.model);
        baked.geometry.dispose();
        if (data.cpuRate > 1) await new Promise(resolve => setTimeout(resolve, (performance.now() - start - downloads) * (data.cpuRate - 1)));
        worker.postMessage({ bytes, prebuilt: true, deathPose }, [bytes]); return;
      } catch { /* Missing build output uses the same runtime preparation below. */ }
    }
    if (data.infected) { worker.postMessage({}); return; }
    // The animation library is needed only by the source fallback. Shipped bakes
    // repair their delivered pose rows without loading the authored clips.
    const [{ loadCivilianSource, disposeCivilianSource }, { prepareCivilianGeometry, prepareCivilianRig }, { encodeCivilianBake }] = await Promise.all([import('../../assets/civilianSource'), import('./prepareCivilianGeometry'), import('../../assets/civilianBakeData')]);
    dispose = disposeCivilianSource;
    root = await loadCivilianSource(data.model, data.lod, async url => {
      const before = performance.now();
      try { const response = await fetch(url); if (!response.ok) throw Error(`Civilian source ${response.status}`); return await response.arrayBuffer(); }
      finally { downloads += performance.now() - before; }
    });
    prepareCivilianRig(root, data.model);
    const baked = await prepareCivilianGeometry(root, data.model); baked.rig = root;
    const deathPose = await repairDeath(baked, data.model);
    const bytes = encodeCivilianBake(baked); baked.geometry.dispose();
    if (data.cpuRate > 1) await new Promise(resolve => setTimeout(resolve, (performance.now() - start - downloads) * (data.cpuRate - 1)));
    worker.postMessage({ bytes: bytes.buffer, deathPose }, [bytes.buffer]);
  } catch { worker.postMessage({}); }
  finally { if (root) dispose?.(root); }
};
