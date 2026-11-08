"""Light-anchor metadata for the legacy fire engine; leaves every mesh/material unchanged."""
import json
import bpy
from mathutils import Vector
from . import sockets, pivots


def install(root):
    bpy.context.view_layer.update()
    buckets = {key: [] for key in ('front', 'brake', 'red', 'blue', 'amber', 'accent_red', 'warm')}
    objects = [root, *root.children_recursive]
    for obj in objects:
        if obj.type != 'MESH':
            continue
        owners = set()
        parent = obj.parent
        while parent:
            owners.add(parent.name)
            parent = parent.parent
        for mat in obj.data.materials:
            if not mat or not mat.name.startswith('emi_'):
                continue
            token = mat.name.split('.')[0][4:]
            key = 'front' if 'lightsFront' in owners else 'brake' if 'lightsBrake' in owners else 'blue' if token == 'policeBlue' and owners & {'sirenL', 'sirenR'} else 'red' if token == 'sirenRed' and owners & {'sirenL', 'sirenR'} else 'amber' if token == 'schoolBusYellow' else 'accent_red' if token == 'sirenRed' else 'warm'
            buckets[key].append(obj)
    by_name = {obj.name: obj for obj in objects}
    specs = [
        ('headlightL', 'front', 'spot', 'light_led_white', 4, 24, .6),
        ('headlightR', 'front', 'spot', 'light_led_white', 4, 24, -.6),
        ('brakeL', 'brake', 'point', 'light_siren_red', 1.2, 3, .6),
        ('brakeR', 'brake', 'point', 'light_siren_red', 1.2, 3, -.6),
        ('sirenRed', 'red', 'beacon', 'light_siren_red', 3, 6, 0),
        ('sirenBlue', 'blue', 'beacon', 'light_siren_blue', 3, 6, 0),
        ('markerAmber', 'amber', 'point', 'light_sodium', .4, 2, 0),
        ('markerRed', 'accent_red', 'point', 'light_siren_red', .4, 2, 0),
        ('markerWarm', 'warm', 'point', 'light_window_warm', .4, 2, 0),
    ]
    for name, key, kind, color, intensity, reach, lateral in specs:
        meshes = buckets[key]
        if not meshes:
            continue
        owner = by_name.get('lightsFront' if key == 'front' else 'lightsBrake' if key == 'brake' else '')
        center = owner.matrix_world.translation.copy() if owner else sum((obj.matrix_world @ (sum((Vector(p) for p in obj.bound_box), Vector()) / 8) for obj in meshes), Vector()) / len(meshes)
        center += root.matrix_world.to_3x3() @ Vector((0, lateral, 0))
        anchor = by_name.get('light:' + name) or sockets.empty('light:' + name)
        anchor.parent = None
        anchor.location = center
        direction = (root.matrix_world.to_3x3() @ Vector((1, 0, -.25))).normalized()
        anchor.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        pivots.parent(anchor, root)
        marker = key in ('amber', 'accent_red', 'warm')
        anchor['ss_light'] = json.dumps(dict(type=kind, color=color, intensity=intensity, range=reach,
            **({'angle': 48} if kind == 'spot' else {}), pool=not marker,
            beam='soft' if kind == 'spot' else 'none', reflect=not marker,
            shadow='hero' if kind == 'spot' else 'none', heroPriority=2 if kind == 'spot' else 0,
            flicker='none', powerGroup='self', breakable=not marker,
            emissiveNodes=sorted(set(obj.name for obj in meshes))))
