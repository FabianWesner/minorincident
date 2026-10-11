"""PKG-02: impact and heat damage of the integrated engine's native shells.

Import each authored tier, deform its actual panels and retain the entire
rigid-node/socket hierarchy. No replacement panels, boxes or generated LODs.
Budgets: 15k / 6k / 2k triangles; original 40-draw vehicle contract.
"""
import json
import math
import shutil
from pathlib import Path
import bmesh
import bpy
from . import export, palette

LIMITS = (15000, 6000, 2000)
WHEELS = {'wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'}


def smooth(a, b, x):
    t = max(0, min(1, (x-a)/(b-a)))
    return t*t*(3-2*t)


def build_damage(directory, output, decay):
    directory = Path(directory)
    if decay not in ('wrecked', 'burned'):
        raise ValueError('unsupported engine decay: '+decay)
    burned = decay == 'burned'
    stats = {}
    for lod in (0, 1, 2):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        # Mid-tier shell already preserves the full body, ladder and cab openings.
        source = directory / ('model.lod2.glb' if lod == 2 else 'model.lod1.glb')
        bpy.ops.import_scene.gltf(filepath=str(source))
        bpy.context.view_layer.update()
        root = next(o for o in bpy.context.scene.objects if o.type == 'EMPTY' and o.parent is None)
        anchors = {o.name: [list(row) for row in o.matrix_world] for o in root.children_recursive if o.type == 'EMPTY'}
        meshes = [o for o in root.children_recursive if o.type == 'MESH']
        for obj in meshes:
            owners = []; ancestor = obj.parent
            while ancestor:
                owners.append(ancestor.name); ancestor = ancestor.parent
            wheel = any(name in WHEELS for name in owners)
            tokens = [m.name.removeprefix('pal_').removeprefix('emi_').split('.')[0] for m in obj.data.materials]
            matrix = obj.matrix_world.copy(); inverse = matrix.inverted()
            bm = bmesh.new(); bm.from_mesh(obj.data)
            # Glass fractures expose the existing hollow cab and native seating.
            glass = [f for f in bm.faces if tokens[f.material_index] == 'backpackTeal' and
                     (burned or (matrix @ f.calc_center_median()).x > 2.35)]
            bmesh.ops.delete(bm, geom=glass, context='FACES')
            bm.to_mesh(obj.data); bm.free()
            for v in obj.data.vertices:
                p = matrix @ v.co
                if not wheel:
                    nose = smooth(1.65, 3.45, p.x)
                    above_axle = smooth(.8, 1.5, p.z)
                    # Cab nose folds back over the intact axle; front bumper twists too.
                    p.x -= (.70 if burned else .52)*nose*above_axle
                    if p.x > 2.6 and p.z < .85:
                        p.x -= .19*nose
                        p.z += .11*math.sin(p.y*2.5)*nose
                    roof = smooth(2.35, 3.0, p.z)
                    cab = smooth(1.45, 2.25, p.x)
                    p.z -= (.60 if burned else .34)*roof*cab
                    # Large equipment skins buckle inward around the pump/roller doors.
                    side = smooth(.35, .85, abs(p.y))*smooth(.65, 1.25, p.z)
                    dent = math.exp(-((p.x+.45)/1.25)**2)
                    p.y *= 1-(.24 if burned else .14)*side*dent
                    p.z += (.11 if burned else .07)*side*math.sin(p.x*2.1)
                    if burned:
                        # Heat collapses the native equipment roof and bends its ladder.
                        p.z -= .30*roof*math.exp(-((p.x+.8)/1.9)**2)
                        p.y += .08*roof*math.sin(p.x*1.8)
                v.co = inverse @ p
            for i, material in enumerate(list(obj.data.materials)):
                token = tokens[i]
                if material.name.startswith('emi_'):
                    obj.data.materials[i] = palette.mat('uiDark')
                elif burned and not wheel:
                    obj.data.materials[i] = palette.mat('blood' if token in ('survivorRed', 'blood') else 'asphalt' if token in ('picketWhite', 'sidewalk') else 'uiDark')
            # Soot variation uses the existing AO vertex layer, preserving native detail.
            layer = obj.data.color_attributes.active_color
            if burned and layer and not wheel:
                tinted = set()
                for loop in obj.data.loops:
                    p = matrix @ obj.data.vertices[loop.vertex_index].co
                    soot = .28 + .22*(.5+.5*math.sin(p.x*2.3+p.z*3.2))* (1-smooth(1.2, 3.0, p.z))
                    index = loop.index if layer.domain == 'CORNER' else loop.vertex_index
                    if index in tinted:
                        continue
                    tinted.add(index)
                    c = layer.data[index].color
                    layer.data[index].color = (c[0]*soot, c[1]*soot, c[2]*soot, c[3])
            obj.data.update()
        for obj in root.children_recursive:
            if 'ss_light' in obj:
                del obj['ss_light']
            if obj.name in ('lightsFront', 'lightsBrake', 'sirenL', 'sirenR'):
                obj['damagedLightOff'] = True
        root['decay'] = decay
        root['damagedLightsOff'] = True
        export.merge_by_material(root, WHEELS | {'body', 'ladder', 'sirenL', 'sirenR', 'lightsFront', 'lightsBrake'}, preserve_vertex_colors=True)
        meshes = [o for o in root.children_recursive if o.type == 'MESH']
        for obj in meshes:
            obj.data.calc_loop_triangles()
        triangles = sum(len(o.data.loop_triangles) for o in meshes)
        draws = sum(len(o.data.materials) for o in meshes)
        assert triangles <= LIMITS[lod], (decay, lod, triangles)
        assert draws <= 40, (decay, lod, draws)
        assert anchors == {o.name: [list(row) for row in o.matrix_world] for o in root.children_recursive if o.type == 'EMPTY'}, 'socket transform changed'
        path = directory / ('model.'+decay+('' if lod == 0 else '.lod'+str(lod))+'.glb')
        export.glb(root, path)
        stats['lod'+str(lod)] = dict(triangles=triangles, draws=draws, bytes=path.stat().st_size, source=source.name, anchorsUnchanged=True)
    (directory/(decay+'-stats.json')).write_text(json.dumps(stats, indent=2)+'\n')
    shutil.copyfile(directory/('model.'+decay+'.glb'), output)
