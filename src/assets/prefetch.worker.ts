import { prefetchLevelAssets } from './prefetchAssets';

self.onmessage = async ({ data }: MessageEvent<{ level: string; concurrency: number; quality: 'high' | 'low' }>) => {
  try {
    await prefetchLevelAssets(data.level, data.concurrency, data.quality);
    self.postMessage({ ok: true });
  } catch { self.postMessage({ ok: false }); }
};
