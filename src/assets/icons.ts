import manifest from './manifest.json';
const urls = import.meta.glob<string>('./icons/*.svg', { eager: true, query: '?url', import: 'default' });
/** Browser-ready icon URLs (Vite inlines small SVGs); HUD consumes the same manifest IDs. */
export function actionIconUrl(id: string): string {
  const entry = manifest.find((asset) => asset.id === id), path = entry?.icon?.replace('src/assets/', './'), url = path && urls[path];
  if (!url) throw new Error(`Unknown action icon ${id}`); return url;
}
