"""Sunset Grove (L1 v2) authoring helpers: road grid, lots, fences, shells, plausibility checks.

Conventions (see layouts/D-GROVE/layout.py): X east, Z south, metres. Every building/prop model faces +X at yaw 0, so a
building that faces direction d has yaw FACE_YAW[d]. Fences/gates have their long axis on local Z, hedges on local X.
"""
import json
import math
import random
import re
from pathlib import Path

from sslib import l1_dressing as D

FACE_YAW = {'E': 0.0, 'N': math.pi / 2, 'W': math.pi, 'S': -math.pi / 2}
FRONT = {'E': (1, 0), 'N': (0, -1), 'W': (-1, 0), 'S': (0, 1)}
# Solid assets whose manifest entry is still a placeholder box but that must stay enterable (door gaps in a shell).
HOLLOW = {'bld.clinic-annex', 'bld.cafe-corner', 'bld.courier-depot', 'bld.garage-detached'}
OVERLAP_TOLERANCE = .12


def rot(yaw, lx, lz):
    """Local (x, z) to world offset, same convention as placementColliders (three.js rotation.y)."""
    return lx * math.cos(yaw) + lz * math.sin(yaw), -lx * math.sin(yaw) + lz * math.cos(yaw)


def load_static(root):
    text = (root / 'src/assets/staticCollision.ts').read_text()
    return {m.group(1): json.loads(m.group(2))['boxes'] for m in re.finditer(r'^  "([^"]+)": (\{.*\}),?$', text, re.M)}


class Grove:
    def __init__(self, l):
        self.l = l
        self.root = l.root
        self.static = load_static(self.root)
        self.manifest = l.manifest
        self.solids = []      # (label, x0, z0, x1, z1, ymax) of every non-walkable footprint, for the overlap check
        self.problems = []
        self.cars = {}
        self.rng = random.Random(1)
        self.sidewalks = []
        self.lawn_rects = []
        l.data['lawns'] = []
        original = l.place
        def place(asset, pos, yaw=0, tier=0, allowed=False, scale=(1, 1, 1)):
            # Tiny daisies are baked decorations, as in the other L1 districts (sslib/l1_dressing.py).
            if asset == 'prop.flower': return D.flower(l, *pos, scale, yaw)
            return original(asset, pos, yaw, tier, allowed, scale)
        l.place = place

    # ---- manifest helpers -------------------------------------------------------------------------------------
    def dims(self, asset):
        d = self.manifest[asset]['dimensions']
        return d['x'], d['y'], d['z']

    def placeholder(self, asset):
        return self.manifest[asset].get('status') == 'placeholder'

    def pick(self, asset, fallback):
        """Side-tier assets that are still placeholder boxes fall back to a delivered model."""
        return fallback if self.placeholder(asset) else asset

    # ---- footprints / overlap check ---------------------------------------------------------------------------
    def boxes(self, asset, x, z, yaw, scale):
        sc = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
        out = []
        data = self.static.get(asset)
        if data is None or (asset in HOLLOW and self.placeholder(asset)):
            return out
        for b in data:
            if b['max'][1] <= .45:
                continue
            xs, zs = [], []
            for bx in (b['min'][0], b['max'][0]):
                for bz in (b['min'][2], b['max'][2]):
                    ox, oz = rot(yaw, bx * sc[0], bz * sc[2])
                    xs.append(x + ox); zs.append(z + oz)
            out.append((min(xs), min(zs), max(xs), max(zs), b['max'][1] * sc[1]))
        return out

    def record(self, label, box, group=None):
        x0, z0, x1, z1, y = box
        group = group or label
        for (other, a0, b0, a1, b1, oy, og) in self.solids:
            if og == group:
                continue
            dx = min(x1, a1) - max(x0, a0); dz = min(z1, b1) - max(z0, b0)
            if dx > OVERLAP_TOLERANCE and dz > OVERLAP_TOLERANCE:
                self.problems.append(f'overlap {label} / {other} ({dx:.2f} x {dz:.2f}) at {x0:.1f},{z0:.1f}')
        self.solids.append((label, x0, z0, x1, z1, y, group))

    def blocked(self, x, z, r=0.0):
        return any(a0 - r < x < a1 + r and b0 - r < z < b1 + r for (_, a0, b0, a1, b1, _, _) in self.solids)

    def footprint(self, asset, x, z, yaw, sc):
        """Non-walkable footprint boxes: baked GLB collision when present, else the visual footprint of a solid asset."""
        info = self.manifest[asset]
        hollow = asset in HOLLOW and self.placeholder(asset)
        if hollow:
            return []
        boxes = self.boxes(asset, x, z, yaw, sc)
        if not boxes and (info.get('world') or {}).get('solid'):
            dx, dy, dz = self.dims(asset)
            ex, ez = abs(math.cos(yaw)) * dx * sc[0] + abs(math.sin(yaw)) * dz * sc[2], abs(math.sin(yaw)) * dx * sc[0] + abs(math.cos(yaw)) * dz * sc[2]
            boxes = [(x - ex / 2, z - ez / 2, x + ex / 2, z + ez / 2, dy * sc[1])]
        return boxes

    def fits(self, boxes, margin=0.0):
        for (x0, z0, x1, z1, _) in boxes:
            for (_, a0, b0, a1, b1, _, _) in self.solids:
                if min(x1, a1) - max(x0, a0) > OVERLAP_TOLERANCE - margin and min(z1, b1) - max(z0, b0) > OVERLAP_TOLERANCE - margin:
                    return False
        return True

    def place(self, asset, x, z, yaw=0.0, scale=1.0, check=True, y=0.0, soft=False, margin=0.0):
        sc = (scale, scale, scale) if isinstance(scale, (int, float)) else tuple(scale)
        l = self.l
        boxes = self.footprint(asset, x, z, yaw, sc)
        if soft and not self.fits(boxes, margin):
            return None
        pid = l.place(asset, [x, y, z], yaw=yaw, scale=sc)
        if asset in HOLLOW and self.placeholder(asset):
            # Placeholder box: replace the footprint collider by walls with door gaps (see shell()).
            l.data['colliders'] = [c for c in l.data['colliders'] if c['id'] != pid]
        self.count = getattr(self, 'count', 0) + 1
        for b in boxes:
            label = f'{asset}@{x:.1f},{z:.1f}'
            if check:
                self.record(label, b, f'{asset}#{self.count}')
            else:
                self.solids.append((label, *b, f'{asset}#{self.count}'))
        return pid

    def solid(self, name, token, size, pos, collide=True):
        l = self.l
        o = l.box(name, token, size, pos)
        if collide:
            D.collider(l, name, size, pos)
            self.record(f'{name}@{pos[0]:.1f},{pos[2]:.1f}', (pos[0] - size[0] / 2, pos[2] - size[2] / 2, pos[0] + size[0] / 2, pos[2] + size[2] / 2, pos[1] + size[1] / 2))
        return o

    def collide_only(self, name, size, pos):
        D.collider(self.l, name, size, pos)
        self.record(f'{name}@{pos[0]:.1f},{pos[2]:.1f}', (pos[0] - size[0] / 2, pos[2] - size[2] / 2, pos[0] + size[0] / 2, pos[2] + size[2] / 2, pos[1] + size[1] / 2))

    # ---- hollow placeholder shell -----------------------------------------------------------------------------
    def shell(self, name, cx, cz, facing, depth, width, doors, wall=.4, height=3.2):
        """Wall boxes around a placeholder footprint. doors: list of (side, lateral_offset, gap) with side in front/back/left/right
        (relative to the facing direction). Interior stays walkable; door gaps are accessible."""
        yaw = FACE_YAW[facing]
        hd, hw = depth / 2, width / 2
        specs = {  # side: (local centre x, local centre z, size along local x, size along local z, axis of the gap)
            'front': (hd - wall / 2, 0, wall, width, 'z'),
            'back': (-hd + wall / 2, 0, wall, width, 'z'),
            'left': (0, -hw + wall / 2, depth, wall, 'x'),
            'right': (0, hw - wall / 2, depth, wall, 'x'),
        }
        for side, (lx, lz, sx, sz, axis) in specs.items():
            gaps = sorted((off - gap / 2, off + gap / 2) for s, off, gap in doors if s == side)
            span = sz if axis == 'z' else sx
            cuts, start = [], -span / 2
            for g0, g1 in gaps:
                if g0 > start + .05: cuts.append((start, g0))
                start = g1
            if start < span / 2 - .05: cuts.append((start, span / 2))
            for a, b in cuts:
                mid = (a + b) / 2
                px, pz = (lx, lz + mid) if axis == 'z' else (lx + mid, lz)
                ox, oz = rot(yaw, px, pz)
                size_l = (sx, b - a) if axis == 'z' else (b - a, sz)
                if abs(math.sin(yaw)) > .5: size_l = (size_l[1], size_l[0])
                D.collider(self.l, f'{name}', [size_l[0], height, size_l[1]], [cx + ox, height / 2, cz + oz])
                self.record(f'{name}', (cx + ox - size_l[0] / 2, cz + oz - size_l[1] / 2, cx + ox + size_l[0] / 2, cz + oz + size_l[1] / 2, height), name)

    # ---- roads --------------------------------------------------------------------------------------------------
    def roads(self, roads, sidewalk=2.0, crossings=()):
        """roads: list of dict(id, a, b, w, kind) with axis-aligned (x, z) endpoints. Builds graph, asphalt, kerbs, sidewalks, markings."""
        l = self.l
        for o in list(l.layers[0]):
            if o.name.startswith('road-'):
                l.layers[0].remove(o)
                import bpy
                bpy.data.objects.remove(o, do_unlink=True)
        data = l.data
        data['roads'] = dict(nodes=[], edges=[])
        data['surfaces'] = [s for s in data['surfaces'] if s['surface'] == 'grass']
        self.road_list = roads
        pts = {}
        def nid(p):
            key = (round(p[0], 3), round(p[1], 3))
            if key not in pts:
                pts[key] = f'n{len(pts)}'
                data['roads']['nodes'].append(dict(id=pts[key], point=[key[0], key[1]]))
            return pts[key]
        # intersection split points
        for r in roads:
            ax = 0 if r['a'][1] == r['b'][1] else 1
            cuts = {r['a'][ax], r['b'][ax]}
            for o in roads:
                if o is r: continue
                oax = 0 if o['a'][1] == o['b'][1] else 1
                if oax == ax: continue
                c = o['a'][ax]
                lo, hi = sorted((r['a'][ax], r['b'][ax]))
                olo, ohi = sorted((o['a'][1 - ax], o['b'][1 - ax]))
                if lo - 1e-6 <= c <= hi + 1e-6 and olo - 1e-6 <= r['a'][1 - ax] <= ohi + 1e-6:
                    cuts.add(c)
            cuts = sorted(cuts)
            r['ax'] = ax; r['cuts'] = cuts
            for c0, c1 in zip(cuts, cuts[1:]):
                if r['kind'] != 'road':
                    continue   # alleys are surfaces only: they stay out of the street graph (no traffic, no lane keep-out)
                # graph ends may stop short of the drawn road so that road-work barriers sit outside every lane keep-out
                glo, ghi = sorted(((r.get('ga') or r['a'])[ax], (r.get('gb') or r['b'])[ax]))
                c0, c1 = max(c0, glo), min(c1, ghi)
                if c1 - c0 < 1e-6:
                    continue
                p0 = [c0, r['a'][1]] if ax == 0 else [r['a'][0], c0]
                p1 = [c1, r['a'][1]] if ax == 0 else [r['a'][0], c1]
                data['roads']['edges'].append(dict(id=f"{r['id']}-{len(data['roads']['edges'])}", start=nid(p0), end=nid(p1), points=[p0, p1], laneWidth=r['w']))
        for r in roads:
            ax = r['ax']; lo, hi = r['cuts'][0], r['cuts'][-1]
            half = r['w'] / 2
            token = 'asphalt' if r['kind'] == 'road' else 'uiDark'
            segs = [(lo, hi)]
            if r['kind'] != 'road':
                # Alleys are drawn kerb to kerb between the streets they join, so no gravel lies under the asphalt.
                segs = []
                for c0, c1 in zip(r['cuts'], r['cuts'][1:]):
                    m0 = max([o['w'] / 2 for o in roads if o is not r and o['ax'] != ax and abs(o['a'][ax] - c0) < 1e-6 and o['kind'] == 'road'] or [0])
                    m1 = max([o['w'] / 2 for o in roads if o is not r and o['ax'] != ax and abs(o['a'][ax] - c1) < 1e-6 and o['kind'] == 'road'] or [0])
                    segs.append((c0 + m0, c1 - m1))
            for s0, s1 in segs:
                length = s1 - s0; mid = (s0 + s1) / 2
                size = [length, .08, r['w']] if ax == 0 else [r['w'], .08, length]
                pos = [mid, .01, r['a'][1]] if ax == 0 else [r['a'][0], .01, mid]
                l.box('road-' + r['id'], token, size, pos)
                data['surfaces'].append(dict(surface='asphalt' if r['kind'] == 'road' else 'gravel', polygon=self.rect_poly(pos, size)))
            if r['kind'] != 'road':
                continue
            line = r['a'][1 - ax]
            # kerb lip, gutter, sidewalk strips with gaps where side streets join
            for side in (-1, 1):
                gaps = []
                for o in roads:
                    if o is r or o['ax'] == ax: continue
                    c = o['a'][ax]; olo, ohi = sorted((o['a'][1 - ax], o['b'][1 - ax]))
                    # does the side street leave this side of the road?
                    if (side < 0 and olo < line - 1e-6 and c >= lo - 1e-6 and c <= hi + 1e-6) or (side > 0 and ohi > line + 1e-6 and c >= lo - 1e-6 and c <= hi + 1e-6):
                        if olo - 1e-6 <= line <= ohi + 1e-6 or True:
                            gaps.append((c - o['w'] / 2, c + o['w'] / 2))
                gaps.sort()
                segs, start = [], lo
                for g0, g1 in gaps:
                    if g0 > start: segs.append((start, g0))
                    start = max(start, g1)
                if start < hi: segs.append((start, hi))
                for s0, s1 in segs:
                    if s1 - s0 < .3: continue
                    m = (s0 + s1) / 2; ln = s1 - s0
                    off = side * (half + sidewalk / 2)
                    sz = [ln, .18, sidewalk] if ax == 0 else [sidewalk, .18, ln]
                    ps = [m, .04, line + off] if ax == 0 else [line + off, .04, m]
                    l.box('walk', 'sidewalk', sz, ps)
                    self.sidewalks.append((ps, sz))
                    lip = [ln, .13, .13] if ax == 0 else [.13, .13, ln]
                    pl = [m, .035, line + side * (half + .04)] if ax == 0 else [line + side * (half + .04), .035, m]
                    l.box('curb-lip', 'picketWhite', lip, pl)
                    gut = [ln, .015, .18] if ax == 0 else [.18, .015, ln]
                    pg = [m, .057, line + side * (half - .15)] if ax == 0 else [line + side * (half - .15), .057, m]
                    l.box('gutter', 'denim', gut, pg)
            # dashed centre line
            v = lo + 3
            while v < hi - 2:
                if not any(abs(v - o['a'][ax]) < o['w'] / 2 + 1.8 for o in roads if o is not r and o['ax'] != ax and o['kind'] == 'road'):
                    sz = [1.4, .014, .12] if ax == 0 else [.12, .014, 1.4]
                    p = [v, .065, line] if ax == 0 else [line, .065, v]
                    l.box('lane-mark', 'picketWhite', sz, p)
                v += 4
        return data

    @staticmethod
    def rect_poly(pos, size):
        x, z = pos[0], pos[2]; hx, hz = size[0] / 2, size[2] / 2
        return [[x - hx, z - hz], [x + hx, z - hz], [x + hx, z + hz], [x - hx, z + hz], [x - hx, z - hz]]

    def crosswalk(self, cx, cz, axis, w=5.0, sidewalk=2.0):
        """Zebra stripes across the road arm leaving the intersection centre; axis = direction of travel across (0: crossing along x)."""
        l = self.l
        for k in range(-2, 3):
            if axis == 1:   # stripes laid along z, spread along x
                l.box('crosswalk', 'picketWhite', [.5, .014, 1.05], [cx + k * .85, .066, cz])
            else:
                l.box('crosswalk', 'picketWhite', [1.05, .014, .5], [cx, .066, cz + k * .85])

    def lawn(self, x0, z0, x1, z1):
        if x1 - x0 > .5 and z1 - z0 > .5:
            self.l.data['lawns'].append(dict(min=[x0, z0], max=[x1, z1]))

    def path(self, x0, z0, x1, z1, token='sidewalk'):
        """Walkable paving strip between two points (axis-aligned)."""
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        self.l.box('yard-path', token, [abs(x1 - x0) or 1.2, .06, abs(z1 - z0) or 1.2], [cx, .02, cz])

    # ---- fences / hedges -----------------------------------------------------------------------------------------
    def fence(self, kind, x0, z0, x1, z1, gaps=(), scale_y=1.0, label=None):
        """Axis-aligned fence run with optional gaps [(centre, width)] measured along the run. Returns list of placement ids."""
        asset = {'picket': 'prop.picket-fence', 'privacy': 'prop.privacy-fence'}[kind]
        length_model = self.dims(asset)[2]
        ax = 0 if abs(z1 - z0) < 1e-6 else 1
        a0, a1 = (x0, x1) if ax == 0 else (z0, z1)
        if a1 < a0: a0, a1 = a1, a0
        base = z0 if ax == 0 else x0
        spans, start = [], a0
        for c, w in sorted(gaps):
            if c - w / 2 > start + .05: spans.append((start, c - w / 2))
            start = max(start, c + w / 2)
        if start < a1 - .05: spans.append((start, a1))
        yaw = math.pi / 2 if ax == 0 else 0.0
        for s0, s1 in spans:
            n = max(1, round((s1 - s0) / length_model))
            seg = (s1 - s0) / n
            for i in range(n):
                m = s0 + seg * (i + .5)
                x, z = (m, base) if ax == 0 else (base, m)
                self.place(asset, x, z, yaw, (1, scale_y, seg / length_model))

    def hedge(self, x0, z0, x1, z1, scale=1.2, gaps=()):
        """Hedge run (model long axis X). scale raises it above the 1.6 m sight line."""
        length_model = self.dims('prop.hedge')[0] * scale
        ax = 0 if abs(z1 - z0) < 1e-6 else 1
        a0, a1 = sorted((x0, x1) if ax == 0 else (z0, z1))
        base = z0 if ax == 0 else x0
        spans, start = [], a0
        for c, w in sorted(gaps):
            if c - w / 2 > start + .05: spans.append((start, c - w / 2))
            start = max(start, c + w / 2)
        if start < a1 - .05: spans.append((start, a1))
        yaw = 0.0 if ax == 0 else math.pi / 2
        for s0, s1 in spans:
            n = max(1, round((s1 - s0) / length_model))
            seg = (s1 - s0) / n
            for i in range(n):
                m = s0 + seg * (i + .5)
                x, z = (m, base) if ax == 0 else (base, m)
                self.place('prop.hedge', x, z, yaw, (seg / self.dims('prop.hedge')[0], scale, scale))

    # ---- small details ------------------------------------------------------------------------------------------
    def flowers(self, x0, z0, x1, z1, n):
        for _ in range(n):
            x = x0 + self.rng.random() * (x1 - x0); z = z0 + self.rng.random() * (z1 - z0)
            if self.blocked(x, z, .15): continue
            D.flower(self.l, x, 0, z, (.5, .6, .8), self.rng.random() * math.pi)

    def report(self):
        return self.problems
