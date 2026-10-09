"""L5 cold burned shells derived from the integrated vehicles' authored meshes.

Native LOD1 supplies near/mid shells; native LOD2 supplies far shells. Explicit
roof ruptures, removed glazing, collapsed tyres and heat buckles survive every
tier. No decimation, fitting or runtime scale changes. Original owners remain
as non-rendering interface anchors; wheels retain independent rigid owners.
"""
import json
import math
import shutil
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector
from . import ao, colliders, export, palette, sockets
from .traffic_wrecks import box, n3, refine, smooth, WHEELS

CONFIG = {
    'veh.pickup-red': ('survivorRed', 'picketWhite', 'sidewalk'),
    'veh.police-sedan': ('picketWhite', 'uiDark', 'sidewalk'),
    'veh.ambulance': ('picketWhite', 'survivorRed', 'policeBlue'),
    'veh.school-bus': ('schoolBusYellow', 'survivorRed', 'sidewalk'),
}
LIMITS = (15000, 6000, 2000)


def build_burned(directory, output):
    directory = Path(directory)
    asset = directory.name
    colors = set(CONFIG[asset]) | {'uiDark'}
    tier = int(sys.argv[sys.argv.index('--distance-tier') + 1]) if '--distance-tier' in sys.argv else None
    if tier not in (None, 1, 2):
        raise ValueError('distance tier must be 1 or 2')
    stats_path = directory / 'burned-stats.json'
    stats = json.loads(stats_path.read_text()) if stats_path.exists() else {}
    for lod in ((tier,) if tier else (0, 1, 2)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(directory / ('model.lod2.glb' if lod == 2 else 'model.lod1.glb')))
        bpy.context.view_layer.update()
        root = next(o for o in bpy.context.scene.objects if o.parent is None and o.type == 'EMPTY')
        meshes = [o for o in root.children_recursive if o.type == 'MESH']
        points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
        lo = Vector(tuple(min(p[k] for p in points) for k in range(3)))
        hi = Vector(tuple(max(p[k] for p in points) for k in range(3)))
        L, W, H = hi.x-lo.x, hi.y-lo.y, hi.z-lo.z
        bus = asset == 'veh.school-bus'
        ambulance = asset == 'veh.ambulance'
        police = asset == 'veh.police-sedan'
        # A large central roof section is physically absent, leaving native rim/pillars.
        roof_x = -.13 * L if bus or ambulance else -.02 * L
        roof_half = .20 * L if bus or ambulance else .095 * L
        roof_z = hi.z * (.86 if bus or ambulance else .81)
        removed_glass = []
        info = {}
        for obj in meshes:
            ancestors = []
            owner = obj.parent
            while owner:
                ancestors.append(owner.name); owner = owner.parent
            wheel = next((a for a in ancestors if a in WHEELS), None)
            obj.data.transform(obj.matrix_world)
            obj.parent = None
            obj.matrix_world = Matrix.Identity(4)
            tokens = [m.name.removeprefix('pal_').removeprefix('emi_').split('.')[0] for m in obj.data.materials]
            info[obj] = wheel
            bm = bmesh.new(); bm.from_mesh(obj.data)
            kill = []
            for f in bm.faces:
                token = tokens[f.material_index]
                c = f.calc_center_median()
                glass = not wheel and (token in ('backpackTeal', 'glassBlue') or
                    token == 'asphalt' and (c.z > (.45 * H if ambulance else .56 * H if bus else .58 * H)))
                # Burned rear ambulance panes and bus window batches are uiDark.
                glass |= not wheel and token == 'uiDark' and (
                    ambulance and any(a in ('doorL', 'doorR', 'doorPatient', 'doorRearL', 'doorRearR') for a in ancestors) and c.z > .50 * H and f.calc_area() > .025 and max(abs(f.normal.x),abs(f.normal.y)) > .7 or
                    bus and .56 * H < c.z < .86 * H and f.calc_area() > .06 and (
                        abs(c.y) > .32 * W and abs(f.normal.y) > .7 or
                        (c.x > .16 * L or c.x < -.43 * L) and abs(f.normal.x) > .7))
                if not police and not wheel and obj.data.materials[f.material_index].name.startswith('emi_'):
                    kill.append(f)
                    continue
                if glass:
                    removed_glass.extend(v.co.copy() for v in f.verts)
                    kill.append(f)
            bmesh.ops.delete(bm, geom=kill, context='FACES')
            bm.to_mesh(obj.data); bm.free()
            if not obj.data.polygons:
                bpy.data.objects.remove(obj, do_unlink=True)
                continue
            if not wheel:
                # Local edge splitting only adds authored fold/rupture boundaries.
                refine(obj, (.40, .65, 1.30)[lod], lambda p: p.z > roof_z or p.x > hi.x-.28*L, passes=1)
                bm = bmesh.new(); bm.from_mesh(obj.data)
                kill = [f for f in bm.faces if f.calc_center_median().z > roof_z and
                        abs(f.calc_center_median().x-roof_x) < roof_half and
                        abs(f.calc_center_median().y) < .24*W and abs(f.normal.z) > .45]
                bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(obj.data); bm.free()
            for i, m in enumerate(list(obj.data.materials)):
                token = tokens[i]
                if wheel:
                    token = 'sidewalk'
                elif m.name.startswith('emi_'):
                    token = 'uiDark'
                elif token == 'sidewalk' or ambulance and token == 'policeBlue':
                    token = 'uiDark'
                elif token not in colors:
                    token = 'uiDark'
                obj.data.materials[i] = palette.mat(token)
            if not wheel:
                # Palette faces carry the scorch in the game renderer as well as
                # vertex AO: runtime palette swaps do not use COLOR_0 as albedo.
                dark_index = len(obj.data.materials)
                obj.data.materials.append(palette.mat('uiDark'))
                rust_index = len(obj.data.materials)
                obj.data.materials.append(palette.mat('brick'))
                for face in obj.data.polygons:
                    c = face.center
                    patch = n3(c, 2.7, 8.1)
                    original = obj.data.materials[face.material_index].name
                    if original != 'pal_uiDark':
                        if patch < .10 or c.z > .76*H and patch < .32:
                            face.material_index = dark_index
                        elif patch > .24:
                            face.material_index = rust_index
            for v in obj.data.vertices:
                p = v.co.copy()
                if wheel:
                    # Two nearly bare rims; two collapsed, heat ruined tyres.
                    pv = bpy.data.objects[wheel].matrix_world.translation
                    missing = pv.y < 0
                    v.co.x = pv.x + (p.x-pv.x) * (.57 if missing else 1.10)
                    v.co.z = lo.z + (p.z-lo.z) * (.38 if missing else .52)
                else:
                    front = smooth(hi.x-.30*L, hi.x, p.x)
                    v.co.x -= .065*L*front
                    v.co.z += .22*math.sin(front*math.pi*1.5)*smooth(.2*H,.4*H,p.z)
                    # Roof sags steeply into the missing central section.
                    if p.z > roof_z-.15:
                        v.co.z -= .08*H*math.exp(-((p.x-roof_x)/(.27*L))**2) * (1-.45*abs(p.y)/(.5*W))
                    if abs(p.y) > .27*W and p.z > .24*H:
                        v.co.y += .07*W*n3(p, 2.5, 1.7)*math.sin((p.z-lo.z)/H*math.pi)
                    # The driver door's lower corner curls away from its original sill.
                    if any(a in ('doorL','door_near_0') for a in ancestors):
                        v.co.y += .04*W*smooth(.7*H,.2*H,p.z)
                v.co.z = max(lo.z, v.co.z)
            obj.data.update()
        meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        # Turn the original body mesh into an empty without losing its transform.
        body = bpy.data.objects.get('body')
        if body is not None and body.type == 'MESH':
            body.name = 'nativeBodySkin'
            body = None
        if body is None:
            body = sockets.empty('body', parent=root)
        # Cabin is genuinely open: floor, dashboard and charred seat backs, no solid void box.
        if removed_glass:
            gx = [p.x for p in removed_glass]; gz = [p.z for p in removed_glass]
            cx = (min(gx)+max(gx))/2
            z = max(lo.z+.3, min(gz)-.20)
            additions = [box('scorchedCabinFloor',(cx,0,z),(max(gx)-min(gx),.54*W,.06),'uiDark')]
            for side in (-1,1):
                additions.append(box('burnedSeatBack',(cx-.08*L,side*.15*W,z+.19*H),(.065*L,.21*W,.23*H),'uiDark',(0,-.18,0)))
            if bus:
                for x in (-.32*L,-.18*L,-.04*L):
                    additions.append(box('passengerSeatSkeleton',(x,0,.39*H),(.04*L,.52*W,.20*H),'uiDark'))
            meshes += additions
        # Exposed ribs cross only part of the large tear; the black hole stays readable.
        for x in (roof_x-roof_half*.85, roof_x+roof_half*.85):
            meshes.append(box('warpedRoofRib',(x,0,roof_z-.09*H),(.028,.62*W,.035),'uiDark',(0,.18,0)))
        for k in range((5,3,2)[lod]):
            meshes.append(box('fallenScorchedPanel',(roof_x+.15*k,-.33*W,lo.z+.055),(.24,.27,.06),'uiDark',(0,.1,k*.7)))
        for obj in meshes:
            owner = bpy.data.objects[info[obj]] if info.get(obj) else body
            obj.parent = owner
            obj.matrix_parent_inverse = owner.matrix_world.inverted()
        for obj in root.children_recursive:
            if 'ss_light' in obj:
                del obj['ss_light']
                obj['burnedLightOff'] = True
        if bpy.data.objects.get('front') is None:
            sockets.empty('front',(hi.x,0,.5*H),root)
        # Pickup's native 'front' is an assembly pivot; keep it and add a face marker.
        if asset == 'veh.pickup-red':
            marker = sockets.empty('frontFace',(hi.x-.065*L,0,.5*H),root)
            marker['front'] = True
        root['decay'] = 'burned'
        root['ss_physics'] = json.dumps({'class':'heavy','mass':1900 if bus or ambulance else 1400,
            'friction':.85,'restitution':.02,'centerOfMass':[0,.6,0], 'pushable':False,
            'kickable':False,'flammable':False,'sounds':'prop.metal-heavy'})
        if not any(o.name.startswith('col:') for o in root.children_recursive):
            colliders.cuboid('shell',(L,W,H),(0,0,H/2),root)
        export.merge_by_material(root, set(WHEELS)|{'body'})
        meshes = [o for o in root.children_recursive if o.type == 'MESH']
        ao.bake_all(meshes,16)
        for obj in meshes:
            layer = obj.data.color_attributes.active_color
            wheel = obj.parent.name in WHEELS
            for loop in obj.data.loops:
                p = obj.matrix_world @ obj.data.vertices[loop.vertex_index].co
                c = layer.data[loop.index].color
                # Broad dark burn clouds and rusty edges, rather than clean dark paint.
                patch = smooth(-.26,.30,n3(p,2.7,8.1))
                factor = .06+.40*patch
                if wheel:
                    tint = (.19,.10,.055)
                elif obj.data.materials[0].name == 'pal_uiDark':
                    tint = (.26+.40*patch,.23+.20*patch,.24+.16*patch)
                else:
                    tint = (factor, factor*(.57+.25*patch), factor*(.40+.27*patch))
                layer.data[loop.index].color = (c[0]*tint[0],c[1]*tint[1],c[2]*tint[2],1)
            obj.data.calc_loop_triangles()
        triangles = sum(len(o.data.loop_triangles) for o in meshes)
        draws = sum(len(o.data.materials) for o in meshes)
        if triangles > LIMITS[lod] or draws > 8:
            raise ValueError(f'{asset} burned LOD{lod}: {triangles} triangles / {draws} draws')
        path = directory / ('model.burned'+('' if lod == 0 else '.lod'+str(lod))+'.glb')
        export.glb(root,path)
        stats['lod'+str(lod)] = dict(triangles=triangles,draws=draws,materials=len({m.name for o in meshes for m in o.data.materials}),bytes=path.stat().st_size)
    stats_path.write_text(json.dumps(stats,indent=2)+'\n')
    supplied = directory / ('model.burned'+('.lod'+str(tier) if tier else '')+'.glb')
    if supplied.resolve() != Path(output).resolve():
        shutil.copyfile(supplied,output)
