// Which assets the L5 layout copy uses and their manifest status (placeholders render as magenta cubes). npx tsx tools/l5/assets.ts
import { readFileSync } from 'node:fs';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { levelFiveLayouts } from '../../src/levels/L5/layout';

const manifest = new Map((JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as { id: string; status: string; glb?: string }[]).map(a => [a.id, a]));
const [layout] = levelFiveLayouts([JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as DistrictLayout]);
const counts = new Map<string, number>();
for (const p of layout.placements) counts.set(p.assetId, (counts.get(p.assetId) ?? 0) + 1);
for (const [id, n] of [...counts].sort()) { const a = manifest.get(id); if (!a || a.status !== 'integrated') console.log(id.padEnd(34), n, a?.status ?? 'NOT IN MANIFEST'); }
