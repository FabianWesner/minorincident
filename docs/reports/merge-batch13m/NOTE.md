# merge-batch13m campaign note

Campaign `npm run playtest -- --levels L1-L10 --quality low --zoom 1.5 --no-skip` was STOPPED after L9 (L10 was running) for the Q-161 fix: L5 regressed with 18 deaths (finished, 698 s wall).

Finished L1-L9, deaths: L1 1, L2 0, L3 0, L4 0, L5 18, L6 0, L7 0, L8 0, L9 0. No P0/P1; 5 P2 (L5 1, L9 3, L10 1 stuck-navigating at the time of the stop). No summary.json was written because the run was killed; runs-campaign.json holds the per-level results.
