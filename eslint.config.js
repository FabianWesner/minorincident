import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'folio-2025/**', 'preview/**', 'assets/**', 'experiment/**', 'references/**', 'initial-drafts/**', 'epics-pipeline/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/sim/**/*.ts', 'src/physics/**/*.ts', 'src/core/**/*.ts', 'src/levels/**/*.ts'],
    ignores: ['src/core/Ticker.ts'],
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'location', 'HTMLElement', 'HTMLCanvasElement', 'requestAnimationFrame', 'performance', 'Date'],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Use a seeded Rng stream.' }],
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['three/webgpu', 'three/tsl', '**/render/**', '**/ui/**', '**/debug/**', '*dom*'], message: 'Keep simulation dependencies headless.' }],
      }],
    },
  },
);
