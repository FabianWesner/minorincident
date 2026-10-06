// Build-time load optimizations (production only; dev keeps the stock behaviour).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

/** Rapier's compat build inlines its 3 MB WASM as base64 inside a 4.3 MB JS chunk. Emit the
 * binary as its own hashed asset instead: smaller transfer (raw WASM compresses better than
 * base64), no main-thread base64 decode, and streaming compilation while it downloads. */
export function rapierWasmFile(): Plugin {
  return {
    name: 'mi:rapier-wasm-file', apply: 'build', enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@dimforge/rapier3d-compat') || !code.includes('AGFzbQ')) return null;
      const match = /([A-Za-z_$][\w$]*)\.toByteArray\("(AGFzbQ[A-Za-z0-9+/=]+)"\)\.buffer/.exec(code);
      if (!match) this.error('Rapier base64 WASM pattern not found; update tools/build/load-plugins.ts');
      const ref = this.emitFile({ type: 'asset', name: 'rapier.wasm', source: Buffer.from(match![2], 'base64') });
      return { code: code.slice(0, match!.index) + `import.meta.ROLLUP_FILE_URL_${ref}` + code.slice(match!.index + match![0].length), map: null };
    },
    // Start the WASM download with the HTML instead of after the JS has run; the matching
    // fetch() (cors, same-origin credentials) reuses this preload for streaming compilation.
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        const wasm = Object.values(context.bundle ?? {}).find(file => file.type === 'asset' && /rapier.*\.wasm$/.test(file.fileName));
        if (!wasm || !context.filename.endsWith('/index.html') || context.filename.includes('/preview/')) return html;
        return { html, tags: [{ tag: 'link', attrs: { rel: 'preload', href: `/${wasm.fileName}`, as: 'fetch', type: 'application/wasm', crossorigin: '' }, injectTo: 'head' }] };
      },
    },
  };
}

/** Content hashes of runtime-fetched public assets. Loaders append `?v=<hash>` so the CDN may
 * cache these unhashed paths for long periods while a redeploy still fetches changed files. */
export const versionedDirs = ['models', 'layouts', 'basis', 'decals'];
export function assetVersions(root = 'public'): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string): void => {
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(glb|json|ktx2|png|webp|wasm|js)$/.test(name)) out['/' + relative(root, path).split('\\').join('/')] = createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 10);
    }
  };
  for (const dir of versionedDirs) walk(join(root, 'assets', dir));
  return out;
}
export function assetVersionsDefine(): Plugin {
  return { name: 'mi:asset-versions', apply: 'build', config: () => ({ define: { __ASSET_VERSIONS__: JSON.stringify(assetVersions()) } }) };
}
