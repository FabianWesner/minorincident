import type { Group } from 'three/webgpu';
import { decompressCivilianBake } from '../../assets/bakeCompression';
import files from '../../assets/civilianBakes.json';

const worker = globalThis as unknown as { onmessage: (event: MessageEvent<{ model: string; lod: 'lod0' | 'lod1' | 'lod2'; cpuRate: number; source?: boolean }>) => void; postMessage(value: unknown, transfer?: Transferable[]): void };
worker.onmessage = async ({ data }) => {
  const start = performance.now(); let downloads = 0;
  let root: Group | undefined, dispose: ((root: Group) => void) | undefined;
  try {
    const path = (files as Record<string, string>)[`${data.model}:${data.lod}`];
    if (!data.source && path && typeof DecompressionStream !== 'undefined') {
      try {
        const before = performance.now();
        const response = await fetch(path);
        if (!response.ok) throw Error('Unavailable civilian bake');
        const compressed = await response.arrayBuffer(); downloads += performance.now() - before;
        const inflateStart = performance.now(); performance.measure('civilian:download', { start: before, end: inflateStart });
        const bytes = await decompressCivilianBake(compressed);
        performance.measure('civilian:inflate', { start: inflateStart, end: performance.now() });
        if (data.cpuRate > 1) await new Promise(resolve => setTimeout(resolve, (performance.now() - start - downloads) * (data.cpuRate - 1)));
        worker.postMessage({ bytes, prebuilt: true }, [bytes]); return;
      } catch { /* Missing build output uses the same runtime preparation below. */ }
    }
    // Shipped bakes need only fetch + inflate. Load Three and the animation
    // library only for the source fallback, rather than booting them in eight workers.
    const [{ loadCivilianSource, disposeCivilianSource }, { prepareCivilianGeometry, prepareCivilianRig }, { encodeCivilianBake }] = await Promise.all([import('../../assets/civilianSource'), import('./prepareCivilianGeometry'), import('../../assets/civilianBakeData')]);
    dispose = disposeCivilianSource;
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
  finally { if (root) dispose?.(root); }
};
