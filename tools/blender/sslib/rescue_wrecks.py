"""Wreck transformations of existing CLOSED native sedan forms, not decimation.
The near wreck uses native LOD1 plus buckled hood/scratches; distant wrecks use
the sedan's reviewed native tiers. Preserve all source nodes and socket pivots.
"""
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector
from . import palette, ao


def build_wreck(directory, output):
    directory=Path(directory);asset=directory.name;stats={}
    for lod in (0,1,2):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        source=directory/('model.lod2.glb' if lod==2 else 'model.lod1.glb')
        bpy.ops.import_scene.gltf(filepath=str(source))
        bpy.context.view_layer.update()
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
        points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
        low=[min(v[k] for v in points) for k in range(3)];high=[max(v[k] for v in points) for k in range(3)]
        length=high[0]-low[0];nose=high[0];top=high[2]
        for obj in meshes:
            # Tear away the driver door, including its painted skin. Keep the socket.
            ancestor=obj.parent
            torn=False
            while ancestor:
                if ancestor.name in ('doorL','doorRearL'):torn=True
                ancestor=ancestor.parent
            # Missing front-left tire keeps the wheel socket but exposes the empty arch.
            if torn or (obj.parent and obj.parent.name=='wheelFL'):
                bpy.data.objects.remove(obj,do_unlink=True)
                continue
            if asset=='veh.police-sedan' and 'pal_asphalt' in [m.name for m in obj.data.materials]:
                # Police glazing shares the asphalt batch: remove only thin window faces,
                # retaining body trim. Native panes sit above 1.10 m in the source script.
                import bmesh
                bm=bmesh.new();bm.from_mesh(obj.data)
                faces=[f for f in bm.faces if obj.data.materials[f.material_index].name=='pal_asphalt' and all((obj.matrix_world@v.co).z>1.10 for v in f.verts)]
                bmesh.ops.delete(bm,geom=faces,context='FACES');bm.to_mesh(obj.data);bm.free()
                if not obj.data.polygons:
                    bpy.data.objects.remove(obj,do_unlink=True)
                    continue
            beacon=asset=='veh.police-sedan' and obj.parent and obj.parent.name in ('sirenL','sirenR','lightbar')
            if beacon:
                # Tear off the far end of the bar, retaining both named lamp batches.
                import bmesh
                bm=bmesh.new();bm.from_mesh(obj.data)
                faces=[f for f in bm.faces if all((obj.matrix_world@v.co).y>.35 for v in f.verts)]
                bmesh.ops.delete(bm,geom=faces,context='FACES');bm.to_mesh(obj.data);bm.free()
            # Remove front glass faces by authored spatial region; keep surrounding pillars.
            # Original panes are independent palette batches, so no panel triangulation collapses.
            if 'glass' in obj.name.lower() or any(m and m.name in ('pal_backpackTeal','pal_glassBlue') for m in obj.data.materials):
                # Entire glazing batch becomes empty frame area, including rear panes.
                obj.hide_render=True
                bpy.data.objects.remove(obj,do_unlink=True)
                continue
            inv=obj.matrix_world.inverted()
            for v in obj.data.vertices:
                world=obj.matrix_world@v.co
                # Deterministic front impact, bonnet fold and roof sag; continuous displacement.
                t=max(0,min(1,(world.x-(nose-length*.28))/(length*.28)))
                if world.z>.55 and world.z<top*.78:
                    world.x-=length*.20*t
                    world.z+=.27*math.sin(t*math.pi)-.28*t
                if world.z>top*.8:world.z-=.07*max(0,1-abs(world.x)/length*2)
                if beacon:
                    world.z=1.70+(world.z-1.70)*.30
                    world.z+=world.y*.08
                v.co=inv@world
            obj.data.update()
        # Bare axle hub preserves the animated wheel contract without an intact tire.
        wheel=bpy.data.objects['wheelFL']
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=.10, depth=.18, location=wheel.matrix_world.translation, rotation=(math.pi/2,0,0))
        hub=bpy.context.object;hub.name='exposedAxleHub';hub.data.materials.append(palette.mat('sidewalk'))
        matrix=hub.matrix_world.copy();hub.parent=wheel;hub.matrix_world=matrix
        root=next(o for o in bpy.context.scene.objects if o.type=='EMPTY' and o.parent is None)
        root['decay']='wrecked'
        root['ss_physics']=json.dumps({'class':'heavy','mass':1400,'friction':.85,'restitution':.02,'centerOfMass':[0,.6,0],'pushable':False,'kickable':False,'flammable':True,'sounds':'prop.metal-heavy'})
        # Keep a named collider in native coordinates (Blender Z up).
        if not any('collider' in o for o in bpy.context.scene.objects):
            from .colliders import cuboid
            cuboid('wreck',(length,high[1]-low[1],top),(0,0,top/2),root)
        # An explicit closed accordion-fold hood gives the wreck a readable impact silhouette
        # even where the native bonnet has too few vertices for a continuous dent.
        token='policeBlue' if asset.endswith('blue') else 'uiDark' if asset=='veh.police-sedan' else 'survivorRed'
        xs=[nose-length*.29,nose-length*.22,nose-length*.15,nose-length*.08]
        zs=[top*.56,top*.77,top*.58,top*.63]
        width=(high[1]-low[1])*.32
        vs=[(x,y,z-dz) for dz in (0,.045) for x,z in zip(xs,zs) for y in (-width,width)]
        fs=[]
        for i in range(3):
            k=i*2;fs.extend([(k,k+1,k+3,k+2),(k+8,k+10,k+11,k+9),(k,k+2,k+10,k+8),(k+1,k+9,k+11,k+3)])
        fs.extend([(0,8,9,1),(6,7,15,14)])
        data=bpy.data.meshes.new('buckledHood');data.from_pydata(vs,[],fs);data.materials.append(palette.mat(token))
        hood=bpy.data.objects.new('buckledHood',data);bpy.context.collection.objects.link(hood);hood.parent=root
        from .primitives import rounded_box
        def panel(name,location,size,token='uiDark',angle=0):
            obj=rounded_box(name,size,palette.mat(token),location,0);obj.modifiers.remove(obj.modifiers['bevel']);obj.parent=root;obj.rotation_euler.y=angle
            return obj
        # Deep black cabin void remains visible through the torn door and broken glazing.
        panel('exposedCabin',(0,0,top*.63),(length*.38,(high[1]-low[1])*.72,top*.35))
        panel('scorchedHood',(nose-length*.27,0,top*.58),(length*.16,(high[1]-low[1])*.55,.035),angle=-.3)
        panel('detachedBumper',(nose-.025,0,.15),(.05,(high[1]-low[1])*.65,.14),'sidewalk',.12)
        if lod<2:
            # The detached, folded door lies beside the sill rather than hiding the hole.
            panel('tornDoor',(-length*.12,low[1]+.13,.28),(length*.22,.30,.085),token,.22)
            panel('doorScorch',(-length*.12,low[1]+.12,.33),(length*.12,.22,.014))
            for i in range(5):
                panel('glassShard'+str(i),(length*.1+i*.12,low[1]+.15,.1),(.08,.11,.02),'backpackTeal',i*.4)
        if lod==0:
            from .primitives import rounded_box
            for i in range(5):
                obj=rounded_box('impactScar'+str(i),(.35,.015,.045),palette.mat('uiDark'),(nose-length*.14-i*.10,low[1]-.012,.72+i*.08),0)
                obj.parent=root;obj.rotation_euler.y=.2
                obj.modifiers.remove(obj.modifiers['bevel'])
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
        ao.bake_all(meshes,16)
        for o in meshes:
            o.data.calc_loop_triangles()
        tris=sum(len(o.data.loop_triangles) for o in meshes)
        path=directory/('model.wrecked'+('' if lod==0 else '.lod'+str(lod))+'.glb')
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE')
        stats['lod'+str(lod)]={'triangles':tris}
    (directory/'wrecked-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
    import shutil
    shutil.copyfile(directory/'model.wrecked.glb',output)
