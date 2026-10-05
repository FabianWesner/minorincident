export interface Pixels {
  shape: number[];
  data: Uint8Array;
  get(x: number, y: number, channel: number): number;
}
export function getPixels(bytes: Uint8Array, mimeType: string): Promise<Pixels>;
export function savePixels(pixels: Pixels, mimeType: string): Promise<Uint8Array>;
