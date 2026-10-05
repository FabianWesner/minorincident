import type { AssetStatus } from '../../src/assets/types';

/** Expand the inventory's compact IDs; wildcard families remain production templates. */
export function expandIds(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].flatMap((match) => {
    const value = match[1];
    if (!/^[a-z]+\.[a-z]/.test(value) || /[ *]/.test(value)) return [];
    const [base, ...suffixes] = value.split('/');
    if (!suffixes.length) return [base];
    const stem = base.slice(0, base.lastIndexOf('-') + 1);
    return [base, ...suffixes.map((s) => s.includes('.') ? s : stem + s)];
  });
}
export function parseInventory(text: string): Map<string, AssetStatus> {
  const assets = new Map<string, AssetStatus>();
  let section = 0;
  for (const line of text.split('\n')) {
    const heading = line.match(/^## (\d+)\./);
    if (heading) section = Number(heading[1]);
    if (section < 3 || section > 4 || !line.startsWith('|')) continue;
    const columns = line.split('|').map((c) => c.trim());
    const status: AssetStatus = /\bfinal\b/.test(columns[3] ?? '') ? 'final'
      : /\bintegrated\b/.test(columns[3] ?? '') ? 'integrated'
      : /\bmodeled\b/.test(columns[3] ?? '') ? 'modeled'
      : /\bU\b/.test(columns[3] ?? '') ? 'upscaled'
      : section === 3 || /→ D/.test(columns[1]) ? 'reference' : 'placeholder';
    for (const id of expandIds(columns[1] ?? '')) assets.set(id, status);
  }
  return assets;
}
