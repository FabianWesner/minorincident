# Performance terminal logs

Both attempts were bounded by the original 09:55:33 UTC deadline. No accepted timing row comes from the rejected attempt.

## rejected

```text
Quiet-run waiting: {"at":"2026-11-08T09:35:33.659Z","event":"quiet-admission-wait","granted":false,"quiet":false,"load":[7.58203125,14.26708984375,15.52880859375],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:36:04.221Z","event":"quiet-admission-wait","granted":false,"quiet":false,"load":[5.95849609375,13.236328125,15.1103515625],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:36:34.810Z","event":"quiet-admission-wait","granted":false,"quiet":false,"load":[4.9638671875,12.29052734375,14.701171875],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:37:05.397Z","event":"quiet-admission-wait","granted":false,"quiet":false,"load":[4.99951171875,11.6064453125,14.36865234375],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:37:35.969Z","event":"quiet-admission-wait","granted":false,"quiet":false,"load":[4.1669921875,10.76806640625,13.9677734375],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:38:06.651Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[4.27880859375,10.19189453125,13.64892578125],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:38:36.700Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[3.53662109375,9.44091796875,13.255859375],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:39:06.705Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[3.74951171875,8.92138671875,12.93408203125],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:39:36.782Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[3.60693359375,8.38720703125,12.60009765625],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:40:06.932Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[3.4560546875,7.8876953125,12.27197265625],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:40:36.954Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[3.56494140625,7.4970703125,11.9775390625],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:41:07.057Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[3.6572265625,7.14501953125,11.69384765625],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:41:37.150Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[3.69384765625,6.837890625,11.42529296875],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:42:07.287Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[3.26416015625,6.380859375,11.072265625],"busy":[]}
Quiet-run pool preflight: exclusive context admission; load < 3; no foreign headless Chrome, Blender, build or local Vitest.
[scene] starting vite preview on http://127.0.0.1:4347
/Users/wesner/Workspace/minorincident/.claude/worktrees/e25-final/tools/qa/e25-native-perf.ts:50
    if (!(native.ticks > 0 && native.renderedFrames >= 290)) throw Error(`Native sample did not advance production simulation/rendering: ${JSON.stringify({ ticks: native.ticks, frames: native.renderedFrames })}`);
                                                                   ^

Error: Native sample did not advance production simulation/rendering: {"ticks":328,"frames":0}
    at <anonymous> (/Users/wesner/Workspace/minorincident/.claude/worktrees/e25-final/tools/qa/e25-native-perf.ts:50:68)

Node.js v26.0.0

```

## corrected

```text
Quiet-run waiting: {"at":"2026-11-08T09:44:47.534Z","event":"quiet-admission-wait","granted":false,"quiet":false,"load":[6.626953125,6.22021484375,10.16748046875],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:45:18.055Z","event":"quiet-admission-wait","granted":false,"quiet":false,"load":[6.8427734375,6.296875,10.056640625],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:45:48.455Z","event":"quiet-admission-wait","granted":false,"quiet":false,"load":[7.0087890625,6.3935546875,9.96044921875],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:46:19.219Z","event":"quiet-admission-wait","granted":false,"quiet":false,"load":[5.60205078125,6.126953125,9.74072265625],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:46:50.149Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[4.44677734375,5.80712890625,9.5],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:47:21.187Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[3.27001953125,5.3935546875,9.2216796875],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:47:51.260Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[3.0341796875,5.1318359375,8.9931640625],"busy":[]}
Quiet-run waiting: {"at":"2026-11-08T09:48:21.304Z","event":"quiet-admission-wait","granted":true,"quiet":false,"load":[3.2939453125,5.00341796875,8.8125],"busy":[]}
Quiet-run pool preflight: exclusive context admission; load < 3; no foreign headless Chrome, Blender, build or local Vitest.
[scene] starting vite preview on http://127.0.0.1:4347
reflection-lab high: native p95 10.700 ms; GPU queries true
light-lab high: native p95 5.000 ms; GPU queries true
night-street high: native p95 6.200 ms; GPU queries true
[scene] starting vite preview on http://127.0.0.1:4347
light-lab low: native p95 4.800 ms; GPU queries true
night-street low: native p95 5.500 ms; GPU queries true

```
