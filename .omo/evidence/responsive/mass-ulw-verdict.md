# Responsive Mass-ULW Verdict

## Required command evidence

| Command | Exit | Result |
|---|---:|---|
| `bun run typecheck` | 0 | `tsc --noEmit` completed successfully |
| `bun run lint` | 0 | `biome lint .` checked 133 files with no fixes applied |

## Independent source verification

- Mobile report claims match the current responsive source: mobile shrink/wrap rules and `min-width: 0` changes are present in `shell.css`, `home.css`, `today.css`, and `calendar.css`. The reported touch-target defect is also current: `.icon-btn` remains 36x36px in `primitives.css`; `.segment__item` retains `var(--space-2)` vertical padding; and the mobile date-control gap is 2px.
- Desktop report claims match the current diff: desktop shell rail clearance uses `padding-left: 68px`; `.plane` is a centered 1280px-max container; the grid uses `minmax(280px, 340px) minmax(0, 1fr)`; and the month column is sticky at `top: 88px`.
- QA-contract report claims match `script/qa/responsive-layout-qa.mjs`: it checks document width, tab-button bounds, date overlap/right bound, and indirect desktop rail/grid geometry, but has no calendar-cell bounds/scroll-width assertion, no required eight-button count, and no left/date-title bound checks. Its `fullPage: true` screenshots are stitched capture artifacts for fixed navigation and are not layout-placement evidence.

## Registered-criterion blockers

- **C001 - BLOCKED:** `audit-qa-contract.md` judges the required five-viewport QA contract inadequate. The current script confirms the cited coverage gaps, so its green result cannot faithfully prove the complete responsive fix.
- **C002 - BLOCKED:** `audit-mobile.md` names touch usability as a blocker at both 320x568 and 390x844. Current source confirms sub-44px date/navigation targets and a 2px mobile date-control gap; the script does not assert this mobile requirement.
- **C003 - BLOCKED:** The registered regression criterion requires a deployed responsive QA run and `.omo/evidence/responsive/live-green.txt`. That artifact is absent; `browser-qa.txt` alone does not satisfy the deployed responsive portion. The desktop audit reports no additional desktop product-layout blocker.

## Final recommendation

Remediate the two confirmed audit blockers before re-evaluation:

1. Raise mobile date/navigation targets to at least 44x44px and increase the adjacent date-control gap.
2. Add direct, executable bounds and internal-overflow assertions for calendar/grid cells, a non-vacuous eight-button assertion, and two-sided date/rail bounds.

Capture fixed-navigation placement with viewport-only screenshots (`fullPage: false`) or direct viewport geometry assertions. Do not use full-page stitched screenshots as evidence for fixed-nav placement.

## Final verdict

**BLOCKED**

Typecheck and lint are green, but the confirmed mobile touch-target and direct-QA-assertion blockers prevent C001/C002 from being accepted; C003's deployed responsive evidence is also missing.
