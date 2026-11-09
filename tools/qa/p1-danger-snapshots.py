"""Prepare the two historical source snapshots for remote pressure comparisons."""
import hashlib
import json
import subprocess
from pathlib import Path

revisions = {"batch59": "2741447027b1073e6ee581d03a6ee60feaa6e113", "main": "cab3405c20f3bf4214c99d764d61c526b3e0c525"}
output = Path("tools/qa/.p1-danger-sources")
output.mkdir(parents=True, exist_ok=True)
rows = []
for side, revision in revisions.items():
    paths = subprocess.check_output(["git", "ls-tree", "-r", "--name-only", revision, "src", "tools", "specs", "layouts", "tests/fixtures", "package.json", "package-lock.json", "tsconfig.json", "tsconfig.sim.json", "public/assets/layouts"], text=True).splitlines()
    paths = [path for path in paths if not path.endswith((".glb", ".png", ".jpg", ".webm", ".gz", ".blend"))]
    archive = output / f"{side}.tar.gz"
    subprocess.run(["git", "archive", "--format=tar.gz", "-o", str(archive), revision, *paths], check=True)
    rows.append({"side": side, "revision": revision, "archiveSha256": hashlib.sha256(archive.read_bytes()).hexdigest(), "bytes": archive.stat().st_size})
receipt = Path("docs/reports/p1-danger/evidence/snapshots.json")
receipt.parent.mkdir(parents=True, exist_ok=True)
receipt.write_text(json.dumps(rows, indent=2) + "\n")
print(json.dumps(rows, indent=2))
