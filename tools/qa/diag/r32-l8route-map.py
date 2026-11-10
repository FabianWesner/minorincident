"""r32-l8route-plan: top-down D-ZOO map from the shipped layout JSON + L8 data, with a
reachability flood fill (0.25 m grid, blockers dilated by the 0.4 m courier radius).
usage: python3 zoomap.py <worktree> <trace.json> <outdir>
Writes current.png (today) and plan.png (proposed linear route), and prints the cell check."""
import json, math, sys
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw, ImageFont

WT, TRACE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
L = json.load(open(f'{WT}/public/assets/layouts/D-ZOO.layout.json'))
X0, X1, Z0, Z1 = -120.0, 120.0, -90.0, 90.0
RES = .25
W, H = int((X1 - X0) / RES), int((Z1 - Z0) / RES)
PX = 5  # output px per metre
R = .4  # courier radius

def g(x, z): return int((x - X0) / RES), int((z - Z0) / RES)

def box_mask(m, x0, z0, x1, z1):
    a, b = g(min(x0, x1), min(z0, z1)); c, d = g(max(x0, x1), max(z0, z1))
    m[max(0, b):max(0, d + 1), max(0, a):max(0, c + 1)] = True

# ---------------------------------------------------------------- shared blockers
base = np.zeros((H, W), bool)
static_boxes = []
for c in L['colliders']:
    mn, mx = c['aabb']['min'], c['aabb']['max']
    if mx[0] < X0 or mn[0] > X1 or mx[2] < Z0 or mn[2] > Z1: continue
    box_mask(base, mn[0], mn[2], mx[0], mx[2]); static_boxes.append((c['id'], mn[0], mn[2], mx[0], mx[2]))
# runtime L8 blockers (src/data/l8Bosses.ts, LevelEightZoo.ts)
yard_walls = [(84, 51, .25, 5), (84, 77, .25, 13), (88, 46, 4, .25), (108, 46, 8, .25)]
yard_gates = [(84, 60, .25, 4), (96, 46, 4, .25)]
enc_gates = {'flamingo': (0, -52, 7, .25), 'zebra': (60, 52, 7, .25), 'monkey': (-20, 26, .25, 6), 'lion': (-60, -52, 7, .25), 'gorilla': (60, -52, 7, .25), 'elephant': (116, 80, .25, 8)}
arenas = [('flamingo', -6, -27, 0, -9, 17), ('zebra', 60, 32, 60, 8, 23), ('monkey', -5, 15, 1, 14, 13), ('lion', -60, -32, -60, -8, 23), ('gorilla', 60, -32, 60, -8, 23), ('elephant', 96, 64, 96, 46, 22)]
bus = (-16, 70, 4.68, 1.48); apc = (96, 74, 4.2, 1.6)
for x, z, hx, hz in yard_walls + [bus, apc]: box_mask(base, x - hx, z - hz, x + hx, z + hz)

def seg_box(x0, z0, x1, z1, t=.8):
    if abs(x1 - x0) < abs(z1 - z0): return (x0 - t / 2, min(z0, z1), x0 + t / 2, max(z0, z1))
    return (min(x0, x1), z0 - t / 2, max(x0, x1), z0 + t / 2)

def reach(blocked_extra, seed):
    m = base.copy()
    for b in blocked_extra: box_mask(m, *b)
    m = ndimage.binary_dilation(m, iterations=int(math.ceil(R / RES)))
    free = ~m
    lab, _ = ndimage.label(free)
    i, j = g(*seed)
    return lab == lab[j, i]

# ---------------------------------------------------------------- drawing
font = ImageFont.load_default(size=13) if hasattr(ImageFont, 'load_default') else None
small = ImageFont.load_default(size=11)
big = ImageFont.load_default(size=16)

def P(x, z): return ((x - X0) * PX, (z - Z0) * PX)

def draw_base(img, d):
    for s in L['surfaces']:
        if s['surface'] == 'tile':
            d.polygon([P(*p) for p in s['polygon']], fill=(214, 205, 186))
    for zid, poly in L['zones'].items():
        pts = poly if isinstance(poly, list) else poly.get('polygon', [])
        if pts and isinstance(pts[0], (list, tuple)): d.polygon([P(*p) for p in pts], outline=(120, 150, 90))
    for idn, x0, z0, x1, z1 in static_boxes:
        col = (90, 90, 90)
        if 'crowd-fence' in idn: col = (120, 95, 60)
        elif 'zoo-wall' in idn: col = (70, 50, 45)
        elif idn.startswith('bld'): col = (110, 110, 125)
        elif 'rocks' in idn: col = (140, 130, 120)
        elif 'hedge' in idn or 'garden' in idn: col = (60, 120, 60)
        d.rectangle([P(x0, z0), P(x1, z1)], fill=col)
    for p in L['placements']:
        if p['assetId'] in ('prop.tree', 'prop.street-tree'):
            x, _, z = p['position']
            if abs(x) < 116 and abs(z) < 86: d.ellipse([P(x - .6, z - .6), P(x + .6, z + .6)], fill=(70, 130, 70))
    for x, z, hx, hz in yard_walls: d.rectangle([P(x - hx, z - hz), P(x + hx, z + hz)], fill=(150, 120, 60))
    d.rectangle([P(bus[0] - bus[2], bus[1] - bus[3]), P(bus[0] + bus[2], bus[1] + bus[3])], fill=(200, 170, 40)); d.text(P(-22, 73), 'bus', fill=(80, 60, 0), font=small)
    d.rectangle([P(apc[0] - apc[2], apc[1] - apc[3]), P(apc[0] + apc[2], apc[1] + apc[3])], fill=(80, 100, 60)); d.text(P(91, 77), 'APC', fill=(20, 40, 10), font=small)
    for name, a in L['anchors'].items():
        x, _, z = a['position']
        if name.startswith('tunnel-outlet'):
            d.rectangle([P(x - 1.5, z - 1.5), P(x + 1.5, z + 1.5)], fill=(150, 20, 20)); d.text(P(x + 2, z - 3), 'outlet ' + name[-1], fill=(150, 20, 20), font=small)
    d.ellipse([P(-6, -6), P(6, 6)], outline=(30, 30, 160), width=2); d.text(P(-5, -3), 'PLAZA', fill=(30, 30, 160), font=small)
    d.text(P(118.5, 76), 'E gate', fill=(0, 0, 0), font=small)
    for t, x, z in [('LION', -66, -34), ('FLAMINGO pond', -12, -40), ('GORILLA', 54, -34), ('ZEBRA', 54, 30), ('elephant encl. (unused)', -78, 30), ('reptile house', -22, 19), ('lodge', 83, 26), ('YARD', 100, 58), ('arrival', -4, 66)]:
        d.text(P(x, z), t, fill=(20, 20, 20), font=small)

def gate(d, x, z, hx, hz, col, w=4):
    d.rectangle([P(x - max(hx, .4), z - max(hz, .4)), P(x + max(hx, .4), z + max(hz, .4))], fill=col)

def legend(img, rows, title):
    half = (len(rows) + 1) // 2
    out = Image.new('RGBA', (img.width, img.height + 30 + 22 * half), (255, 255, 255, 255)); out.paste(img, (0, 0))
    d = ImageDraw.Draw(out); y0 = img.height + 4
    d.text((10, y0), title, fill=(0, 0, 0), font=big)
    for i, (col, txt) in enumerate(rows):
        x = 10 + (i // half) * (img.width // 2); y = y0 + 26 + 22 * (i % half)
        d.rectangle([x, y + 2, x + 14, y + 14], fill=col); d.text((x + 20, y), txt, fill=(0, 0, 0), font=font)
    return out

def tint(img, mask, col, alpha):
    over = Image.new('RGBA', img.size, col + (0,))
    a = Image.fromarray((mask * alpha).astype(np.uint8)).resize(img.size, Image.NEAREST)
    over.putalpha(a); img.alpha_composite(over)

# ================================================================ CURRENT
tr = json.load(open(TRACE))
img = Image.new('RGBA', (int((X1 - X0) * PX), int((Z1 - Z0) * PX) + 0), (196, 214, 170, 255))
d = ImageDraw.Draw(img); draw_base(img, d)
# reachable after the breach hold with no fight running (encounter gates open, yard locked)
free_now = reach([], (0, 0))
tint(img, free_now, (255, 210, 0), 110); d = ImageDraw.Draw(img)
for aid, cx, cz, ex, ez, r in arenas:
    d.ellipse([P(cx - r, cz - r), P(cx + r, cz + r)], outline=(200, 0, 0), width=3)
    d.ellipse([P(ex - 12, ez - 12), P(ex + 12, ez + 12)], outline=(200, 0, 0, 120), width=1)
    d.ellipse([P(ex - 1, ez - 1), P(ex + 1, ez + 1)], fill=(200, 0, 0))
for aid, (x, z, hx, hz) in enc_gates.items(): gate(d, x, z, hx, hz, (230, 120, 0))
for x, z, hx, hz in yard_gates: gate(d, x, z, hx, hz, (150, 0, 150))
pts = [(p[1], p[2]) for p in tr['pts'] if not p[5]]
cols = [(0, 90, 255), (0, 160, 255)]
for k in range(1, len(pts)): d.line([P(*pts[k - 1]), P(*pts[k])], fill=(0, 70, 230), width=3)
for e in tr['events']:
    if e['key'].count('1') and e['key'] != tr['events'][0]['key']:
        pass
order = ['flamingo', 'zebra', 'monkey', 'lion', 'gorilla', 'elephant']
prev = None; n = 0
for e in tr['events']:
    ph = [int(e['key'][2 * i + 1]) for i in range(6)]
    if prev is not None:
        for i in range(6):
            if prev[i] == 0 and ph[i] == 1:
                n += 1; x, z = e['x'], e['z']
                d.ellipse([P(x - 2.4, z - 2.4), P(x + 2.4, z + 2.4)], fill=(0, 70, 230)); d.text(P(x - 1, z - 1.6), str(n), fill=(255, 255, 255), font=font)
                d.text(P(x + 3, z - 2), f"{order[i]} engaged t={e['t']:.0f}s", fill=(0, 40, 160), font=small)
    prev = ph
# bypass annotations
for x, z, txt in [(-52, 6, 'open W boulevard'), (28, 6, 'open E boulevard'), (-36, -48, 'open lawn'), (18, -48, 'open lawn'), (24, 40, 'x=24 boulevard: plaza -> APC skips every arena'), (-100, 0, 'x=-96 loop path'), (0, -60, 'N service loop (behind enclosures)'), (100, -20, 'x=96 loop path')]:
    d.text(P(x, z), '! ' + txt, fill=(170, 0, 0), font=small)
img = legend(img, [((255, 210, 0), f'reachable on foot after the breach, no fight running: {free_now.sum() * RES * RES / 1000:.1f}k m2'),
           ((200, 0, 0), 'arena disc (l8Bosses radius) + 12 m engage ring at entry'),
           ((230, 120, 0), "keeper 'far' gate: closed only mid-fight"),
           ((150, 0, 150), 'yard gates: closed until 5 arenas clear'),
           ((0, 70, 230), f"complete-bot route seed {tr['seed']} (finished={tr['finished']}), n = engage order"), ((170, 0, 0), '! = open bypass (no barrier between the boulevards, lawns and arenas)')], 'D-ZOO today (north = top, 1 px = 0.2 m): every lawn, path and arena is one connected area')
img.convert('RGB').save(f'{OUT}/current.png')
print('current reachable m2', free_now.sum() * RES * RES)

# ================================================================ PLAN
# Permanent barriers (layout): hedge lines on lawn, fixed jersey/army barricades where they cross a path.
def seg(x0, z0, x1, z1): return seg_box(x0, z0, x1, z1)
PERM = {
    'H1 N-loop split (x=14)': seg(14, -85.6, 14, -52),
    'H2 W-gap north (z=-52)': seg(-38, -52, -14, -52),
    'H3 E-gap north (z=-52)': seg(14, -52, 38, -52),
    'H4 W-outer north (z=-52)': seg(-115.6, -52, -82, -52),
    'H5 W-outer south (z=12)': seg(-115.6, 12, -82, 12),
    'H6 W-gap south (z=12)': seg(-38, 12, -28, 12),
    'H7 E-gap south (z=12) hedge W': seg(14, 12, 21.5, 12), 'H7b hedge E': seg(26.5, 12, 38, 12),
    'H8 plaza W hedge N': seg(-14, -12, -14, -3), 'H8b plaza W hedge S': seg(-14, 3, -14, 8),
    'H9 plaza E hedge N': seg(14, -12, 14, -3), 'H9b plaza E hedge S': seg(14, 3, 14, 12),
    'H10 E-outer split (x=82, z=-12..12)': seg(82, -12, 82, 12),
    'H11 yard slot (z=46, x=82..84)': seg(82, 46, 84, 46),
    # primate yard round the reptile house: x[-28,14] z[8,32], gates on the x=-24 path
    'M-N fence W': seg(-28, 8, -26.5, 8), 'M-N fence E': seg(-21.5, 8, 14, 8),
    'M-W fence': seg(-28, 8, -28, 32), 'M-E fence': seg(14, 8, 14, 32),
    'M-S fence W': seg(-28, 32, -26.5, 32), 'M-S fence E': seg(-21.5, 32, 14, 32),
    'elephant encl. N gate locked': seg(-63, 12, -57, 12),
    'gorilla N gate locked': seg(57, -52, 63, -52),
}
# Route gates in order: (label, box, opens after step k).  step 0 = breach hold over.
GATES = [
    ('flamingo S (entry)', seg(-3, -12, 3, -12), 0),
    ('flamingo N (exit)', seg(-3, -52, 3, -52), 1),
    ('lion N (entry)', seg(-63, -52, -57, -52), 1),
    ('lion S (exit)', seg(-63, -12, -57, -12), 2),
    ('primate NW (entry)', seg(-26.5, 8, -21.5, 8), 2),
    ('primate SW (exit)', seg(-26.5, 32, -21.5, 32), 3),
    ('zebra S (entry)', seg(57, 52, 63, 52), 3),
    ('zebra N (exit)', seg(57, 12, 63, 12), 4),
    ('gorilla S (entry)', seg(57, -12, 63, -12), 4),
    ('gorilla E (exit, new)', seg(82, -35, 82, -29), 5),
    ('yard N (elephant)', (92, 45.75, 100, 46.25), 5),
]
BREACH = [('plaza W gate', seg(-14, -3, -14, 3)), ('plaza E gate', seg(14, -3, 14, 3)), ('plaza S/boulevard gate', seg(21.5, 12, 26.5, 12))]
YARD_W = (83.75, 56, 84.25, 64)  # stays locked (l8YardGates[0]) until departure
# gorilla E fence must get a 6 m opening at z=-35..-29 for the new exit (remove those fence colliders)
base_plan_removed = [(81.5, -35, 82.5, -29)]

def plan_reach(k):
    """Cells reachable from the plaza when route gates with step <= k-1... are open (state after clearing k arenas)."""
    extra = list(PERM.values()) + [b for _, b in BREACH] + [YARD_W]
    extra += [b for _, b, s in GATES if s > k]
    m = base.copy()
    for x0, z0, x1, z1 in base_plan_removed:
        a, b = g(x0, z0); c, e = g(x1, z1); m[b:e + 1, a:c + 1] = False
    for b in extra: box_mask(m, *b)
    m = ndimage.binary_dilation(m, iterations=int(math.ceil(R / RES)))
    lab, _ = ndimage.label(~m); i, j = g(0, 0)
    return lab == lab[j, i]

order_p = ['flamingo', 'lion', 'monkey', 'zebra', 'gorilla', 'elephant']
centres = {a[0]: (a[1], a[2]) for a in arenas}
centres['monkey'] = (-6, 20)
cells = [plan_reach(k) for k in range(6)]
prev = np.zeros_like(cells[0]); report = []
yard_pt = g(100, 70)
for k, c in enumerate(cells):
    new = c & ~prev
    nxt = order_p[k]; cx, cz = centres[nxt]; i, j = g(cx, cz)
    later = [o for o in order_p[k + 1:] if (lambda ij: c[ij[1], ij[0]])(g(*centres[o]))]
    report.append(dict(after_cleared=order_p[:k], new_area_m2=round(float(new.sum()) * RES * RES), next_arena=nxt, next_reachable=bool(c[j, i]), later_arenas_reachable=later, yard_reachable=bool(c[yard_pt[1], yard_pt[0]])))
    prev = c
print(json.dumps(report, indent=1))
json.dump(report, open(f'{OUT}/plan-cells.json', 'w'), indent=1)

img = Image.new('RGBA', (int((X1 - X0) * PX), int((Z1 - Z0) * PX)), (196, 214, 170, 255))
d = ImageDraw.Draw(img); draw_base(img, d)
# erase the gorilla E opening visually
d.rectangle([P(81.5, -35), P(82.5, -29)], fill=(196, 214, 170))
palette = [(255, 220, 0), (255, 150, 0), (240, 90, 160), (150, 90, 230), (40, 170, 220), (60, 200, 120)]
prev = np.zeros_like(cells[0])
for k, c in enumerate(cells):
    tint(img, c & ~prev, palette[k], 80); prev = c
d = ImageDraw.Draw(img)
for name, b in PERM.items():
    d.rectangle([P(b[0], b[1]), P(b[2], b[3])], fill=(20, 90, 20) if 'locked' not in name else (120, 0, 0))
for name, b, s in GATES: d.rectangle([P(b[0] - .3, b[1] - .3), P(b[2] + .3, b[3] + .3)], fill=(230, 0, 0) if 'exit' in name or 'yard' in name else (0, 120, 255))
for name, b in BREACH: d.rectangle([P(b[0] - .3, b[1] - .3), P(b[2] + .3, b[3] + .3)], fill=(140, 0, 200))
route = [(0, 0), (0, -12), (-6, -27), (0, -52), (0, -64), (-60, -64), (-60, -52), (-60, -32), (-60, -12), (-60, 0), (-24, 0), (-24, 8), (-10, 22), (-24, 32), (-24, 64), (60, 64), (60, 52), (60, 32), (60, 12), (60, -12), (60, -32), (82, -32), (96, -32), (96, 46), (96, 64), (96, 74), (116, 80)]
for a, b in zip(route, route[1:]): d.line([P(*a), P(*b)], fill=(0, 0, 0), width=4)
for i, a in enumerate(order_p):
    cx, cz = centres[a]
    d.ellipse([P(cx - 3, cz - 3), P(cx + 3, cz + 3)], fill=(0, 0, 0)); d.text(P(cx - 1, cz - 1.8), str(i + 1), fill=(255, 255, 255), font=big)
for t, x, z in [('primate yard (new fence)', -26, 34.5), ('H1', 15, -80), ('H10', 83, -4), ('CP', 1, -60), ('CP', -58, -8), ('CP', -22, 36), ('CP', 62, 8), ('CP', 84, -28), ('outlet 2 cohort: E-outer leg', 98, 10), ('outlet 3: N leg', -40, -76), ('outlets 1/4: S leg', -80, 64)]:
    d.text(P(x, z), t, fill=(0, 0, 0), font=small)
img = legend(img, [((255, 220, 0), 'cell 0: plaza + pond (breach)'), ((255, 150, 0), 'cell 1: N service loop + lion (after flamingo)'),
           ((240, 90, 160), 'cell 2: west boulevard + primate yard (after lion)'), ((150, 90, 230), 'cell 3: south field + zebra (after monkey)'),
           ((40, 170, 220), 'cell 4: east boulevard + gorilla (after zebra)'), ((60, 200, 120), 'cell 5: east service lane + yard (after gorilla)'),
           ((20, 90, 20), 'new permanent hedge / fixed barricade line'), ((0, 120, 255), 'entry gate (closes behind the group on engage)'),
           ((230, 0, 0), 'exit gate (opens when the arena clears)'), ((140, 0, 200), 'plaza gates: open in the calm tour, shut after the breach hold'),
           ((0, 0, 0), 'intended route, 1-6 = arena order, CP = checkpoint')], 'Proposed linear L8: six cells, each opens only when the arena before it clears (flood-fill verified)')
img.convert('RGB').save(f'{OUT}/plan.png')
for name in ('current', 'plan'):
    im = Image.open(f'{OUT}/{name}.png'); im.thumbnail((1200, 1200)); im.save(f'{OUT}/{name}-small.png', optimize=True)
