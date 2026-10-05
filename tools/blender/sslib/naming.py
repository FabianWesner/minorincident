def validate(objects):
    names = [obj.name for obj in objects]
    if len(names) != len(set(names)) or any(not name for name in names):
        raise ValueError('Asset objects need unique nonempty names')
