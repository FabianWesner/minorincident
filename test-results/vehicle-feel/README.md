# Vehicle feel review

`driving.webm`: 11.36 s, 960×540, WebM. Two L1 town segments, normal gameplay follow camera, headless ANGLE/Metal.

- 0–6.7 s: accelerate, break the cone, round Row Street into Juniper, apply the rear handbrake while steering back through the turn, then brake.
- 6.7–11.36 s: drive along the bakery verge and bump one side's raycast wheels over the existing 0.35 m raised planter edge. This is a physical curb-like obstacle; the visual street curbs have no colliders.

Fixture loading/placement is trimmed out; the cut switches to a separate real-town pass. Neither manoeuvre teleports the driving car. Foreground roofing/foliage partly covers the final drift, as it does with the ordinary game camera.

`town-drive.json`, `curb-drive.json` and `video.json` provide positions, speeds, corner/drift stages and montage timing. Screenshots are ≤1600 px wide. Raw recordings and temporary review frames were deleted.

Validation and remaining L3/L6 completion failures: `../epics/E09/report.md`.
