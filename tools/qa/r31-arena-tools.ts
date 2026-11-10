// r31-megafight: native numbers for the arena checks (the same function the missions test runs).
//   node --import tsx/esm tools/qa/r31-arena-tools.ts
import { l10MegaFightCheck } from '../../tests/helpers/l10MegaFight';
console.log(JSON.stringify(await l10MegaFightCheck()));
process.exit(0);
