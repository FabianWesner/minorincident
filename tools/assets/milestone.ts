import { atLeast, type AssetDef } from '../../src/assets/types';

/** Production batches use this gate; pending assets never satisfy a milestone. */
export function pendingMilestone(assets: AssetDef[], scheduled: string[]): string[] {
  return scheduled.filter(id=>{
    const asset=assets.find(a=>a.id===id);
    return !asset || !atLeast(asset.status,'integrated');
  });
}
