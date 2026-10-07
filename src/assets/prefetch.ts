import manifest from './manifest.json';
import { compositions } from '../levels/compositions';
import type { DistrictLayout } from '../levels/districts/types';
import { assetUrl } from './assetUrl';
import { districtAssetUrls } from './DistrictAssets';
import { atLeast, type AssetDef } from './types';
import { catalog } from '../data/actions/catalog';

const definitions = new Map((manifest as AssetDef[]).map(def => [def.id, def]));
const definition = (id: string): AssetDef => { const def = definitions.get(id); if (!def) throw new Error(`Unknown asset ID ${id}`); return def; };
const started = new Set<string>();

/** Warm the HTTP cache with a level's district data (layout JSON + GLB, placement LOD1/LOD2 models)
 * while the player is still in the menus. Low priority, a few requests at a time; the real load
 * then reads from the cache (or joins the in-flight response). Never throws. */
export async function prefetchLevel(level: string, concurrency = 4): Promise<void> {
  const composition = compositions[level];
  if (!composition || started.has(level)) return;
  started.add(level);
  const get = (url: string) => fetch(assetUrl(url), { priority: 'low' } as RequestInit);
  try {
    const layouts = await Promise.all(composition.districts.map(async ({ id }) => (await get(`/assets/layouts/${id}.layout.json`)).json() as Promise<DistrictLayout>));
    const urls = new Set<string>(composition.districts.map(({ id }) => `/assets/layouts/${id}.base.glb`));
    for (const layout of layouts) for (const placement of layout.placements) {
      if (placement.minTier > composition.tier || placement.maxTier < composition.tier) continue;
      try { for (const url of districtAssetUrls(placement.assetId, definition)) urls.add(url); } catch { /* unknown ids surface in the real load */ }
    }
    // Weapon/action view models load one after another in ActionView: warm them too.
    for (const def of Object.values(catalog)) { const asset = definitions.get(def.viewAssetId); if (asset?.glb && atLeast(asset.status, 'integrated')) urls.add('/' + asset.glb.replace(/^public\//, '')); }
    const queue = [...urls];
    await Promise.all(Array.from({ length: concurrency }, async () => {
      for (let url = queue.shift(); url; url = queue.shift()) { try { await (await get(url)).arrayBuffer(); } catch { /* best effort */ } }
    }));
  } catch { /* best effort: the level load reports real failures */ }
}
