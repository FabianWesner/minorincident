"""Grove Shopping Center: static layout. Gameplay tuning is in src/levels/districts/D-SHOP.ts."""
from sslib.layout import Layout
from sslib.l1_dressing import prepare, dress
l = Layout('D-SHOP', 'Grove Shopping Center')
prepare(l)
l.building('bld.supermarket', -14, -14, 'market-door', 'Grove Market')
l.building('bld.pharmacy', 14, -14, 'pharmacy-door', 'Grove Pharmacy')
l.building('bld.joes-diner', -14, 14, 'food-court-door', 'Food Court')
l.building('bld.mainstreet-brick', 14, 14, 'mall-door', 'Maple Mini Mall')
for x in [-22,-19,-16,-13,-10]: l.box('parking-stripe','picketWhite',[.13,.025,3],[x,.08,7])
l.box('mall-sign','schoolBusYellow',[5,1,.4],[15,3,9])
l.anchor('objective', [5,0,-8])
dress(l)
l.export()
