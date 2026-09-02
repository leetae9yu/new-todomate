# Desktop responsive audit — rail & planner alignment

## Verdict: PASS (both desktop viewports)

Live-measured at `1024x768` and `1440x1000` against the served production build. All five criteria pass at both dimensions. No blockers.

Evidence: geometry probed via Playwright on the live app (`http://127.0.0.1:4173`), cross-checked against `desktop-small.png` / `desktop-wide.png`, and the QA contract (`script/qa/responsive-layout-qa.mjs`) re-run green: `PASS responsive layout at 320, 390, 768, 1024, 1440px`. The pre-fix baseline is `red.txt` (C001/C002 FAIL).

## Criterion results

| Criterion | 1024x768 | 1440x1000 |
|---|---|---|
| Brand clearance beyond 68px rail | PASS | PASS |
| Profile / home-grid left alignment | PASS | PASS |
| Usable two-column widths | PASS | PASS |
| Sticky calendar | PASS | PASS |
| Viewport containment | PASS | PASS |

### Brand clearance beyond the 68px rail
- Fix: `.shell__with-rail { padding-left: 68px }` shifts the whole padded shell; the `.topbar` (inside the shell) inherits the offset. Rail is `position: fixed; width: 68px` at left `0..68`.
- Measured: brand `.topbar__logo` left = `88` at both widths → `88 >= 68 + 16` (20px clear of the rail). Screenshot confirms "todo mate" wordmark starts right of the rail border, not under it.

### Profile / home-grid alignment
- Fix: `.plane` is the shared centered container (`max-width: 1280px`, `margin-inline: auto`), so the date-navigation block (`.profile`) and `.home__grid` share the same content left edge.
- Measured left edges: 1024 → profile `100`, grid `100` (delta 0); 1440 → profile `146`, grid `146` (delta 0). Both within the `<= 2px` contract.

### Usable two-column widths
- Fix: `.home__grid { grid-template-columns: minmax(280px,340px) minmax(0,1fr); gap: var(--space-6) }`; month column `minmax(280,340)`, today column flexible with `minmax(0,1fr)` so it can't force overflow.
- Measured: 1024 → month `340`, today `528` (today left `464`); 1440 → month `340`, today `852` (today left `510`). Both columns wide enough to be usable; today column never collapses below content.

### Sticky calendar
- Fix: `.home__grid .home__month { position: sticky; top: 88px }` at `min-width:1024px`. `88px` = topbar height (`61`) + plane top padding (`24`) + 3px breathing room.
- Measured: month starts at top `299` at scroll 0; after `scrollY=2000`, clamps to top `88` at both widths. `position: sticky` confirmed computed. Calendar follows scroll without leaving the viewport top.

### Viewport containment
- Measured: `scrollWidth === clientWidth` at both widths (1024 → `1024/1024`; 1440 → `1440/1440`). No horizontal scrollbar.
- Date controls within viewport: 1024 → right `992 <= 1024`; 1440 → right `1362 <= 1424`. Grid right edge: 1024 → `992 <= 1008`; 1440 → `1362 <= 1424`. Plane `max-width: 1280px` centers the wide layout, keeping content off the edges.

## Fix summary (what made red → green)
- `shell.css`: added `.shell__with-rail { padding-left: 68px }` at desktop; `.plane` given `width:100%; max-width:1280px; margin-inline:auto; min-width:0`. Removed the old `margin-left: 68px` on `.plane`/`.home__grid` that double-shifted and misaligned the grid.
- `home.css`: `.home__grid` columns changed from fixed `360px minmax(0,1fr)` to `minmax(280px,340px) minmax(0,1fr)`; month cell made `position: sticky; top: 88px`; profile/date-head given `min-width:0` + ellipsis to prevent flex overflow.
- `calendar.css`: `min-width:0` on `.calendar`, `.calendar__grid`, `.calendar__day` so the 7-column grid shrinks instead of overflowing.
- `today.css`: `.task__label`/`task-inline` `min-width:0` + `overflow-wrap:anywhere` so long task text can't push the grid wide.
- `planner-home.tsx`: replaced inline `style` shortcut row with `.home__shortcuts` (no layout impact).

## Blockers
None for the desktop criteria. (Pre-existing, out-of-scope note: `audit-qa-contract.md` flags the QA script's checks as indirect for calendar-cell overflow; that is a test-robustness observation, not a product layout blocker. Desktop layout itself is correct.)
