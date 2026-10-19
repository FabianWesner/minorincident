# Full matrix result

All 1,548 rows measured in 5655.483 seconds; raw 1,531 pass / 17 fail. Twelve explicitly accepted PO #25 fixture baselines leave five unresolved measured reds. Original raw results are retained in the JSON index and log.

| Remaining red | Failure | Capture |
| --- | --- | --- |
| apc-sedan-contact@low-z0.5 | vehicleSilhouette:parked:blocking 0.3 > 0.3 | [sheet](full-matrix-reviewed/apc-sedan-contact@low-z0.5.jpg) |
| seethrough-scripted-convoy@high-z1 | seeThroughCutPixelsOutside 122917 > 0 | [sheet](full-matrix-reviewed/seethrough-scripted-convoy@high-z1.jpg) |
| seethrough-scripted-convoy@high-z1.5 | seeThroughCutPixelsOutside 195856 > 0 | [sheet](full-matrix-reviewed/seethrough-scripted-convoy@high-z1.5.jpg) |
| seethrough-scripted-convoy@low-z1 | seeThroughCutPixelsOutside 122571 > 0 | [sheet](full-matrix-reviewed/seethrough-scripted-convoy@low-z1.jpg) |
| seethrough-scripted-convoy@low-z1.5 | seeThroughCutPixelsOutside 205216 > 0 | [sheet](full-matrix-reviewed/seethrough-scripted-convoy@low-z1.5.jpg) |

[All row results](full-matrix-index.json), [all compact measurements](full-matrix-metrics.jsonl), [approved L4 baselines](accepted-facade-baseline.json).
