# s206b — Faster dogs and vehicle contact

Status: incomplete. The s206 merge was restored in `2b682b49`, retaining dog run factor 1.65. Alpha throw windups now clear residual locomotion in `a7c2b28f`, consistent with the existing grab-throw behavior.

The L9 high campaign replay previously measured 35.1 cm maximum slide (34.2 cm p95) for Alpha 848 during living-missile windup. It retained running velocity while the heave pose was stationary. With the fix the L9 high maximum is 4.2 cm (3.0 cm p95), and correction checks pass. L9 low passes. L9 high still fails: bus passenger 677 has only two visible airborne samples on release, so its contact is unproven. Its first sampled speed is 172.8 m/s. Investigate the bus release and establish contact coverage without relaxing thresholds.

Typecheck, lint, and focused infected AI and vehicle tests passed after the Alpha change (2 files, 7 tests). Full vehicle campaign and vehicle motion gates, sharded threat audit, and full unit suite remain to be run successfully on the final code. No claim of completion is made.
