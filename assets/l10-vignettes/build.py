"""L10 field remains. Headless, deterministic, authored 800/300/60 triangle caps.

python3 tools/blender/run.py assets/l10-vignettes/build.py --batch [--sheet]
The cow is a frozen, stockier derivative of the existing amb.zebra quadruped builder.
"""
import argparse
import json
import math
import runpy
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/blender'))
from sslib import palette, export

IDS = ['prop.l10-grave-cross', 'decay.body-bag', 'prop.l10-quarantine-tape', 'prop.l10-cow-carcass', 'prop.l10-shovel']

def empty(name):
    o = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(o); return o

def box(root, name, at, size, token):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    o = bpy.context.object; o.name = name; o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(palette.mat(token)); o.parent = root; return o

def mesh(root, name, verts, faces, tokens, colors=None):
    d = bpy.data.meshes.new(name); d.from_pydata(verts, [], faces); d.update()
    o = bpy.data.objects.new(name, d); bpy.context.collection.objects.link(o); o.parent = root
    for token in tokens: d.materials.append(palette.mat(token))
    if colors:
        for f, c in zip(d.polygons, colors): f.material_index = c
    return o

def build_asset(asset, lod, root=None):
    root = root or empty('root'); root.name = 'root'; root['asset_id'] = asset
    if asset == 'prop.l10-grave-cross':
        box(root, 'upright', (0, 0, .48), (.09, .09, .96), 'woodWarm')
        box(root, 'crossbar', (0, -.01, .69), (.56, .075, .085), 'woodWarm')
        box(root, 'nameboard', (0, -.06, .48), (.25, .035, .12), 'canvasTan')
        if lod == 0:
            for x in [-.07, .07]: box(root, 'nail', (x, -.083, .48), (.015, .012, .015), 'asphalt')
    elif asset == 'decay.body-bag':
        n, rings = [(10, 7), (8, 5), (8, 4)][lod]
        verts, faces = [], []
        for j in range(rings):
            x = -1.05 + 2.1*j/(rings-1)
            envelope = .28 + .72*math.sin(math.pi*j/(rings-1))**.35
            for i in range(n):
                a = math.tau*i/n
                verts.append((x, .36*envelope*math.cos(a), .18+.16*envelope*math.sin(a)))
        for j in range(rings-1):
            for i in range(n): faces.append((j*n+i, j*n+(i+1)%n, (j+1)*n+(i+1)%n, (j+1)*n+i))
        faces += [tuple(reversed(range(n))), tuple((rings-1)*n+i for i in range(n))]
        mesh(root, 'canvas', verts, faces, ['olive','uiDark'] if lod==2 else ['olive'], [0]*(len(faces)-1)+[1] if lod==2 else None)
        if lod<2:box(root, 'zipper', (0, 0, .343), (1.65, .015, .008), 'canvasTan')
        if lod < 2:
            for x in [-.65, .65]:
                for y in [-.33, .33]: box(root, 'handle', (x, y, .1), (.16, .1, .035), 'uiDark')
    elif asset == 'prop.l10-quarantine-tape':
        for x in [-1.4, 1.4]: box(root, 'stake', (x, 0, .65), (.05, .05, 1.3), 'woodWarm')
        verts, faces, colors = [], [], []
        for slope in [-.15, .15]:
            for j in range(8):
                a, b = -1.4+j*.35, -1.4+(j+1)*.35
                k = len(verts); verts += [(a, 0, .85+a*slope-.035), (b, 0, .85+b*slope-.035), (b, 0, .85+b*slope+.035), (a, 0, .85+a*slope+.035)]
                faces.append((k,k+1,k+2,k+3)); colors.append(j%2)
        o = mesh(root, 'tape', verts, faces, ['schoolBusYellow', 'uiDark'], colors)
        for m in o.data.materials: m.surface_render_method = 'DITHERED'; m.use_backface_culling = False
    elif asset == 'prop.l10-shovel':
        # Low-poly scenery counterpart of the existing wpn.shovel, lying beside a field grave.
        box(root,'shaft',(-.02,0,.045),(.9,.035,.035),'woodWarm')
        box(root,'blade',(.49,0,.025),(.24,.24,.03),'asphalt')
        for y in [-.075,.075]: box(root,'grip_side',(-.49,y,.045),(.16,.025,.035),'woodWarm')
        box(root,'grip_end',(-.56,0,.045),(.025,.175,.035),'woodWarm')
    elif asset == 'prop.l10-cow-carcass':
        if lod == 2:
            # Closed coarse masses preserve the body/hooves/horns; global reduction made disconnected shards.
            box(root, 'torso', (-.2,0,.42), (1.7,.85,.65), 'woodWarm')
            box(root, 'head', (.85,.08,.35), (.65,.4,.4), 'canvasTan')
            def tetra(name, pts, token): mesh(root,name,pts,[(0,2,1),(0,1,3),(0,3,2),(1,2,3)],[token])
            for i,x in enumerate([-.78,-.5,.45,.65]):
                tetra('leg',[(x,-.05,.3),(x+.13,.15,.55),(x+.1,1.55-i*.08,.35),(x-.06,.3,.3)],'woodWarm')
            for side in [-1,1]: tetra('horn',[(.8,.08+side*.1,.5),(.95,.08+side*.1,.5),(.87,.08+side*.22,.9),(.9,.08+side*.18,.55)],'canvasTan')
            tetra('tail',[(-1.03,-.05,.35),(-1.03,.06,.4),(-1.27,.2,.2),(-1.03,.02,.3)],'uiDark')
            bpy.context.view_layer.update()
        else:
            return build_cow(asset, lod)
    else: raise ValueError(asset)
    return finish(root, asset, lod)

def build_cow(asset, lod):
        # Reuse the closed quadruped anatomy and joint hierarchy, then freeze it.
        parts = runpy.run_path(str(ROOT/'assets/amb.zebra/build.py'), run_name='l10_cow_base')['build_zebra'](2, False)
        root = parts['root']; root.name = 'root'; root['asset_id'] = asset
        brown, cream = palette.mat('woodWarm'), palette.mat('canvasTan')
        for o in list(bpy.context.scene.objects):
            if o.type != 'MESH': continue
            if o.name.startswith('stump_'): bpy.data.objects.remove(o, do_unlink=True); continue
            o.data.materials.clear(); o.data.materials.append(brown); o.data.materials.append(cream)
            for f in o.data.polygons:
                c = f.center; f.material_index = int(math.sin(c.x*3.4+c.z*2)+math.cos(c.y*4-c.z*3) > .9)
        # Shorten the long equine neck, broaden the torso and add bovine horns.
        parts['neck'].scale = (.7, .85, .7)
        head = parts['head']; bpy.context.view_layer.update(); at = head.matrix_world.translation
        for side in [-1, 1]:
            bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=.065, radius2=0, depth=.22, location=(at.x, at.y+side*.2, at.z+.13))
            horn = bpy.context.object; horn.name = 'horn'; horn.rotation_euler.x = side*.6; horn.data.materials.append(cream); horn.parent = root
        root.scale = (.94, 1.2, .94); root.rotation_euler.x = math.pi/2
        bpy.context.view_layer.update()
        # Static corpse: remove all rig nodes after evaluating the posed geometry.
        obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        for o in obs:
            world = o.matrix_world.copy(); o.parent = None; o.matrix_world = world
        for o in list(bpy.context.scene.objects):
            if o.type != 'MESH': bpy.data.objects.remove(o, do_unlink=True)
        root = empty('root'); root['asset_id'] = asset
        for o in obs: o.parent = root
        return finish(root,asset,lod)

def finish(root,asset,lod):
    bpy.context.view_layer.update()
    obs = [o for o in root.children_recursive if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]; bpy.ops.object.join()
    body = bpy.context.object; body.name = 'body'
    bpy.context.scene.cursor.location = (0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # Ground every frozen asset without moving its authored pivot off the origin.
    floor = min(v.co.z for v in body.data.vertices)
    cx=(min(v.co.x for v in body.data.vertices)+max(v.co.x for v in body.data.vertices))/2
    cy=(min(v.co.y for v in body.data.vertices)+max(v.co.y for v in body.data.vertices))/2
    for v in body.data.vertices: v.co.z -= floor; v.co.x -= cx; v.co.y -= cy
    if asset.endswith('cow-carcass'):
        count = sum(len(p.vertices)-2 for p in body.data.polygons)
        cap = [800,300,60][lod]
        if count > cap:
            mod = body.modifiers.new('authored distance reduction','DECIMATE'); mod.ratio = (cap-4)/count
            bpy.ops.object.modifier_apply(modifier=mod.name)
    body.data.calc_loop_triangles()
    count = len(body.data.loop_triangles)
    if count > [800,300,60][lod]: raise ValueError(f'{asset} LOD{lod}: {count} triangles')
    front = empty('front'); front.parent = root
    front.location = (max(v.co.x for v in body.data.vertices)+.5, (min(v.co.y for v in body.data.vertices)+max(v.co.y for v in body.data.vertices))/2, .1)
    return root

def build(ctx):
    return build_asset(ctx.root.name, 0, ctx.root)

if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--')+1:]
    report = []
    selected=IDS if '--only' not in args else args[args.index('--only')+1].split(',')
    for asset in selected:
        for lod in range(3):
            bpy.ops.wm.read_factory_settings(use_empty=True)
            root = build_asset(asset,lod)
            out = ROOT/'assets'/asset/('model.glb' if lod == 0 else f'model.lod{lod}.glb'); out.parent.mkdir(exist_ok=True)
            export.glb(root,out)
            body = root.children[0]; points = [body.matrix_world@v.co for v in body.data.vertices]
            lo = [min(v[i] for v in points) for i in range(3)]; hi = [max(v[i] for v in points) for i in range(3)]
            report.append({'id':asset,'lod':lod,'triangles':len(body.data.loop_triangles),'dimensions':[hi[0]-lo[0],hi[2]-lo[2],hi[1]-lo[1]]})
    (ROOT/'assets/l10-vignettes/build-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print('L10 asset batch: 15 authored exports; caps 800/300/60')
