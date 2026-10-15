import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';
import base from '../../../../vitest.config';

export default mergeConfig(base, {
  test: { setupFiles: [fileURLToPath(new URL('./reach-cache-off.ts', import.meta.url))] },
});
