import { test } from '../e2e/fixtures';
// Only manual WebGPU and the explicitly staged SSR proof remain deferred.
// Implemented criteria live in e25-closure.spec.ts and the focused unit/sim tests.
test.fixme('T-E25-01-GPU @E25 @E25-AC01 deferred: comparative ClusteredLighting/DynamicLighting WebGPU GPU timing (manual)', async () => {});
test.fixme('T-E25-04 @E25 @E25-AC04 deferred: WebGL2/WebGPU pool parity at one photo spot (WebGPU is checked manually)', async () => {});
test.fixme('T-E25-10-SSR @E25 @E25-AC10 deferred: SSR reflected car silhouette (release extras, specs/04 section 6)', async () => {});
