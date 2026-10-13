Native headless Chrome / ANGLE Metal on Apple M4; production build; 200/100 infected; APC autopilot on all three retained routes. Simulation scale 2, normal RAF rendering. Phone: 390×844, low quality, fourfold CPU throttle. Desktop: 1600×900.

Assets/shaders are ready and transient load garbage is collected before timing; the first 3 s are warmup. All subsequent route streaming is included. Triangles are view submissions per E18/Scene Lab; shadow and total submissions are recorded separately. JS heap is CDP usedSize after collection; heapPeakMB also includes backing stores and is not the E18 JS-heap metric.

| Profile | Route | Frame p95 ms | Tick p95 ms | Draws | View triangles | Resident | Heap MB | Max frame ms | Pass |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| high | road | 12.5 | 0.80 | 90 | 902984 | 25 | 147.19 | 37.7 | True |
| high | countryside | 14.1 | 0.90 | 90 | 886665 | 25 | 148.27 | 39.6 | True |
| high | dry-shortcut | 14.3 | 0.90 | 79 | 898577 | 25 | 148.06 | 33.8 | True |
| low | road | 5.9 | 0.80 | 70 | 193394 | 9 | 110.49 | 12.4 | True |
| low | countryside | 5.9 | 0.80 | 71 | 193410 | 9 | 99.36 | 13.3 | True |
| low | dry-shortcut | 6.7 | 0.90 | 71 | 193484 | 9 | 99.92 | 11.0 | True |
| phone | road | 13.4 | 2.30 | 60 | 131917 | 9 | 109.79 | 77.4 | True |
| phone | countryside | 18.4 | 2.60 | 56 | 131540 | 9 | 98.15 | 44.6 | True |
| phone | dry-shortcut | 13.0 | 2.30 | 56 | 87803 | 9 | 98.55 | 33.8 | True |

Limits remain E18: 600/300 draws, 1.5M/500k view triangles, 4/6 ms tick p95, 400/250 MB JS heap, 16.7/33.3 ms frame p95, 25/9 detailed cells. Desktop high and low max frame ≤50 ms. Lights, awake props, particles, puffs and debris remain at zero in this healthy greybox stress fixture.

| Profile | Heap first/last MB | GPU geometry first/last | Textures first/last | Node builds first/last | Pass |
| --- | --- | --- | --- | --- | --- |
| high | 148.79/149.02 | 95/95 | 31/31 | 425/425 | True |
| low | 101.02/101.15 | 89/89 | 33/33 | 373/373 | True |
| phone | 99.68/99.81 | 77/77 | 28/28 | 355/355 | True |

Five outward/backward sweeps use 100 m steps so low-tier windows overlap, matching continuous driving. Heap and GPU counts must end within 10% of the first sweep; node builds must remain unchanged.

Scope: this proves S3 healthy greybox terrain streaming. Collider/nav ownership and serialized inactive-state restoration are S4; floor/crash/finale stress awaits S5/S6 and subsequent encounters/dressing. Real iOS/Android recordings remain manual.

Run after build: `SCENE_PORT=34291 SCENE_SERVER=preview sh tools/perf/quiet-run.sh npx tsx tools/l9/streaming-perf.ts`. Optional `L9_PROFILE`, `L9_ROUTE`, `L9_CPU_PROFILE=low/road` isolate a diagnostic; final proof uses all profiles/routes.
