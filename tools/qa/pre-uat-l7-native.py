"""Run the L7 before/after threat comparison, final unit suite and acceptance in one remote job.

run.sh supplies native-input from the local frozen Git tree. Each job has a private
copy; source restoration is guaranteed before final checks and at process exit.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

root = Path("test-results/pre-uat-l7/native-final")
inputs = Path("test-results/pre-uat-l7/native-input")
identity = json.loads((inputs / "identity.json").read_text())
root.mkdir(parents=True, exist_ok=True)
original = {name: Path(name).read_bytes() for name in identity["files"]}
for name, content in original.items():
    if hashlib.sha256(content).hexdigest() != identity["files"][name]["finalSha256"]:
        raise RuntimeError(f"Source changed before remote sync: {name}")
receipts = []


def run(name, command, revision):
    env = dict(os.environ, QA_THREAT_REVISION=revision)
    with (root / f"{name}.log").open("w") as log:
        result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, env=env)
    receipts.append({"name": name, "command": command, "exitCode": result.returncode})
    (root / "commands.json").write_text(json.dumps(receipts, indent=2))
    print(name, result.returncode, flush=True)


try:
    for name, entry in identity["files"].items():
        content = (inputs / entry["baselineFile"]).read_bytes()
        if hashlib.sha256(content).hexdigest() != entry["baselineSha256"]:
            raise RuntimeError(f"Baseline payload mismatch: {name}")
        Path(name).write_bytes(content)
    run("threat-before", ["npm", "run", "qa:threat", "--", "--levels", "L7", "--maxWorkers", "2", "--out", str(root / "threat-before")], identity["baseline"])
finally:
    for name, content in original.items():
        Path(name).write_bytes(content)

run("unit-after", ["node", "tools/qa/test-budget.mjs", "--name", "pre-uat-l7-test", "--max-seconds", "150", "--", "npm", "test", "--", "--maxWorkers=4"], identity["final"])
shutil.copy2("test-results/timings/pre-uat-l7-test.json", root / "unit-timing.json")
run("threat-after", ["npm", "run", "qa:threat", "--", "--levels", "L7", "--maxWorkers", "2", "--out", str(root / "threat-after")], identity["final"])
run("accept-after", ["npm", "run", "qa:accept", "--", "--level", "L7", "--skip-browser"], identity["final"])
accept = root / "accept"
(accept / "receipts").mkdir(parents=True, exist_ok=True)
shutil.copy2("docs/reports/fix51-verify/L7.json", accept / "report.json")
for path in Path("docs/reports/fix51-verify/receipts").glob("L7-*.json"):
    shutil.copy2(path, accept / "receipts" / path.name)
(root / "identity.json").write_text(json.dumps(identity, indent=2))
raise SystemExit(int(any(row["exitCode"] for row in receipts)))
