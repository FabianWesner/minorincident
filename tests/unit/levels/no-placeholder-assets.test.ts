import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { atLeast, variantPath } from '../../../src/assets/types';
import { vehicleDecayFallback } from '../../../src/assets/vehicleDecay';
import { productionIds } from '../../../src/assets/productionIds';
import { compositions } from '../../../src/levels/compositions';
import { levelTwoLayouts } from '../../../src/levels/L2/layout';
import { levelThreeLayouts } from '../../../src/levels/L3/layout';
import { levelFourLayouts } from '../../../src/levels/L4/layout';
import { levelFiveLayouts } from '../../../src/levels/L5/layout';
import type { DistrictLayout } from '../../../src/levels/districts/types';

/**
 * No level may ship a placeholder box (PO 10-12: "The blocker is just a white box"). The registry turns any placement whose
 * GLB variant is missing, or lacks a node the manifest requires, into a grey/magenta box; the static batcher then repaints that
 * box beige. This gate resolves every placement of L1-L5 (asset + decay variant + every LOD file) the way the registry does and
 * fails with the exact missing file or node.
 */
interface Def { id: string; status: string; glb?: string; lods?: Record<string, string>; requiredNodes: string[]; animatedNodes: string[]; sockets: string[]; decayVariants: string[]; decalTexture?: string; category: string }
const manifest = new Map((JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as Def[]).map(a => [a.id, a]));
const nodes = new Map<string, Set<string>>();
function nodeNames(path: string): Set<string> {
  let names = nodes.get(path);
  if (!names) {
    const bytes = readFileSync(path), json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8')) as { nodes?: { name?: string }[] };
    names = new Set((json.nodes ?? []).map(n => n.name ?? '')); nodes.set(path, names);
  }
  return names;
}
const read = (id: string) => JSON.parse(readFileSync(`public/assets/layouts/${id}.layout.json`, 'utf8')) as DistrictLayout;
const layoutsOf = (level: string): DistrictLayout[] => {
  const base = compositions[level].districts.map(d => read(d.id));
  if (level === 'L2') return levelTwoLayouts(base);
  if (level === 'L3') return levelThreeLayouts(base);
  if (level === 'L4') return levelFourLayouts(base);
  if (level === 'L5') return levelFiveLayouts(base);
  return base;
};

/** Problems of one placed asset (+ decay variant) as the registry would hit them; empty when it renders as real art. */
export function placeholderProblems(assetId: string, decay?: string): string[] {
  const id = productionIds[assetId] ?? assetId, def = manifest.get(id);
  if (!def) return [];                       // registered dressing without a manifest entry has no GLB contract here
  const label = `${assetId}${decay ? ':' + decay : ''}`;
  if (!atLeast(def.status as never, 'integrated')) return [`${label}: status ${def.status} renders the placeholder`];
  if (def.decalTexture) return [];
  if (decay && !def.decayVariants.includes(decay) && !vehicleDecayFallback(def as never, decay)) return [`${label}: unknown decay variant`];
  const out: string[] = [];
  for (const lod of ['lod0', 'lod1', 'lod2'] as const) {
    const source = lod === 'lod0' ? def.glb : def.lods?.[lod];
    if (!source) continue;
    const path = variantPath(source, vehicleDecayFallback(def as never, decay) ? undefined : decay);
    if (!existsSync(path)) { out.push(`${label}: missing ${path}`); continue; }
    const names = nodeNames(path);
    // Decorative decay variants are never driven or boarded, so seat sockets are only required of the intact model.
    const required = [...def.requiredNodes, ...def.animatedNodes, ...(decay ? [] : def.sockets)];
    for (const node of required) if (!names.has(node)) out.push(`${label} ${lod}: ${path} lacks node ${node}`);
  }
  return out;
}

describe('no placeholder art in any level', () => {
  for (const level of ['L1', 'L2', 'L3', 'L4', 'L5']) {
    test(`${level}: every placed asset and decay variant resolves to real geometry`, () => {
      const used = new Map<string, Set<string | undefined>>();
      for (const layout of layoutsOf(level)) for (const p of layout.placements) {
        if (!used.has(p.assetId)) used.set(p.assetId, new Set());
        used.get(p.assetId)!.add(p.decay);
      }
      const problems = [...used].flatMap(([assetId, decays]) => [...decays].flatMap(decay => placeholderProblems(assetId, decay)));
      expect(problems).toEqual([]);
    }, 120_000);
  }
});
