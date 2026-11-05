"""Standing Oak Avenue twins, built from the houses' shipped authored recipes.

No rescaling, panel collapse or decimation. Near tiers retain native LOD1 forms;
far foliage uses explicit octahedral crowns. Palette swatches are folded into
vertex colors per rigid owner so cutaway roofs and door hinges fit eight draws.
"""
import json
import shutil
from pathlib import Path
import bpy
from mathutils import Vector
from . import export, palette, sockets, primitives


def components(obj):
    """Closed native components, welded by position (GLB splits hard normals)."""
    mesh = obj.data
    lookup, parent = {}, list(range(len(mesh.vertices)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    def union(a, b):
        parent[find(b)] = find(a)
    for v in mesh.vertices:
        key = tuple(round(float(c), 5) for c in v.co)
        if key in lookup: union(lookup[key], v.index)
        else: lookup[key] = v.index
    for face in mesh.polygons:
        for i in face.vertices[1:]: union(face.vertices[0], i)
    groups = {}
    for v in mesh.vertices: groups.setdefault(find(v.index), []).append(v.index)
    return sorted(groups.values(), key=lambda ids: tuple(mesh.vertices[ids[0]].co))


def bounds(obj, ids=None):
    points = [obj.matrix_world @ obj.data.vertices[i].co for i in (ids if ids is not None else range(len(obj.data.vertices)))]
    low = Vector(tuple(min(p[k] for p in points) for k in range(3)))
    high = Vector(tuple(max(p[k] for p in points) for k in range(3)))
    return low, high


def mesh(name, vertices, faces, token, owner):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.materials.append(palette.mat(token))
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    # Vertices are in world metres; inherit the existing owner without moving them.
    bpy.context.view_layer.update()
    obj.parent = owner
    obj.matrix_parent_inverse = owner.matrix_world.inverted()
    return obj


def box(name, position, size, token, owner, lod, rotation=0, axis=0):
    obj = primitives.rounded_box(name, size, palette.mat(token), position, .018 if lod == 0 else 0)
    if lod == 0: obj.modifiers['bevel'].segments = 1
    else: obj.modifiers.remove(obj.modifiers['bevel'])
    obj.rotation_euler[axis] = rotation
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = owner
    obj.matrix_world = world
    return obj


def batch(root, protected, extinguish_windows=True):
    # First use the shared material merger; then fold swatches into one draw per
    # rigid owner. Ratios multiply pal_picketWhite in both glTF and runtime.
    export.merge_by_material(root, protected)
    white = palette.mat('picketWhite')
    base = white.diffuse_color[:3]
    groups = {}
    for obj in list(root.children_recursive):
        if obj.type != 'MESH': continue
        material = obj.data.materials[0]
        if material.name.startswith('emi_'): continue
        rgb = material.diffuse_color[:3]
        layer = obj.data.color_attributes.new(name='palette', type='FLOAT_COLOR', domain='CORNER')
        obj.data.color_attributes.active_color = layer
        for value in layer.data: value.color = (*[min(1, rgb[i]/base[i]) for i in range(3)], 1)
        obj.data.materials.clear()
        obj.data.materials.append(white)
        groups.setdefault(obj.parent, []).append(obj)
    for owner, objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        bpy.context.object.name = owner.name + '_pal_picketWhite'
    # A surviving emissive batch is always a stable named reference.
    emissive = [o for o in root.children_recursive if o.type == 'MESH' and o.data.materials[0].name.startswith('emi_')]
    for obj in emissive: obj.name = obj.parent.name + '_emi_windowGlow'
    for obj in root.children_recursive:
        if 'ss_light' not in obj: continue
        value = obj['ss_light']
        light = json.loads(value) if isinstance(value, str) else dict(value)
        if light['type'] == 'window' and extinguish_windows:
            # Broken, boarded and deserted windows have no electrical spill.
            light['intensity'] = 0
            light['emissiveNodes'] = []
        else: light['emissiveNodes'] = [o.name for o in emissive if o.parent.name == ('door_front' if 'door_front' in obj.name else 'lightsFront')]
        obj['ss_light'] = json.dumps(light)


def build_house(directory, output, decay, only_tier=None):
    directory = Path(directory).resolve()
    if decay not in ('w2', 'w3'): raise ValueError('Standing house decay must be w2/w3')
    stats = {}
    for lod in ([only_tier] if only_tier is not None else (0, 1, 2)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        source = directory / (('model.distance2.glb' if lod == 2 else 'model.distance1.glb') if directory.name in ('bld.house-d','bld.house-e') else ('model.lod2.glb' if lod == 2 else 'model.lod1.glb'))
        bpy.ops.import_scene.gltf(filepath=str(source))
        bpy.context.view_layer.update()
        # Native distance exports can shift their root to centre trimmed foliage.
        # Restore the BASE transforms, never fit a damaged building to a new AABB.
        import re
        for obj in list(bpy.context.scene.objects):
            name = re.sub(r'\.\d{3}$', '', obj.name)
            if obj.type == 'EMPTY' and name != obj.name and name not in bpy.data.objects:
                obj.name = name
        native = set(bpy.context.scene.objects)
        native_world = {o: o.matrix_world.copy() for o in native}
        bpy.ops.import_scene.gltf(filepath=str(directory / 'model.glb'))
        bpy.context.view_layer.update()
        reference = set(bpy.context.scene.objects) - native
        originals = {re.sub(r'\.\d{3}$', '', o.name): o for o in reference}
        reference_bounds = [bounds(o) for o in reference if o.type == 'MESH']
        base_low = Vector(tuple(min(lo[k] for lo, hi in reference_bounds) for k in range(3)))
        base_high = Vector(tuple(max(hi[k] for lo, hi in reference_bounds) for k in range(3)))
        desired = {}
        for obj in native:
            original = originals.get(obj.name)
            if obj.type == 'EMPTY' and original:
                desired[obj] = original.matrix_world.copy()
            else:
                owner = obj.parent
                while owner and (owner.name not in originals or owner.type != 'EMPTY'):
                    owner = owner.parent
                desired[obj] = (originals[owner.name].matrix_world @ native_world[owner].inverted() @ native_world[obj]) if owner else native_world[obj]
        for obj in reference: bpy.data.objects.remove(obj, do_unlink=True)
        def depth(obj):
            count=0
            while obj.parent: count+=1; obj=obj.parent
            return count
        for obj in sorted(native, key=depth):
            obj.matrix_world = desired[obj]
            bpy.context.view_layer.update()
        # Imported glTF shaders do not initialize Blender diffuse_color. Create
        # fresh shared palette materials, rather than inheriting that grey default.
        imported_tokens = {}
        for material in list(bpy.data.materials):
            token = re.sub(r'\.\d{3}$', '', material.name).split('_', 1)[-1]
            imported_tokens[material] = token
            material.name += '_native'
        root = bpy.data.objects['root']
        root['asset_id'] = directory.name
        root['decay'] = decay
        root['ss_physics'] = json.dumps({'class':'fixed','mass':0,'friction':.8,'restitution':0,'centerOfMass':[0,0,0],'pushable':False,'kickable':False,'flammable':True,'sounds':'prop.wood-medium'})
        protected = {o.name for o in root.children_recursive if o.name in ('roof','dormer_roof','interior') or o.name.startswith('door_') and o.type == 'EMPTY'}
        # C's body is a semantic mesh in the native export; preserve its transform
        # as an empty while its material joins the static assembly.
        body = bpy.data.objects.get('body')
        if body and body.type == 'MESH':
            body.name = 'body_native'
            pivot = sockets.empty('body', parent=root)
            pivot.matrix_world = body.matrix_world.copy()
            world = body.matrix_world.copy(); body.parent = pivot; body.matrix_world = world
        if not bpy.data.objects.get('body'): sockets.empty('body', parent=root)
        protected.add('body')
        lamp_owner = sockets.empty('lightsFront', parent=root)
        protected.add('lightsFront')
        # Inspect pane components before their material is changed; these carry
        # the exact shifted/native positions rather than guessed base coordinates.
        panes = []
        for obj in list(bpy.context.scene.objects):
            if obj.type != 'MESH' or not obj.data.materials: continue
            material = obj.data.materials[0]
            token = imported_tokens.get(material, material.name.split('_', 1)[-1])
            if material.name.startswith('emi_'):
                lamp = obj.parent and obj.parent.name.startswith('lamp_')
                if lamp:
                    obj.data.materials.clear(); obj.data.materials.append(palette.mat('windowGlow', True))
                    world = obj.matrix_world.copy(); obj.parent = lamp_owner; obj.matrix_world = world
                else:
                    owner = obj.parent
                    for ids in components(obj):
                        lo, hi = bounds(obj, ids)
                        size = hi-lo
                        if max(size) > .6:
                            panes.append((lo, hi, owner, obj.name.startswith('door_')))
                    obj.data.materials.clear(); obj.data.materials.append(palette.mat('backpackTeal'))
            elif token in palette.TOKENS:
                obj.data.materials.clear(); obj.data.materials.append(palette.mat(token))
            if lod == 2 and not material.name.startswith('emi_') and obj.parent and obj.parent.name.startswith('lamp_'):
                # Far lanterns keep a closed cap; omit the individual cage bars.
                lo, hi = bounds(obj); owner = obj.parent
                bpy.data.objects.remove(obj, do_unlink=True)
                pos = (lo+hi)/2; pos.z = hi.z-.03
                size = hi-lo; size.z = .06
                box('farLanternCap', pos, size, 'uiDark', owner, lod)
                continue
            # Far foliage: each closed crown gets an explicit six-vertex recipe,
            # retaining its exact extrema and therefore the original footprint.
            if lod == 2 and token in ('foliage','foliageDark','foliageLight'):
                crowns = [bounds(obj, ids) for ids in components(obj)]
                owner = obj.parent
                bpy.data.objects.remove(obj, do_unlink=True)
                for lo, hi in crowns:
                    c=(lo+hi)/2; r=(hi-lo)/2
                    vs=[tuple(c+Vector((r.x,0,0))),tuple(c+Vector((-r.x,0,0))),tuple(c+Vector((0,r.y,0))),tuple(c+Vector((0,-r.y,0))),tuple(c+Vector((0,0,r.z))),tuple(c+Vector((0,0,-r.z)))]
                    mesh('farShrub', vs, [(4,0,2),(4,2,1),(4,1,3),(4,3,0),(5,2,0),(5,1,2),(5,3,1),(5,0,3)], 'foliage', owner)
        for index, (lo, hi, owner, door) in enumerate(panes):
            c=(lo+hi)/2; size=hi-lo; axis=0 if size.x<size.y else 1
            u=1-axis; w=size[u]; h=size.z
            # Normal faces away from the house centre; C's east wall is x≈0.
            center_x = -1.8 if directory.name.endswith('c') else (-.9 if directory.name.endswith('a') else 0)
            sign = 1 if c[axis] > (center_x if axis==0 else 0) else -1
            face = hi[axis]+.015 if sign>0 else lo[axis]-.015
            def point(a,b,d=0):
                v=c.copy();v[axis]=face+sign*d;v[u]+=a;v.z+=b;return tuple(v)
            def surface(name, vertices, token):
                # Match the outward facade normal on all four sides. Concave
                # void/scorch outlines use Newell's normal, not their first corner.
                normal = Vector((0,0,0))
                for a,b in zip(vertices,vertices[1:]+vertices[:1]):
                    normal += Vector(a).cross(Vector(b))
                if normal[axis]*sign < 0: vertices = list(reversed(vertices))
                return mesh(name, vertices, [tuple(range(len(vertices)))], token, owner)
            if decay=='w3' or index%3==0:
                # Irregular void lies inside surviving glazing borders. Retain
                # sash bars and frame geometry from the integrated original.
                outline=[(-.42,-.42),(-.16,-.31),(-.07,-.45),(.14,-.36),(.42,-.43),(.34,-.08),(.46,.08),(.33,.22),(.4,.44),(.08,.35),(-.12,.46),(-.26,.3),(-.43,.42),(-.34,.13),(-.47,-.02),(-.32,-.16)]
                if lod==2: outline=outline[::2]
                verts=[point(a*w,b*h,.008) for a,b in outline]
                surface('jaggedWindowVoid',verts,'uiDark')
                if lod==0:
                    for a,b in [(-.38,.28),(.34,-.27)]:
                        surface('survivingGlassShard',[point(a*w,b*h,.012),point((a+.10)*w,(b-.12)*h,.012),point((a+.13)*w,b*h,.012)],'picketWhite')
            if decay=='w2' and not door:
                for k in range(2):
                    dims=[.065,.065,.19]; dims[u]=w*1.04; dims[axis]=.075
                    pos=Vector(point(0,(k-.5)*h*.43,.085))
                    box('diagonalBoard',pos,dims,'woodWarm',owner,lod,(-.22 if k==0 else .17)*(1 if axis==0 else -1),axis)
                    if lod==0:
                        for end in (-.40,.40):
                            nail=list(point(end*w,(k-.5)*h*.43,.13)); ns=[.035]*3;ns[axis]=.013
                            box('boardNail',nail,ns,'uiDark',owner,lod)
            if decay=='w3' and not door:
                # Broad uneven local soot, under the sill and above the lintel.
                # The opening remains smaller and darker than the surrounding patch.
                for top in (False,True):
                    z=.56 if top else -.58
                    profile=[(-.95,z-.08),(-.83,z+.20),(-.29,z+.12),(.06,z+.29),(.51,z+.15),(.95,z+.09),(.82,z-.10)] if c.z < 3.5 else [(-.64,z-.08),(-.53,z+.20),(-.19,z+.12),(.06,z+.29),(.31,z+.15),(.58,z+.09),(.52,z-.10)]
                    surface('localSoot', [point(a*w,b*h,.10) for a,b in profile], 'uiDark' if top else 'asphalt')
                dims=[.07,.07,.12];dims[u]=w*.54;dims[axis]=.075
                box('splinteredSill',point(.15*w,-.55*h,.10),dims,'woodWarm',owner,lod,.13,axis)
        if decay=='w2':
            # Clutter is inside the existing porch bounds, clear of door pivots.
            positions={'bld.house-a':[(2.1,2.13,.68),(2.15,1.93,.61)],'bld.house-b':[(1.51,-3.38,.94),(1.79,-3.43,.80)],'bld.house-c':[(.69,-.73,1.12),(.88,-.69,1.04)],'bld.house-d':[(3.05,-.90,.62),(3.05,-.50,.57)],'bld.house-e':[(2.65,-1.65,.87),(2.80,-1.30,.80)]}
            for i,p in enumerate(positions[directory.name]):
                box('entranceBelongings',p,(.36,.32,.40 if i==0 else .25),'woodWarm' if i==0 else 'backpackTeal',root,lod,.12*i,2)
        # All imported empties, anchors and colliders keep their exact transforms.
        if not bpy.data.objects.get('front'):
            from .sockets import empty
            # Match the production pipeline's marker on the original base AABB.
            center = (base_low+base_high)/2
            radius = max(base_high.x-base_low.x, base_high.y-base_low.y)/2+.01
            marker = empty('front', parent=root)
            marker.matrix_world.translation = center+Vector((radius,0,0))
        batch(root, protected)
        meshes=[o for o in root.children_recursive if o.type=='MESH']
        for obj in meshes: obj.data.calc_loop_triangles()
        count=sum(len(o.data.loop_triangles) for o in meshes)
        draws=sum(len(o.data.materials) for o in meshes)
        if count > (30000,12000,4000)[lod] or draws>8:
            raise ValueError(f'{directory.name}.{decay} LOD{lod}: {count} triangles / {draws} draws')
        path=directory/('model.'+decay+('' if lod==0 else '.lod'+str(lod))+'.glb')
        export.glb(root,path)
        stats['lod'+str(lod)]={'triangles':count,'drawCalls':draws,'materials':len({m.name for o in meshes for m in o.data.materials}),'bytes':path.stat().st_size,'source':str(source.relative_to(directory))}
    (directory/(decay+'-stats.json')).write_text(json.dumps(stats,indent=2)+'\n')
    source=directory/('model.'+decay+('' if only_tier in (None,0) else '.lod'+str(only_tier))+'.glb')
    if Path(output).resolve()!=source: shutil.copyfile(source,output)
    print('OK standing house',directory.name,decay,json.dumps(stats))
