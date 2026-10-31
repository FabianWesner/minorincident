# Preflight evidence

Date: 2026-10-31. Worktree branch: `lane/final-e2e`. HEAD and `main`: `b98aaa60448060e02ccfe2e1332b39406360e828`.

## Build

`npm run build:qa` initially failed before compilation because the cache lock path was outside the writable worktree:

```text
PermissionError: [Errno 1] Operation not permitted: '/Users/wesner/Workspace/minorincident/.mi-worktree-cache/locks/dist-517626072224d78d8795889714432325d6fa938e86022470e421b1e13f64a4f4'
```

`MI_BUILD_CACHE=off npm run build:qa` then completed successfully with Vite 6.4.3 (`644 modules transformed`, `✓ built in 8.79s`). This is the local QA build used for the attempted playtest.

## Playtest launch attempts

`npm run playtest ...` re-invokes the blocked cache build. Directly invoking `tsx` failed because its IPC socket could not be created (`listen EPERM`). Invoking the driver through `node --import tsx` bypassed that IPC issue, but its preview server could not bind:

```text
Error: preview server did not start on 4761
```

The driver source reports the cause at `tools/playtest/play.ts:51`; it tries to serve the built QA `dist/` on `127.0.0.1:4761`. `curl` to ports 4761 and 4329 both failed to connect. `sh tools/browser-status.sh` reported `Browser pool unavailable (fetch failed); use a browser command to start it.` The in-app browser selection for the local QA URL returned `No browser is available`.

No browser session started, no gameplay input was sent, no screenshot was captured, and no browser profile was created. Disk check showed 19 GiB available (above the 10 GB minimum).

## Environment restored

On the next goal continuation, unrestricted filesystem/network execution was provided. The shared browser pool is now live (`pid=91433`, no active or waiting contexts on inspection); the campaign can proceed. The earlier startup and Git restrictions are historical, not current blockers.
