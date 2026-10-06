import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
/** Run pinned axe-core as an external QA tool, never a game/package dependency.
 * E14_AXE_PATH supports an offline preinstalled tool; npm exec caches it otherwise.
 * MPL source stays unmodified in npm's external cache and out of the game bundle. */
export function axeTool(): string {
  const path = process.env.E14_AXE_PATH ?? execFileSync('npm', [
    'exec', '--yes', '--package=axe-core@4.11.0', '--', 'node', '--input-type=module', '-e',
    'import {existsSync} from "node:fs"; import {join,dirname,delimiter} from "node:path"; const path=process.env.PATH.split(delimiter).map(p=>join(dirname(p),"axe-core/axe.min.js")).find(existsSync); if(!path)process.exit(1); console.log(path)',
  ], { encoding: 'utf8', timeout: 60_000 }).trim();
  return readFileSync(path, 'utf8');
}
