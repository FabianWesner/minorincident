#!/usr/bin/env python3
"""Hetzner runner pool for Minor Incident (mi-runner-1..4, cx33). Stdlib only. See docs/tools/remote-runner.md.

  pool.py pick               wait for a runner with a free job slot (scales up after MI_SCALE_WAIT s), print its IPv4
  pool.py status             servers + slots (used by status.sh)
  pool.py create [NAME]      add a runner (hard cap MI_MAX_RUNNERS=4), from the newest snapshot if there is one
  pool.py snapshot [NAME]    snapshot a runner (default mi-runner-1) as the boot image for new runners
  pool.py reap               delete runners (except MI_KEEP) with no job for MI_IDLE_HOURS (default 4)
  pool.py delete NAME|--all [--snapshots]
  pool.py cost
The API token (HETZNER_API_KEY) comes from the environment or the main checkout's .env and is never printed."""
import json, os, subprocess, sys, time, urllib.request, urllib.error, concurrent.futures as cf

API = "https://api.hetzner.cloud/v1"
LABEL = "project=minor-incident"
PREFIX = "mi-runner-"
MAX = int(os.environ.get("MI_MAX_RUNNERS", "4"))
SLOTS = int(os.environ.get("RUNNER_SLOTS", "2"))
SCALE_WAIT = int(os.environ.get("MI_SCALE_WAIT", "300"))
IDLE_H = float(os.environ.get("MI_IDLE_HOURS", "4"))
KEEP = os.environ.get("MI_KEEP", "mi-runner-1").split(",")
KEY = os.path.expanduser(os.environ.get("MI_RUNNER_KEY", "~/.ssh/mi-runner"))
HOSTS = os.path.expanduser("~/.ssh/known_hosts_mi-runner")
HERE = os.path.dirname(os.path.abspath(__file__))
SSH = ["ssh", "-i", KEY, "-o", "IdentitiesOnly=yes", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no",
       "-o", f"UserKnownHostsFile={HOSTS}", "-o", "LogLevel=ERROR", "-o", "ConnectTimeout=6"]

def log(*a): print("[pool]", *a, file=sys.stderr, flush=True)

def token():
    t = os.environ.get("HETZNER_API_KEY")
    if t: return t
    cands = [os.environ.get("MI_ENV_FILE", "")]
    try:
        common = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], capture_output=True, text=True).stdout.strip()
        cands.append(os.path.join(os.path.dirname(common), ".env"))
    except Exception: pass
    cands.append("/Users/wesner/Workspace/minorincident/.env")
    for p in cands:
        if p and os.path.isfile(p):
            for line in open(p):
                if line.startswith("HETZNER_API_KEY="):
                    return line.split("=", 1)[1].strip().strip("'\"")
    sys.exit("pool.py: HETZNER_API_KEY not found (env or .env)")
TOKEN = None

def api(method, path, body=None):
    global TOKEN
    TOKEN = TOKEN or token()
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        err = json.loads(e.read() or b"{}").get("error", {})
        raise RuntimeError(f"{method} {path}: {err.get('code')} {err.get('message')}")

def servers():
    out = api("GET", f"/servers?label_selector={LABEL}&per_page=50")["servers"]
    return sorted((s for s in out if s["name"].startswith(PREFIX)), key=lambda s: s["name"])

def ip(s): return s["public_net"]["ipv4"]["ip"]

def rsh(addr, cmd, timeout=20):
    try:
        r = subprocess.run(SSH + [f"runner@{addr}", cmd], capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout
    except subprocess.TimeoutExpired:
        return 255, ""

STATE_CMD = ("now=$(date +%s); run=0; wait=0; for f in /srv/mi/queue/*.job; do [ -f \"$f\" ] || continue; "
             "n=$(awk -F'\\t' 'NR==1{print NF}' $f); if [ \"$n\" -ge 4 ]; then run=$((run+1)); else wait=$((wait+1)); fi; done; "
             "echo \"$run $wait $(cat /srv/mi/last-activity 2>/dev/null || echo 0) $(cut -d' ' -f1 /proc/loadavg) $(ls /srv/mi/ws 2>/dev/null | tr '\\n' ',')\"")

def state(s):
    rc, out = rsh(ip(s), STATE_CMD)
    if rc != 0 or not out.strip(): return None
    p = out.split()
    return {"name": s["name"], "ip": ip(s), "running": int(p[0]), "waiting": int(p[1]), "last": int(p[2]), "load": float(p[3]), "ws": p[4] if len(p) > 4 else ""}

def states(ss):
    with cf.ThreadPoolExecutor(8) as ex:
        return list(ex.map(state, ss))

def lock():
    d = "/tmp/mi-runner-scale.lock"
    for _ in range(120):
        try: os.mkdir(d); return d
        except FileExistsError:
            if time.time() - os.path.getmtime(d) > 600: os.rmdir(d)
            time.sleep(1)
    sys.exit("pool.py: scale lock busy")

def snapshot_image():
    imgs = [i for i in api("GET", f"/images?type=snapshot&label_selector=role%3Drunner-base,{LABEL}&sort=created:desc")["images"]]
    return imgs[0] if imgs else None

def wait_ssh(s, timeout=300):
    t = time.time()
    while time.time() - t < timeout:
        if state(s): return True
        time.sleep(4)
    return False

def create(name=None):
    d = lock()
    try:
        ss = servers()
        if len(ss) >= MAX: sys.exit(f"pool.py: cap of {MAX} runners reached")
        names = {s["name"] for s in ss}
        name = name or next(f"{PREFIX}{i}" for i in range(1, MAX + 1) if f"{PREFIX}{i}" not in names)
        pub = open(KEY + ".pub").read().strip()
        img = snapshot_image()
        ud = open(os.path.join(HERE, "cloud-init.yaml")).read().replace("__PUB__", pub)
        fw = api("GET", "/firewalls?name=mi-runner-fw")["firewalls"][0]["id"]
        last = None
        for loc in os.environ.get("MI_LOCATIONS", "nbg1,fsn1,hel1").split(","):
            body = {"name": name, "server_type": "cx33", "image": str(img["id"]) if img else "ubuntu-24.04", "location": loc,
                    "ssh_keys": ["mi-runner"], "labels": {"project": "minor-incident"}, "firewalls": [{"firewall": fw}], "user_data": ud}
            try:
                s = api("POST", "/servers", body)["server"]; break
            except RuntimeError as e:
                last = e; log(f"{loc}: {e}")
        else:
            sys.exit(f"pool.py: create failed: {last}")
        log(f"created {name} ({ip(s)}) in {loc} from {'snapshot ' + str(img['id']) if img else 'ubuntu-24.04 + cloud-init'}")
        if not wait_ssh(s, 600): sys.exit(f"pool.py: {name} did not come up")
        if not img:
            for _ in range(90):  # cloud-init (node, swap) still running on a fresh image
                if rsh(ip(s), "test -f /var/lib/cloud/instance/boot-finished && command -v node")[0] == 0: break
                time.sleep(5)
        rsh(ip(s), "mkdir -p /srv/mi && date +%s > /srv/mi/last-activity")
        log(f"{name} ready")
        return s
    finally:
        os.rmdir(d)

def pick():
    t0 = time.time(); announced = False
    while True:
        ss = [s for s in servers() if s["status"] in ("running", "initializing", "starting")]
        sts = [x for x in states([s for s in ss if s["status"] == "running"]) if x]
        booting = len(ss) - len(sts)
        free = [x for x in sts if x["running"] < SLOTS and x["last"]]  # only runners whose provisioning finished (/srv/mi/last-activity)
        if free:
            free.sort(key=lambda x: (x["running"] + x["waiting"], x["load"]))
            best = free[0]; print(best["ip"]); return
        waited = time.time() - t0
        if not ss:
            log("no runner exists; creating one"); s = create(); print(ip(s)); return
        if waited > SCALE_WAIT and len(ss) < MAX and booting == 0:
            log(f"all {len(sts)} runner(s) full for {int(waited)}s; adding one"); create(); continue
        if not announced or int(waited) % 60 < 5:
            log(f"all runners full ({', '.join(x['name'] + ':' + str(x['running']) + '/' + str(SLOTS) + '+' + str(x['waiting']) + 'q' for x in sts)}); waiting {int(waited)}s"); announced = True
        time.sleep(5)

def delete(name):
    for s in servers():
        if s["name"] == name:
            api("DELETE", f"/servers/{s['id']}"); log(f"deleted {name}"); return
    log(f"no server {name}")

def reap():
    now = time.time()
    for s in servers():
        if s["name"] in KEEP or s["status"] != "running": continue
        st = state(s)
        if not st or st["running"] or st["waiting"]: continue
        last = st["last"] or time.mktime(time.strptime(s["created"][:19], "%Y-%m-%dT%H:%M:%S")) - time.timezone
        if now - last > IDLE_H * 3600:
            log(f"{s['name']} idle {(now - last) / 3600:.1f} h (> {IDLE_H} h): deleting"); delete(s["name"])

def cost():
    t = api("GET", "/server_types?name=cx33")["server_types"][0]
    p = [x for x in t["prices"] if x["location"] == "nbg1"][0]
    h, m = float(p["price_hourly"]["gross"]), float(p["price_monthly"]["gross"])
    n = len(servers())
    print(f"cx33 gross: {h:.4f} EUR/h, {m:.2f} EUR/month (capped) per runner; 1 runner {h:.4f}/h {m:.2f}/mo; 4 runners {4*h:.4f}/h {4*m:.2f}/mo; running now: {n}")

def status():
    ss = servers()
    for s, st in zip(ss, states(ss)):
        print(f"{s['name']}  id={s['id']} {s['server_type']['name']} {s['datacenter']['location']['name'] if 'datacenter' in s else s['location']['name']} {ip(s)} {s['status']}"
              + (f"  jobs {st['running']}/{SLOTS} +{st['waiting']} queued  load {st['load']}  idle {int(time.time()) - st['last'] if st['last'] else '?'}s" if st else "  (ssh not ready)"))
    if not ss: print("no runners (they are created on demand)")

def snapshot(name):
    s = next((x for x in servers() if x["name"] == name), None) or sys.exit(f"no server {name}")
    st = state(s)
    if not st or st["running"] or st["waiting"]: sys.exit("pool.py: runner is busy; snapshot cleans workspaces, retry when idle")
    rsh(ip(s), "rm -rf /srv/mi/ws/* /srv/mi/jobs/* /srv/mi/queue/* /srv/mi/locks/*; cd /srv/mi/nm && ls -t | tail -n +3 | xargs -r rm -rf; sync", 120)
    old = api("GET", f"/images?type=snapshot&label_selector=role%3Drunner-base,{LABEL}")["images"]
    r = api("POST", f"/servers/{s['id']}/actions/create_image", {"type": "snapshot", "description": "mi-runner base " + time.strftime("%F %H:%M"),
                                                                "labels": {"project": "minor-incident", "role": "runner-base"}})
    new = r["image"]["id"]; log(f"snapshot {new} started")
    for _ in range(120):
        if api("GET", f"/images/{new}")["image"]["status"] == "available": break
        time.sleep(10)
    for i in old: api("DELETE", f"/images/{i['id']}")
    log(f"snapshot {new} available; removed {len(old)} older")

if __name__ == "__main__":
    a = sys.argv[1:] or ["status"]
    c = a[0]
    if c == "pick": pick()
    elif c == "status": status()
    elif c == "create": create(a[1] if len(a) > 1 else None)
    elif c == "snapshot": snapshot(a[1] if len(a) > 1 else "mi-runner-1")
    elif c == "reap": reap()
    elif c == "cost": cost()
    elif c == "delete":
        if a[1] == "--all":
            for s in servers(): delete(s["name"])
            if "--snapshots" in a:
                for i in api("GET", f"/images?type=snapshot&label_selector=role%3Drunner-base,{LABEL}")["images"]: api("DELETE", f"/images/{i['id']}"); log("snapshot deleted")
        else: delete(a[1])
    else: sys.exit(__doc__)
