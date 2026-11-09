"""Collect native danger receipts and render the review report, without running simulations."""
import csv
import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

root = Path("docs/reports/p1-danger")
evidence = root / "evidence"
evidence.mkdir(parents=True, exist_ok=True)


def read(path):
    return json.loads(Path(path).read_text())


def copy(path, destination=None):
    path = Path(path)
    destination = evidence / (destination or path.relative_to("test-results/p1-danger"))
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, destination)


def routes(side):
    rows = {}
    for path in Path(f"test-results/p1-danger/{side}").glob("routes-*.json"):
        data = read(path)
        for row in data["rows"]:
            rows[row["level"], row["policy"]] = row | {"receipt": str(path), "sourceHash": data.get("sourceHash")}
    return rows


baseline, main = routes("batch59") | routes("batch59-matched"), routes("main") | routes("main-matched")
current = routes("final") | routes("restored") | routes("stable")
# Later, targeted measurements take precedence, with their original source
# hashes and paths retained. Never relabel an intermediate receipt as final.
for side in ["l4-design", "l4-design-passive", "l5-l6-composition", "l5-butcher", "l6-stable", "l6-alphas", "l6-fan", "l6-breach", "l6-placement", "l10-shared-brain", "l10-shared-passive", "l10-density"]:
    path = Path(f"test-results/p1-danger/{side}/routes.json")
    if path.exists():
        data = read(path)
        for row in data["rows"]:
            current[row["level"], row["policy"]] = row | {"receipt": str(path), "sourceHash": data.get("sourceHash")}

for side in ["batch59", "main", "batch59-matched", "main-matched"]:
    for path in Path(f"test-results/p1-danger/{side}").glob("*.json"):
        copy(path, Path("routes") / side / path.name)
for row in current.values():
    copy(row["receipt"])
(evidence / "current-row-sources.json").write_text(json.dumps(list(current.values()), indent=2) + "\n")
for folder in ["recovery", "final-gate", "l7-before", "l7-batch59"]:
    for path in Path(f"test-results/p1-danger/{folder}").glob("*"):
        if "progress" not in path.name:
            copy(path)
for side in ["l2-cluster", "l2-approach", "l4-cadence", "l6-density", "l6-butcher", "l6-breach", "l6-fan", "l6-alphas"]:
    path = Path(f"test-results/p1-danger/{side}/routes.json")
    if path.exists():
        copy(path, Path("rejected-trials") / f"{side}.json")

if os.environ.get("P1_FINAL_REPORT") == "1":
    def digest(scopes):
        paths = subprocess.check_output(["git", "ls-files", "-z", "--", *scopes]).decode().split("\0")
        value = hashlib.sha256()
        for name in sorted(set(filter(None, paths))):
            value.update(name.encode()); value.update(b"\0"); value.update(Path(name).read_bytes())
        return value.hexdigest()
    checks = read("test-results/p1-danger/final-gate/checks.json")
    actual = {"sourceHash": digest(["src", "layouts", "public/assets/layouts"]),
              "unitContractHash": digest(["tests/engine", "tests/helpers", "tests/shared", "tests/tools"])}
    assert all(check["status"] == 0 for check in checks["checks"])
    assert all(checks.get(key) == value for key, value in actual.items()), "Gate source must match the final working tree"
    (evidence / "gate-source-match.json").write_text(json.dumps(actual | {"matchesFinalWorkingTree": True}, indent=2) + "\n")

matrix = []
for tier in ["low", "high"]:
    for seed in [1, 2, 3]:
        path = Path(f"test-results/r17-l7diff/p1-design14-{tier}-{seed}.json")
        data = read(path)
        matrix.append(data)
        for item in [path, path.with_name(path.stem + "-trace.json.gz")]:
            copy(item, Path("p1-design14") / item.name)
        s = data["summary"]
        assert s["completed"] and s["deaths"] == 0 and s["boarded"] >= 15
        assert s["longestQuietSeconds"] <= 30 and s["alphaLandedHits"] > 0 and s["simultaneousDirections"] >= 3
        assert len(s["alphas"]) == 5 and all(a["hp"] == 450 for a in s["alphas"])
for path in Path("test-results/r17-l7diff").glob("p1-neglect-final-*"):
    if "progress" not in path.name:
        copy(path, Path("p1-neglect-final") / path.name)
assert all(r["passed"] for r in read("test-results/p1-danger/recovery/native.json")["rows"])

trials = []
for path in Path("test-results/r17-l7diff").glob("p1-design*-*.json"):
    if not re.match(r"p1-design\d+-(low|high)-\d+\.json$", path.name):
        continue
    d = read(path)
    trials.append({key: d["summary"].get(key) for key in ["tag", "tier", "seed", "completed", "seconds", "boarded", "acceptedDamage", "alphaLandedHits", "alphaLandedDamage", "grabs", "longestQuietSeconds"]} | {"sourceHash": d.get("sourceHash")})
trials.sort(key=lambda r: (int(r["tag"][9:]), r["tier"], r["seed"]))
with (evidence / "l7-layout-trials.csv").open("w") as handle:
    writer = csv.DictWriter(handle, fieldnames=list(trials[-1]))
    writer.writeheader()
    writer.writerows(trials)


def cell(row):
    return f'{row["damageHpPerMinute"]:.2f} / {row["landedHitsPerMinute"]:.2f} / {row["deaths"]}'


def delta(a, b):
    return "— (PROD zero)" if not a else f"{(b / a - 1) * 100:+.1f}%"


lines = ["# P1 danger: native comparison and L7 evacuation", "", "**Not accepted: shared ordinary mechanics and L7 checks pass; the global route-damage parity gate remains red.** No push, deploy or browser run was performed.", "", "## Method and limits", "", "PROD is batch 59 `2741447027b1073e6ee581d03a6ee60feaa6e113`; before is main `cab3405c20f3bf4214c99d764d61c526b3e0c525`. Source archives are identified in [snapshots.json](evidence/snapshots.json). Native pressure runs use seed 1 and low population. L4/L6 historical reruns overlay the current early-campaign bot/navigation code on the original simulation snapshots; their rows supersede the original historical-policy comparison, which is retained in evidence. The same no-attack wrapper is used for passive comparison. Both input entry points suppress attacks; passive courier damage is mortal. No health injection is used for these route outcomes.", "", "Cells below are **total courier HP lost/min / landed infected hits/min / deaths** over actual observed simulation time, including retries. Attack starts and misses are not landed hits. Total HP includes environmental damage; infected-only totals, duration, completion and source hashes remain in [the row manifest](evidence/current-row-sources.json). L9's damage is vehicle/environmental: there are zero direct infected courier hits in all three builds, so these numbers do not establish infected-to-vehicle pressure parity. A one-seed whole-route comparison is sensitive to changed encounters, checkpoints and completion duration; it is not a statistical estimate.", "", "Late-campaign native policies are retained with their redesigned builds. Early L1–6 decisions use unchanged bot code, with current Walker helpers; L4/L6 changed decision code is explicitly overlaid for the matched historical runs. L7's revised policy has a body-width corner tolerance, chooses the carried axe sweep when surrounded, and keeps close-combat weapon selection stable between 6 and 9 m. It uses normal input, cover, collision, weapon windups and cooldowns. Therefore the L7 before/after comparison includes both encounter design and a more capable completion policy; it does not isolate layout causally.", ""]
for policy in ["skilled", "passive"]:
    lines += [f"## {policy.title()} native routes", "", "| Level | PROD HP/min / hits/min / deaths | Main before | Restored | HP/min vs PROD | Acceptance gate |", "|---|---:|---:|---:|---:|---|"]
    for i in range(1, 11):
        level = f"L{i}"
        a, b, c = baseline[level, policy], main[level, policy], current[level, policy]
        amount = a["damageHpPerMinute"]
        passed = abs(c["damageHpPerMinute"] - amount) <= amount * .15 + 1e-8
        result = "L7 outcome gate" if i == 7 else "PASS" if passed else "RED: above band" if c["damageHpPerMinute"] > amount else "RED: below band"
        if i in [8, 10]:
            result = "PASS: ≥PROD" if c["damageHpPerMinute"] >= amount else "RED: below PROD"
        if i == 9:
            result = "≥PROD losses; zero infected hits"
        lines.append(f"| {level} | {cell(a)} | {cell(b)} | {cell(c)} | {delta(amount, c['damageHpPerMinute'])} | {result} |")
    lines.append("")
lines += ["The strict band has not been waived. L1–3's skilled damage exceeds it after full moving hits and shared catalog stats. L4's first passive comparison mixed a twenty-minute historical-policy retry loop with a five-minute moving-defence route; the corrected table uses the matched policy on both simulations. The redesigned L8/L10 readings meet the brief's minimum-PROD requirement. L9 has zero direct infected courier hits in every build, so its higher environmental losses are not evidence about infected-to-vehicle damage. These differences are reported, not hidden by a changed measurement window or reduced zombie wounds.", "", "## Standing courier time to kill", "", "A separate controlled fixture uses one runner at 2.3 m, a stationary 100 HP courier and no attacks. It is not native level TTK. In restored code all ten level flags take **8.583 s, 10 landed hits and 100 HP**. PROD takes 8.617 s (L3 8.733 s); main takes about 8.583 s, except L7 **59.883 s / 67 hits**. [Raw fixtures](evidence/routes/batch59/ttk.json).", "", "## Causes and shared-rule corrections", "", "- **Confirmed wound regression:** R14 moving ordinary lunges used a 0.1 damage fraction in L1–5 and extra two-second recovery. L7 then used 0.2 and finally 0.15 fractions, and its completed escort bite fell from 34 to 5 HP. Accepted runner contacts now deal the shared 10 HP, moving or stationary; human completed bites use 34 HP. The 1.6 m prediction bound remains. Lunges approach through their warning/burst and must reach the live body.", "- Removed ordinary per-level damage multipliers (L2 1.8, L3/L4 1.1, L5 1.25), opening wound discounts/grace, extra chase-speed boosts, L3 speed cap/range overrides, L2 melee toughness, and L4 regular-only allied resistance. L6 now spawns the actual catalog role instead of borrowing another role's HP/radius/speed. Riot shield response is shared. L10 initializes the same seeded ordinary-human brain as the other native campaign levels; its previous generic runner speed was 4.2 m/s.", "- Removed shotgun permanence in L5–10, L4 ordinary-weapon permanence on rioters, L2 recovering-pool destruction, level-specific recovery delays and mission repeat-down corpse shortcuts. Ordinary gun/melee downs retain identity and recover after the same seeded 10–20 s at full HP; get-up takes 1.3 s. Strict caps reserve the body's slot. Nurses may accelerate a recoverable down, but cannot resurrect explosive/fire permanent kills. Mounted minigun bullets also down ordinary infected normally.", "- The height guard remains at a shared 0.9 m support-level difference: small kerbs/steps fit, separate floors do not. No evidence justified removing floor checks. The R19 contact/cover systems remain in place; accepted moving-hit, contact-family and navigation contracts pass. Down/recovery updates occur before distant-actor culling, and the actual native recovery audit passes L1–L10.", "- Authored boss mechanics remain explicit exceptions: L7's five Alphas retain 450 HP; zoo bosses, the Mega Alpha and cure sequence retain their story rules. L1's PROD weapon damage remains a weapon rule. No ordinary zombie stat is weakened for escort survival.", "", "## Rockets and the empty street", "", "**Rockets already killed permanently in PROD.** Damage 180, radius 6 m, falloff 0.6 and projectile speed 18 m/s are unchanged. Fire rate fell from 2.4/s to 1.2/s; the 5 m discharge restriction rejects close shots. Neither change increases explosion damage or radius. PROD did also have a late-level shotgun permanence exception; the current binding PO gun-rise rule supersedes it, so it is removed.", "", "| Seed 1 | PROD shots / permanent rocket kills | Main shots / permanent rocket kills | Restored shots / permanent rocket kills |", "|---|---:|---:|---:|", "| low | 74 / 203 | 43 / 150 | 33 / 162 |", "| high | 75 / 403 | 43 / 310 | 36 / 215 |", "", "The measured main route leaves **fewer**, not more, permanent rocket kills than PROD. A street of rocket corpses remaining down is expected. The correction uses staggered arrivals and multiple approach directions, preserving 200/400 ordinary infected and five strong Alphas over L7's authored encounter plan. [PROD receipts](evidence/l7-batch59/), [main receipts](evidence/l7-before/).", "", "## L7 final seed/tier outcomes", "", "The column follows its walked route behind the courier, including during street combat. Four catalog rifle soldiers follow; two pairs cover the road junction and boarding approach. Soldiers rescue active escort grabs and immediate courier/self-defence threats before returning to Alphas. Four standard medkits sit on the route. Spawns obey normal safe/offscreen admission, physical clearance and the existing cap. No soldier/escort invulnerability or zombie damage discount is added.", "", "| Tier | Seed | Courier / deaths | Time s | Boarded / 24 | Courier HP lost | Alpha landed hits / HP to humans | Escort grabs | Longest quiet s |", "|---|---:|---|---:|---:|---:|---:|---:|---:|"]
for data in matrix:
    s = data["summary"]
    lines.append(f'| {s["tier"]} | {s["seed"]} | complete / {s["deaths"]} | {s["seconds"]:.2f} | {s["boarded"]} | {s["acceptedDamage"]:.0f} | {s["alphaLandedHits"]} / {s["alphaLandedDamage"]:.0f} | {s["grabs"]} | {s["longestQuietSeconds"]:.2f} |')
lines += ["", "All six cases pass completion, zero courier deaths, majority boarding, ≤30 s quiet time, at least three simultaneous threat sectors, actual landed Alpha damage and five admitted 450 HP Alphas. Actual attack starts span multiple compass directions; seed 2 low has three directions, the other five cases have four. Recoveries occur during these real routes (28–73 per run), alongside permanent rocket kills. Full receipts and compressed traces are in [p1-design14](evidence/p1-design14/); all failed and successful design iterations are listed in [layout trials](evidence/l7-layout-trials.csv). Queued job labels are not immutable revisions: use the source hash to distinguish/deduplicate snapshots.", "", "### Pacing timeline before / after", "", "Fight beats are accepted positive combat hits within 30 m of the courier, displayed at most once per 10 s; every actual hit contributes to quiet-gap measurement. Radio and weapon pickup are also beats. Objective/checkpoint bookkeeping and attack starts are not used to fill gaps. This is simulation evidence, not visual/browser approval. The before sample already meets the 30 s threshold; the complaint is not represented as a fabricated failing baseline.", "", "| Seed 1 | Main fight-beat times s | Restored fight-beat times s | Quiet max before → after |", "|---|---|---|---|"]
for tier in ["low", "high"]:
    before = read(f"test-results/p1-danger/l7-before/p1-before-{tier}-1.json")
    after = next(d for d in matrix if d["summary"]["tier"] == tier and d["summary"]["seed"] == 1)
    times = lambda d: ", ".join(f'{b["seconds"]:.1f}' for b in d["pacing"]["beats"] if b["kind"] == "fight")
    lines.append(f'| {tier} | {times(before)} | {times(after)} | {before["pacing"]["longestQuietSeconds"]:.2f} → {after["pacing"]["longestQuietSeconds"]:.2f} |')
lines += ["", "Both routes begin with the start radio at 0 s and rocket pickup at 0.23 s. Revised extraction completes at 103.78 s low / 107.10 s high; before was 128.67 / 132.88 s. The timeline is compressed for readability; full beat details, quiet interval endpoints, one-second actor/health/position samples, landed wounds and grabs remain in the receipts/traces.", "", "### Neglect and mortality proof", "", "With the courier's attacks suppressed but soldier cover active, the explicitly **courier-protected observer** loses 22/24 low-tier escorts and 24/24 high-tier escorts within 120 s; neither boards anyone. There are 196/151 grabs and minimum escort HP reaches zero. Courier protection only keeps this observation alive: its zero courier damage/deaths are not survivability evidence. The isolated unopposed bite contract also requires 100 → 66 → 32 → death on the third completed bite. [Neglect receipts](evidence/p1-neglect-final/).", "", "## Validation and reproduction", "", "- `npm run verify -- E07` runs the repository's current per-change gate: typecheck, lint and `npm test` (`test:unit` alias). The full gate passed (106 tests passed, one skipped); [command receipts](evidence/final-gate/checks.json). No browser or performance approval is claimed.", "- Native initialized-world shotgun recovery: **10/10 levels pass**, full HP and same entity identity. [Recovery receipt](evidence/recovery/native.json). The focused engine contract also covers recoverable melee/gun downs, >12 simultaneous downed bodies, shared timers, and permanent explosives in all ten level flags.", "- The report builder asserts the six L7 outcome/pacing/direction/Alpha gates and all ten native recovery results before writing this report. Route parity remains separately red.", "", "```sh", "python3 tools/qa/p1-danger-snapshots.py", 'MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --pull test-results/p1-danger/batch59 -- sh tools/qa/p1-danger-run.sh batch59', 'MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --pull test-results/p1-danger/main -- sh tools/qa/p1-danger-run.sh main', 'MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --pull test-results/p1-danger/stable -- sh tools/qa/p1-danger-run.sh stable', 'MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --pull test-results/r17-l7diff -- node --import tsx/esm tools/qa/r17-l7diff.ts p1-design14 both 1,2,3', 'MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --pull test-results/p1-danger/recovery -- node --import tsx/esm tools/qa/p1-danger-recovery.ts', 'MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --pull test-results/epics/E07 -- bash tools/remote/timing-isolated.sh --all sh tools/qa/p1-danger-verify.sh', "python3 tools/qa/p1-danger-report.py", "```", "", "The synthetic Git commit in the remote verify wrapper contains the actual review source tree and exists only in the disposable runner job, for freshness checks. Historical archives stay uncommitted; the snapshot script recreates them. Source hashes and raw receipt hashes are preserved in evidence. The first historical L7 main receipt has an empty Git-file-list source hash; its archived revision and archive SHA identify that build, and the original receipt is preserved unchanged. Specs and main were not edited.", ""]
restored_ttk = Path("test-results/p1-danger/stable/ttk.json")
if restored_ttk.exists():
    copy(restored_ttk, Path("standing-restored.json"))
    tables = ["| Level | PROD TTK s | Main TTK s | Restored TTK s |", "|---|---:|---:|---:|"]
    receipts = [read("test-results/p1-danger/batch59/ttk.json"), read("test-results/p1-danger/main/ttk.json"), read(restored_ttk)]
    for level in range(1, 11):
        values = [next(r["seconds"] for r in d["rows"] if r["level"] == f"L{level}") for d in receipts]
        tables.append(f"| L{level} | " + " | ".join("not killed" if v is None else f"{v:.3f}" for v in values) + " |")
    tables += ["", "[Restored standing fixture receipt](evidence/standing-restored.json).", ""]
    report = "\n".join(lines).replace("## Causes and shared-rule corrections", "\n".join(tables) + "\n## Causes and shared-rule corrections")
else:
    report = "\n".join(lines)
remaining = """## Remaining acceptance work

The goal is not met. The strict L1–L6 band still fails for L1 skilled/passive, L2 skilled/passive, L3 skilled, L4 passive and L6 passive. The low results are L2 passive (−19.5%) and L4 passive (−17.3%); the other failures are above the band. The requested PO clarification about the upper bound versus minimum-PROD pressure has not been answered. It would not by itself clear the two below-band cases.

Rejected experiments are retained in [trial receipts](evidence/rejected-trials/): increasing L2's bridge cluster and advancing one ambush approach reduced passive pressure; faster L4 waves also reduced pressure. Those changes are absent from the final source. L6's added Alpha/butcher fronts were unnecessary once the matched-policy baseline was available; the final change retains the original two-member hatch quotas and spreads their positions.

Further acceptance work needs encounter/route balancing with shared zombie stats, plus a decision on the strict upper band. Standing TTK here is a controlled shared-runner fixture, not a native encounter/phase TTK audit. The report does not claim browser appearance or GPU performance approval.

"""
report = report.replace("## Validation and reproduction", remaining + "## Validation and reproduction")
(root / "README.md").write_text(report)
files = {str(path.relative_to(evidence)): hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(evidence.rglob("*")) if path.is_file() and path.name != "sha256.json"}
(evidence / "sha256.json").write_text(json.dumps(files, indent=2) + "\n")
print(f"Wrote report with {len(current)} native route rows, {len(matrix)} L7 cases and {len(files)} evidence files; global parity not accepted.")
