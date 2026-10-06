# E19 fix-round vision review

Inspected desktop 1600×900, touch portrait 390×844 and touch landscape 844×390 frames: morning, pre-incident, incident, display, store, fight and completion, plus desktop fists, exposed world edge, escape respawn and middle-click crowbar.

- Ground reaches every visible viewport edge. At the exposed town boundary, the horizon backdrop is green terrain rather than light-blue sky. Repeated beyond-edge clicks keep the survivor upright on ground.
- The house no longer has the large flat “Your House” banner across its facade. Its replacement is a small floating sprite above the roof.
- Morning retains real neighbors and one corgi. Incident runners read clearly, with red eyes and telegraphs. The player remains identifiable in all three viewports.
- Fists, kick and chosen bat icons are distinct; actual fist/bat attacks and hit flashes appear. Hardware choice buttons and touch controls remain usable without overlap.
- Death restores the diner escape objective with full health and fists/kick. Completion shows “Milestone 1 complete — thanks for playing” with Restart at all viewports.
- Lower-half sky-colour sampling and per-step ground-height assertions pass along desktop/touch routes. Existing transient hit flashes and cyan VFX remain visible; this fix round does not change their presentation.

All inspected screenshots are deleted after final validation as requested. Numeric evidence remains in summary.json and the performance/pixel reports.
