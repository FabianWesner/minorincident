import type { SendResult, Transport } from './client';
import type { ChunkTransport } from './replay';

const map = (status: number): SendResult => status >= 200 && status < 300 ? 'ok' : status === 404 || status === 405 || status === 503 ? 'stop' : status === 408 || status === 429 || status >= 500 ? 'retry' : 'drop';
const canBeacon = (): boolean => typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function';

/** fetch for normal sends, sendBeacon (queued by the browser, survives unload) for the final flush. */
export const browserTransport: Transport & ChunkTransport = {
  async send(url: string, body: string, final: boolean): Promise<SendResult> {
    if (final && canBeacon()) return navigator.sendBeacon(url, new Blob([body], { type: 'application/json' })) ? 'ok' : 'retry';
    const response = await fetch(url, { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: final && body.length < 60_000 });
    return map(response.status);
  },
  async post(url: string, body: Uint8Array, final: boolean): Promise<SendResult> {
    // Beacons are capped near 64 KB per page; chunks are cut often enough that the final one fits.
    if (final && canBeacon() && body.length < 60_000) return navigator.sendBeacon(url, new Blob([body as BlobPart], { type: 'application/octet-stream' })) ? 'ok' : 'retry';
    const response = await fetch(url, { method: 'POST', body: body as BodyInit, headers: { 'content-type': 'application/octet-stream' }, keepalive: final && body.length < 60_000 });
    return map(response.status);
  },
};
