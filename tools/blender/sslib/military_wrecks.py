"""L5 military wrecks derived from shipped authored base GLBs, in native metres.

Explicit component removal, boolean breaches, panel folds and thrown running gear.
No decimation or AABB fitting. Preserve base pivots/anchors, vertex livery and
closed surviving panels. Near uses base LOD1; far uses its authored LOD2 recipe.
"""
import json
import math
import shutil
import sys
import struct
from pathlib import Path
import bpy
import bmesh
from mathutils import Matrix, Vector, noise
from . import palette, sockets, export, ao, colliders
from .house_decay import components, bounds
from .traffic_wrecks import box

SOURCE_FACTORS = {}
LIMITS = (15000, 6000, 2000)
WHEELS = {'wheel'+ax+side for ax in ('F','M','R') for side in ('L','R')}


def world_mesh(obj):
    obj.data.transform(obj.matrix_world)
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)


def delete_components(obj, predicate):
    kill = set()
    for ids in components(obj):
        lo, hi = bounds(obj, ids)
        if predicate((lo+hi)/2, hi-lo): kill.update(ids)
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in sorted(kill)], context='VERTS')
    bm.to_mesh(obj.data); bm.free()


def breach(obj, center, size, sides=7):
    """A deliberately large irregular cut through the solid armour, no tiny holes."""
    # Boolean only the native solid hull. Decorative stars/trim and open cloth
    # are separate components, and cannot be fed to the solid boolean solver.
    candidates=[]
    for ids in components(obj):
        lo,hi=bounds(obj,ids);extent=hi-lo
        if extent.x>1.2 and extent.y>1.5 and extent.z>.5:
            candidates.append((extent.x*extent.y*extent.z,ids))
    if not candidates:return
    ids=set(max(candidates,key=lambda item:item[0])[1])
    shell=obj.copy();shell.data=obj.data.copy();bpy.context.collection.objects.link(shell)
    bm=bmesh.new();bm.from_mesh(shell.data);bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.index not in ids],context='VERTS');bm.to_mesh(shell.data);bm.free()
    bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[bm.verts[i] for i in sorted(ids)],context='VERTS');bm.to_mesh(obj.data);bm.free()
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=1, depth=2, location=center,
                                      rotation=(math.pi/2, 0, 0))
    cutter = bpy.context.object; cutter.name='temporary_breach'
    cutter.data.materials.append(palette.mat('oliveSeam'))
    cutter.scale=(size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.context.view_layer.objects.active=shell
    mod=shell.modifiers.new('authored armour breach','BOOLEAN'); mod.operation='DIFFERENCE'; mod.solver='EXACT'; mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);shell.select_set(True)
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.join()


def tint_to_palette(obj):
    # Keep baked military livery, and convert dead lenses / native truck materials.
    white=palette.mat('picketWhite'); base=white.diffuse_color[:3]
    old=obj.data.color_attributes.active_color
    source=[SOURCE_FACTORS.get(m.name.split('.')[0],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value[:3]) if m else (.10,.10,.10) for m in obj.data.materials]
    values=[tuple(v.color) for v in old.data] if old else None
    domain=old.domain if old else None
    layer=obj.data.color_attributes.new(name='wreckPalette',type='FLOAT_COLOR',domain='CORNER')
    for f in obj.data.polygons:
        rgb=source[f.material_index]
        emitting=obj.data.materials[f.material_index] and obj.data.materials[f.material_index].name.startswith('emi_')
        for i in f.loop_indices:
            c=values[i if domain=='CORNER' else obj.data.loops[i].vertex_index] if values else (1,1,1,1)
            layer.data[i].color=tuple((.045 if emitting else rgb[k]*c[k])/base[k] for k in range(3))+(1,)
    obj.data.color_attributes.active_color=layer
    obj.data.materials.clear(); obj.data.materials.append(white)


def build_wreck(directory, output, only_tier=None):
    directory=Path(directory).resolve(); asset=directory.name
    if only_tier is None and '--distance-tier' in sys.argv:
        only_tier=int(sys.argv[sys.argv.index('--distance-tier')+1])
    stats_path=directory/'wrecked-stats.json'
    stats=json.loads(stats_path.read_text()) if stats_path.exists() else {}
    for lod in ([only_tier] if only_tier is not None else (0,1,2)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        source=directory/('model.lod2.glb' if lod==2 else 'model.lod1.glb')
        blob=source.read_bytes();record=json.loads(blob[20:20+struct.unpack_from('<I',blob,12)[0]])
        SOURCE_FACTORS.clear();SOURCE_FACTORS.update({m['name']:m.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])[:3] for m in record['materials']})
        bpy.ops.import_scene.gltf(filepath=str(source)); bpy.context.view_layer.update()
        # Imported vertex-color materials have a linked BSDF base input whose
        # default is white. Read the actual factor from GLB instead.
        imported_white=bpy.data.materials.get('pal_picketWhite')
        if imported_white:
            imported_white.name='sourceWhite';SOURCE_FACTORS['sourceWhite']=SOURCE_FACTORS['pal_picketWhite']
        root=bpy.data.objects[asset]
        body=bpy.data.objects['body']
        protected={'body','turret','gun'} | WHEELS
        meshes=[o for o in root.children_recursive if o.type=='MESH']
        extra=[]
        def panel(name,loc,size,token='uiDark',rot=(0,0,0)):
            o=box(name,loc,size,token,rot);extra.append(o);return o
        for obj in meshes:
            owner=obj.parent
            while owner!=root and owner.name not in protected: owner=owner.parent
            if owner==root: owner=body
            original_owner=obj.parent.name
            iswheel=owner.name in WHEELS
            world_mesh(obj)
            # Omit sub-pixel native decoration by explicit tier, retaining panels.
            if lod>0:
                delete_components(obj,lambda c,s: max(s)<(.12 if lod==1 else .27))
            if asset=='veh.tank':
                if owner==body:
                    # Rip off impact-side skirts, fender and the entire continuous track.
                    delete_components(obj, lambda c,s: c.y<-.75 and ((s.x>4 and s.z<1.6) or (c.y< -1.40 and .5<s.z<1.2) or (c.z<1.3 and max(s)<.75) or (c.x>2.4 and c.z>1.1)))
                    # Single large side/roof breach; the rest of the chamfered hull survives.
                    breach(obj,(1.15,-1.30,1.50),(.88,.65,.62))
                for v in obj.data.vertices:
                    p=v.co
                    if owner.name in ('turret','gun'):
                        pivot=Vector((-.25,0,1.72)); p=pivot+Matrix.Rotation(.15,3,'Z')@(p-pivot)
                        p.z-=.22+.12*(p.y+1)
                    if owner.name=='gun' and p.x>3.4:
                        p.z-=.30*(p.x-3.4);p.y+=.10*(p.x-3.4)
                    if owner==body and p.x>2.1 and p.z>1:
                        p.x-=.22*(p.x-2.1);p.z-=.16*(p.x-2.1)
                    v.co=p
            elif asset=='veh.military-apc':
                if owner==body:
                    # Hull corner physically opened; missing hatch and buckled roof.
                    breach(obj,(1.20,-1.10,1.91),(.70,.61,.63))
                    delete_components(obj,lambda c,s: (c.x>1.5 and 1.9<c.z<2.1 and s.x<.3) or (c.x>1 and c.y<-.8 and c.z>1.1 and s.z<.2))
                if owner.name=='wheelFL':
                    # Bare hub remains at the original wheel pivot; tyre is gone.
                    delete_components(obj,lambda c,s: max(s)>.4)
                for v in obj.data.vertices:
                    p=v.co
                    if iswheel:p.y=max(-1.50,min(1.50,p.y))
                    if owner.name=='turret':p.z-=.12;p.y-=.16*(p.z-2.2)
                    if owner.name=='gun':p.z-=.10+.38*max(0,p.x-.5);p.y-=.15
                    if not iswheel and owner==body:
                        t=max(0,min(1,(p.x-.5)/2.15));p.x-=.45*t
                        p.z-=.42*t*max(0,min(1,(p.z-.9)/1.0))*(1 if p.y<0 else .35)
                    v.co=p
            else:
                # The door's lower slab sits over a solid cab box in the base.
                # Cut that box too, so the hiding-place opening is a real recess.
                if owner==body and original_owner=='body':
                    delete_components(obj,lambda c,s: (1.3<c.x<1.6 and c.z>2.1 and .35<s.z<.65) or (s.z>.8 and s.x<.2 and c.x<.1 and c.y>.5))
                    breach(obj,(.70,-.95,1.99),(.59,.35,.60),sides=4)
                    # Burn away the front half of the tarp, preserve rear silhouette.
                    if any('khaki' in m.name for m in obj.data.materials):
                        bm=bmesh.new();bm.from_mesh(obj.data)
                        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.0001,plane_co=(-1.50,0,0),plane_no=(1,0,0),clear_outer=True)
                        bm.to_mesh(obj.data);bm.free()
                if original_owner=='doorL':
                    # Torn door, laid beside the truck within its original footprint.
                    for v in obj.data.vertices:
                        p=v.co;v.co=Vector((p.x-.5,-1.2+(p.z-1.6)*.2,.12+(p.y+1.08)*.25))
                elif original_owner=='doorR':
                    delete_components(obj,lambda c,s:c.z>2.1 and s.z>.35)
                if owner.name=='wheelFL':
                    for v in obj.data.vertices:v.co.z=max(0,v.co.z*.46);v.co.x+=.12*v.co.z
                elif owner==body:
                    for v in obj.data.vertices:
                        p=v.co
                        if p.x>1.50 and p.z>.8:
                            t=min(1,(p.x-1.50)/1.9);p.x-=.62*t;p.z+=.25*math.sin(t*math.pi*2)-.38*t
                        if .1<p.x<1.6 and p.z>2.55:p.z-=.24+.18*(1-p.y)
                        if p.x< -1.45 and p.z>2.0:
                            p.z-=.13*max(0,1-abs(p.x+2.6));p.y+=.09*math.sin(p.x*3)
                        v.co=p
            if not obj.data.polygons:
                bpy.data.objects.remove(obj,do_unlink=True);continue
            tint_to_palette(obj)
            obj.parent=owner;obj.matrix_parent_inverse=owner.matrix_world.inverted()
        if asset=='veh.tank':
            # Thrown track is a heavy linked strip snaking out from the exposed idler.
            for i in range([13,9,6][lod]):
                u=i/max(1,[13,9,6][lod]-1)
                panel('thrownTrackLink',(2.65-2.55*u,-1.39-.20*math.sin(u*math.pi),.12+.68*(1-u)**3),(.30 if lod<2 else .48,.50,.15),'uiDark',(0,.5*(1-u),.3*math.sin(u*5)))
            panel('darkHullInterior',(1.15,-.93,1.03),(1.45,.88,.22))
            for i in range(3 if lod<2 else 2):panel('tornArmorLip',(.48+i*.48,-1.43,1.56),(.52,.18,.13),'sidewalk',(0,.25+i*.15,.16))
        elif asset=='veh.military-apc':
            panel('blackenedCabin',(1.02,-.56,1.06),(1.25,1.02,.22))
            panel('foldedArmor',(1.2,-1.18,1.53),(1.13,.12,.34),'oliveSeam',(0,-.42,.17))
            panel('tornHatch',(1.12,-1.16,.10),(.67,.49,.13),'oliveSeam',(0,.16,.3))
            # Named hub: a surviving independently owned assembly at wheelFL.
            h=panel('exposedAxleHub',(1.78,-1.26,.6),(.19,.38,.19),'sidewalk')
            bpy.context.view_layer.update();world=h.matrix_world.copy();h.parent=bpy.data.objects['wheelFL'];h.matrix_world=world
        else:
            panel('cabFloor',(.72,-.13,1.23),(1.10,1.48,.12))
            panel('seatBack',(.38,-.40,1.72),(.20,.48,.60),'leather',(0,-.10,0))
            panel('seatCushion',(.64,-.40,1.40),(.49,.46,.15),'leather')
            panel('exposedEngine',(2.14,0,1.62),(.72,.80,.32),'uiDark',(0,-.25,0))
            panel('foldedBonnet',(2.30,0,2.13),(.65,1.50,.12),'oliveSeam',(0,-.56,.06))
            sockets.empty('survivorSeat',(.64,-.40,1.43),root)
            sockets.empty('survivorDoor',(.72,-1.09,1.48),root)
            sockets.empty('survivorExit',(.72,-1.65,0),root)
            # Keep the base proxy name on the cargo bed, with separate front/back
            # proxies so the level lane can admit a survivor through the torn door.
            proxy=bpy.data.objects['col:body'];proxy.location=(-1.59,0,1.70);proxy['size']=[3.35,2.24,3.40]
            colliders.cuboid('engine',(1.72,2.24,1.55),(2.40,0,.88),root)
            colliders.cuboid('cabBack',(.18,1.99,1.19),(.05,0,2.06),root)
            colliders.cuboid('cabFloor',(1.35,1.99,.20),(.75,0,1.18),root)
        if lod==0:
            # Near-tier jagged armour edges and larger scattered fragments.
            for i in range(12):
                panel('tornEdge'+str(i),(.50+i*.075,-1.20,1.53+.13*math.sin(i*1.3)),(.13,.10,.09),'sidewalk',(0,i*.31,i*.47))
        for i in range([8,4,2][lod]):
            panel('scatteredHardware'+str(i),(1.1+i*.21,-1.32,.07),(.22,.17,.09),'oliveSeam',(0,.12,i*.63))
        for obj in extra:
            tint_to_palette(obj)
            if obj.parent is None:obj.parent=body;obj.matrix_parent_inverse=body.matrix_world.inverted()
        for obj in root.children_recursive:
            if 'ss_light' in obj:del obj['ss_light'];obj['wreckLightOff']=True
        if bpy.data.objects.get('front') is None:
            _,high=bounds_combined([o for o in root.children_recursive if o.type=='MESH'])
            sockets.empty('front',root.matrix_world.inverted()@Vector((high.x,0,1.1)),root)
        root['decay']='wrecked'
        record=json.loads(root['ss_physics']);record.update(pushable=False,kickable=False,sounds='prop.metal-heavy',friction=.85,restitution=.02)
        root['ss_physics']=json.dumps(record)
        if lod==0:
            # Close inspection keeps soft manufactured edges on the surviving
            # native solids. Weld glTF normal seams before beveling actual edges;
            # never bevel individual imported triangles or simplify panels.
            for obj in [o for o in root.children_recursive if o.type=='MESH']:
                bm=bmesh.new();bm.from_mesh(obj.data)
                bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
                bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
                mod=obj.modifiers.new('near manufactured edge','BEVEL');mod.width=.018;mod.segments=1
                mod.limit_method='ANGLE';mod.angle_limit=.60;mod.use_clamp_overlap=True
        export.merge_by_material(root,protected,preserve_vertex_colors=True)
        meshes=[o for o in root.children_recursive if o.type=='MESH']
        ao.bake_all(meshes,16)
        for obj in meshes:
            layer=obj.data.color_attributes['palette'];ambient=obj.data.color_attributes['ao']
            for loop in obj.data.loops:
                p=obj.matrix_world@obj.data.vertices[loop.vertex_index].co
                c=layer.data[loop.index].color
                n=noise.noise(Vector((p.x*2.1,p.y*2.1,p.z*2.1)))
                # Broad cold soot regions, with chipped warm rust and dust-grey edges.
                scorch=.22+.20*max(0,n)+(.14 if p.x>0 and p.z>1 else 0)
                a=.65+.35*ambient.data[loop.index].color[0]
                rust=max(0,n-.12)*.42
                layer.data[loop.index].color=(c[0]*scorch*a+rust*.09,c[1]*scorch*a+rust*.035,c[2]*scorch*a+rust*.022,1)
            obj.data.color_attributes.active_color=layer
            obj.data.calc_loop_triangles()
        tris=sum(len(o.data.loop_triangles) for o in meshes);draws=len(meshes)
        cap=9 if asset=='veh.military-apc' else 8
        if tris>LIMITS[lod] or draws>cap:raise ValueError(f'{asset} LOD{lod}: {tris} triangles / {draws} draws exceeds {LIMITS[lod]} / {cap}')
        path=directory/('model.wrecked'+('' if lod==0 else f'.lod{lod}')+'.glb')
        export.glb(root,path)
        lo,hi=bounds_combined(meshes)
        stats[f'lod{lod}']={'triangles':tris,'draws':draws,'materials':len({m.name for o in meshes for m in o.data.materials}),'bytes':path.stat().st_size,'dimensions':{'x':hi.x-lo.x,'y':hi.z-lo.z,'z':hi.y-lo.y},'source':str(source.relative_to(directory.parents[1]))}
        print('WRECK',asset,lod,json.dumps(stats[f'lod{lod}']))
    stats_path.write_text(json.dumps(stats,indent=2)+'\n')
    supplied=directory/('model.wrecked'+(f'.lod{only_tier}' if only_tier else '')+'.glb')
    if supplied!=Path(output).resolve():shutil.copyfile(supplied,output)


def bounds_combined(meshes):
    pts=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
    return (Vector(tuple(min(p[k] for p in pts) for k in range(3))),Vector(tuple(max(p[k] for p in pts) for k in range(3))))
