import type { AssetDef } from './types';
import { settingsKey } from '../ui/Settings';

/** Explicit URL choice wins over the persisted opt-in; production starts off. */
export function texturedCharactersEnabled(): boolean {
  if (typeof location === 'undefined') return false;
  const choice = new URLSearchParams(location.search).get('tex');
  if (choice !== null) return choice === '1';
  try { return JSON.parse(localStorage.getItem(settingsKey) ?? '{}').texturedCharacters === true; }
  catch { return false; }
}
export function textureVariant(id: string, definitions: ReadonlyMap<string, AssetDef>): string {
  return texturedCharactersEnabled() ? definitions.get(id)?.textureVariant ?? id : id;
}
