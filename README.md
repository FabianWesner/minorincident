# Minor Incident

Minor Incident is a browser based isometric zombie action RPG built with TypeScript, Vite, three.js, and Rapier.

## Get started

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The development server uses port 3300.

## Build and checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
E2E_PORT=4871 SCENE_PORT=4872 npm run test:smoke
npm run scene:gate
npm run qa:threat
```

Acceptance reports are generated with `npm run qa:accept -- --level all`. See [the specs index](specs/README.md) for project requirements, [the acceptance guide](docs/reports/fix51-verify/README.md) for evidence and review status, and [acceptance review freshness](docs/reports/fix51-r9i/README.md) for review source digests.
