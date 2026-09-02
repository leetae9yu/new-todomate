# Mobile Responsive Audit — new-todomate

Date: 2026-09-02
Scope: 320x568 (phone-small) and 390x844 (phone)
Method: static review of `src/web/styles/{shell,home,today,calendar}.css`,
`src/web/components/planner-home.tsx` (+ `chrome.tsx`, `planner-tabs.tsx`,
`planner-date-navigation.tsx`), `script/qa/responsive-layout-qa.mjs`, and the
captured evidence `phone-small.png` (320x3788) / `phone.png` (390x3698).
Baseline regression state: `.omo/evidence/responsive/red.txt`.

This is an audit only. No product source or tests were changed.

## Verdict matrix

| Criterion | 320x568 | 390x844 |
|---|---|---|
| Document overflow | PASS | PASS |
| Eight bottom-nav items | PASS | PASS |
| Date controls | PASS | PASS |
| Profile truncation | PASS | PASS |
| Long populated planner content | PASS | PASS |
| Touch usability | FAIL | FAIL |

Overall: **FAIL** — one blocker (touch usability) applies to both widths.

## Evidence and reasoning

### Document overflow — PASS (both)
- RED state: `phone-small: document width 366 exceeds 320`.
- Fix present in source: `.shell`, `.topbar`, `.plane`, `.home__grid`,
  `.calendar`, `.week-strip`, `.task-inline`, and `.profile` all carry
  `min-width: 0`, so grid/flex children can shrink instead of forcing
  horizontal scroll. Long task text uses `overflow-wrap: anywhere`
  (`.task__label`), and `.task-chip` ellipsizes.
- Captured evidence confirms: `phone-small.png` is exactly 320 wide and
  `phone.png` is exactly 390 wide — no horizontal scrollbar in either full-page
  capture.

### Eight bottom-navigation items — PASS (both)
- `planner-tabs.tsx` defines exactly 8 tabs (home, calendar, routines, backlog,
  stats, social, notifications, profile).
- RED state: items 7 and 8 clipped at 320, item 8 clipped at 390.
- Fix present: `.tabbar` is `overflow-x: hidden` with
  `justify-content: space-around`; each `.tabbar button` is `flex: 1;
  min-width: 0`, so all eight share the row equally instead of overflowing. At
  <=480px the icons shrink to 21px (`shell.css`), giving 8 x ~40px slots at
  320px. Both screenshots show all eight icons fully inside the viewport.

### Date controls — PASS (both)
- RED state: `date controls exceed viewport` at every width.
- Fix present: at <=480px `.date-head` becomes `flex-wrap: wrap` with a smaller
  `gap`, and `.date-head__controls` gets `margin-left: auto` and `gap: 2px`,
  letting the segmented 월/주 toggle + prev/next chevrons wrap onto their own
  line right-aligned instead of overflowing past the title. The QA script's
  overlap and `dateControls.right <= viewport.width` checks are satisfied by
  this wrap. Both screenshots show the controls fully on-screen.

### Profile truncation — PASS (both)
- `.profile` and `.profile__text` carry `min-width: 0`; the motto line
  (`.profile__text p`) uses `overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap`, so the long motto "each task shapes who we become."
  truncates with an ellipsis rather than pushing the layout. The avatar is
  `flex-shrink: 0`. Both screenshots show the motto ellipsized and the row
  intact.

### Long populated planner content — PASS (both)
- The feed renders many populated category groups (QA-*, 비공개-*, 공유-*)
  with inline add inputs. `.feed-groups`/`.tasklist` are vertical grids with
  `min-width: 0`; task labels wrap (`overflow-wrap: anywhere`) and inline
  inputs are `flex: 1; min-width: 0`. Vertical growth is unbounded (page
  scrolls), which is correct. Both full-page screenshots (~3700px tall) render
  the long list cleanly with no clipped or overlapping rows and the bottom
  shortcuts (일기/타이머/보관함) reachable above the fixed tab bar
  (`.plane` adds `padding-bottom: calc(space-6 + 64px + safe-area)`).

### Touch usability — FAIL (both) — BLOCKER
- The date-header chevrons and the topbar menu button use `.icon-btn`, which is
  fixed at **36x36px** (`primitives.css`). That is below the 44x44px (Apple
  HIG) / 48x48px (Android) minimum touch target.
- The 월/주 segmented control (`.segment__item`) is `padding: 8px 12px` on a
  0.75rem line — roughly **32px tall**, also under 44px.
- The week-strip day buttons (`.week-strip__day`) at 320px are ~45px wide but
  only as tall as their content (weekday + 24px cloud + number, ~`space-2`
  padding) — under 44px tall.
- Result: the primary navigation/date controls on a 320–390px phone are all
  sub-44px and sit adjacent (gap as low as 2px in `.date-head__controls`),
  so mis-taps are likely. This is the single blocker and applies at both
  widths.

## Blockers

1. **Touch target size (both 320x568 and 390x844).** `.icon-btn` = 36x36px,
   `.segment__item` ~32px tall, `.week-strip__day` < 44px tall, with 2px gaps
   in the date controls. Raise interactive targets to >= 44x44px (and increase
   the date-control gap) to pass touch usability. No other criterion blocks.

## Notes
- `planner-home.tsx` correctly hides the side month calendar below 1024px
  (`.home__grid .home__month { display: none }`), so mobile shows a single
  column — confirmed in both screenshots.
- `calendar.css` hides task chips and shrinks day cells at <=480px, keeping the
  month grid inside the viewport on small phones.
