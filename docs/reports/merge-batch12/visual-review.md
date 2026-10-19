# Merge batch 12 visual review

Fresh merged production build, headless Mac browsers, real game camera. Images below were opened, not inferred from the numeric gates.

| Capture opened | What is visible |
| --- | --- |
| [L4 WebGL2 sheet](campaign/L4-webgl2-sheet.jpg) | High and low, zoom 1 and 0.5: cream bus roof and crossings, cool slate-blue side panels, violet road shadows. The roof keeps the late-afternoon warmth; the side lettering and bus silhouette remain distinct. At zoom 0.5 the bus fills the frame. Low wheels become polygonal, with the same overall silhouette. |
| [L4 WebGPU sheet](campaign/L4-webgpu-sheet.jpg) | Matches the WebGL2 colours, framing and shadow boundaries closely in all four cells. No blank frame or missing bus body. These are the final tuned L4 values on the merged branch. |
| [Zoo high/z1.5 sheet, WebGL2](functional-proofs/wave3-zoo-routines-webgl2-high-desktop-z1.5/sheet.jpg) | Six figures remain separate through the sampled idle sequence. The green staff stand apart from the blue, cream and red visitor shirts. Caps, bags and the watering can follow their owners; no visible body/prop penetration at this scale. Finger details are too small for a visual-only conclusion; the unchanged clipping gate reports 0. |
| [Zoo close frame, WebGL2](functional-proofs/wave3-zoo-routines-webgl2-high-desktop-z0.5/shot-0000.png) | The visitor's cup remains upright and the keeper's fingers sit around the bag handle. The watering can hangs beside the rightmost staff figure. Feet and long cast shadows meet the tiled ground; the front figure is cropped by the close camera. |
| [L6 Pixel 7 portrait](functional-proofs/qa-w6-phone-gate-webgl2-high-pixel-7-z1/phone-hud.png) | “Block the tunnel” and its two-line instruction sit below the objective and left of the map/pause/home controls. The gate, lit rails and courier remain visible below. The prompt stays well above the touch action buttons. Prompt top 159.86 px versus objective bottom 129.59 px: 30.27 px vertical clearance. |
| [L6 Pixel 7 landscape](functional-proofs/qa-w6-phone-gate-webgl2-high-pixel-7-landscape-z1/phone-hud.png) | Prompt is fully on screen below the objective, centered over the track area, clear of the map and side action controls. Prompt top 137.59 px versus objective bottom 129.59 px: 8 px clearance. The viewport remains playable around it. |
| [Window angles and power state, WebGL2 high](functional-proofs/qa-w6-window-depth-webgl2-high-desktop-z1/parallax-sheet.jpg) | The illuminated front room changes its visible wall divisions between 45° and 60°. With power off, panes and porch light are dark. The scanline measurement records 113.87 px shift and a 9.59× powered/unpowered luminance ratio. |

Additional opened comparisons: [WebGL2 low zoo close frame](functional-proofs/wave3-zoo-routines-webgl2-low-desktop-z0.5/shot-0000.png), [WebGPU high zoo z1.5](functional-proofs/wave3-zoo-routines-webgpu-high-desktop-z1.5/sheet.jpg), [WebGPU low zoo z1.5](functional-proofs/wave3-zoo-routines-webgpu-low-desktop-z1.5/sheet.jpg), and [WebGPU low landscape phone](functional-proofs/qa-w6-phone-gate-webgpu-low-pixel-7-landscape-z1/phone-hud.png). Low zoo models keep the cup and bag-handle shapes with simpler faces and softer shadows. Both WebGPU zoo sheets retain the same staff/visitor separation. The low WebGPU phone has the same prompt placement, legible lettering and clear control areas as the high WebGL2 capture.

The phone fixture renders the real L6 mission, service gate and HUD. Its L5 survivor roster has zero area in this L6 state; no visible roster is fabricated for the proof. The rectangle records include every visible objective/roster/subtitle/story panel, prompt visibility and viewport bounds.

Native timing and the remaining backend/tier results are documented in the validation report; still images alone do not prove frame budgets.

## Final civilian body budget fix

Opened the final [WebGL2 low close sheet](civilian-detail-webgl2/wave3-civilian-lod2@low-z0.5/sheet.jpg), [WebGPU high wide sheet](civilian-detail-webgpu/wave3-civilian-lod2@high-z1.5/sheet.jpg), and [WebGPU low close sheet](civilian-detail-webgpu/wave3-civilian-lod2@low-z0.5/sheet.jpg). Guard helmet, vest, sleeves and boots stay connected; the police cap, jacket and legs retain their silhouettes through the idle sequence. The elderly figure reaches the right edge at close zoom. The two backend close sheets match closely in colour, proportions and pose. No missing torso, floating foot, disconnected sleeve or visible prop intersection; the clipping gates also remain 0.

The [L5 counter image](e18-final/perf-l5-aftermath-low-male.png) is covered by the “Hours later” opening fade. It records the stress scenario and its draw/triangle counters; the dedicated civilian sheets provide the clear uniform/body detail review.

Final source `cf7e830f1`: opened fresh [L4 WebGL2](campaign-final/L4-webgl2-sheet.jpg) and [L4 WebGPU](campaign-final/L4-webgpu-sheet.jpg) sheets after the body-bake fix. Both contain high/low and zoom 1/0.5. They retain the earlier cream roof/crossing, cool bus-side and violet-shadow observations; the backend images match closely. This is the final source used by the full gate.

## Full-gate red sheets

Opened [convoy high/z1.5](full-matrix/seethrough-scripted-convoy@high-z1.5/sheet.jpg): the cream-roofed bus turns through the junction and remains visible through stippled building cutouts. Later frames show the bus beside the roof and building edges. The full-resolution gate detects 3,244 changed pixels outside the allowed cut region; the small sheet alone cannot establish that pixel boundary.

Opened [APC/sedan low/z0.5](full-matrix/apc-sedan-contact@low-z0.5/sheet.jpg) for the silhouette-floor red: a red sedan starts opaque, becomes translucent as the olive APC crosses it, then disappears behind the near-side APC body as that vehicle fills the frame. The sedan roof/window edges remain faintly visible during the overlap. The numeric coverage record is retained with the sheet.
