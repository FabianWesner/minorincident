# Repository guidance

Minor Incident: isometric zombie action RPG in the browser (TypeScript, Vite, three.js WebGPU with WebGL2 fallback, Rapier).

Source of truth: `specs/` (start with `specs/README.md`). Per epic read `specs/04-epics-overview.md` (Definition of Done),
the epic file, `specs/02-technical-architecture.md` and `specs/90-test-concept.md` / `91-test-plan.md`.
Bruno Simon's `folio-2025/` is a read-only technology reference (`specs/08-bruno-reuse-map.md`). Never edit it.

Validation: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run verify -- E<NN>`.

Rules:
- Implement the smallest clean change that satisfies the epic. Reuse existing code and patterns; no speculative abstractions.
- Do not edit `specs/` except to fix a wrong criterion, and then explain it in the epic report.
- Do not edit `folio-2025/`, `references/`, `initial-drafts/`, `experiment/` or `assets/*/reference*.png`.
- `preview/` and `experiment/tools/` are working dev tools: keep them working.
- Dependencies: permissive licenses only (MIT preferred; Apache-2.0, BSD, ISC acceptable). No GPL/AGPL.
- This Mac runs many jobs at once: cap Playwright at 2 workers (SwiftShader is CPU-heavy) and Vitest at 4 threads; never start a second dev server on 3300.
- Never print or commit secrets from `.env`.
