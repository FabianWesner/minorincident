"""Generate the complete acceptance tracker from the unchanged criterion IDs."""
import collections
import json
import re
from pathlib import Path

root = Path('docs/reports/batch51-qa')
source = Path('docs/qa/level-acceptance.md')
observations_path = root / 'criteria-observations.json'
observations = json.loads(observations_path.read_text()) if observations_path.exists() else {}
global_plans = {
 'G-01': 'Run tools/qa/release-ab-load.mjs through tools/perf/quiet-run.sh for all ten levels, low/high, WebGPU and WebGL2; measure real click to playable, retaining the worst sample.',
 'G-02': 'Run tools/qa/release-ab-handover.mjs on all nine real campaign handovers; retain actual outgoing save, transition start and first playable frame, requiring <=6 s each.',
 'G-03': 'Run tools/playtest/session.ts without photo captures for the first ten active seconds at each level/quality, then every first weapon pickup/equip/shot; inspect its *-frames.json playable intervals.',
 'G-04': 'Record RAF intervals and native event timestamps during every objective, blast, breach, power-off, crash and gate close using tools/playtest/frames.ts; apply the PO quantisation clarification and name each >=66 ms spike.',
 'G-05': 'Run npm run test:perf in an exclusive quiet slot at each level peak, low/high; retain renderer calls/triangles, sim p95, heap and live population alongside frame p95.',
 'G-06': 'Review real-input captures for every level at low/high and zoom 0.5/1.5, including every used vehicle and critical occluders; inspect full-size crops of suspected defects.',
 'G-07': 'Run tools/playtest/session.ts through fences/walls/hordes/corpses and tools/qa/visual-p1-captures.ts --phase after on current source; review the full-size courier silhouette at both qualities/zooms.',
 'G-08': 'Add a read-only per-tick marker-position/HUD-distance observer to tools/playtest/session.ts for every step; compare world marker and arrow with the authored fixed action/destination anchor, including offscreen targets.',
 'G-09': 'Use tools/playtest/session.ts plus a read-only step-start observer: record marker visibility within two seconds at zoom 1 and 1.5 for every objective, including pickups behind props.',
 'G-10': 'Use tools/playtest/session.ts to walk through every ground/shelf pickup without E or stopping; record pickup event, distance and physical key trace at the <=1.5/2.2 m crossing.',
 'G-11': 'Use tools/playtest/session.ts through survivor weapon collection; observe ring visibility and entity generations before/after collection and after revisiting each location.',
 'G-12': 'Run tools/qa/l6-retreat-bars.ts and count eligible on-screen follower IDs against HealthBars.snapshot at group sizes 1,5,24,29,35, including healthy/injured and overlapping poses; require a visible bar for every eligible follower.',
 'G-13': 'Inspect every followerSpeeds record in test-results/qa-threat/audit.json, not only the gate named cohorts; supplement with resolved-motion samples from real-input escorts and stationary-far waiting bounds.',
 'G-14': 'Add a read-only permanent-corpse ID/lifetime ledger to the full real-input runs; revisit corpses at level end and review pile height, floating bodies and stretched limbs.',
 'G-15': 'Use tools/playtest/session.ts physical WASD/mouse traces and moving/aiming frame bursts; exercise independent move/aim, melee, firearm and rocket direction, plus a ground click without movement keys.',
 'G-16': 'Compare the weaponsStart and pickup ledgers from progressed-save real-input L1-L10 runs with the story loadout; explicitly check axe-only L10 after the real L9 crash.',
 'G-17': 'Capture moving low-quality frame strips for every infected body/variant in wander/chase, and inspect planted feet/legs plus drawn hip-to-head angle; include all seven L10 runner variants and compare with 42 degrees.',
 'G-18': 'Extend the existing contact probes in tests/engine/l4-contact.test.ts and native threat routes across all scripted archetypes/levels; assert real attack windups on player, followers and companion perception targets.',
 'G-19': 'Observe corgi health/targeting/collision and bar events throughout real-input L1-L10; capture actual door/shutter closures and vehicle entry, including the final corgi position.',
 'G-20': 'Use tools/playtest/session.ts and a read-only final-objective/transition tick ledger on every level; verify five live invulnerable seconds when action continues.',
 'G-21': 'Run mortal checkpoint death/retry exercises for every later checkpoint using tools/playtest/session.ts; compare follower/pickup/gate snapshots, inventory and restored location before/after death.',
 'G-22': 'Run npm run qa:threat at low and high; retain each actual announced-cohort ledger, first player attack and reachable count, including a deliberately broken fixture proof.',
 'G-23': 'Run tools/qa/visual-p1-bounds.ts and wrong-way real-input traversals; review visible barriers, dead ends and map edges at both qualities/zooms, with a screenshot-only route-clarity run.',
 'G-24': 'Run Scene Lab current-source Alpha/zoo-species fixtures through healthy-near, healthy-far, hurt and dead states; inspect world bars and normal animals at low/high.',
 'G-25': 'Finish every level by real input with tools/playtest/session.ts, retaining all pageerror and console-error records through the actual ending; capped/unfinished runs cannot prove this row.',
 'G-26': 'Run current-source character/accessory/held-prop and live-seat Scene Lab matrices for every adult body and routine, comparing actual heights with the heroine; review full-size images.',
 'G-27': 'Review current real-input sheets for all ten levels and answer glitches, stunning score/missing elements, and boring/harmless/babysitting; compare with actual attack/damage and escort evidence.'
}

special_plans = {
 'L1-03': 'Record a real-input depot handover burst through clerk return and door closure with tools/playtest/session.ts; require continuous actor identity and visible handover.',
 'L1-04': 'Record a real-input laboratory handover burst through technician return, comparing the actual sequence with the PROD build using tools/qa/ab-tour.ts stops.',
 'L1-07': 'Use the existing native L1 observer with a stationary remote courier for 240 seconds; log bite-derived births at +120/+240 s. The travelling complete/passive route does not test this condition.',
 'L1-11': 'Run tools/playtest/session.ts once with the bicycle and once walking, retaining real mount/dismount input, delivery time and collision/pose captures.',
 'L1-16': 'Run tools/playtest/live.ts in screenshot-only mode from a fresh L1 save with no hidden navigation assists; time every lost interval and review its route decisions.',
 'L2-02': 'Capture the axe rack at both zooms, then run a real-input L2 without taking the axe through completion; the ordinary axe run cannot prove optionality.',
 'L2-07': 'Extend the native L2 passive probe to stand at the open doors for at least 15 seconds; record actual attack windups, >=4/min and >=90% reach. The current 9.55-second travelling window is insufficient.',
 'L2-08': 'Hold a stationary native observer at the opened doors for 120 seconds; census at +60/+120 s and record firefighter turns/attacks with persistent IDs.',
 'L2-09': 'Run a mortal real-input axe courier within 15 m of the doors for 120 seconds, logging live counts at +10/+90 s and a real death.',
 'L2-10': 'Extend the existing axe fixture in tools/qa/release-ab-weapons.mjs: compare 1-2 versus >=3 in-range infected, native hit counts and resolved push distance.',
 'L2-14': 'Run separate real-input cluster escapes via side path and car alarm, counting the authored 12-16 cluster members and player kills; each route must work with <=50% killed.',
 'L3-01': 'Record real armory pickup time and event location, fire 600 shots while observing UI, and check two native handgun hits against a 40 HP infected fixture.',
 'L3-02': 'Run the native cohort observer at both qualities, checking admitted counts, five directions/police share, <=18 s stream spans and >=25% on screen within two seconds.',
 'L3-04': 'Run idle native L3 through fallback; retain which first-of condition fired and a same-ID uniformed officer conversion.',
 'L3-06': 'Use the L3 real-input threat observer to retain all squad IDs, formation distance, segment counts and bite/kill/separation losses through army arrival.',
 'L3-08': 'Add a native per-segment population census and local-live median to tools/qa/threat-audit.ts; verify 250/625/1000 +/-20% and both quality caps.',
 'L3-10': 'Hold the native courier 20 seconds behind each progress line, then advance; retain offscreen source distances, admission counts per ten seconds and shutdown behavior.',
 'L3-11': 'Combine competent real-input attack rate with a per-street medkit census and a newbie policy health trace; all three clauses must be covered.',
 'L3-12': 'Run screenshot-only tools/playtest/live.ts to the army without route steering; log fixed ring, real distance and route decisions, supplementing the scripted marker observer.',
 'L4-01': 'Record actual real-input convoy start/stop/control ticks, five vehicle IDs and bus parking bounds at the plaza.',
 'L4-03': 'Add a read-only pickup/alarm/attack tick ledger to the real-input quartermaster pickup, including the actual klaxon event.',
 'L4-06': 'Run the existing high-tier hold census in npm run qa:threat; measure actual first physical breach on the level clock and sustained living plaza population through line break.',
 'L4-09': 'Retain native line/nest/armour/fallback event ticks in a full L4 hold; verify opening-fight reveals do not take over the courier-follow camera.',
 'L4-11': 'Run the existing frontal/flank riot fixtures in tools/qa/release-ab-weapons.mjs, including point blank, visible recoil/HP and an ordinary full-HP mortal courier firing continuously.',
 'L4-13': 'Complete real-input cellar escape; census route contacts, forty-second gap and each three-per-nine-second pursuit group with a native event observer.',
 'L4-16': 'Record actual cellar bar timing, entrant IDs/corgi position, battle-audio event duration and L5 same-basement handover.',
 'L5-01': 'Use the ordinary initial shotgun approach, plus native regular/Alpha damage fixtures; record auto-pickup distance and shell-to-incapacitation timings.',
 'L5-07': 'Run tools/playtest/live.ts screenshot-only with muted audio, relying only on captions and visible direction cues until >=4/5 are found; a static authored-map tour does not prove this row.',
 'L5-09': 'Run separate native evade-only and complete policies, recording unprotected-survivor first bite latency and rescue counts; do not infer protection from a single competent route.',
 'L5-12': 'Run tools/playtest/session.ts with PLAYTEST_METRO_AUDIT=1 through actual shutter closure; review 24 occupants, every follower/corgi crossing and end-camera continuity.',
 'L5-13': 'Use the existing mission fixture with every survivor lost, then finish by real input and check the rescued-count result; do not add a test case.',
 'L6-03': 'Retain the native first-breach clock, bang event >=1.5 s earlier, cohort count and actual shelter-floor arrivals; include a real-input frame burst.',
 'L6-04': 'Retain second-breach clock/access counts, power/light change tick and abandon reason/timestamp; count >=10 real arrivals, not pending demand.',
 'L6-07': 'Run a competent mortal real-input retreat with actual player/group attack and damage ledgers, plus both-tier peak infected census; a forced-death run does not qualify the damage band.',
 'L6-09': 'Physically close each of the three gates, time its delay effect and verify emergency release after >12 s isolation using a read-only event observer.',
 'L6-11': 'Compare separate evade-only and complete native/real-input L6 runs with balanced survivors-in/out/lost ledgers.',
 'L6-12': 'Run tools/playtest/session.ts with PLAYTEST_L6_DIE_ONCE=1 and no skips, through the actual night exit; compare restored snapshot movement, Northgate collision, caption and balanced result counts.',
 'L6-13': 'Run an ordinary mortal fists-only L6 through completion with tools/playtest/session.ts, no objective skips or weapon pickup substitutions.',
 'L6-14': 'Measure actual courier/background luminance contrast in underground captures at both quality tiers, and identify the brightest infected-eye pixels; a subjective readability score is insufficient.',
 'L7-01': 'Record real launcher approach/auto-pickup and first physical mouse shot with frames.ts; measure pickup distance and actual frame intervals without prewarming via a photo.',
 'L7-03': 'Use actual clicked-ground rocket fixtures in tools/qa/release-ab-mouse.mjs and tools/qa/release-ab-effects.mjs; measure cadence, 20/24 kills, three-metre gap and point-blank luminance.',
 'L7-06': 'Physically explore both connected corridor routes and wrong-way edges, then review a screenshot-only route-clarity run and current-source bounds sweep.',
 'L7-08': 'Census the initially blocked final corridor at both qualities, then record a physical rocket gap and one actual survivor crossing it.',
 'L7-10': 'Record every passenger entry tick and living follower ID through actual departure; separately hold a boarding obstruction for 20 seconds and retain the recovery.',
 'L7-11': 'Capture an uninterrupted real-input end cinematic with timed bus displacement and skyline frames, checking lit truck/gore and absence of map edge.',
 'L8-01': 'Run the real L7-to-L8 handover from the carried campaign save; compare roster IDs, HP, rack and selected weapon, and census L8 pickups.',
 'L8-02': 'Use the real-input threat/handover observer for 60 active seconds: require no objective text, tracker, world/HUD/minimap marker or scripted attack.',
 'L8-04': 'Run the native entrance ledger at low/high and current-source entrance frame strips: >=3 outlets, spacing, <=1-second opening spread, 6/3 admitted per outlet and no pop-in.',
 'L8-05': 'Track same-ID/species animal turns at 2.5-3.5 seconds, all four victim classes, Alpha admissions and concurrent caps through a full native/real-input outbreak.',
 'L8-07': 'Physically walk both >=2.5 m escape paths from every enclosure and log the fixed APC marker, including a screenshot-only route review.',
 'L8-09': 'Record actual boarding of every living follower, late/missing-member guidance and APC weapon inventory through real-input departure.',
 'L8-10': 'Time the actual saved APC L8-to-L9 handover with tools/qa/release-ab-handover.mjs; compare durability and vehicle identity, requiring <=6 seconds.',
 'L9-02': 'Census every authored route group and physically drive an alternate detour >=20 m around each; retain six/eight-member counts and shortcut Alphas.',
 'L9-03': 'Run tools/playtest/play.ts separately with --l9-route road, countryside and dry-shortcut, enabling PLAYTEST_THREAT_AUDIT=1; compute maximum uninterrupted on-camera enemy absence while driving.',
 'L9-04': 'Compare controlled collision-onset and stopped-surrounded attacks in native vehicle fixtures, then matched safe/shortcut real-input drives with durability ledgers.',
 'L9-05': 'Drive a real-input APC reduced to zero HP before the bridge; measure 60% speed and smoke while retaining steering/control, then continue to the forced crash.',
 'L9-07': 'Record one uninterrupted crash from full HP and one from zero HP, with vehicle-part visibility and wreck objective event order.',
 'L9-08': 'Perform the real L9-to-L10 handover and record on-foot state, exactly axe, ordinary health and the corgi.',
 'L9-09': 'Run every driving route while measuring terrain seam positions, live detailed-chunk counts and uninterrupted physical input across streaming boundaries.',
 'L10-01': 'Census the entire first sixty active seconds of a real-input/native L10 at both tiers, retaining peak regular count, group sizes and absence of dogs/Alphas.',
 'L10-02': 'Record actual roar/impact introduction by two minutes, Mega distance and its native reachable route from a fresh crash start.',
 'L10-03': 'Run the native census through all seven regions at low/high, recording concurrent local counts and dogs/Alphas rather than total level spawn calls.',
 'L10-04': 'Hold a native stationary passive courier and run the competent route in every region; measure >=90% reach and per-region actual attacks, not only the finale hold.',
 'L10-05': 'Record named weapon approach pickups, snapshot timing and spawn calls before/after each pickup in the real-input regional route.',
 'L10-07': 'Track the pursuing Mega continuously with native position/event ledgers: speed ratio, no-LOS pursuit, reachable path, no teleport and 20-35-second audio cadence; review minimap presentation.',
 'L10-09': 'Record the actual research subtitles and visible canister, compare movement speed, then die after collection and verify the checkpoint restores cure state.',
 'L10-10': 'Record the full native charge tick counter while inside/outside radius and alive/dead; run the existing minigun heat fixture for fire rate and lock/unlock thresholds.',
 'L10-11': 'Run both-quality native assault census and passive hold, recording local peak, reach, >=8 attacks/min and actual Mega arena-arrival time.',
 'L10-12': 'Use native direct-hit rocket and conventional/minigun fixtures for Mega HP thresholds, then real-input motion/death captures and frame probe within/outside twelve metres.',
 'L10-13': 'Exercise each missing release prerequisite in the existing mission fixture, then release by physical input only when all three are satisfied at the console.',
 'L10-14': 'Record the complete real-input epilogue with mist-position/event ledger, species kill latency, healthy/corgi immunity, control duration, camera pullback and actual title/credits.',
 'L10-15': 'Force ordinary mortal deaths at every regional checkpoint and after cure/boss progress, comparing location, loadout, cure and boss snapshot with the saved checkpoint.'
}

rows = []
for line in source.read_text().splitlines():
    match = re.match(r'^\| (G-\d{2}|L\d+-\d{2}) \|', line)
    if not match:
        continue
    ident = match[1]
    cells = [c.strip() for c in line.split('|')]
    level = 'global' if ident.startswith('G-') else ident.split('-')[0]
    criterion = cells[2 if level == 'global' else 3]
    tags = cells[-2]
    if ident in global_plans:
        plan = global_plans[ident]
    elif ident in special_plans:
        plan = special_plans[ident]
    elif 'O' in tags or 'L' in tags:
        plan = f'Run tools/playtest/session.ts on {level} from its progressed save with physical WASD/mouse, low/high and zoom 0.5/1.5; record a frame burst and read-only timing/count ledger for the complete row, then review the frames. Required: ' + criterion.split('PO:')[0].replace('**', '')
    else:
        plan = f'Extend the existing {level} observer/fixture in tools/qa/threat-audit.ts or tools/playtest/session.ts to assert every timing/count/state clause below, at low/high; execute the native probe and real-input route and retain the event ledger. Required: ' + criterion.split('PO:')[0].replace('**', '')
    row = dict(id=ident, level=level, status='NOT CHECKED', value='Not measured by this batch run.', evidence=[], method='NEXT: ' + plan)
    row.update(observations.get(ident, {}))
    if row['status'] == 'NOT CHECKED' and 'NEXT:' not in row['method']:
        row['method'] += ' NEXT: ' + plan
    assert row['status'] in ('PASS', 'FAIL', 'NOT CHECKED')
    rows.append(row)

assert len(rows) == 169, len(rows)
assert len({r['id'] for r in rows}) == 169
assert set(observations) <= {r['id'] for r in rows}
counter = collections.Counter(r['status'] for r in rows)
counts = {status:counter[status] for status in ['PASS','FAIL','NOT CHECKED']}
result = dict(source=str(source), sourceRevision='99516473d', policy='NO-GO until every S/L/O criterion passes; compound rows require all clauses.', counts=counts, rows=rows)
(root / 'criteria.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')

def clean(value):
    return str(value).replace('|', '\\|').replace('\n', ' ')

tables = []
for level in ['global'] + [f'L{i}' for i in range(1, 11)]:
    tables += [f'### {level}', '', '| ID | Status | Measured value / gap | Evidence | How checked / next required run |', '|---|---|---|---|---|']
    for row in (r for r in rows if r['level'] == level):
        evidence = ', '.join(row['evidence']) or '—'
        tables.append('| ' + ' | '.join(clean(row[k]) for k in ['id', 'status', 'value']) + ' | ' + clean(evidence) + ' | ' + clean(row['method']) + ' |')
    tables.append('')
table = '\n'.join(tables)
(root / 'criteria-table.md').write_text(table)
tracker = '# Acceptance status — batch 51\n\n**NO-GO.** PO decision: no PROD until every S/L/O criterion passes. NOT CHECKED is not a pass; follow each row’s NEXT run. The criterion definitions remain in [level-acceptance.md](level-acceptance.md).\n\nMachine source: [criteria.json](../reports/batch51-qa/criteria.json). QA verdict and scope: [batch 51 report](../reports/batch51-qa/README.md).\n\nStatus counts: ' + ', '.join(f'{k}: {v}' for k, v in counts.items()) + '.\n\n' + table
Path('docs/qa/acceptance-status.md').write_text(tracker)
readme = root / 'README.md'
body = readme.read_text()
marker = '<!-- CRITERIA START -->'
if marker in body:
    body = body.split(marker)[0]
readme.write_text(body.rstrip() + '\n\n' + marker + '\n## Complete criteria tracker\n\n' + ', '.join(f'{k}: {v}' for k, v in counts.items()) + '. All 169 source rows are represented.\n\n' + table + '\n<!-- CRITERIA END -->\n')
print(json.dumps(counts), '169/169 criteria, README and tracker generated')
