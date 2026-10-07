"""Build experiment/gallery/ (index.html + img/): reference vs. each build round, with creation and runtime metrics.

Add a round by appending to ROUNDS. Runtime benchmarks come from experiment/results/bench.json
(written by tools/run_bench.py)."""
import datetime as dt
import html
import json
import struct
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'gallery'
IMG = OUT / 'img'
IMG.mkdir(parents=True, exist_ok=True)
GLB = OUT / 'glb'
GLB.mkdir(exist_ok=True)
import shutil
CLI = '/Users/fabianwesner/.claude/skills/codex-scheduler/scripts/scheduler_cli.py'
SESSION = '0ffd5f45-ea4e-4cf0-a094-4ee67caa3755'
NOW = dt.datetime.now(dt.timezone.utc)

ROUNDS = [
    {'id': 'r1', 'label': 'Round 1 · Detailed', 'brief': 'realistic detail, fire-engine example', 'prefix': 'xp-sol-', 'sub': 'sol'},
    {'id': 'r2', 'label': 'Round 2 · Stylized', 'brief': 'chunky low-poly, flat palette, hard budgets', 'prefix': 'xp-sty-', 'sub': 'stylized'},
    {'id': 'r3', 'label': 'Round 3 · Middle ground', 'brief': 'round 2 plus mid-scale detail, 6–12k triangles', 'prefix': 'xp-mid-', 'sub': 'mid',
     'assets': ['police-car', 'school-bus']},
]
MODEL_NAME = {'gpt-6-luna': 'GPT-6 Luna', 'gpt-6.1-sol': 'GPT-6.1 Sol'}

jobs = {j['slug']: j for j in json.loads(subprocess.run(['python3', CLI, 'list', '--session', SESSION, '--json'], capture_output=True, text=True).stdout)}
bench = {}
if (ROOT / 'results' / 'bench.json').exists():
    bench = json.loads((ROOT / 'results' / 'bench.json').read_text())


def ts(s):
    return dt.datetime.fromisoformat(s.replace('Z', '+00:00')) if s else None


def dur(j):
    a, b = ts(j.get('started_at')), ts(j.get('finished_at'))
    return ((b or NOW) - a).total_seconds() if a else None


def fmt_dur(s):
    if s is None:
        return '–'
    m, sec = divmod(int(s), 60)
    return f'{m}m {sec:02d}s'


def fmt_tok(n):
    return f'{n / 1e6:.2f}M' if n and n >= 1e6 else (f'{n / 1e3:.0f}k' if n else '–')


def fmt_n(n):
    return f'{n:,.0f}' if isinstance(n, (int, float)) else '–'


def glb_stats(p):
    """Triangles, mesh nodes (≈ draw calls before batching), materials and size, read from the GLB itself."""
    if not p.exists():
        return None
    b = p.read_bytes()
    n = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + n])
    acc = j.get('accessors', [])
    tri_per_mesh = []
    for m in j.get('meshes', []):
        t = 0
        for pr in m['primitives']:
            if 'indices' in pr:
                t += acc[pr['indices']]['count'] // 3
            else:
                t += acc[pr['attributes']['POSITION']]['count'] // 3
        tri_per_mesh.append(t)
    mesh_nodes = [nd for nd in j.get('nodes', []) if 'mesh' in nd]
    prims = sum(len(j['meshes'][nd['mesh']]['primitives']) for nd in mesh_nodes)
    return {'triangles': sum(tri_per_mesh[nd['mesh']] for nd in mesh_nodes), 'draws': prims,
            'materials': len(j.get('materials', [])), 'kb': len(b) / 1024}


def thumb(src, name, width=900):
    dst = IMG / name
    if src and src.exists():
        im = Image.open(src).convert('RGB')
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(dst, 'JPEG', quality=82, optimize=True)
    return f'img/{name}' if dst.exists() else None


def first(d, names):
    for n in names:
        if (d / n).exists():
            return d / n
    return None


def latest_review(d):
    cands = [p for p in d.glob('*.png') if not p.name.startswith('three')]
    return max(cands, key=lambda p: p.stat().st_mtime) if cands else None


def status_chip(j):
    st = (j or {}).get('status', 'not started')
    return f'<span class="chip st-{st.replace(" ", "-")}">{html.escape(st)}</span>'


assets = sorted(p.name for p in ROOT.iterdir() if p.is_dir() and (p / 'crop.png').exists())
agg = {r['id']: [] for r in ROUNDS}
sections = []
for slug in assets:
    d = ROOT / slug
    desc = (d / 'description.txt').read_text().strip()
    up = jobs.get(f'xp-up-{slug}', {})
    ref = thumb(d / 'reference-upscaled.png', f'{slug}-ref.jpg')
    crop = thumb(d / 'crop.png', f'{slug}-crop.jpg', 400)
    cols = []
    rounds_here = [r for r in ROUNDS if slug in r.get('assets', assets)]
    for r in rounds_here:
        j = jobs.get(f"{r['prefix']}{slug}", {})
        folder = d / r['sub']
        rd = folder / 'renders'
        st = glb_stats(folder / 'model.glb')
        b = bench.get(f"/experiment/{slug}/{r['sub']}/model.glb", {})
        hero = thumb(first(rd, ['hero.png']) or (latest_review(rd) if rd.exists() else None), f"{slug}-{r['id']}-hero.jpg")
        glb_rel = None
        if (folder / 'model.glb').exists():
            # Artifacts do not serve .glb, so ship the same model as embedded glTF JSON.
            glb_rel = f"glb/{slug}-{r['id']}.gltf.json"
            gb = (folder / 'model.glb').read_bytes()
            jl = struct.unpack('<I', gb[12:16])[0]
            gj = json.loads(gb[20:20 + jl])
            off = 20 + jl
            if off < len(gb):
                bl = struct.unpack('<I', gb[off:off + 4])[0]
                import base64
                gj['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(gb[off + 8:off + 8 + bl]).decode()
            (OUT / glb_rel).write_text(json.dumps(gj, separators=(',', ':')))
        secs = dur(j)
        if j.get('status') == 'done':
            agg[r['id']].append({'secs': secs, 'tok': j.get('tokens_total') or 0, **(st or {}),
                                 'gpu': (b.get('webgpu') or {}).get('medianMs'), 'gl': (b.get('webgl2') or {}).get('medianMs')})
        facts = [('Built by', f"{MODEL_NAME.get(j.get('model'), j.get('model') or '–')} · {j.get('effort') or '–'}"),
                 ('Creation time', fmt_dur(secs) + (' so far' if j.get('status') == 'running' else '')),
                 ('Tokens', fmt_tok(j.get('tokens_total'))),
                 ('Triangles', fmt_n(st and st['triangles'])), ('Draw calls', fmt_n(st and st['draws'])),
                 ('Materials', fmt_n(st and st['materials'])), ('GLB', f"{st['kb']:,.0f} KB" if st else '–'),
                 ('25× frame', f"{b['webgpu']['medianMs']} ms WebGPU · {b['webgl2']['medianMs']} ms WebGL2" if b.get('webgpu') else 'not benchmarked yet')]
        dl = ''.join(f'<dt>{k}</dt><dd>{html.escape(str(v))}</dd>' for k, v in facts)
        figs = (f'<figure><img src="{hero}" alt="Blender render of {slug}, {r["label"]}" loading="lazy"><figcaption>Blender render (Cycles)</figcaption></figure>' if hero else '')
        if glb_rel:
            figs += (f'<div class="live" data-src="{glb_rel}" data-mode="study"><div class="stage"></div>'
                     f'<div class="livebar"><span class="status">Scroll here to render</span>'
                     f'<span class="views"><button type="button" data-view="study" aria-pressed="true">Close-up</button>'
                     f'<button type="button" data-view="game" aria-pressed="false">Game camera</button></span></div>'
                     f'<p class="cap">Live three.js · drag to orbit</p></div>')
        figs = figs or '<p class="empty">No render yet.</p>'
        cols.append(f'<div class="col"><div class="colhead"><span class="model">{r["label"]}</span>{status_chip(j)}</div>{figs}<dl>{dl}</dl></div>')
    sections.append(f'''<section class="asset" id="{slug}">
  <header><h2>{html.escape(slug.replace('-', ' '))}</h2><p>{html.escape(desc)}</p></header>
  <div class="grid" style="--cols:{1 + len(rounds_here)}">
    <div class="col ref"><div class="colhead"><span class="model">Reference</span><span class="effort">GPT-6.1 Sol · low upscale</span>{status_chip(up)}</div>
      {f'<figure><img src="{ref}" alt="Upscaled reference of {slug}" loading="lazy"><figcaption>Upscaled reference · {fmt_dur(dur(up))} · {fmt_tok(up.get("tokens_total"))} tokens</figcaption></figure>' if ref else ''}
      {f'<figure class="crop"><img src="{crop}" alt="Concept sheet crop of {slug}" loading="lazy"><figcaption>Original concept-sheet crop</figcaption></figure>' if crop else ''}
    </div>
    {''.join(cols)}
  </div>
</section>''')


def avg(rows, k):
    v = [r[k] for r in rows if r.get(k) is not None]
    return sum(v) / len(v) if v else None


rows = ''
for r in ROUNDS:
    a = agg[r['id']]
    gpu, gl = avg(a, 'gpu'), avg(a, 'gl')
    rows += (f"<tr><th>{r['label']}<small>{html.escape(r['brief'])}</small></th><td>{len(a)} / {len(r.get('assets', assets))}</td><td>{fmt_dur(avg(a, 'secs'))}</td>"
             f"<td>{fmt_tok(avg(a, 'tok'))}</td><td>{fmt_n(avg(a, 'triangles'))}</td><td>{fmt_n(avg(a, 'draws'))}</td><td>{fmt_n(avg(a, 'kb'))} KB</td>"
             f"<td>{f'{gpu:.1f} / {gl:.1f} ms' if gpu else '–'}</td></tr>")

page = f'''<title>Asset Pipeline Rounds</title>
<style>
/* Layout: summary table, then one band per asset: reference | round 1 | round 2 | ... */
:root {{
  --bg: #f3f2f6; --panel: #ffffff; --fg: #1d1b24; --muted: #6a6676; --line: #dedbe6; --accent: #c4351f;
  --ok: #1f7a4d; --run: #a86a00; --bad: #b3261e;
  --display: "Archivo Narrow", "Arial Narrow", system-ui, sans-serif; --body: "IBM Plex Sans", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg: #16151b; --panel: #201e27; --fg: #ece9f3; --muted: #a29eb0; --line: #34313e; --accent: #ff6a4d; --ok: #4fc58a; --run: #f0b14a; --bad: #ff7a70; color-scheme: dark }} }}
:root[data-theme="dark"] {{ --bg: #16151b; --panel: #201e27; --fg: #ece9f3; --muted: #a29eb0; --line: #34313e; --accent: #ff6a4d; --ok: #4fc58a; --run: #f0b14a; --bad: #ff7a70; color-scheme: dark }}
body {{ background: var(--bg); color: var(--fg); font-family: var(--body); line-height: 1.5; }}
.wrap {{ max-width: 1600px; margin: 0 auto; padding-inline: 20px; padding-block: 28px 64px; display: grid; gap: 28px; }}
h1 {{ font-family: var(--display); font-size: clamp(28px, 4vw, 44px); line-height: 1.05; margin: 0; text-wrap: balance; }}
.lede {{ color: var(--muted); max-width: 75ch; margin: 8px 0 0; }}
.eyebrow {{ font-family: var(--mono); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); }}
.tablewrap {{ overflow-x: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }}
table {{ border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }}
th, td {{ text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--line); white-space: nowrap; vertical-align: top; }}
th small {{ display: block; font-weight: 400; color: var(--muted); font-size: 12px; }}
thead th {{ font-family: var(--mono); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }}
tbody tr:last-child th, tbody tr:last-child td {{ border-bottom: 0; }}
.note {{ font-size: 13px; color: var(--muted); margin: 8px 2px 0; max-width: 100ch; }}
nav {{ display: flex; flex-wrap: wrap; gap: 8px; }}
nav a {{ font-family: var(--mono); font-size: 13px; color: var(--fg); text-decoration: none; border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; background: var(--panel); }}
nav a:hover, nav a:focus-visible {{ border-color: var(--accent); outline: none; }}
.asset {{ display: grid; gap: 12px; border-top: 2px solid var(--fg); padding-top: 14px; }}
.asset header {{ display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 16px; }}
.asset h2 {{ font-family: var(--display); text-transform: uppercase; font-size: 26px; margin: 0; letter-spacing: .03em; }}
.asset header p {{ margin: 0; color: var(--muted); }}
.grid {{ display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 14px; }}
@media (max-width: 1000px) {{ .grid {{ grid-template-columns: 1fr; }} }}
.col {{ min-width: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px; display: grid; gap: 10px; align-content: start; }}
.colhead {{ display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }}
.model {{ font-weight: 600; }}
.effort {{ font-family: var(--mono); font-size: 12px; color: var(--muted); }}
.chip {{ margin-left: auto; font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; padding: 2px 8px; border-radius: 999px; border: 1px solid currentColor; }}
.st-done {{ color: var(--ok); }} .st-running, .st-queued {{ color: var(--run); }} .st-failed, .st-stopped, .st-not-started {{ color: var(--bad); }}
figure {{ margin: 0; display: grid; gap: 4px; }}
figure img {{ width: 100%; height: auto; border-radius: 6px; background: var(--bg); cursor: zoom-in; }}
figcaption {{ font-size: 12px; color: var(--muted); }}
.crop img {{ max-width: 55%; }}
dl {{ display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0; font-size: 13px; font-variant-numeric: tabular-nums; }}
dt {{ color: var(--muted); }} dd {{ margin: 0; min-width: 0; }}
.empty {{ color: var(--muted); font-size: 13px; margin: 0; padding: 24px 0; text-align: center; border: 1px dashed var(--line); border-radius: 6px; }}
dialog {{ border: 0; padding: 0; background: transparent; max-width: 96vw; }}
dialog img {{ max-width: 96vw; max-height: 92vh; border-radius: 8px; display: block; }}
dialog::backdrop {{ background: rgb(0 0 0 / .8); }}
.live {{ --stage: #d9d6df; display: grid; gap: 4px; }}
.stage {{ aspect-ratio: 16 / 10; width: 100%; max-width: 100%; border-radius: 6px; background: var(--stage); overflow: hidden; touch-action: none; }}
.stage canvas {{ display: block; width: 100% !important; height: 100% !important; }}
.livebar {{ display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; }}
.status {{ font-family: var(--mono); font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }}
.views {{ display: inline-flex; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; }}
.views button {{ font: 500 12px var(--body); color: var(--fg); background: transparent; border: 0; padding: 3px 10px; cursor: pointer; }}
.views button[aria-pressed="true"] {{ background: var(--fg); color: var(--bg); }}
.views button:focus-visible {{ outline: 2px solid var(--accent); outline-offset: -2px; }}
.cap {{ margin: 0; font-size: 12px; color: var(--muted); }}
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;600&display=swap">
<div class="wrap">
  <header>
    <div class="eyebrow">Suburban Survivors · asset pipeline</div>
    <h1>Asset Pipeline Rounds</h1>
    <p class="lede">The same ten concept-sheet assets, rebuilt as scripted Blender models by Codex GPT-6.1 Sol (low effort) in successive rounds. Each round changes the brief to find the balance between how stunning an asset looks, how cheap it is to create, and how fast it renders in gameplay. Snapshot {NOW.astimezone().strftime('%d %b, %H:%M')}; running jobs show their time so far.</p>
  </header>
  <div>
    <div class="tablewrap"><table>
      <thead><tr><th>Round</th><th>Finished</th><th>Avg creation</th><th>Avg tokens</th><th>Avg triangles</th><th>Avg draw calls</th><th>Avg GLB</th><th>25× frame (WebGPU / WebGL2)</th></tr></thead>
      <tbody>{rows}</tbody>
    </table></div>
    <p class="note">Budgets from the asset spec: vehicles 6–12k triangles, street furniture ≤ 3k, small props ≤ 1.5k. Draw calls = mesh primitives in the GLB before any runtime batching. The live viewers load each GLB in your browser (WebGPU, WebGL2 fallback); at most four render at once. The frame benchmark renders 25 copies under the game camera on this M1 Max (lower is better; 16.7 ms = 60 fps). Round 1 also ran on GPT-6 Luna (high); Sol was clearly better, so Luna was dropped and its files deleted.</p>
  </div>
  <nav>{''.join(f'<a href="#{s}">{s.replace("-", " ")}</a>' for s in assets)}</nav>
  {''.join(sections)}
</div>
<dialog id="zoom"><img alt="Enlarged render"></dialog>
<script type="importmap">{{"imports": {{"three": "https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js", "three/webgpu": "https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/"}}}}</script>
<script type="module" src="viewer.js"></script>
<script>
const dlg = document.getElementById('zoom'), big = dlg.querySelector('img');
document.querySelectorAll('figure img').forEach((im) => im.addEventListener('click', () => {{ big.src = im.src; big.alt = im.alt; dlg.showModal(); }}));
dlg.addEventListener('click', () => dlg.close());
</script>
'''
(OUT / 'index.html').write_text(page)
used = {p.split('/')[-1] for p in __import__('re').findall(r'img/[\w.-]+\.jpg', page)}
for f in IMG.glob('*.jpg'):
    if f.name not in used:
        f.unlink()
glbs = set(__import__('re').findall(r'glb/[\w.-]+\.gltf\.json', page))
for f in GLB.glob('*'):
    if f'glb/{f.name}' not in glbs:
        f.unlink()
(OUT / 'files.json').write_text(json.dumps(sorted([f'img/{n}' for n in used] + sorted(glbs) + ['viewer.js'])))
print('gallery written:', len(used), 'images')
