Rename the game from "Suburban Survivors" to "Minor Incident" in the project documentation.

Scope: `specs/**/*.md`, `specs/status.json` comments, `AGENTS.md`, `docs/**/*.md`. Replace the product name (and obvious
variants such as "suburban-survivors" used as a product/package slug) with "Minor Incident" / "minor-incident".
Do NOT change: the in-world place name "Sunset Grove", file names of concept sheets in `initial-drafts/`, the GitHub
repo or folder name `suburban-survivors`, the test API name `window.__SS__`, or anything outside the scope above.
Where a spec describes the logo, note that the logo now reads "MINOR INCIDENT" and the home-screen draft is
`initial-drafts/home-screen.png` (add it to the source-sheets table in `specs/05-asset-inventory.md` and mark `ui.logo` as drafted there).
Another job is concurrently editing code (src/, package.json, tests/) for epic E01: do not touch those.

Done means: `grep -ri "suburban survivors" specs docs AGENTS.md` returns only intentional historical mentions (if any);
the diff contains only the rename plus the inventory note; committed on main as one commit (do not push).
Before finishing, review your diff for accidental changes.
