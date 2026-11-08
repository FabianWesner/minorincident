# native-timing

```text
Quiet-run waiting: {"at":"2026-11-08T03:23:55.430Z","event":"quiet-admission-wait","granted":false,"quiet":false,"load":[10.0244140625,10.47216796875,9.572265625],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T03:24:26.292Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[13.46923828125,11.3203125,9.9130859375],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T03:24:56.980Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[10.3095703125,10.74951171875,9.75341796875],"busy":[{"pid":1201,"command":"node /Users/wesner/Workspace/minorincident/.claude/worktrees/pre-uat-l7/node_modules/.bin/eslint src tests tools functions playwright.config.ts vite.config.ts vitest.config.ts esli"},{"pid":1202,"command":"node /Users/wesner/Workspace/minorincident/.claude/worktrees/pre-uat-l7/node_modules/.bin/tsc --noEmit"}]}
Quiet-run waiting: {"at":"2026-11-08T03:25:27.679Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[9.38037109375,10.52294921875,9.70703125],"busy":[]}
Error: Quiet-run: admission exceeded 120 seconds; last conditions: {"quiet":false,"load":[8.125,10.10595703125,9.5830078125],"busy":[]}; report unmeasured coverage.
```
