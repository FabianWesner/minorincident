export function childFailedUnexpectedly(code: number | null, expected: string[], rows: { name: string; pass: boolean }[], known: Set<string>): boolean {
  const names = new Set(rows.map(row => row.name));
  if (rows.length !== expected.length || names.size !== rows.length || expected.some(name => !names.has(name)) || rows.some(row => !expected.includes(row.name))) return true;
  if (code === 0) return false;
  const failed = rows.filter(row => !row.pass);
  return code !== 1 || failed.length === 0 || failed.some(row => !known.has(row.name));
}
