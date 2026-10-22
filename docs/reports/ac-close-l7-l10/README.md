# E25 / L7–L10 acceptance closure

Starting runtime: `769d9f8ce` (batch13g), 2026-10-22. The [31-row inventory](evidence/partial-ac-inventory.json) preserves every partial from the sweep. This is an ongoing audit; no pending row is accepted by this report.

## Current evidence

- Typecheck and lint passed on the unchanged starting tree. Remote validation initially failed before dispatch with DNS resolution; the retry is running on `2.28.24.66`. Final command receipts will supersede this progress record.
- Current Blender previews: **94 light-bearing assets /188 day/night renders**, zero missing assets. [Coverage and GLB/script/image SHA256 hashes](evidence/previews-coverage.json). Executed Blender 5.2.2 headless, two threads, using the production `render_preview.py --all-light-assets` path. No asset was modified.
- I opened all four sheets: [buildings 1](lighting-previews-1.jpg), [buildings/interiors 2](lighting-previews-2.jpg), [kits/props 3](lighting-previews-3.jpg), [vehicles 4](lighting-previews-4.jpg). Day renders expose the geometry; night renders show residential windows, clinic/diner/shop signage, gym/cafeteria windows, pharmacy lettering, supermarket cases, tunnel strips, checkpoint beacons, handheld emitters and vehicle lamps. The gym, pharmacy and supermarket exports absent from the old 91-asset set are present. Dark unlit walls remain visible as silhouettes. The basement/metro and tower night thumbnails are especially dark; these previews alone establish neither in-game readability nor light-pool performance. The required production turntable on/off proof is still pending, so E25-AC15 remains partial.
- Opened the retained batch13f L7 horde/rocket and L7/L8 loader comparison sheets. Their tiny hair/hat-edge differences support that dated optimization comparison; they do not supply the complete scored level-pair reviews or the missing input matrix.

## Corrections awaiting execution

- L7 entry/phone fixtures now move their living escort by the same setup displacement as the player. The former isolated corridor setup left the group across the city, correctly failing the production eighteen-metre group requirement. The continuous desktop route remains unchanged; checkpoint restore still compares the complete roster, bus identity and weapons.
- L7 music now reads the current departure cinematic phase when resolving combat intensity. Previously only the later `level.completed` switched it to aftermath, allowing the receding-city shot to retain combat music. A regression retains hostile intensity through waiting/boarding, requires aftermath during departure, then requires combat after a retry. Gameplay is unchanged.
- The unchanged L7 contrast test reproduced its empty horde mask on remote SwiftShader. The normal frame visibly contains the courier through a wrecked truck's reveal disc; the mask is opaque black there (zero courier pixels), while the rocket mask contains 7,610 magenta pixels. ID replacements now preserve custom placement/deformation nodes and the production see-through discard. The same pixel/contrast/identity assertions are rerunning unchanged. Remote software-rendered frames are diagnostic evidence, not native performance or final visual acceptance.

## Proposed rewrites — awaiting PO decision

| AC | Proposed wording | Reason / current disposition |
| --- | --- | --- |
| E25-AC10 SSR subcheck | Keep the existing both-tier wet-streak criterion. Move the high-tier SSR reflected-car silhouette /≥30% ID overlap to the explicitly staged release-extras gate; require it before shipping that SSR option. | The overview §6 places SSR after release closure, while this AC includes it in E25. The implementation and its fixme openly omit SSR. This proposal is not adopted; AC10 stays partial. |
| E31-AC20 device subcheck | Retain the continuous campaign requirement. Track real iOS and Android crossing p50≥30 fps as PO-device acceptance; record model, OS/browser, route, tier, sample duration and p50. Until devices are supplied, retain a separately labelled 390×844 /4×CPU desktop-emulation proxy with the same ≥30 fps p50 target. | No physical phones are available to this lane. Emulation cannot establish real-device performance. The proxy is proposed, not substituted for acceptance; AC20 stays partial. |
| E32-AC31 device subcheck | Retain every native frame/hitch/retention/cap gate. Track real iOS and Android region/assault/mist/pullout p50≥30 fps as PO-device acceptance, with the same device/run metadata; retain a separately labelled 390×844 /4×CPU desktop proxy while awaiting phones. | Same physical-device limitation. Native/desktop evidence will not be described as a physical-device pass; AC31 stays partial. |

No criterion or threshold has been changed, and no epic is marked done while its acceptance evidence is incomplete. Browser work on this Mac is held until 09:15 UTC; subsequent runs use ports 4091/4092, one headless browser through the repository lock, and separate quiet reservations of at most twenty minutes.
