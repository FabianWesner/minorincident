"""Courier tier-2 gear: shin guards, elbow pads, thigh holster (replaces the box placeholders in CharacterView).
Rebuild: python3 tools/blender/run.py assets/acc.courier-gear/build.py -- --out public/assets/models
Every mesh is authored in the local frame of the rig node it is parented to at runtime (glTF Y up, +X forward,
left side = -Z), named `<node>__<paletteToken>`. Blender axes: bx = gx, by = -gz, bz = gy.
Both courier bodies share the same joint layout, so one file serves female and male.
"""
import sys, math, json
from pathlib import Path
import bpy, bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = Path(ARGS[ARGS.index('--out') + 1]) if '--out' in ARGS else HERE
palette = json.loads((REPO / 'src/assets/palette.json').read_text())

def lin(h):
    c = [int(h.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c) + (1,)
MATS = {}
def mat(token):
    if token not in MATS:
        m = bpy.data.materials.new('pal_' + token); m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = lin(palette[token])
        m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .65
        m.diffuse_color = lin(palette[token]); m.use_backface_culling = True
        MATS[token] = m
    return MATS[token]

def G(x, y, z): return Vector((x, -z, y))  # glTF -> Blender

def finish(bm, name, token):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name); bm.to_mesh(mesh); bm.free()
    for p in mesh.polygons: p.use_smooth = True
    mesh.materials.append(mat(token))
    obj = bpy.data.objects.new(name, mesh); bpy.context.scene.collection.objects.link(obj)
    return obj

def shell(name, token, cx, cz, r, thick, y0, y1, dir_deg, half_deg, nh, na, bulge=0.0, crest=0.0):
    """Curved plate wrapped around a vertical axis through (cx, cz); stadium outline, closed solid."""
    bm = bmesh.new()
    def ring(rad_extra, inset):
        rows = []
        for i in range(nh + 1):
            t = i / nh
            # stadium outline: angular half-width shrinks to 0 at the ends (rounded top/bottom)
            w = math.radians(half_deg) * (1 - (2 * t - 1) ** 6) ** .5 * (1 - inset)
            y = y0 + (y1 - y0) * t
            row = []
            for j in range(na + 1):
                a = math.radians(dir_deg) + w * (2 * j / na - 1)
                rr = r + rad_extra + bulge * math.sin(math.pi * t) + crest * math.cos((a - math.radians(dir_deg)) / max(math.radians(half_deg), 1e-3) * math.pi / 2) * math.sin(math.pi * t)
                row.append(bm.verts.new(G(cx + rr * math.cos(a), y, cz + rr * math.sin(a))))
            rows.append(row)
        return rows
    outer, inner = ring(thick, 0), ring(0, 0)
    for rows, flip in ((outer, False), (inner, True)):
        for i in range(nh):
            for j in range(na):
                v = [rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]]
                try: bm.faces.new(v[::-1] if flip else v)
                except ValueError: pass
    # side walls close the solid (left/right edges and the collapsed top/bottom rows)
    for j in range(na):
        for rows_i in (0, nh):
            try: bm.faces.new([outer[rows_i][j], outer[rows_i][j + 1], inner[rows_i][j + 1], inner[rows_i][j]])
            except ValueError: pass
    for i in range(nh):
        for j in (0, na):
            try: bm.faces.new([outer[i][j], outer[i + 1][j], inner[i + 1][j], inner[i][j]])
            except ValueError: pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return finish(bm, name, token)

def band(name, token, cx, cz, r, h, yc, t, n, bump=0.0):
    """Closed strap ring around a vertical axis."""
    bm = bmesh.new()
    levels = [(yc - h / 2, 0), (yc - h / 2, t), (yc + h / 2, t), (yc + h / 2, 0)]
    rings = []
    for y, extra in levels:
        rings.append([bm.verts.new(G(cx + (r + extra + bump * (1 if k == 0 else 0)) * math.cos(2 * math.pi * k / n), y, cz + (r + extra) * math.sin(2 * math.pi * k / n))) for k in range(n)])
    for i in range(4):
        a, b = rings[i], rings[(i + 1) % 4]
        for k in range(n):
            try: bm.faces.new([a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]])
            except ValueError: pass
    return finish(bm, name, token)

def box(name, token, c, size, taper=1.0, rot_z_deg=0.0):
    """Small rounded-ish block (glTF frame centre/size); top face scaled by taper."""
    bm = bmesh.new()
    sx, sy, sz = size
    pts = []
    for yy in (-.5, .5):
        s = taper if yy > 0 else 1
        for xx, zz in ((-.5, -.5), (.5, -.5), (.5, .5), (-.5, .5)):
            pts.append(bm.verts.new(G(c[0] + xx * sx * s, c[1] + yy * sy, c[2] + zz * sz * s)))
    for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([pts[i] for i in f])
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=min(size) * .18, segments=1, affect='EDGES')
    return finish(bm, name, token)

def build(lod):
    hi = lod == 0
    nh, na, nb = (6, 10, 16) if hi else (4, 6, 8)
    for side, sg in (('L', -1), ('R', 1)):
        # shin guard: crested front plate with two straps, strapped to the calf (node origin = knee, shin runs to y -0.177)
        zc = 0.012 * sg * 0 + 0.0
        shell(f'shin{side}__tealDark', 'tealDark', 0.004, zc, 0.066, 0.011, -0.03, -0.138, 0, 62, nh, na, bulge=0.004, crest=0.008)
        band(f'shin{side}__backpackTeal', 'backpackTeal', 0.004, zc, 0.066, 0.014, -0.05, 0.007, nb)
        band(f'shin{side}__orange', 'orange', 0.004, zc, 0.062, 0.016, -0.12, 0.008, nb)
        # elbow pad: cupped plate on the back/outside of the elbow of the upper arm (node origin = shoulder, elbow at y -0.145)
        out_deg = 90 if sg > 0 else 270
        shell(f'arm{side}__tealDark', 'tealDark', 0.0, 0.0, 0.07, 0.012, -0.175, -0.095, 180, 80, max(nh - 2, 3), max(na - 2, 5), bulge=0.012, crest=0.0)
        band(f'arm{side}__orange', 'orange', 0.0, 0.0, 0.07, 0.016, -0.115, 0.007, nb)
    # holster on the right outer thigh (parent legR; thigh axis x0 z0, radius about 0.095): leather pouch shaped like the handgun, grip showing
    shell('legR__leatherShadow', 'leatherShadow', 0.0, 0.0, 0.098, 0.016, -0.17, -0.03, 90, 48, nh, max(na - 2, 5), bulge=0.012, crest=0.012)
    band('legR__leather', 'leather', 0.0, 0.0, 0.098, 0.018, -0.16, 0.006, nb)
    band('legR__leather', 'leather', 0.0, 0.0, 0.098, 0.018, -0.05, 0.006, nb)
    box('legR__uiDark', 'uiDark', (-0.035, 0.004, 0.128), (0.03, 0.05, 0.026), taper=1.0)  # grip top
    box('legR__uiDark', 'uiDark', (0.02, -0.035, 0.122), (0.1, 0.03, 0.02))  # slide edge showing at the pouch mouth
    box('legR__brass', 'brass', (-0.03, -0.03, 0.134), (0.012, 0.012, 0.006))  # pouch stud

for lod in (0, 1):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    MATS.clear()
    build(lod)
    # join per name/material so each node/token pair is one mesh
    groups = {}
    for o in bpy.data.objects: groups.setdefault(o.name.split('.')[0], []).append(o)
    for name, objs in groups.items():
        if len(objs) > 1:
            bpy.ops.object.select_all(action='DESELECT')
            for o in objs: o.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            bpy.ops.object.join()
        (bpy.context.view_layer.objects.active if len(objs) > 1 else objs[0]).name = name
    tris = {}
    for o in bpy.data.objects:
        o.data.name = o.name
        tris[o.name] = sum(len(p.vertices) - 2 for p in o.data.polygons)
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / ('acc.courier-gear.glb' if lod == 0 else 'acc.courier-gear.lod1.glb')
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_apply=True, export_yup=True, export_materials='EXPORT')
    print('GEAR', out.name, tris, 'total', sum(tris.values()))
