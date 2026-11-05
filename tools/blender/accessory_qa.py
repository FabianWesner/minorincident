"""Accessory fit + QA sheets: python3 tools/blender/run.py tools/blender/accessory_qa.py --render -- [--fits] [--sheets OUT] [--only id,id]

--fits    measure per-base fit (scale + offset, head-joint local) and print/write assets/accessory-fits.json
--sheets  per accessory a sheet: columns = 3 bases, rows = before / LOD0 front / LOD0 back / LOD1 front / LOD1 back / game scale;
          also prints skull clip metrics (poke-through vertices, gap) against every base head.
"""
import json
import math
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sslib.accessory_set import BUILDERS
from sslib import accessories as A

BASES = ['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b', 'npc.civilian-elderly', 'npc.civilian-kid']
SHEET_BASES = {'acc.hat-baseball-cap': 0}
TINT = {'hat': (0.62, 0.12, 0.10), 'hair': (0.16, 0.07, 0.03)}
HAT_TINTS = [(0.30, 0.05, 0.04), (0.04, 0.10, 0.30), (0.55, 0.40, 0.08), (0.80, 0.30, 0.02), (0.30, 0.30, 0.32), (0.06, 0.28, 0.12)]
HAIR_TINTS = [(0.34, 0.16, 0.07), (0.10, 0.08, 0.08), (0.85, 0.62, 0.25), (0.62, 0.25, 0.10), (0.70, 0.70, 0.74), (0.45, 0.22, 0.10)]
FITS_PATH = ROOT / 'assets/accessory-fits.json'
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path, tag=None):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    if tag:
        for o in new:
            o.name = f'{tag}:{o.name}'
    return new


def head_meshes(objs):
    head = next(o for o in objs if o.name.split(':')[-1] == 'head')
    return head, [o for o in objs if o.type == 'MESH' and o.parent == head]


HIDE_PREFIX = ('pal_hair', 'pal_cap', 'pal_woodWarm', 'pal_denimLight', 'pal_schoolBusYellow')


def mat_names(o):
    return [m.name if m else '' for m in o.data.materials]


def skin_verts(o):
    """Vertices of polygons with a skin material (head meshes can be multi-material, e.g. the kid)."""
    names = mat_names(o)
    ids = {v for poly in o.data.polygons if 'skin' in names[poly.material_index] for v in poly.vertices}
    return [o.matrix_world @ o.data.vertices[i].co for i in sorted(ids)]


def skin_points(objs):
    head, meshes = head_meshes(objs)
    return head, [p for o in meshes for p in skin_verts(o)]


def head_points(objs):
    head, meshes = head_meshes(objs)
    return head, [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]


def band_metrics(points):
    top = max(p.z for p in points)
    band = [p for p in points if top - .20 <= p.z <= top - .05]
    width = max(abs(p.y) for p in points if top - .16 <= p.z <= top - .06)
    return {'top': top, 'back': min(p.x for p in band), 'width': width}


def ray_stats(local_verts, polys, base_pts, fit):
    """Cast rays from the fitted cranium centre through every base head vertex against the fitted shell."""
    sx, sy, sz = fit['scale']
    ox, oy, oz = fit['offset']
    world = [Vector((ox + sx * x, oy + sy * y, oz + sz * z)) for x, y, z in local_verts]
    centre = Vector((ox + sx * A.C.x, oy + sy * A.C.y, oz + sz * (A.C.z - A.HEAD_JOINT_Z)))
    bvh = BVHTree.FromPolygons(world, polys)
    top = max(p.z for p in base_pts)
    pokes, depth, deep = 0, 0.0, 0
    outer = {}   # visible surface only: farthest base vertex per direction bin
    for p in base_pts:
        d = p - centre
        dist = d.length
        if dist < 1e-6:
            continue
        hit = bvh.ray_cast(centre, d / dist)
        if hit[0] is None:
            continue
        gap = hit[3] - dist
        if gap < -.005:
            pokes += 1
            deep += gap < -.010
            depth = max(depth, -gap)
        elif p.z > top - .12:
            key = (int(math.degrees(math.atan2(d.y, d.x)) // 15), int(math.degrees(math.asin(max(-1.0, min(1.0, d.z / dist)))) // 12))
            if key not in outer or dist > outer[key][0]:
                outer[key] = (dist, gap)
    return pokes, depth, [g for _, g in outer.values()], deep


def fit_cost(local_verts, polys, base_pts, fit):
    pokes, depth, gaps, deep = ray_stats(local_verts, polys, base_pts, fit)
    if not gaps:
        return 1e9
    gaps.sort()
    return pokes * .3 + depth * 300 + abs(gaps[len(gaps) // 2] - .024) * 100 + abs(gaps[int(len(gaps) * .95)] - .036) * 50


def measure_fits():
    """Coordinate-descent fit of each base against the tight reference hair piece (short crop)."""
    clear()
    objs = import_glb(ROOT / 'assets/acc.hair-short-crop/model.glb')
    mesh = next(o for o in objs if o.type == 'MESH')
    local = [tuple(v.co) for v in mesh.data.vertices]
    polys = [tuple(p.vertices) for p in mesh.data.polygons]
    fits = {}
    for base in BASES:
        clear()
        bobjs = import_glb(ROOT / f'assets/{base}/model.glb')
        head, pts = skin_points(bobjs)
        jz = head.matrix_world.translation.z
        fit = {'scale': [.85, .85, .85], 'offset': [0.0, 0.0, jz]}
        best = fit_cost(local, polys, pts, fit)
        for step in (.1, .05, .025, .0125, .006):
            for _ in range(4):
                for key, idx in [('scale', 0), ('scale', 1), ('scale', 2), ('offset', 0), ('offset', 2)]:
                    for delta in (-step, step):
                        trial = {'scale': list(fit['scale']), 'offset': list(fit['offset'])}
                        trial[key][idx] += delta * (1 if key == 'scale' else .5)
                        if key == 'scale' and not .7 <= trial[key][idx] <= 1.15:
                            continue
                        cost = fit_cost(local, polys, pts, trial)
                        if cost < best - 1e-6:
                            best, fit = cost, trial
        pokes, depth, gaps, deep = ray_stats(local, polys, pts, fit)
        gaps.sort()
        print('FITDETAIL', base, 'cost', round(best, 2), 'pokes', pokes, 'poke_mm', round(depth * 1000, 1), 'deep', deep, 'of', len(pts), 'gap_med_cm', round(gaps[len(gaps) // 2] * 100, 1))
        fits[base] = {'scale': [round(v, 3) for v in fit['scale']], 'offset': [round(fit['offset'][0], 3), 0, round(fit['offset'][2] - jz, 3)]}
    return fits, {}


def load_fits():
    return json.loads(FITS_PATH.read_text())


def place_accessory(acc_id, lod, base_head, fit):
    path = ROOT / f'assets/{acc_id}/model{"" if lod == 0 else ".lod1"}.glb'
    objs = import_glb(path)
    root = next(o for o in objs if o.parent is None and o.type == 'EMPTY')
    # Same head bone at every LOD: the packed LOD1 base carries sourceScale on its nodes, so the fit is
    # applied in the (scaled) head's frame.
    k = base_head.matrix_world.to_scale()
    root.scale = tuple(fit['scale'][i] * k[i] for i in range(3))
    root.location = base_head.matrix_world.translation + Vector(fit['offset']) * k.x
    bpy.context.view_layer.update()
    return objs


def tint(objs, rgb):
    for o in objs:
        if o.type == 'MESH':
            m = o.data.materials[0].copy()
            m.diffuse_color = (*rgb, 1)
            bsdf = m.node_tree.nodes['Principled BSDF']
            for link in list(m.node_tree.links):
                if link.to_socket == bsdf.inputs['Base Color']:
                    m.node_tree.links.remove(link)
            bsdf.inputs['Base Color'].default_value = (*rgb, 1)
            o.data.materials[0] = m


def clip_metrics(acc_objs, base_objs, centre, base_head):
    """Skull clipping (skin vertices through the shell) is reported apart from base hair/headwear poking through."""
    mesh = next(o for o in acc_objs if o.type == 'MESH')
    mw = mesh.matrix_world
    bvh = BVHTree.FromPolygons([mw @ v.co for v in mesh.data.vertices], [tuple(p.vertices) for p in mesh.data.polygons])
    _, meshes = head_meshes(base_objs)
    skin_set = {tuple(round(c, 5) for c in p) for o in meshes for p in skin_verts(o)}
    pts = [(o.matrix_world @ v.co, tuple(round(c, 5) for c in (o.matrix_world @ v.co)) in skin_set) for o in meshes for v in o.data.vertices]
    top = max(p.z for p, skin in pts if skin)
    out = {'skin': [0, 0.0], 'other': [0, 0.0]}
    outer = {}
    bad = []
    for p, skin in pts:
        d = p - centre
        dist = d.length
        if dist < 1e-6:
            continue
        hit = bvh.ray_cast(centre, d / dist)
        if hit[0] is None:
            continue
        gap = hit[3] - dist
        if gap < -.005:
            rec = out['skin' if skin else 'other']
            if skin:
                bad.append(p)
            rec[0] += 1
            rec[1] = max(rec[1], -gap)
        elif skin and p.z > top - .12:
            key = (int(math.degrees(math.atan2(d.y, d.x)) // 15), int(math.degrees(math.asin(max(-1.0, min(1.0, d.z / dist)))) // 12))
            if key not in outer or dist > outer[key][0]:
                outer[key] = (dist, gap)
    gaps = sorted(g for _, g in outer.values())
    if bad:
        print('SKINPOKE', [round(min(p[i] for p in bad), 3) for i in range(3)], [round(max(p[i] for p in bad), 3) for i in range(3)])
    return {'skin_pokes': out['skin'][0], 'skin_max_mm': round(out['skin'][1] * 1000, 1),
            'base_hair_pokes': out['other'][0], 'base_hair_max_mm': round(out['other'][1] * 1000, 1),
            'crown_gap_cm_med': round(gaps[len(gaps) // 2] * 100, 1) if gaps else None}


def setup_scene(res):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 10
    scene.cycles.use_denoising = False
    scene.render.resolution_x = scene.render.resolution_y = res
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new('w')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (.8, .82, .86, 1)
    bg.inputs['Strength'].default_value = 1.1
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 2.2
    so = bpy.data.objects.new('sun', sun)
    bpy.context.scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    bpy.context.scene.collection.objects.link(cam)
    scene.camera = cam
    return scene, cam


def shoot(scene, cam, target, azimuth_deg, radius, fov_deg, base_forward_deg=0):
    polar = math.pi * .30
    az = math.radians(azimuth_deg + base_forward_deg)
    cam.location = target + Vector((radius * math.sin(polar) * math.cos(az), radius * math.sin(polar) * math.sin(az), radius * math.cos(polar)))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.angle = math.radians(fov_deg)
    scene.render.filepath = '/tmp/acc_cell.png'
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load('/tmp/acc_cell.png', check_existing=False)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)
    bpy.data.images.remove(img)
    return px


def hide(objs, state=True):
    for o in objs:
        o.hide_render = state


def strip_copies(objs):
    """For head meshes carrying base hair/headwear, make a copy without those polygons (the system lane hides them)."""
    import bmesh
    made = []
    for o in list(objs):
        if o.type != 'MESH' or not o.parent or o.parent.name.split(':')[-1] != 'head':
            continue
        names = mat_names(o)
        bad = [i for i, n in enumerate(names) if n.startswith(HIDE_PREFIX)]
        if not bad and 'pal_picketWhite' not in names:
            continue
        o['has_hideable'] = True
        copy = o.copy()
        copy.data = o.data.copy()
        copy.name = o.name + ':strip'
        bpy.context.scene.collection.objects.link(copy)
        copy.parent = o.parent
        copy.matrix_parent_inverse = o.matrix_parent_inverse
        bm = bmesh.new()
        bm.from_mesh(copy.data)
        mw = o.matrix_world
        crown = o.parent.matrix_world.translation.z + .26      # cap panels reuse picketWhite above the eyes
        drop = [f for f in bm.faces if f.material_index in bad or (names[f.material_index] == 'pal_picketWhite' and (mw @ f.calc_center_median()).z > crown)]
        bmesh.ops.delete(bm, geom=drop, context='FACES')
        bm.to_mesh(copy.data)
        bm.free()
        made.append(copy)
    return made


def sheets(out_dir, only):
    fits = load_fits()
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    ids = [i for i in BUILDERS if not only or i in only]
    sheet_bases = BASES  # all six bases are rendered; first three drive the picture rows, all six get metrics
    res = 240
    report = {}
    cells = {}
    clear()
    scene, cam = setup_scene(res)
    ground = bpy.data.objects.new('ground', None)
    ground.hide_render = True
    # one scene per base: base lod0 + lod1 side by side in X, accessories added per sheet
    base_state = {}
    for bi, base in enumerate(BASES):
        lod0 = import_glb(ROOT / f'assets/{base}/model.glb', base + ':0')
        lod1 = import_glb(ROOT / f'assets/{base}/model.lod1.glb', base + ':1')
        for o in lod0:
            if o.parent is None:
                o.location.x += 0
        lod0 += strip_copies(lod0)
        h0 = next(o for o in lod0 if o.name.split(':')[-1] == 'head')
        lod1 += strip_copies(lod1)
        h1 = next(o for o in lod1 if o.name.split(':')[-1] == 'head')
        base_state[base] = {'lod0': lod0, 'lod1': lod1, 'head': h0, 'head1': h1}
        hide(lod0)
        hide(lod1)
        for o in lod0 + lod1:
            o.hide_viewport = False
    r_close = 2.6
    r_game = 19 / 1.257
    game_fov = math.degrees(2 * math.atan(res / 1080 * math.tan(math.radians(12.5))))
    close_fov = math.degrees(2 * math.atan(1.0 / (2 * r_close)))
    def centre_of(base, lod=0):
        h = base_state[base]['head' if lod == 0 else 'head1']
        k = h.matrix_world.to_scale().x
        t = h.matrix_world.translation
        return Vector((t.x - .02 * k, 0, t.z + .16 * k))

    def show(base, lod, strip):
        objs = base_state[base]['lod0' if lod == 0 else 'lod1']
        hide(objs, False)
        for o in objs:
            if o.name.endswith(':strip'):
                o.hide_render = not strip
            elif strip and o.get('has_hideable'):
                o.hide_render = True
    # before views
    before = {}
    for base in BASES:
        hide(base_state[base]['lod0'], False)
        c = centre_of(base)
        before[base] = (shoot(scene, cam, c, 35, r_close, close_fov), shoot(scene, cam, c, 215, r_close, close_fov))
        hide(base_state[base]['lod0'], True)
    for idx, acc in enumerate(ids):
        rows = {k: [] for k in ('before', 'l0f', 'l0b', 'l1f', 'l1b', 'game')}
        tints = HAT_TINTS if '.hat-' in acc else HAIR_TINTS
        for bi, base in enumerate(BASES):
            c = centre_of(base)
            fit = fits[base]
            head = base_state[base]['head']
            rows['before'].append(before[base][0])
            for lod, front_key, back_key in ((0, 'l0f', 'l0b'), (1, 'l1f', 'l1b')):
                show(base, lod, True)
                head = base_state[base]['head' if lod == 0 else 'head1']
                ss = head.matrix_world.to_scale().x
                c = centre_of(base, lod)
                acc_objs = place_accessory(acc, lod, head, fit)
                tint(acc_objs, tints[idx % len(tints)])
                if lod == 0:
                    fc = head.matrix_world.translation + Vector((fit['offset'][0] + fit['scale'][0] * A.C.x, fit['scale'][1] * A.C.y, fit['offset'][2] + fit['scale'][2] * (A.C.z - A.HEAD_JOINT_Z)))
                    cm = clip_metrics(acc_objs, base_state[base]['lod0'], fc, head)
                    report.setdefault(acc, {})[base] = cm
                rows[front_key].append(shoot(scene, cam, c, 35, r_close * ss, close_fov))
                rows[back_key].append(shoot(scene, cam, c, 215, r_close * ss, close_fov))
                if lod == 0:
                    rows['game'].append(shoot(scene, cam, c, 45, r_game, game_fov))
                for o in acc_objs:
                    bpy.data.objects.remove(o, do_unlink=True)
                hide(base_state[base]['lod0' if lod == 0 else 'lod1'], True)
        # tile: 6 bases across (two sheets of 3: men / others combined into one wide image of 6 columns)
        order = ['before', 'l0f', 'l0b', 'l1f', 'l1b', 'game']
        h = []
        for k in order:
            h.append(np.concatenate(rows[k], axis=1))
        sheet = np.concatenate(h[::-1], axis=0)[::-1]  # image rows are bottom-up in Blender
        sheet = np.concatenate(h[::-1], axis=0)
        img = bpy.data.images.new(acc, width=sheet.shape[1], height=sheet.shape[0], alpha=True)
        img.pixels = sheet.ravel().tolist()
        img.filepath_raw = str(out / (acc + '.png'))
        img.file_format = 'PNG'
        img.save()
        bpy.data.images.remove(img)
        print('SHEET', acc, json.dumps(report[acc]))
    (out / 'clip-metrics.json').write_text(json.dumps(report, indent=1))


if '--fits' in args:
    fits, metrics = measure_fits()
    FITS_PATH.write_text(json.dumps(fits, indent=1) + '\n')
    print('FITS', json.dumps(fits))
    
if opt('--sheets'):
    sheets(opt('--sheets'), (opt('--only') or '').split(',') if opt('--only') else None)
