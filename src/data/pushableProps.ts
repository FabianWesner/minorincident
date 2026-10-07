/** PO finding #15 (folio-2025 Objects.js style): small street/garden props are dynamic Rapier bodies the
 * courier and running infected shove aside. Mass in kg (spec 07 light class, the big blue drop box a bit
 * heavier). Everything else (cars, dumpsters, benches, lamps, fences, hydrants, sign rows) stays static. */
export const pushableProps: Readonly<Record<string, { mass: number }>> = {
  'prop.trash-bin': { mass: 14 },
  'prop.recycling-bin': { mass: 10 },
  'prop.traffic-cone': { mass: 3 },
  'prop.crates': { mass: 12 },
  'prop.lawn-chair-a': { mass: 5 },
  'prop.lawn-chair-b': { mass: 5 },
  'prop.folding-chair': { mass: 4 },
  'prop.broken-chair': { mass: 4 },
  'prop.gnome': { mass: 4 },
  'prop.flamingo': { mass: 2 },
  'prop.trash-bags': { mass: 8 },
  'prop.wheelbarrow': { mass: 14 },
  'prop.hose-reel': { mass: 6 },
  'prop.bbq': { mass: 18 },
  'prop.mailbox-blue': { mass: 25 },
  'prop.shopping-cart': { mass: 20 },
};
