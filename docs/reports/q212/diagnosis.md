# Baseline diagnosis

L7 high is the only over-budget baseline row: 6,094.1 ms on the first profile, then
3,427.8 / 3,375.9 / 3,376.4 / 3,391.6 ms. The first shader compilation is 3,605.2 ms
and its first driver warm-up is 565.2 ms; later profiles spend about 1,730–1,781 ms
and 63–79 ms respectively. Every profile has a new browser/profile/cache; OS/driver
caches remain shared. This first-sample tail is retained in the budget comparison.

A separate profiled fresh-browser load, after those five observations, takes
3,483.1 ms. It cannot recreate the already-warmed OS/driver cache. In its roughly
1,774 ms shader window, the CPU profile attributes 1,484 ms to Three's graph
construction and 149 ms to GC, versus 20 ms idle. Async pipeline calls overlap and
must not be summed as wall time. These diagnostic values are excluded from the
acceptance distributions.

L7's baseline census finds 14 ordinary-infected batches and 14 material graphs.
Those surfaces already have per-draw pose/atlas binding support in the L4 path;
sharing by its existing feature key is the candidate for the repeated graph cost.
Alpha-specific surfaces are outside this candidate.

Raw CPU, Dawn trace and phase measures: [diagnostic evidence](evidence/diagnostic-main-L7-high/).
