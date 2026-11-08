# AC09: repair the measured beam-band edges

The original four scanlines reproduced at raw beauty-image gradients of **34.79%, 49.38%, 46.78% and 42.57%** on `d6ff72c1`. Three causes were isolated and repaired:

- Promoted spots used Three's noisy five-tap PCF, unlike the sun's existing fixed weighted filter. Reuse the stable filter with radius 2 for the spot; sun filtering is unchanged.
- The 64-ray light-field visibility mask rounded to one binary ray. This produced the hard bright wedge bordering the shadow. A no-visibility control brought all four scanlines below 20%, isolating that cause. Promoted night pools now feather inward radially and interpolate conservative neighboring visibility values. Each interpolated endpoint is bounded by both adjacent blocker rays, so a formerly occluded point cannot become lit. The weight follows the existing hero promotion fade and is zero in the accepted native captures.
- Cones faded against world Y=0, leaving hard cuts at raised surfaces. They now fade against the copied opaque depth in view-space distance.

The **same four original raw-image bands**, unaltered 25% limit, now measure **19.03%, 10.85%, 17.03%, 10.85% high** and a maximum **19.03% low**. No beams-disabled difference image substitutes for the beauty-image gate. Fresh fixed-mask AC03 regression: pool/outside **35.29× high / 35.34× low**, fence/ambient **0.617× / 0.999×**. AC06 remains within its original limits at both zooms and tiers: **42.50–44.05% darker**, hue **265.27–266.10°**. All these captures have zero browser errors. [Numeric proof](evidence/beam-repair.json).

The lossless before/after images were opened and compared (`test-results/epics/E25/final/beams-before-after.png`): the blue-purple shadow remains visible, stipple and the bright hard wedge are removed, and the pools still stop at the fence. The final report records the accepted L1/L2/L4/L5 matrix separately.

## Wider audit limitation

The audit additionally samples 28 azimuth rays on the actual cone surfaces. Its maximum full-image gradient is **32.83% at pixel (500,338)** on an existing asphalt crack; the beam contribution there is **0.25%**. The crop was opened and identifies the crack, rather than a cone or shadow edge. The literal all-background reading of AC09 therefore still has a counterexample. This repair does **not** claim full AC09 closure or waive that counterexample. The ground artwork and the 25% threshold are unchanged. Resolving that literal scope requires a contract decision about background texture edges; the original reported beam-edge failures themselves are repaired.
