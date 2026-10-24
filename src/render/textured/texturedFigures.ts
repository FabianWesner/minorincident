import { settingsKey } from '../../ui/Settings';

/** Dev/QA switch for the 3D-pipeline textured assets (PO 10-24 render change): `?tex=1` turns them on, `?tex=0` off,
 * otherwise the persisted settings flag `texturedFigures` (localStorage minor-incident.ui.v1) decides. PROD default: off.
 * Shared by every textured lane (courier body, crowds, props): one switch, one material cache (Materials.fromTexture). */
export function useTexturedFigures(params: URLSearchParams, storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): boolean {
  if (params.has('tex')) return params.get('tex') === '1';
  try { return (JSON.parse(storage?.getItem(settingsKey) ?? '{}') as { texturedFigures?: unknown }).texturedFigures === true; }
  catch { return false; }
}
