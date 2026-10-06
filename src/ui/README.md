# HUD and menus (E14)

`GameUI` owns the DOM menu context, settings persistence, and manual Resume. It
adapts Bruno Menu/Modals' named panels and first-focus behavior without a framework.
`Game` updates UI on every animation frame, including paused/loading frames; `step`
also updates it after deterministic steps. The renderer never owns or writes HUD state.

`Hud` reads live sim components without cloning snapshots. North-up minimap positions
use X/Z offsets, 30 m radius and 44% usable radius; far objective/home pins clamp to
the edge and set `data-clamped`. Living detectable infected within 30 m use 256
preallocated pins (above existing mission infected caps). Ammo, charge, reload,
recharge and cooldown values come from the current `ActionSlot`. Shield/armor reflects
the existing armor fraction or active shield effect. E08 companion entities are read
when available; before then the portrait says “awaiting rescue.” No companion logic
or progression modifiers are introduced here.

`Settings` saves validated preferences under `minor-incident.ui.v1`. Rebinding uses
the existing versioned `Bindings`; prompt glyphs read its current keyboard key.
`Onboarding` records shown actions under `minor-incident.onboarding.v1` and advances
on real movement/actions/events. L1's evade/interact/pickup lessons wait for their
context; L2 adds selector/second side, L3 adds vehicle. E13 can clear or copy this
record when starting or restoring a distinct save. Disabled storage falls back to
session behavior. The `upgrade-selected` DOM event bubbles from `menus` with
`{id, level}` at the existing E12 `progression` handoff; E13 owns its effect. Rack
choices use existing `Combat.setLoadout` before the next briefing.

Background lifecycle comes from E16 AudioService's existing synchronous host pause
callback. During play/cinematics this opens E14 Pause and clears held inputs. On a
menu it keeps that menu. Focus return resumes audio, and only Resume resumes the
clock. `Clock.advance` stops its catch-up loop immediately when a sampled touch
pause is encountered. Escape opens Pause or backs out of Settings; it does not
resume after backgrounding.

For earlier epic harnesses `?test=1` keeps the existing presentation. `?ui=1` opts
into the real menus/HUD in tests. `hud-golden` is the HUD camera photo spot.
`__SS__.settings.set` accepts `textSize: 1 | 1.25 | 1.5` and `colorblind: boolean`
in addition to its existing settings. Text size affects DOM presentation;
colorblind mode also recolors live and future telegraphs without changing their
geometry, lifetime or simulation state.

Accessibility audits use unmodified axe-core 4.11.0 as a standalone QA tool through
`npm exec` (external npm cache), or `E14_AXE_PATH` for offline environments. It is
not added to package.json/node_modules or distributed in the game. Tests audit all
menu screens, focus visibility, and accessible button names. `perf().uiMs` records
DOM update cost separately from the sim and renderer.
