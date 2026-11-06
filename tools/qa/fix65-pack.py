"""fix65-a: pack screenshot-only Luna runs (actions, visible HUD, player notes, frame hashes) into one JSON evidence file.

usage: python3 tools/qa/fix65-pack.py <out.json> <label>=<run dir> [...]
Frames stay in test-results/ (git-ignored); only their SHA-256 values are recorded.
"""
import hashlib, json, os, sys

out, runs = sys.argv[1], sys.argv[2:]
packed = {'method': 'One fresh attached screenshot per action (tools/qa/fix64-screen-run.mjs protocol; fix65-screen-run.mjs adds only a camera/minimap orientation legend). Courier protected, aim assist on, clock paused between actions.', 'runs': {}}
for spec in runs:
    label, path = spec.split('=', 1)
    lines = lambda name: [json.loads(l) for l in open(os.path.join(path, name)) if l.strip()] if os.path.exists(os.path.join(path, name)) else []
    log = lines('log.jsonl')
    raw = open(os.path.join(path, 'player.jsonl')).read() if os.path.exists(os.path.join(path, 'player.jsonl')) else ''
    frames = sorted(os.listdir(os.path.join(path, '.frames'))) if os.path.isdir(os.path.join(path, '.frames')) else []
    packed['runs'][label] = {
        'dir': path,
        'actions': [{'turn': x['turn'], 'objective': x['objective'], 'action': x['action']} for x in log],
        'playerNotes': raw,
        'prefix': json.load(open(os.path.join(path, 'prefix.json'))) if os.path.exists(os.path.join(path, 'prefix.json')) else None,
        'frames': {f: hashlib.sha256(open(os.path.join(path, '.frames', f), 'rb').read()).hexdigest() for f in frames},
    }
json.dump(packed, open(out, 'w'), indent=1)
print(out, {k: len(v['actions']) for k, v in packed['runs'].items()})
