import { NavGrid } from '../../../../src/sim/ai/NavGrid';

// Diagnostic control on the same source revision: every request executes the
// original flood instead of accepting a memo hit. No production file is changed.
const reach = NavGrid.prototype.reachPath;
NavGrid.prototype.reachPath = function (this: NavGrid, ...args: Parameters<NavGrid['reachPath']>) {
  (this as unknown as { reachMemo: unknown }).reachMemo = null;
  return reach.apply(this, args);
};
