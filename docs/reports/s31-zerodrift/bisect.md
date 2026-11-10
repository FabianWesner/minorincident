# Path-limited bisect transcript

```text
# bad: [fb3dd88c7a09e0b638ba3fa0d5163eea55c8f516] Merge branch 'lane/r29-l9pin': L9 APC auto-reverse wins over heavy-contact stops; no heavy stop when standing; counter-steer reverse; L9 bot reverse fixes
# good: [36db80344706e9115cdbe4e46d7ec6e5a6093d15] docs: lessons from r29-l9pin
git bisect start 'fb3dd88c' '36db8034' '--' 'public/assets/layouts/D-CROSSING.layout.json'
# bad: [e19047c854f4cb17c0bd525a69a2f76b10bfa880] L9: remove only the corner verge hedges/bushes/fences after generation (15 placements; all other ids/positions unchanged) — APC nose no longer catches at (-325,-338) (from r28-tools)
git bisect bad e19047c854f4cb17c0bd525a69a2f76b10bfa880
# first bad commit: [e19047c854f4cb17c0bd525a69a2f76b10bfa880] L9: remove only the corner verge hedges/bushes/fences after generation (15 placements; all other ids/positions unchanged) — APC nose no longer catches at (-325,-338) (from r28-tools)
```
