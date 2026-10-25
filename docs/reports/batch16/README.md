# Batch16 final gate

Code `287ae99e5`: batch15 + male courier; shared main `fromTexture` / `textureMode`, heroine-only night lift. Restored authored tank hulls after the initial L10 P0; corrected ordinary respawn handling in the diagnostic runner.  
Static, build and **1,262 asset rows / zero errors** pass. [Receipts](static-gates.json).  
Remote **2640 passed / 9 baseline skips**; smoke **6 + 31 passed**; invariants **28 + 12 passed**.  
Both-survivor gear **144/144**, maximum **1.6 cm / 2 cm** on WebGPU and WebGL2. [Matrix](gear-summary.json).  
Paired main/candidate 200-infected A/B **4/4 pass**, maximum candidate horde mesh draws **14**. [Timing](performance-summary.json); [Node runtime](performance-node-runtime.json).  
Campaign **10/10** plus male **3/3**, no skips, **zero P0/P1**; P2 diagnostics female **6**, male **0** retained. [Audit](completion-audit.json); [campaign equivalence](campaign-code-equivalence.json); [initial failure](attempt-1/summary.json).
