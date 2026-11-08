/** Production QA artifact with source-bound mask helpers; never a public/deploy build. */
import { mergeConfig } from 'vite';
import base from '../../vite.config';
export default mergeConfig(base, { build: { rollupOptions: {
  preserveEntrySignatures: 'exports-only',
  input: ['tools/qa/e25-infected-mask.ts', 'tools/qa/e25-reflection-mask.ts'],
  output: { entryFileNames: 'build/[name].js' },
} } });
