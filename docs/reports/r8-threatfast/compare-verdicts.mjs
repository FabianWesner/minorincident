import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { renderReport } from '../../../tools/qa/threat/report.ts';

const [macPath, linuxPath, output] = process.argv.slice(2);
const load = path => JSON.parse((path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path)).toString());
const mac = load(macPath), linux = load(linuxPath);
function acceptanceProjection(audit) {
  let section = '';
  const tableVerdicts = [];
  for (const line of renderReport(audit).split('\n')) {
    if (line.startsWith('## ')) section = line.slice(3);
    if (!line.startsWith('|')) continue;
    const cells = line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
    if (/^(?:PASS|FAIL|SHORT WINDOW|NOT MEASURED|MISSING|N\/A)(?:\b|:)/.test(cells.at(-1)))
      tableVerdicts.push([section, cells[0], cells.at(-1)]);
  }
  return {
    flags: audit.flags,
    levelGateFlags: Object.fromEntries(audit.levels.map(level => [level.level, level.passiveFlags])),
    tableVerdicts,
    kiting: Object.fromEntries(audit.levels.map(level => [level.level, level.kiting])),
  };
}
const a = acceptanceProjection(mac), b = acceptanceProjection(linux);
const equal = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const result = {
  macPath, linuxPath, identical: equal(a, b), tableVerdictsCompared: a.tableVerdicts.length,
  auditFlagsIdentical: equal(a.flags, b.flags), levelGateFlagsIdentical: equal(a.levelGateFlags, b.levelGateFlags),
  kitingReceiptsIdentical: equal(a.kiting, b.kiting),
  nativeDiagnosticDifferences: mac.levels.flatMap((level, i) => equal(level.flags, linux.levels[i].flags) ? []
    : [{ level: level.level, mac: level.flags, linux: linux.levels[i].flags }]),
  mac: a, linux: b,
};
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ identical: result.identical, tableVerdictsCompared: result.tableVerdictsCompared,
  nativeDiagnosticDifferences: result.nativeDiagnosticDifferences.length }));
process.exitCode = result.identical ? 0 : 1;
