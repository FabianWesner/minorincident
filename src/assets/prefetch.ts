import { prefetchLevelAssets } from './prefetchAssets';

const started = new Set<string>();
/** Warm the same HTTP assets off the gameplay thread, with bounded request concurrency. */
export async function prefetchLevel(level: string, concurrency = 4, quality: 'high' | 'low' = 'high'): Promise<void> {
  const key = `${level}:${quality}`;
  if (started.has(key)) return;
  started.add(key);
  try {
    if (typeof document !== 'undefined' && typeof Worker !== 'undefined') {
      // L2 warms L3 during its truck ride. JSON parsing and response consumption
      // must not compete with that frame on the main thread.
      const worker = new Worker(new URL('./prefetch.worker.ts', import.meta.url), { type: 'module' });
      try {
        await new Promise<void>((resolve, reject) => {
          worker.onmessage = ({ data }: MessageEvent<{ ok: boolean }>) => data.ok ? resolve() : reject(new Error('Prefetch failed'));
          worker.onerror = error => reject(error);
          worker.postMessage({ level, concurrency, quality });
        });
      } finally { worker.terminate(); }
    } else await prefetchLevelAssets(level, concurrency, quality);
  } catch { started.delete(key); /* best effort: allow another attempt after failure */ }
}
