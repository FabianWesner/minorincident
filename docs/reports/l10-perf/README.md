# L10 performance — batch 26

- Code `90d617a2d` on `lane/l10-perf`, branched from main `edd0288e9`.
- Q-227: all pickup weapons warmed; quiet L10 high corridor: **23.9 ms max**, 3377 frames, zero late held builds/errors, rocket collected and visibly equipped.
- Q-228: quiet cold WebGPU low median of five: **5.2611 s**, main **5.6438 s**; improvement 382.7 ms (6.8%).
- Q-229: L1 afro fit fixed; L4 roof failure not reproduced at the captured tents on either low backend, recorded under the orchestrator's timebox exception.
- Checks: typecheck, lint, `npm test` **104/104**, smoke pass, `scene:gate` **48/48**; test budget unchanged **144/150**.
- [Methods, visual comparisons and evidence](details.md): full quality/figures/prewarm retained; moon image identical and lamp image differs in 0.022% of pixels.
