# Atmosphere 2: day-level cast tuning

Reviewed the refreshed WebGL2 overview at `sheets/overview-webgl2-high-z1-L1-L5.jpg` after recapturing L1, L3, and L4 (high and low tiers, zoom 1 and 0.5).

- **L1:** Golden amber light remains. The road reads closer to neutral brown-grey, and the cloud-shadow wedge is softer and less saturated. The remaining shadow tint is cool lilac rather than a frame-wide purple cast.
- **L3:** Sidewalks have moved from salmon pink toward warm beige; the smoky amber mood and dark contrasty road remain.
- **L4:** Zebra stripes read near white with less orange tint. The clean late-afternoon warmth remains visible on the bus and ground.

Changed only per-level data in `src/data/timeOfDay.ts`: L1 grade shadow to `#bac2d2`, cloud shadow strength to `.35`; L3 highlight to `#ffd0a5`; L4 highlight to `#fff3df`. The L1 authored shadow swatch remains `#6c56ac` to preserve the existing unit-test expectation.
