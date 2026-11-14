# s111-l4north — LOW breach spearhead capacity restored

## Result

The L4 north breach cohort now admits all three members. The full all-level threat audit reports only the existing L6 breach2 first-attack flag. L4-06 passes on HIGH and LOW.

| Tier | First breach, level clock | Alive at first breach | Minimum plaza alive from alarm +45 s through line break |
| --- | ---: | ---: | ---: |
| HIGH | 50.08 s | 72 | 42 |
| LOW | 50.08 s | 67 | 55 |

The passive LOW north breach opened at 148.87 s, admitted 3 members, and had its first attack at +11.27 s. Its cohort flag list is empty.

## Root cause and fix

At the LOW infected cap, the breach retry could not retain a reserved slot: LOW reservation accounting only reserves capacity that is already free. The fallback retirement also treated every dynamically emerged horde member as an authored arrival, leaving almost no eligible off-screen population to yield a slot. The north breach therefore admitted one member and remained starved despite its retry path.

The L4 director now frees one LOW infected slot for a delayed breach spearhead and permits distant, off-screen, non-engaged ordinary horde members to yield capacity. Alphas and authored collapse encounters remain protected. The broader retirement applies only to LOW; HIGH keeps its prior retirement policy and sustains its plaza minimum. Reserved arrivals also consume the matching reservation in the character-cap guard.

No infected or weapon stats, per-level zombie stats, recovery timers, corpse persistence, audit thresholds, flag policies, or `waves.ts` rules were changed.

## Full all-level audit

Command: `node --import tsx/esm tools/qa/threat-audit.ts`

Audited source was committed as `9610abbbfbe0d648b4539e35d370f706cba328b9`; the audit ran against the identical working-tree source before commit. Audit duration: 302.1 s. The full flag list is:

- `L6/early-close/wave/l6.breach2:WAVE_FIRST_ATTACK_OVER_20_SECONDS`

The L4 north flag is absent. Full receipt: `test-results/qa-threat/audit.json`; rendered audit: `test-results/qa-threat/README.md`.

## Validation

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused L4 audit — HIGH/LOW criteria passed; LOW north cohort admitted 3.
- Remote unit suite (`sh tools/remote/run.sh "$PWD" -- npm test`) — passed, exit 0: manifest 150/150; 27 files passed, 106 tests passed / 1 skipped; 222.1 s against the 240 s budget. Runner job `/srv/mi/jobs/s111-l4north-a83a52-6227-1794666872`. The earlier launch attempt had no healthy runner; the unchanged suite ran when a runner became available.

## Browser QA needed

No browser QA was run. Review HIGH and LOW breach presentation and horde behavior in browser after the commit lands.

## Delivery status

Committed as `9610abbbfbe0d648b4539e35d370f706cba328b9`. The required remote unit suite passed. All coding-lane checks are complete. No push, deploy, or main movement was performed.
