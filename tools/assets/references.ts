import { existsSync, readdirSync, readFileSync } from 'node:fs';

/** Data modules declare GLB references using asset/assetId, never file paths. */
export function assetReferences(source: string): string[] {
  return [...source.matchAll(/\b(?:asset|assetId)\s*:\s*['"]([^'"]+)['"]/g)].map((m)=>m[1]);
}
export function dataReferences(directories = ['src/data','src/levels']): string[] {
  const visit = (directory: string): string[] => !existsSync(directory) ? [] : readdirSync(directory,{withFileTypes:true}).flatMap((entry)=>entry.isDirectory()?visit(`${directory}/${entry.name}`):entry.name.endsWith('.ts')?assetReferences(readFileSync(`${directory}/${entry.name}`,'utf8')):[]);
  return directories.flatMap(visit);
}
