export interface GateRowIdentity { backend: string; tier: string; name: string }
export function resultKey(name: string, backend: string): string { return `${backend}\0${name}`; }
export function sameWork(saved: GateRowIdentity[], wanted: GateRowIdentity[]): boolean {
  return saved.length === wanted.length && wanted.every(row => saved.some(previous => previous.backend === row.backend && previous.tier === row.tier && previous.name === row.name));
}
