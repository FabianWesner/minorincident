export function parsePlaywrightTotal(output) {
  const total = output.match(/Total: (\d+) tests?/);
  if (!total) throw new Error('Playwright collection did not report a test count');
  const count = Number(total[1]);
  if (!Number.isSafeInteger(count)) throw new Error('Playwright collection reported an invalid test count');
  return count;
}
