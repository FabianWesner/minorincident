"""W5 damage authored on the shipped base GLBs, one explicit recipe per distance tier.

Import each base's authored source tier without rescaling. Split its closed parts,
cut a broad jagged collapse, fracture glazing, and add in-envelope rubble. Anchors,
physics, moving owners and the original plinth remain owned by the base.
"""
import argparse
import json
import math
import random
import shutil
import sys
from pathlib import Path
import bmesh
import bpy
from mathutils import Vector
from .fairhaven import S
from . import ao, colliders, export, palette, sockets

ROOT = Path(__file__).resolve().parents[3]


def bounds(obj):
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return ([min(p[k] for p in pts) for k in range(3)], [max(p[k] for p in pts) for k in range(3)])


def erase(obj):
    bpy.data.objects.remove(obj, do_unlink=True)


def subtract(obj, cutter):
    mod = obj.modifiers.new('authored fracture', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.material_mode = 'TRANSFER'
    mod.object = cutter
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if not obj.data.polygons:
        erase(obj)


def load(asset, lod):
    filename = 'model' + (f'.lod{lod}' if lod else '') + '.glb'
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets' / asset / filename))
    s = S.__new__(S)
    s.asset, s.lod, s.cache = asset, lod, {}
    s.root = bpy.data.objects['root']
    s.body = bpy.data.objects['body']
    s.protected = {'body', 'door_cellar', 'shutter'}
    # Weld importer normal splits, then recover the base's original solid pieces.
    for obj in list(s.root.children_recursive):
        if obj.type != 'MESH':
            continue
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.remove_doubles(threshold=.000001)
        bpy.ops.mesh.separate(type='LOOSE')
        bpy.ops.object.mode_set(mode='OBJECT')
    if asset.endswith('metro-entrance'):
        sockets.empty('braceSlotSocket', (2.43, 0, 1.2), s.root)
        colliders.cuboid('shutter', (.1, 2.8, 2.175), (0, 0, 2.22), bpy.data.objects['shutter'])
    return s


def fracture_windows(s):
    """Replace intact emissive panes by recessed black cavities and glass teeth."""
    for obj in list(s.root.children_recursive):
        if obj.type != 'MESH' or not obj.data.materials or not obj.data.materials[0].name.startswith('emi_'):
            continue
        lo, hi = bounds(obj)
        size = [hi[k] - lo[k] for k in range(3)]
        axis = min(range(3), key=lambda k: size[k])
        # Only upright window panes; small fixtures become dark housings below.
        if axis == 2 or max(size[:2]) < .5 or size[2] < .45:
            obj.data.materials.clear(); obj.data.materials.append(palette.mat('uiDark'))
            continue
        lateral = 1 - axis
        mid = [(lo[k] + hi[k]) / 2 for k in range(3)]
        obj.data.materials.clear(); obj.data.materials.append(palette.mat('uiDark'))
        # Tooth clusters are explicit closed triangular prisms at the pane borders.
        n = (4, 3, 2)[s.lod]
        w = size[lateral] / n
        for i in range(n):
            y = lo[lateral] + (i + .5) * w
            h = size[2] * (.18 + .07 * (i % 2))
            profile = [(y - w * .47, lo[2]), (y + w * .12, lo[2] + h), (y + w * .45, lo[2])]
            s.extrude('brokenGlassSill', profile, 'x' if axis == 0 else 'y', lo[axis] - .015, hi[axis] + .018, 'sidewalk')
            if s.lod < 2 or i == 0:
                profile = [(y - w * .45, hi[2]), (y - w * .15, hi[2] - h * .9), (y + w * .43, hi[2])]
                s.extrude('brokenGlassHead', profile, 'x' if axis == 0 else 'y', lo[axis] - .015, hi[axis] + .018, 'sidewalk')
    # Dead grid anchors remain addressable, with no surviving emissive references.
    for obj in s.root.children_recursive:
        if 'ss_light' in obj:
            record = json.loads(obj['ss_light']) if isinstance(obj['ss_light'], str) else dict(obj['ss_light'])
            record['intensity'] = 0
            record['emissiveNodes'] = []
            obj['ss_light'] = json.dumps(record)


def cut_profile(s, ys, zs, x0):
    profile = [(ys[0], zs[0])]
    for i in range(len(ys)-1):
        mid = (ys[i]+ys[i+1])/2
        profile += [(mid, zs[i]+.16), (mid+.10, zs[i]-.12), (ys[i+1], zs[i+1])]
    profile += [(ys[-1], 14), (ys[0], 14)]
    cutter = s.extrude('CUTTER', profile, 'x', x0, 6, 'uiDark')
    bpy.context.view_layer.update()
    for obj in list(s.root.children_recursive):
        if obj == cutter or obj.type != 'MESH' or obj.parent.name in ('door_cellar', 'shutter'):
            continue
        lo, hi = bounds(obj)
        if hi[0] <= x0 or hi[1] <= ys[0] or lo[1] >= ys[-1] or hi[2] <= min(zs):
            continue
        subtract(obj, cutter)
    erase(cutter)


def cut_collapse(s):
    metro = s.asset.endswith('metro-entrance')
    row = s.asset.endswith('storefront-row')
    # Negative-Y is the game camera side. The cutter rises through the roof;
    # its bottom is a broad stair-stepped diagonal fracture, not a clean box.
    if row:
        ys, zs, x0 = [-8.5, -7.0, -5.9, -4.9, -3.7, -3.0], [4.8, 5.15, 4.6, 5.55, 6.4, 7.1], -.25
    elif metro:
        ys, zs, x0 = [-2.5, -1.7, -.9, -.2], [3.1, 3.6, 4.6, 5.35], -3.3
    else:
        ys, zs, x0 = [-4.7, -3.5, -2.5, -1.35, -.35], [4.7, 5.0, 5.6, 6.4, 7.05], .25
    cut_profile(s, ys, zs, x0)
    if row:
        # Second stepped breach at the far end: the whole upper floor of that bay is gone,
        # so the row reads as shelled from both sides instead of one bitten corner.
        cut_profile(s, [3.3, 4.4, 5.5, 6.6, 7.7, 8.6], [7.2, 6.3, 5.4, 4.5, 3.6, 2.7], x0 + .1)
    elif not metro:
        # Kessler: the back-left gable and upper floor are blown away as well.
        cut_profile(s, [.7, 1.7, 2.7, 3.6, 4.5], [7.4, 6.2, 5.0, 4.0, 3.1], x0)
    if not metro:
        y0 = -7.45 if row else -3.9
        y1 = -3.1 if row else -.55
        z = 4.55
        s.extrude('exposedFloor', [(y0, z), (y1, z), (y1, z + .18), (y0 + .9, z + .3), (y0, z + .18)], 'x', x0, 3.5, 'sidewalk')
        s.box('charredFloor', ((x0 + 3.4) / 2, (y0 + y1) / 2, z + .32), (3.4 - x0, y1 - y0, .08), 'uiDark', bevel=0)
        for i in range((5, 4, 3)[s.lod]):
            y = y0 + .3 + i * (y1 - y0 - .6) / max(1, (5, 4, 3)[s.lod] - 1)
            s.beam('exposedCharredJoist', (x0 + .1, y, 5.9), (3.65, y, 5.15 + .18 * (i % 2)), .19, 'uiDark')
        # Vertical remaining wall teeth make the break read from all elevations.
        for i, y in enumerate((y0 + .3, y0 + 1.0, y1 - .35)):
            s.box('masonryTooth', (x0 + .12, y, 5.45 + .4 * (i % 2)), (.3, .48, .8 + .6 * (i % 2)), 'brick', bevel=.035)
    else:
        # Keep the stair shaft and shutter untouched; collapse falls on the side ledge.
        s.beam('bentCanopyRafter', (-2.4, -1.6, 3.05), (.3, -.35, 5.8), .17, 'uiDark')
        s.beam('snappedCanopyRafter', (-1.6, -.95, 4.7), (1.0, -.25, 5.85), .16, 'foliageDark')


def damage_finish(s):
    """Palette folding leaves space for protected moving-owner draws."""
    metro = s.asset.endswith('metro-entrance')
    row = s.asset.endswith('storefront-row')
    maps = {'canvasTan': 'sidewalk', 'windowGlow': 'uiDark', 'asphalt': 'uiDark', 'woodWarm': 'leather',
            'redDark': 'brick', 'mustard': 'khakiSeam', 'plaidRed': 'pantsLight', 'backpackTeal': 'tealDark',
            'khakiLight': 'sidewalk', 'khaki': 'pantsLight', 'picketWhite': 'sidewalk', 'tealDark': 'uiDark'}
    for obj in list(s.root.children_recursive):
        if obj.type != 'MESH': continue
        for i, material in enumerate(obj.data.materials):
            token = material.name.removeprefix('pal_').removeprefix('emi_').split('.')[0]
            obj.data.materials[i] = palette.mat(maps.get(token, token))
    # Torn awning: remove broad stripe sections by horizontal bounds, leaving the
    # sign and entrance door intact. All tiers retain the same missing strips.
    for obj in list(s.root.children_recursive):
        if obj.type != 'MESH' or obj.parent.name in ('door_cellar', 'shutter'): continue
        lo, hi = bounds(obj)
        if not metro and lo[0] > (4.0 if row else 3.88) and 2.35 < lo[2] and hi[2] < 3.65:
            yc = (lo[1] + hi[1]) / 2
            if (row and (-7.5 < yc < -5.8 or -.8 < yc < .7 or 4.2 < yc < 5.1)) or (not row and (-3.7 < yc < -1.5 or 2.0 < yc < 2.7)):
                erase(obj)
    # Soot tongues and lighter dust halos stand proud of the wall planes.
    face = 4.0 if row else 3.5
    if not metro:
        locations = [(-6.1, 2.1, 2.0), (-.9, 2.0, 1.7), (4.3, 2.0, 2.1)] if row else [(-2.3, 2.2, 1.55), (2.3, 2.2, 1.5)]
        for y, z, w in locations:
            for token, offset, factor in [('leather', .02, 1.22), ('uiDark', .045, 1.0)]:
                s.extrude('sootPlume', [(y-w*.5*factor,z), (y-w*.52*factor,z+1.9), (y-w*.18,z+3.0),
                          (y+w*.05,z+2.7), (y+w*.2*factor,z+1.85), (y+w*.5*factor,z+.9)], 'x', face+offset, face+offset+.025, token)
        # Side wall, especially visible at the game camera.
        side = -7.8 if row else -4.1
        for x, height in [(-2.0, 2.8), (.0, 3.5), (2.0, 2.1)]:
            s.extrude('sideSoot', [(x-.45,.8),(x-.5,height),(x-.1,height+1.35),(x+.3,height),(x+.5,.8)], 'y',side-.05,side-.023,'uiDark')
        rng = random.Random(731)
        for i in range((32, 18, 9)[s.lod]):
            y = rng.uniform(-7.4,7.4) if row else rng.uniform(-3.8,3.8)
            z = rng.uniform(.6,4.3)
            s.tube('bulletImpact', (face+.12,y,z), .075 if s.lod==0 else .1, .025, 'uiDark', rot=(0,math.pi/2,0),sides=(7,6,5))
    else:
        for x in (-2.1,-.5,1.4):
            s.extrude('metroSoot', [(x-.3,.3),(x-.4,1.0),(x,1.75),(x+.3,.7),(x+.3,.3)], 'y',-2.43,-2.405,'uiDark')
    # Rubble is confined to original plinth and kept away from door/stair corridors.
    rng = random.Random(523)
    for i in range((38, 24, 12)[s.lod]):
        if metro:
            x, y, floor = rng.uniform(-2.8,2.1), rng.uniform(-2.25,-1.6), 1.2
            w, h = rng.uniform(.25,.55), rng.uniform(.22,.55)
        else:
            x = rng.uniform(3.4,4.65) if row else rng.uniform(3.75,4.8)
            y = rng.uniform(-7.4,-4.5) if row else rng.uniform(-3.85,-1.65)
            floor, w, h = .2, rng.uniform(.32,.75), rng.uniform(.25,.7)
        obj = s.extrude('collapseRubble', [(-w/2,0),(-w*.45,h*.7),(-w*.13,h),(w*.45,h*.65),(w/2,0)], 'y',-w*.32,w*.32,
                  ['brick','sidewalk','uiDark'][i%3])
        obj.location = (x,y,floor)
        obj.rotation_euler.z = rng.uniform(-.7,.7)
    if not metro:
        rng2 = random.Random(977)
        for i in range((30, 18, 9)[s.lod]):
            w, h = rng2.uniform(.4, .95), rng2.uniform(.3, .85)
            obj = s.extrude('collapseRubble', [(-w/2,0),(-w*.45,h*.7),(-w*.13,h),(w*.45,h*.65),(w/2,0)], 'y', -w*.32, w*.32,
                            ['brick','sidewalk','uiDark'][i%3])
            obj.location = (rng2.uniform(3.3,4.7), rng2.uniform(3.4,8.0), .2) if row else (rng2.uniform(3.75,4.8), rng2.uniform(1.4,3.9), .2)
            obj.rotation_euler.z = rng2.uniform(-.7,.7)
    # A broad fallen facade plate reads as collapse even at 90 px.
    if not metro:
        y = -6.25 if row else -2.75
        s.extrude('fallenFacade', [(y-1.05,.24),(y-.7,.85),(y-.3,.62),(y+.4,1.1),(y+1.05,.3)], 'x',4.0 if row else 3.9,4.45 if row else 4.35,'sidewalk')


def deliver(s, path):
    export.merge_by_material(s.root, s.protected)
    meshes = [o for o in s.root.children_recursive if o.type=='MESH']
    ao.bake_all(meshes, 16)
    for obj in meshes:
        for value in obj.data.color_attributes['ao'].data:
            value.color = tuple(.6+.4*c for c in value.color[:3])+(1,)
    export.glb(s.root,path)
    for obj in meshes: obj.data.calc_loop_triangles()
    tris = sum(len(o.data.loop_triangles) for o in meshes)
    draws = sum(len(o.data.materials) for o in meshes)
    assert tris <= (30000,12000,4000)[s.lod], (s.asset,s.lod,tris)
    assert draws <= 8, (s.asset,s.lod,draws)
    lohi = [bounds(o) for o in meshes]
    lo = [min(v[0][k] for v in lohi) for k in range(3)]
    hi = [max(v[1][k] for v in lohi) for k in range(3)]
    return {'triangles':tris,'draws':draws,'materials':len({m.name for o in meshes for m in o.data.materials}),
            'bytes':Path(path).stat().st_size,'bounds':{'min':lo,'max':hi}}


def run(asset, source):
    parser = argparse.ArgumentParser()
    parser.add_argument('--glb',required=True)
    parser.add_argument('--quality',default='high')
    parser.add_argument('--decay',default='w5',choices=['w5'])
    parser.add_argument('--distance-tier',type=int,choices=[0,1,2])
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    directory = ROOT/'assets'/asset
    stats = {}
    for lod in ([args.distance_tier] if args.distance_tier is not None else [0,1,2]):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        s = load(asset,lod)
        fracture_windows(s)
        cut_collapse(s)
        damage_finish(s)
        path = directory/('model.w5'+(f'.lod{lod}' if lod else '')+'.glb')
        stats[f'lod{lod}'] = deliver(s,path)
        if lod == (args.distance_tier or 0) and Path(args.glb).resolve()!=path.resolve():
            Path(args.glb).resolve().parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(path,args.glb)
    (directory/'lod-stats.w5.json').write_text(json.dumps(stats,indent=2)+'\n')
    print(json.dumps(stats))
