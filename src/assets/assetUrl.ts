import { DefaultLoadingManager } from 'three/webgpu';

declare const __ASSET_VERSIONS__: Record<string, string> | undefined;
/** Build-time content hashes (tools/build/load-plugins.ts); empty in dev and unit tests. */
const versions: Record<string, string> = typeof __ASSET_VERSIONS__ === 'undefined' ? {} : __ASSET_VERSIONS__;

/** Append the content version to a public asset path so long-lived CDN/browser caching stays correct across deploys. */
export function assetUrl(url: string): string {
  if (url.includes('?')) return url;
  const version = versions[url.startsWith('/') ? url : `/${url}`];
  return version ? `${url}?v=${version}` : url;
}
/** Every three.js loader (GLTF, KTX2 transcoder, textures) resolves through the default manager. */
export function installAssetVersions(): void { DefaultLoadingManager.setURLModifier(assetUrl); }
