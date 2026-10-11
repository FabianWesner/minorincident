import type { Group } from 'three/webgpu';
import { loadCivilianSource, disposeCivilianSource } from '../../assets/civilianSource';
import { encodeCivilianBake } from '../../assets/civilianBakeData';
import { prepareCivilianGeometry, prepareCivilianRig } from './prepareCivilianGeometry';

const worker = globalThis as unknown as { onmessage: (event: MessageEvent<{ model: string; lod: 'lod0' | 'lod1' | 'lod2'; cpuRate: number }>) => void; postMessage(value: unknown, transfer?: Transferable[]): void };
worker.onmessage = async ({ data }) => {
  const start = performance.now(); let downloads = 0;
  let root: Group | undefined;
  try {
    root = await loadCivilianSource(data.model, data.lod, async url => {
      const before = performance.now();
      try { const response = await fetch(url); if (!response.ok) throw Error(`Civilian source ${response.status}`); return await response.arrayBuffer(); }
      finally { downloads += performance.now() - before; }
    });
    prepareCivilianRig(root, data.model);
    const baked = await prepareCivilianGeometry(root, data.model, data.lod === 'lod2'); baked.rig = root;
    const bytes = encodeCivilianBake(baked); baked.geometry.dispose();
    if (data.cpuRate > 1) await new Promise(resolve => setTimeout(resolve, (performance.now() - start - downloads) * (data.cpuRate - 1)));
    worker.postMessage({ bytes: bytes.buffer }, [bytes.buffer]);
  } catch { worker.postMessage({}); }
  finally { if (root) disposeCivilianSource(root); }
};
