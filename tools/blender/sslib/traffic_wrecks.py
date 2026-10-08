"""L3 impacts on native authored vehicle tiers; no decimation or AABB fitting.
Keep source anchors. Static doors are torn shells, wheels remain rigid owners.
"""
import json
import math
import shutil
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from . import palette, primitives as P, sockets, export, ao

PAINT = {'veh.sedan-white': 'picketWhite', 'veh.suv-dark': 'asphalt',
         'veh.pickup-red': 'survivorRed', 'veh.ambulance': 'picketWhite',
         'veh.school-bus': 'schoolBusYellow'}


def build_wreck(directory, output):
    directory = Path(directory)
    asset = directory.name
    requested_tier = int(sys.argv[sys.argv.index('--distance-tier')+1]) if '--distance-tier' in sys.argv else None
    if requested_tier not in (None, 1, 2):
        raise ValueError('distance tier must be 1 or 2')
    stats_path = directory/'wrecked-stats.json'
    stats = json.loads(stats_path.read_text()) if stats_path.exists() else {}
    for lod in ((requested_tier,) if requested_tier is not None else (0, 1, 2)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        # Near and middle tiers reuse closed native LOD1; far uses native LOD2.
        bpy.ops.import_scene.gltf(filepath=str(directory / ('model.lod2.glb' if lod == 2 else 'model.lod1.glb')))
        bpy.context.view_layer.update()
        root = bpy.data.objects[asset]
        meshes = [o for o in root.children_recursive if o.type == 'MESH']
        points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
        low = Vector(tuple(min(v[k] for v in points) for k in range(3)))
        high = Vector(tuple(max(v[k] for v in points) for k in range(3)))
        length, width, top = high.x-low.x, high.y-low.y, high.z
        nose = high.x
        paint = PAINT[asset]
        body = bpy.data.objects.get('body')
        if body.type == 'MESH':
            body.name = 'originalBody'
            body = sockets.empty('body', parent=root)
        wheel_names = {'wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'}
        for obj in list(meshes):
            ancestors = []
            owner = obj.parent
            while owner:
                ancestors.append(owner.name)
                owner = owner.parent
            wheel = next((n for n in ancestors if n in wheel_names), None)
            mats = [m.name for m in obj.data.materials]
            # Genuine missing door/window openings retain their frames and pivots.
            torn = 'doorL' in ancestors or (asset == 'veh.school-bus' and 'door_near_0' in ancestors)
            glazing = 'glass' in obj.name.lower() or ('pal_backpackTeal' in mats)
            if asset != 'veh.suv-dark' and mats == ['pal_asphalt'] and not wheel:
                glazing = True
            if torn or glazing or wheel == 'wheelFL':
                bpy.data.objects.remove(obj, do_unlink=True)
                continue
            # Wreck lighting is dead: every lens is an opaque palette swatch.
            for i, material in enumerate(list(obj.data.materials)):
                token = material.name.removeprefix('pal_').removeprefix('emi_').split('.')[0]
                if wheel:
                    token = 'uiDark'
                elif token in ('windowGlow', 'sirenRed', 'policeBlue', 'schoolBusYellow') and token != paint:
                    token = 'survivorRed' if asset == 'veh.ambulance' and token in ('sirenRed', 'policeBlue') else 'sidewalk'
                elif token not in (paint, 'uiDark', 'sidewalk', 'survivorRed' if asset == 'veh.ambulance' else paint):
                    token = 'uiDark'
                obj.data.materials[i] = palette.mat(token)
            if not wheel and asset in ('veh.suv-dark', 'veh.school-bus'):
                # Add authored roof stations before denting: corner-only boxes
                # otherwise keep a perfectly straight roof despite displacement.
                bm = bmesh.new(); bm.from_mesh(obj.data)
                edges = [e for e in bm.edges if all((obj.matrix_world@v.co).z > top*.89 for v in e.verts) and e.calc_length() > length*.3]
                if edges: bmesh.ops.subdivide_edges(bm, edges=edges, cuts=2, use_grid_fill=True)
                bm.to_mesh(obj.data); bm.free()
            inv = obj.matrix_world.inverted()
            for vertex in obj.data.vertices:
                world = obj.matrix_world @ vertex.co
                t = max(0, min(1, (world.x-(nose-length*.27))/(length*.27)))
                if not wheel and .45 < world.z < top*.81:
                    world.x -= length*.16*t
                    world.z += .25*math.sin(t*math.pi)-.23*t
                    world.y += width*.08*t*t
                if not wheel and world.z > top*.79:
                    sag = max(0, 1-abs(world.x+length*.08)/(length*.32))
                    world.z -= (.40 if asset in ('veh.suv-dark','veh.school-bus') else .12)*sag
                if asset == 'veh.pickup-red' and world.x < -length*.15 and world.z > top*.5:
                    world.y += .13*max(0, (world.z-top*.5)/top)
                    world.z -= .13*abs(world.y)/(width/2)
                vertex.co = inv @ world
            obj.data.update()
            if not wheel:
                world = obj.matrix_world.copy(); obj.parent = body; obj.matrix_world = world
        for obj in root.children_recursive:
            if 'ss_light' in obj:
                del obj['ss_light']
                obj['wreckLightOff'] = True
        if bpy.data.objects.get('front') is None:
            sockets.empty('front',(nose,0,top*.5),root)
        root['decay'] = 'wrecked'
        root['ss_physics'] = json.dumps({
            'class': 'heavy', 'mass': 1900 if asset in ('veh.ambulance','veh.school-bus') else 1400,
            'friction': .85, 'restitution': .02, 'centerOfMass': [0,.6,0],
            'pushable': False, 'kickable': False, 'flammable': True, 'sounds': 'prop.metal-heavy'})
        def panel(name, pos, size, token=paint, angle=0):
            obj = P.rounded_box(name, size, palette.mat(token), pos, .012 if lod == 0 else 0)
            obj.modifiers['bevel'].segments = 1
            if lod: obj.modifiers.remove(obj.modifiers['bevel'])
            obj.parent = body; obj.rotation_euler.y = angle
            return obj
        # Accordion hood: a closed folded prism, visible at the game camera.
        start = nose-length*.27
        xs = [start, start+length*.075, start+length*.15, start+length*.21]
        base = .99 if asset == 'veh.school-bus' else top*.51
        zs = [base, base+.38, base-.08, base+.10]
        w = width*.29
        vs = [(x,y,z-d) for d in (0,.06) for x,z in zip(xs,zs) for y in (-w,w)]
        fs = [(0,8,9,1),(6,7,15,14)]
        for i in range(3):
            k=i*2;fs.extend([(k,k+1,k+3,k+2),(k+8,k+10,k+11,k+9),(k,k+2,k+10,k+8),(k+1,k+9,k+11,k+3)])
        data=bpy.data.meshes.new('accordionHood');data.from_pydata(vs,[],fs);data.materials.append(palette.mat(paint))
        hood=bpy.data.objects.new('accordionHood',data);bpy.context.collection.objects.link(hood);hood.parent=body
        panel('exposedEngine',(start+length*.12,0,base-.19),(length*.20,width*.50,.24),'uiDark')
        panel('tornBumper',(nose-.12,0,.28),(.13,width*.67,.17),'sidewalk',.25)
        # Preserve exposed axle wheel geometry for runtime animation validation.
        wheel = bpy.data.objects['wheelFL']
        hub=P.cylinder('exposedHub',.13,.22,palette.mat('uiDark'),wheel.matrix_world.translation,8)
        hub.rotation_euler.x=math.pi/2
        bpy.context.view_layer.update();matrix=hub.matrix_world.copy();hub.parent=wheel;hub.matrix_world=matrix
        # Bent door lies beside the opened sill; distance tier keeps the large shape.
        panel('detachedDoor',(-length*.02,low.y+.23,.25),(length*.18,.36,.09),paint,.25)
        if asset == 'veh.ambulance':
            # Real shell rupture, through the white rear wall, not a painted crack.
            white=[o for o in body.children_recursive if o.type=='MESH' and any(m.name=='pal_picketWhite' for m in o.data.materials)]
            for obj in white:
                cutter = P.rounded_box('shellRuptureCut',(.75,.6,.88),palette.mat('uiDark'),(-length*.16,low.y+.10,top*.74),0)
                cutter.modifiers.remove(cutter.modifiers['bevel'])
                bpy.context.view_layer.update()
                modifier = obj.modifiers.new('authoredShellRupture','BOOLEAN')
                modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
                bpy.context.view_layer.objects.active=obj
                bpy.ops.object.modifier_apply(modifier=modifier.name)
                bpy.data.objects.remove(cutter,do_unlink=True)
                bm=bmesh.new();bm.from_mesh(obj.data)
                faces=[f for f in bm.faces if all(-length*.25 < (obj.matrix_world@v.co).x < -length*.06 and (obj.matrix_world@v.co).y < low.y+.22 and (obj.matrix_world@v.co).z > top*.50 for v in f.verts)]
                if faces:bmesh.ops.delete(bm,geom=faces,context='FACES')
                bm.to_mesh(obj.data);bm.free()
            for x,z in [(-length*.23,top*.74),(-length*.12,top*.83)]:
                panel('splitShellEdge',(x,low.y+.09,z),(.12,.12,.58),'sidewalk',.34)
        if lod < 2:
            for i in range(4):
                panel('debris'+str(i),(start+i*.15,low.y+.18,.08),(.14,.09,.045),'sidewalk',i*.35)
            for i in range(3):
                panel('impactGouge'+str(i),(start+i*.18,low.y+.03,base-.15+i*.13),(.30,.025,.07),'uiDark',.3)
        # Native glazing has solid charcoal gasket backing. Cut a jagged
        # central break through it as well, so missing glass reads as a hole.
        windshield = {
            'veh.sedan-white': (.34,.83), 'veh.suv-dark': (.28,.72),
            'veh.pickup-red': (.24,.65), 'veh.ambulance': (.20,.55),
            'veh.school-bus': (.23,.69),
        }[asset]
        for obj in list(body.children_recursive):
            if obj.type != 'MESH' or not any(m.name == 'pal_uiDark' for m in obj.data.materials): continue
            cutter=P.rounded_box('windshieldBreakCut',(length*.13,width*.56,top*.23),palette.mat('uiDark'),(nose-length*windshield[0],0,top*windshield[1]),0)
            cutter.modifiers.remove(cutter.modifiers['bevel'])
            cutter.rotation_euler.x=.12
            bpy.context.view_layer.update()
            modifier=obj.modifiers.new('authoredGlazingBreak','BOOLEAN')
            modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
            bpy.context.view_layer.objects.active=obj
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            bpy.data.objects.remove(cutter,do_unlink=True)
        export.merge_by_material(root, wheel_names | {'body'})
        meshes=[o for o in root.children_recursive if o.type=='MESH']
        for obj in meshes:
            bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
        bpy.context.view_layer.update()
        ao.bake_all(meshes,16)
        # Broad soot falloff on the crushed front, exported as vertex AO tint.
        for obj in meshes:
            layer=obj.data.color_attributes.active_color
            for loop in obj.data.loops:
                world=obj.matrix_world@obj.data.vertices[loop.vertex_index].co
                t=max(0,1-abs(world.x-(nose-length*.18))/(length*.19))
                c=layer.data[loop.index].color
                factor=1-.55*t if world.z>.5 else 1
                layer.data[loop.index].color=(c[0]*factor,c[1]*factor,c[2]*factor,1)
            obj.data.calc_loop_triangles()
        triangles=sum(len(o.data.loop_triangles) for o in meshes)
        draws=sum(len(o.data.materials) for o in meshes)
        if triangles > [15000,6000,2000][lod] or draws > 8:
            raise ValueError(f'{asset} LOD{lod}: {triangles} tris, {draws} draws')
        path=directory/('model.wrecked'+('' if lod==0 else '.lod'+str(lod))+'.glb')
        export.glb(root,path)
        stats['lod'+str(lod)]={'triangles':triangles,'draws':draws,'bytes':path.stat().st_size}
    (directory/'wrecked-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
    supplied=directory/('model.wrecked'+('.lod'+str(requested_tier) if requested_tier else '')+'.glb')
    if supplied.resolve() != Path(output).resolve():
        shutil.copyfile(supplied,output)
