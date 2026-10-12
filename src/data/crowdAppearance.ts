/** Appearance samples never consume a gameplay RNG stream; identity survives LOD, checkpoint and infection. */
export function appearanceSample(id: number, channel: number): number {
  let value = (id ^ Math.imul(channel + 1, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x21f0aaad);
  value = Math.imul(value ^ value >>> 15, 0x735a2d97);
  return (value ^ value >>> 15) >>> 0;
}
export const hairTones = ['#241f20', '#493027', '#704532', '#a16d42', '#d1ab70', '#783d2c', '#b56b43', '#a7a0a2'] as const;
export const trouserTones = ['#364253', '#50596c', '#5e5145', '#847359', '#384943', '#5b485e', '#403b3b', '#6c6b64'] as const;
export const shirtTones = ['#3178ac', '#e5d9b9', '#d4ad32', '#79865b', '#a86645', '#ac7a91', '#486e69', '#b95862', '#59627e', '#968d78', '#6b517c', '#46734d'] as const;
export const skinTones = ['#edb18d', '#d69a78', '#bd815f', '#9c684f', '#78513f', '#593e34'] as const;
export const infectedSkinTones = ['#afb89a', '#a4ad8e', '#919c7f', '#889276', '#7a886d', '#6c7b63'] as const;
export function crowdAppearance(id: number) {
  return { hair: (appearanceSample(Math.floor(id / 8), 0) + id) % hairTones.length, skin: appearanceSample(id, 1) % skinTones.length,
    trousers: appearanceSample(id, 2) % trouserTones.length, shirt: appearanceSample(id, 3) % shirtTones.length, accessory: appearanceSample(id, 4) };
}
/** Balance the nearest neighbourhood instead of independent random rolls (which can produce ten identical berets).
 * Explicit story looks bypass this; ties use an entity/sequence seed, never the gameplay random stream. */
export function balancedCrowdModel(models: readonly string[], neighbours: Iterable<{ model: string; x: number; z: number }>, at: { x: number; z: number }, seed: number): string {
  const counts = new Map(models.map(model => [model, 0]));
  for (const n of neighbours) if (Math.hypot(n.x - at.x, n.z - at.z) < 30 && counts.has(n.model)) counts.set(n.model, counts.get(n.model)! + 1);
  const minimum = Math.min(...counts.values()), choices = models.filter(model => counts.get(model) === minimum);
  return choices[appearanceSample(seed, 5) % choices.length];
}
export const regularInfectedModels = ['inf.common-worker', 'inf.jogger', 'inf.cashier', 'inf.delivery-driver', 'inf.suburban-mom', 'inf.bbq-dad', 'inf.bathrobe-neighbor'] as const;
