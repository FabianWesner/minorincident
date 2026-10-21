/** The pipe bomb asset is 0.642 m long; match the molotov's 0.442 m hand scale. */
export function heldActionScale(actionId:string):number {
  return actionId==='weapon.pipe-bomb' ? .69 : 1;
}
