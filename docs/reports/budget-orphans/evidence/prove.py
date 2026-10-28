#!/usr/bin/env python3
"""Reproduce the old leak, run the six requested gates, and retain ps evidence.

Run from this checkout: python3 docs/reports/budget-orphans/evidence/prove.py
Only processes started by this script are signalled. Ports 4327/4331-4333
are private to this proof; the pool still reserves the shared browser locks.
"""
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
os.chdir(ROOT)
SUMMARY = {"sourceCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()}


def processes():
    rows = subprocess.check_output(["ps", "-axo", "pid=,ppid=,pgid=,etime=,%cpu=,command="], text=True)
    result = []
    for row in rows.splitlines():
        fields = row.split(None, 5)
        if len(fields) == 6:
            result.append(dict(pid=int(fields[0]), ppid=int(fields[1]), pgid=int(fields[2]),
                               elapsed=fields[3], cpu=float(fields[4]), command=fields[5]))
    return result


def matching():
    # Scheduler summaries quote old commands; only actual executables count.
    return [p for p in processes() if
            re.match(r"^(?:(?:/\S*/)?(?:node|nodejs|npx)(?: |$)|npm exec )", p["command"]) and
            ("vitest" in p["command"] or re.search(r"(?:^|[/ ])npx(?: |$)", p["command"]) or p["command"].startswith("npm exec "))]


def snapshot(label):
    rows = matching()
    with (OUT / "ps.jsonl").open("a") as log:
        log.write(json.dumps(dict(at=time.time(), label=label, processes=rows)) + "\n")
    return rows


def absent(pid):
    return all(p["pid"] != pid for p in processes())


def wait_absent(pid):
    for _ in range(40):
        if absent(pid):
            return
        time.sleep(.05)
    raise AssertionError(f"PID {pid} still present")


def reproduce():
    with tempfile.TemporaryDirectory(prefix="mi-budget-fixture-proof-", dir="/private/tmp") as directory:
        root = Path(directory)
        old = root / "old-watchdog.py"
        old.write_bytes(subprocess.check_output(["git", "show", "4fcba4c1e:tools/browser-job.py"]))
        npx = root / "npx"
        npx.write_text("""const fs = require('node:fs');
const { spawn } = require('node:child_process');
if (process.argv.includes('--orphan')) {
  process.on('SIGTERM', () => {});
  fs.writeFileSync(process.env.PROOF_PID_FILE, String(process.pid));
  setInterval(() => {}, 1000);
} else {
  const child = spawn(process.execPath, [__filename, 'vitest', 'list', '--orphan'], { stdio: 'ignore' });
  child.unref();
  const ready = setInterval(() => { if (fs.existsSync(process.env.PROOF_PID_FILE)) clearInterval(ready); }, 10);
}
""")
        records = []
        for label, watchdog in [("before", old), ("after", ROOT / "tools/browser-job.py")]:
            pid_file = root / (label + ".pid")
            env = dict(os.environ, PROOF_PID_FILE=str(pid_file))
            try:
                started = time.monotonic()
                result = subprocess.run(["python3", str(watchdog), "--seconds", "10", "--", "node", str(npx), "vitest", "list"],
                                        env=env, capture_output=True, text=True, timeout=20)
                assert result.returncode == 0, result.stderr
                pid = int(pid_file.read_text())
                rows = snapshot("reproduction-" + label)
                owned = [p for p in rows if p["pid"] == pid]
                record = dict(label=label, wrapperExit=result.returncode, seconds=time.monotonic() - started,
                              pid=pid, remaining=owned)
                if label == "before":
                    assert owned and owned[0]["ppid"] == 1, owned
                    os.kill(pid, signal.SIGTERM)
                    time.sleep(.2)
                    record["ignoredTerm"] = not absent(pid)
                    assert record["ignoredTerm"]
                    os.kill(pid, signal.SIGKILL)
                wait_absent(pid)
                records.append(record)
            finally:
                if pid_file.exists():
                    pid = int(pid_file.read_text())
                    for p in processes():
                        if p["pid"] == pid and str(root) in p["command"]:
                            os.kill(pid, signal.SIGKILL)
        SUMMARY["reproduction"] = records
    print("Old watchdog leak reproduced (PPID 1, TERM ignored); fixed watchdog leaves no PID", flush=True)


def run_gates(env):
    results = SUMMARY.get('runs', [])
    completed = {r['label'] for r in results if r['exitCode'] == 0 and not r['newLeftovers']}
    for kind, command in [("test", ["npm", "test"]), ("smoke", ["npm", "run", "test:smoke"])]:
        for index in range(1, 4):
            label = f"{kind}-{index}"
            if label in completed:
                continue
            baseline = {p["pid"] for p in snapshot(label + "-before")}
            run_env = dict(env, E2E_PORT=str(4330 + index), SCENE_PORT=str(4430 + index))
            print(f"Starting {label}", flush=True)
            started = time.monotonic()
            with (OUT / (label + ".log")).open("w") as log:
                result = subprocess.run(command, env=run_env, stdout=log, stderr=subprocess.STDOUT, timeout=270)
            rows = snapshot(label + "-after")
            leftovers = [p for p in rows if p["pid"] not in baseline]
            record = dict(label=label, command=command, exitCode=result.returncode,
                          seconds=time.monotonic() - started, ps=rows, newLeftovers=leftovers)
            results.append(record)
            SUMMARY["runs"] = results
            (OUT / "summary.json").write_text(json.dumps(SUMMARY, indent=2) + "\n")
            print(f"Finished {label}: exit={result.returncode}; new Vitest/npx processes={len(leftovers)}", flush=True)
            assert result.returncode == 0, f"{label}: inspect {OUT / (label + '.log')}"
            assert not leftovers, leftovers


def quiet_proof(env):
    with tempfile.TemporaryDirectory(prefix="mi-budget-quiet-", dir="/private/tmp") as directory:
        fixture = Path(directory) / "npx"
        pid_file = Path(directory) / "pid"
        fixture.write_text("process.on('SIGTERM',()=>{}); require('node:fs').writeFileSync(process.argv[2],String(process.pid));setInterval(()=>{},1000);")
        blocker = subprocess.Popen(["python3", "tools/browser-job.py", "--seconds", "30", "--", "node", str(fixture), str(pid_file), "vitest", "list"])
        try:
            for _ in range(100):
                if pid_file.exists(): break
                time.sleep(.05)
            pid = int(pid_file.read_text())
            started = time.monotonic()
            cap = subprocess.run(["sh", "tools/perf/quiet-run.sh", "true"], env=dict(env, E2E_ADMISSION_TIMEOUT_SECONDS="3"), capture_output=True, text=True, timeout=20)
            (OUT / "quiet-cap.log").write_text(cap.stdout + cap.stderr)
            assert cap.returncode == 75, cap
            assert str(pid) in cap.stderr and "3 seconds" in cap.stderr, cap.stderr
            SUMMARY["quietCap"] = dict(exitCode=cap.returncode, seconds=time.monotonic() - started, blockerPid=pid)
        finally:
            blocker.terminate()
            blocker.wait(timeout=12)
        wait_absent(pid)
    print("Quiet admission logged the owned blocker and stopped at its 3-second cap", flush=True)
    started = time.monotonic()
    quiet = subprocess.run(["sh", "tools/perf/quiet-run.sh", "node", "-e", "console.log('budget-orphans quiet command executed')"],
                           env=dict(env, E2E_ADMISSION_TIMEOUT_SECONDS="240", PERF_CONDITIONS_LOG=str(OUT / "quiet-conditions.jsonl")),
                           capture_output=True, text=True, timeout=260)
    (OUT / "quiet-success.log").write_text(quiet.stdout + quiet.stderr)
    assert quiet.returncode == 0 and "budget-orphans quiet command executed" in quiet.stdout, quiet
    SUMMARY["quietSuccess"] = dict(exitCode=quiet.returncode, seconds=time.monotonic() - started)
    snapshot("quiet-after")
    print("Quiet-run completed its command through normal pool exclusive admission", flush=True)


def main():
    if '--resume' in sys.argv:
        previous = json.loads((OUT / 'summary.json').read_text())
        assert previous['sourceCommit'] == SUMMARY['sourceCommit'], 'Source changed; gather fresh proof'
        SUMMARY.update(previous)
    else:
        (OUT / "ps.jsonl").write_text("")
        reproduce()
    env = dict(os.environ, BROWSER_POOL_URL="http://127.0.0.1:4327", MI_SLUG="budget-orphans")
    try:
        with urlopen(env["BROWSER_POOL_URL"] + "/health", timeout=1):
            raise RuntimeError("Port 4327 is already owned; do not touch that daemon")
    except OSError:
        pass
    with (OUT / "pool.log").open("w") as pool_log:
        daemon = subprocess.Popen(["node", "--import", "tsx", "tools/browser-pool/daemon.ts"],
                                  env=dict(env, BROWSER_POOL_PORT="4327"), stdout=pool_log, stderr=subprocess.STDOUT)
        try:
            for _ in range(100):
                try:
                    with urlopen(env["BROWSER_POOL_URL"] + "/health", timeout=1) as response:
                        assert json.load(response)["pid"] == daemon.pid
                    break
                except OSError:
                    assert daemon.poll() is None, "Owned pool failed to start"
                    time.sleep(.1)
            run_gates(env)
            quiet_proof(env)
        finally:
            daemon.terminate()
            daemon.wait(timeout=30)
    SUMMARY["finalProcesses"] = snapshot("final")
    (OUT / "summary.json").write_text(json.dumps(SUMMARY, indent=2) + "\n")
    print("All proof phases completed; owned daemon stopped", flush=True)


if __name__ == "__main__":
    main()
