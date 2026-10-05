/** Ownership contract: reset releases level state; dispose releases the service. */
export interface Lifecycle {
  init(): void | Promise<void>;
  update(): void;
  reset(): void;
  dispose(): void;
}
