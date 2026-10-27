export function validateGateSelection(mode: string | undefined, batch: number, shard: string | undefined, rows: number): string | undefined {
  if (mode !== 'gate' && mode !== 'nightly') return 'unknown mode';
  if (!Number.isSafeInteger(batch) || batch < 1) return 'invalid batch';
  if (!rows) return 'empty selection';
  if (shard !== undefined) {
    const values = shard.split('/').map(Number);
    if (values.length !== 2 || !values.every(Number.isSafeInteger) || values[0] < 1 || values[1] < 1 || values[0] > values[1]) return 'invalid shard';
  }
}
