import { Quaternion, Vector3 } from 'three';

/** Reused world-space socket sample; never feeds the deterministic simulation. */
export class RiderContacts {
  readonly seat = new Vector3();
  readonly handL = new Vector3();
  readonly handR = new Vector3();
  readonly footL = new Vector3();
  readonly footR = new Vector3();
  readonly orientation = new Quaternion();
}

/** Keep the opt-in pilot behind ?skin=1. Set true here to switch the default;
 * ?skin=0 remains an explicit rollback/A/B override. */
export const DEFAULT_SKIN = false;
export function useSkinnedCourier(params: URLSearchParams): boolean { return params.get('skin') === '1' || !params.has('skin') && DEFAULT_SKIN; }
