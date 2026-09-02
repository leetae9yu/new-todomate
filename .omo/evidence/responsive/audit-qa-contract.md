# Responsive QA contract audit

## Verdict: INADEQUATE

The script registers all five required viewports and has executable checks for document overflow, navigation clipping, date-title/control overlap, desktop rail/brand separation, and desktop planner-grid alignment. However, it does not faithfully prove the responsive fix: the rail and grid checks are indirect, and there is no direct assertion for the calendar grid/cells (the principal narrow-layout overflow surface). A clipped descendant can pass when `document.scrollWidth` is unchanged.

## Assertion inventory

1. `metrics.scrollWidth === metrics.clientWidth` (all registered viewports: 320, 390, 768, 1024, 1440).
   - Detects: page-level horizontal overflow, including many failures caused by the calendar/grid, long task text, top bar, or rail layout.
   - Risk: false positive because unrelated page content can trigger it; false negative because descendants clipped by `overflow: hidden` or internally overflowing without expanding the document are not detected. It does not identify which responsive region failed.

2. Each `.tabbar button` has `left >= -0.5` and `right <= viewport.width + 0.5` (all five viewports).
   - Detects: navigation buttons visibly extending beyond the viewport.
   - Risk: false negative if `.tabbar` itself is misplaced, has no buttons, or button content is clipped while the button rectangle remains in bounds. It also does not check touch-target usability or inter-button overlap.

3. `.date-head__title` and `.date-head__controls` rectangles do not overlap (all five viewports).
   - Detects: date title/control collision.
   - Risk: false negative for title text clipping/ellipsis or controls clipped inside an in-bounds container. `box()` throws for missing targets rather than recording a viewport-specific assertion failure.

4. `.date-head__controls.right <= viewport.width + 0.5` (all five viewports).
   - Detects: date controls extending past the viewport.
   - Risk: false negative for left-side overflow, vertical clipping, or controls that are present but unusable/overlapping each other. It does not assert the title is itself within the viewport.

5. At widths >= 1024, `.topbar__logo.left >= .tabbar.right + 16`.
   - Detects: a desktop rail intruding into/covering the brand area.
   - Risk: false positive if the rail is not the actual fixed/visible rail, or if the brand is displaced rather than covered. False negative for rail overlap with the plane, content, or lower portions of the top bar; it also does not assert rail bounds, visibility, or that the rail is on-screen.

6. At widths >= 1024, `abs(.home__grid.left - .profile.left) <= 2`.
   - Detects: planner grid left-edge misalignment relative to the profile/date-navigation column.
   - Risk: false positive if both elements share a wrong offset; false negative for right-edge overflow, column-width errors, internal calendar overflow, or overlap not affecting the left edge.

7. At widths >= 1024, `.home__grid.right <= viewport.width - 16`.
   - Detects: desktop planner grid extending beyond the intended right inset.
   - Risk: false negative for overflow inside the grid (especially calendar cells) that does not move the grid bounding box, and for grid overlap/rail collision on the left.

8. Screenshots are captured for every viewport.
   - Detects nothing executable; artifacts may assist manual review only.

## Required corrections

- Add an executable calendar/grid assertion for every registered viewport: obtain `.home__grid`, `.calendar`, `.calendar__grid`, and all seven-column day cells; assert each target has `left >= 0`, `right <= viewport.width`, and that the calendar grid's computed `scrollWidth` equals its `clientWidth`. This directly covers the narrow calendar `min-width`/column regression instead of relying only on document overflow.
- Strengthen the rail criterion at desktop widths: assert `.tabbar` is within the viewport and assert its rectangle does not intersect the `.plane`/`.home__grid` content region, rather than checking only logo separation.
- Make navigation coverage non-vacuous by asserting the expected tab-button count before iterating; otherwise a missing navigation renders the loop successful.
- Add a date-title bounds assertion (`left >= 0` and `right <= viewport.width`) and controls `left >= 0`; this closes the current one-sided date coverage.

Until these corrections are made, the contract is INADEQUATE even though it will catch a straightforward page-wide horizontal scrollbar at each registered viewport.
