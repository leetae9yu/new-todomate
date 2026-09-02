# TodoMate — UI/Interaction Design Brief (for a React PWA clone)

> Purpose: a visual engineer should be able to build an **original but recognizably
> TodoMate-inspired** PWA from this document alone, without further public research.
> Everything below is sourced from public surfaces (marketing screenshots, store listings,
> the public web app shell, and the client-rendered localization string table shipped in the
> public web bundle). Anything not publicly visible is explicitly labeled **[UNAVAILABLE]**.
> Anything inferred rather than directly observed is labeled **[ASSUMPTION]**.

---

## 0. Sources & verification

| # | Source | What was taken from it | URL |
|---|--------|------------------------|-----|
| S1 | Apple App Store listing (KR) — 10 iPhone screenshots | Calendar, Today feed, widget, Routine, Stats, Timer, Diary, cross-device, Sticker/Cheer, Crew screens; primary color samples | https://apps.apple.com/kr/app/id1505220130 (images via `itunes.apple.com/lookup?id=1505220130&country=kr`) |
| S2 | Apple App Store listing (US) — EN marketing copy | Feature names, positioning, EN/KO term mapping | https://apps.apple.com/us/app/id1505220130 |
| S3 | Apple App Store listing — 6 iPad screenshots (app v2020-era, still public) | Two-pane desktop/tablet layout, dark mode, Backlog, Reminders screens | same listing (`ipadScreenshotUrls`) |
| S4 | Public web app shell `todomate.net` | Splash screen, brand assets (`applogo100.png`, `favicon.png`), tech stack signal (Flutter web), store deep-links (`id1505220130`, `com.undefined.mate`) | https://todomate.net/ |
| S5 | Public web bundle localization table (`main.dart.js`, client-rendered UI strings, EN⇄KO pairs) | Screen/menu/feature names, interaction verbs, settings taxonomy | https://todomate.net/main.dart.js |
| S6 | Google Play listing | `com.undefined.mate`, 5,000,000+ installs, 4.7★ | https://play.google.com/store/apps/details?id=com.undefined.mate |
| S7 | Apple lookup metadata | Category = Productivity + Social Networking, 4.78★ / 107k ratings (KR), 4.80★ (US), v5.15.11 | https://itunes.apple.com/lookup?id=1505220130&country=kr |

**What could NOT be captured:** the live login screen renders behind a Flutter engine that never
produces first-frame in headless Chromium on this machine (WebGL blocked), and all in-app
screens sit behind authentication. Per scope, **no authentication was bypassed**. Login details
below therefore come from the public string table (S5) + splash screen (S4), labeled accordingly.

---

## 1. Brand & design language

**Identity.** Wordmark **"todo mate"** in lowercase with a wide gap (`todo` / `mate`), set in a
heavy black grotesque. App icon & splash logo: a solid **black "cloud/puff" glyph** — four stacked
scalloped bumps, roughly an "X/cross made of bubbles" — on white. The brand is deliberately
**monochrome-first**: black/white UI with one saturated accent family (violet/blue) plus
user-assigned category colors.

**Personality** (from marketing headlines): minimal, playful, motivational. Headlines are huge,
extra-bold, often with a single word colored in brand blue ("**No.1** 오늘의 할 일 앱"). Body copy
is small, quiet gray. Mascot: a hand-drawn cloud character (used in empty states & stickers).

**Tone keywords:** clean, high-contrast, rounded, generous whitespace, cheerful accent pops.

---

## 2. Color system

Sampled from S1 screenshots (± JPEG tolerance). Use as a token set.

### 2.1 Core / neutral
| Token | Hex | Usage |
|-------|-----|-------|
| `bg` | `#FFFFFF` | App background (light mode) |
| `bg-alt` | `#FAFBFF` | Screenshot canvas / very subtle tint |
| `surface` | `#F2F2F2` | Inactive chips, category pill background, unselected checkbox |
| `surface-dark` | `#1D1D1D` | Timer screen pill buttons (on black) |
| `ink` | `#000000` | Primary text, active tab, headlines |
| `ink-soft` | `#191919` | Secondary near-black |
| `line` | `#D5D9DC` (≈ `#D3D8DB`) | Hairlines, inactive calendar cells, borders |
| `muted` | `#8A8A8A` – `#9A9A9A` [ASSUMPTION mid-gray] | Secondary text, timestamps, disabled icons |

### 2.2 Brand accent
| Token | Hex | Usage |
|-------|-----|-------|
| `accent` | `#0077FF` | Brand blue — marketing highlight word, Saturday, links |
| `violet` | `#8437FF` | **Primary category/brand accent** — active checkbox, primary chip, selected state |
| `violet-deep` | `#6433FF` | Diary bottom-sheet fill |
| `blue` | `#2C34FF` | Second category color (checkbox/chip) |

### 2.3 Category palette (user-assignable colors for lists/tasks)
| Token | Hex |
|-------|-----|
| `cat-violet` | `#8437FF` |
| `cat-blue` | `#2C34FF` |
| `cat-pink` | `#FF5CB5` |
| `cat-pink-soft` | `#FFA6DD` (chip tint) |
| `cat-black` | `#191919` |
| `cat-grey` | `#D5D9DC` |
| [ASSUMPTION] Additional hues (red/orange/green) likely exist in the picker but only these six are publicly visible in screenshots. **[UNAVAILABLE: full palette]** |

### 2.4 Sticker / cheer accents (playful)
| Token | Hex |
|-------|-----|
| `sticker-yellow` | `#FFCC25` (heart), `#FFE500` |
| `sticker-red` | `#FF2631` |

### 2.5 Semantic
- Sunday / holiday red text, Saturday blue text (calendar convention).
- Timer "in progress" indicator green `#00CC3C` / `#20BC4F`.
- Dark mode exists (S3 iPad dark screenshot + `prefers-color-scheme` in web shell): bg `#000000`, surface `#1C1C1C`, ink `#FFFFFF`.

---

## 3. Typography

Exact typefaces are **[UNAVAILABLE]** (rendered as raster/bitmap; web bundle embeds fonts). The
visual evidence supports the following **[ASSUMPTION]** scale, which reproduces the look:

| Role | Style | Sample |
|------|-------|--------|
| Display headline | Extra-bold grotesque, ~34–40px, tight tracking, black; one word in `accent` | "todo mate", "오늘의 할 일" |
| Screen title (sub-page) | Semibold, centered, ~17px | "루틴", "타이머", "일기", "Backlog", "Reminders" |
| User display name | Bold, ~20px | "Charlotte" |
| Date / month header | Bold, ~17px | "2026년 7월", "2026년 7월 3주차", "AUGUST 2020" |
| Section / category label | Bold, colored by category, ~14px | "운동", "공부", "Feed", "App Development" |
| Task text | Regular, ~15px, black | "러닝", "Fix bugs" |
| Checkbox-tick text (done) | Regular, same size, struck-through or checked glyph | (see components) |
| Meta / status line | Regular, ~12px, gray | "2026. 1. 1 ~ 2090. 12. 31 / 수목금 / AM 7:30" |
| Weekday header | Small, ~11px, `일`=red, `토`=blue, rest gray/black | calendar grid |
| Tab bar labels | **None** — icon-only tab bar | (see navigation) |

[ASSUMPTION] Font stack suggestion to match mood: a geometric grotesque for Latin (e.g. "Pretendard",
"Spoqa Han Sans Neo", or "Poppins"/"Sora" for EN-only) with heavy (700–900) weights. Avoid thin,
elegant serifs — the brand is bold and friendly.

---

## 4. Spacing, shape & elevation

Measured from S1 screenshots (proportions consistent across screens):

| Property | Value | Notes |
|----------|-------|-------|
| Base unit | 4px grid | all paddings land on 4/8 multiples |
| Screen side padding | 16–20px | content inset from device edge |
| Category pill radius | full / pill (999px) | "운동 +", "App Development +" |
| Task checkbox | rounded square, ~22px, radius ~6px | solid when done, `#F2F2F2` when empty |
| Task chip (calendar) | rounded rect, radius ~6–8px | solid category color, white text |
| Card / sheet radius | 20–24px | diary sheet, sticker sheet, phone mock corners |
| Tab bar | icon-only, ~64px tall, 5 items | black active / gray inactive |
| Avatar | circle, 44–56px | profile + peer chips |
| Elevation | minimal; subtle 1px hairline or soft shadow on sheets | mostly flat UI |

**Signature shape:** the checkbox is a **soft-edged square (squircle)**, not a circle — this is a
key recognizability cue. The brand glyph itself is a squircle-ish scalloped cloud.

---

## 5. Navigation & information architecture

### 5.1 Primary navigation (mobile)
A **5-item, icon-only bottom tab bar** (no text labels), fixed. From S1/S2, left→right:

1. **Home / Feed** — house icon (filled black when active). Default screen = Today.
2. **Explore / Search** — compass icon. Find people & crews.
3. **Notifications / News** — bell icon. Activity feed (likes, follows, crew events).
4. **(Messages / Chat)** — paper-plane icon. [ASSUMPTION: chat/DM, from string table `/chatRoom`]
5. **My / Profile** — person icon. Profile, settings entry.

Active tab = solid black glyph; inactive = gray (`#9A9A9A`-ish). No center FAB; no labels.

### 5.2 Global chrome
- **Top-right hamburger (≡)** on main screens → opens settings / menu (S1).
- **Top-left back chevron (‹)** on sub-pages (Routine, Timer, Diary, Backlog, Reminders).
- **Top-right "+"** on management pages (Reminders, Lists).
- Peer/crew switcher: a **horizontal row of avatar chips** at the top of the Home feed (you + friends/crews). Selected = black pill with white name; unselected = light gray pill. Tapping swaps the whole feed to that person/crew's view (S1-01, S1-10).

### 5.3 Desktop / tablet adaptation (from S3 iPad screenshots + web shell)
- **Two-pane layout**: left column = profile + month calendar; right column = the task feed ("Feed"). Wide whitespace; content is centered, not stretched full-bleed.
- Top bar gains a **"Backlog" button (checklist icon) top-right** + hamburger.
- Profile + add affordance appear as circular `J` avatar + `+` button top-left.
- **[ASSUMPTION for PWA]** On ≥1024px, convert bottom tab bar to a slim left rail (icons) or top bar; keep the two-pane split (calendar left, feed right). On mobile, keep bottom tab bar and single-column feed. This mirrors the observed iPad behavior.

---

## 6. Screen-by-screen reference

### 6.1 Login / onboarding — [UNAVAILABLE: live screen] + [from S5 strings + S4 splash]
- **Splash** (observed, S4): centered black cloud glyph on white, then "Loading todo mate…" with animated ellipsis. Dark-mode aware.
- **Auth options** (from string table, high confidence): four stacked buttons —
  - "Continue with Apple" / Apple 계정으로 시작
  - "Continue with Google" / Google 계정으로 시작
  - "Continue with Email" / 이메일로 시작
  - "Start as Guest" / 게스트로 시작
  - plus "Start todo mate / 시작하기", "Sign Up / 회원가입", "Forgot password?", "Reset Password".
- Legal line: agreement to Terms of Use + Privacy Policy (linked) at bottom.
- [ASSUMPTION] Layout: brand glyph centered upper-third, social buttons as full-width rounded-rect
  buttons (~52px, radius 12), Apple = black, Google = white w/ border, Email = neutral, Guest = text
  link. This matches the monochrome brand and standard social-login pattern.

### 6.2 Today / Todo list (Home feed) — S1-02, S1-10, S3
**Structure top→bottom:**
1. Peer/crew chip switcher (avatars).
2. Profile block: circular avatar (left) + display name (bold) + status/motto line ("each task shapes who we become.") in gray; small settings/decoration icon right.
3. Date header row: a small colored date-badge (circle) + "2026년 7월 3주차" (bold); right side = view toggle ("월"/"주") + ‹ › chevrons to move week.
4. **Weekly strip**: 7 columns, weekday letters (일 red … 토 blue). Each day shows a completion "flower/cloud" glyph — filled & colorful when all done, gray outline when not. Day number below; today = black filled circle number.
5. **Category groups** — the core list. Each group:
   - Header pill: small category-color dot/avatar + category name in its color + a gray "+" (add task).
   - Tasks below, one per row: squircle checkbox (solid category color + white ✓ when done; `#F2F2F2` empty) + task name. Done tasks keep text (not struck in S1-02; the checkbox carries state).
   - Rows are plain, full-width, minimal dividers.
6. When a crew is selected (S1-10): same structure, but tasks are grouped per-member (member avatar + name as the group header) and the feed shows a crew intro line ("화/목/토 7:00 달리기해요!").

**Interactions** (from S5): tap checkbox → complete; long-press row → context menu with
"Do It Today / 오늘하기", "Repeat Today", "Change Date / 날짜 바꾸기", "Move to Backlog / 보관함으로 이동",
"Open Timer / 타이머 열기", "Copy / 복사하기", "Move / 이동", "Delete / 삭제하기", "Memo / 메모".
"Move undone items to today/tomorrow/another day" bulk actions exist.

### 6.3 Calendar — S1-01
1. Same profile block + date header ("2026년 7월") with "주" (week) toggle + ‹ › month chevrons.
2. **Month grid**, Sunday-start ("Start from Sunday in calendar" is a setting). Weekday header row (일 red, 토 blue).
3. Each day cell: day number on top (Sunday red, Saturday blue), and **up to ~3 colored task chips** stacked beneath — solid category color, white bold text. A day with a diary/photo shows a **rounded photo thumbnail** instead of chips (e.g. flower, coffee image on the 8th/16th).
4. Today (22) = number in a **black filled circle**.
5. Chips overflow: days with many tasks show the first few (visual: 3 rows).
- Tapping a day presumably jumps to that day's feed. **[ASSUMPTION]**
- Setting: choose which categories appear on the calendar ("Select the lists to show on Todo Calendar").

### 6.4 Friends / Activity — S1-09, S1-10, S5
Three sub-surfaces:
- **Explore (compass tab):** search "People or crews / 계정 또는 크루"; crew discovery ("Find a crew you want to join", "둘러보기"). Crew cards show crew image, name, intro.
- **Notifications / News (bell tab):** chronological activity list. Templates (verbatim from S5):
  - "<b>%s</b> completed a todo item. <time>"
  - "<b>%s</b> likes your <b>%s</b> todo item."
  - "<b>%s</b> is now following you."
  - "똑똑 <b>%s</b>님이 노크를 했어요" ("knocked on your feed")
  - "<b>%s</b> sent a follow request / has wrote a diary / crew join accepted·rejected."
  Rows: avatar + rich-text line (bold names) + right-aligned timestamp.
- **Cheer / Sticker sheet (S1-09):** a bottom sheet (white, top rounded ~24px) grid of **sticker reactions** — cartoon cloud mascot in 12+ poses across a 4-column grid, with category tabs at the bottom. Used to "cheer with likes." Interactions: "You can like it after it's done", "The previous like will be replaced", "double-tap to send your recent like". Received cheers surface as "Your Supporters / 받은 응원" + "Reactions / 받은 관심".

### 6.5 Profile / Settings — S1-02(profile block), S5(settings taxonomy)
- **Profile block (in-feed):** avatar + name + one-line motto. Full profile page **[UNAVAILABLE]** but string table confirms: Profile image, User ID (≥4 chars, EN/numbers), "Complete your profile / 프로필 완성하기", Followers/Following counts, Gender + Birth Year/Month (grants extra stickers).
- **Settings menu items (verbatim from S5, high confidence):**
  - Account: Signed-in account, Email / Change Email, Password / Reset Password, User ID, Release user ID, Delete Account, Sign Out, Allow Account Search.
  - Content: Lists (카테고리 관리), Routines (루틴 관리), Reminders (리마인더 관리), Backlog (보관함), My stickers, Diary visibility.
  - Privacy: Visibility (Public / Private / Selected Followers), Allow likes for todo items / for diary, Allow follows after approval, Block/Unblock, Report.
  - Notifications: Reminder Time, Followings to get notified, Notifications of liked todo items, Marketing notifications.
  - Appearance/System: Theme, Change font, Enable background effect, Show time in 24-hour format, Start from Sunday in calendar, Language (EN/KO).
  - Monetization: Premium (Remove Ad / "enjoy todo mate without ads"), Premium Time.
  - About: Terms of Use, Privacy Policy, Version, Inquiry (문의하기), Download Desktop App.
- **[ASSUMPTION]** Settings = grouped list with section headers, right chevrons, toggles for booleans — standard clean monochrome rows matching the rest of the app.

### 6.6 Routine management — S1-04
- Sub-page "루틴" with back chevron. Category pill groups (운동/공부/여행/독서) each with "+".
- Each routine row: a blue "진행 중 |" (In Progress) tag + routine name (bold), then a gray meta line: "2026. 1. 1 ~ 2090. 12. 31 / 수목금 / AM 7:30" (date range / days / time).
- Frequencies (S5): Everyday, Weekly, Biweekly, Monthly, Yearly, "X of every month", Last day.

### 6.7 Timer (focus) — S1-06
- **Full-bleed black screen**, top "2:30" clock + battery, back chevron, centered title "타이머".
- Center: task name ("오전 운동") over a hairline, then a **huge tabular timer "00:58:36"** (~64px, white, bold), another hairline.
- Bottom: two dark pills — green pause icon + "진행 중" (In Progress), and white stop square + "완료하기" (Complete).
- Behavior: one active timer at a time ("There is an existing timer…open that timer?"); time saved to the task.

### 6.8 Diary — S1-07, S3(Backlog concept)
- Weekly strip where each day shows an **emoji** (representative mood) instead of a checkbox cloud.
- Tapping opens a **large violet bottom sheet** (`#6433FF`, top-rounded): "일기" title, a big representative emoji (🍟), author avatar+name+date, then diary body text in white.
- Rules: one diary per date; emoji is the signature. AI can generate a diary from completed tasks (S2).
- Feed companion: "Backlog / 보관함" (S3) = undated future tasks, per-category, with a friendly line-art empty state (mascot at a laptop) and the note "It's a place you write things to do in the future."

### 6.9 Stats / Analysis — S1-05
- Same header. Sub-tab pills: **카테고리 / 루틴 / 타이머** (Category selected = black pill, white text; others = outlined).
- Grid of **category cards**, each: category name in its color + "/ count", and a **dot-matrix habit grid** (≈7 cols × 5 rows of circles) — filled dots in the category color for done days, `#D5D9DC` empty. Crew card labeled with a small black "Crew" tag.
- This is a GitHub-style contribution/heatmap visual, but with round dots.

### 6.10 Widgets — S1-03
- Home/lock-screen widgets: white rounded cards titled "TODAY 20"/"TODAY 3" listing squircle checkboxes + task names; a photo widget variant with a magenta check badge and caption "Charlotte — 주말 아침에 분위기 좋은 카페 가기". (Relevant only as PWA inspiration; PWA has no OS widgets — [ASSUMPTION] treat as a "compact today card" component.)

---

## 7. Component inventory (for the design system)

| Component | Spec |
|-----------|------|
| `SquircleCheckbox` | 22px rounded square, radius 6; empty=`surface`; done=category color + white ✓ |
| `CategoryPill` | pill, `surface` bg, category-colored bold label + gray `+` |
| `TaskRow` | full-width, checkbox + 15px label; long-press → context menu |
| `TaskChip` | solid category color, white bold 11px, radius 6, used in calendar cells |
| `AvatarChip` | circle avatar + name; selected=black pill/white text, unselected=`surface` |
| `DateBadge` | small filled circle w/ day number (violet/multicolor), beside date header |
| `WeekStrip` | 7 cols; completion cloud glyph (filled=colorful, empty=gray) + day number |
| `CalendarCell` | day number + ≤3 `TaskChip`s or one rounded photo thumb |
| `TabBar` | 5 icon-only items, 64px, black active / gray inactive |
| `BottomSheet` | top radius 20–24; white (stickers) or `violet-deep` (diary) |
| `PillButton` | dark `#1D1D1D` pill w/ icon+label (timer); primary=black, on white |
| `ContextMenu` | "오늘하기/날짜 바꾸기/보관함으로 이동/타이머 열기/복사/이동/삭제" |
| `DotMatrix` | 7×N grid of 10px dots; filled=category color, empty=`line` |
| `IconButton` | hamburger, back chevron, plus, gear — 24px stroke icons |
| `SegmentedToggle` | "월/주" and "카테고리/루틴/타이머" pills |
| `ActivityRow` | avatar + rich text (bold names) + right timestamp |
| `EmptyState` | line-art mascot illustration + one-line caption |
| `StickerGrid` | 4-col grid of reaction stickers + bottom category tabs |

---

## 8. Copy & term glossary (EN ⇄ KO, from S5 — use to stay recognizably on-brand)

`todo mate`=투두메이트 · List=카테고리 · Todo item=할 일 · Routine=루틴 · Diary=일기 ·
Timer=타이머 · Crew=크루 · Backlog=보관함 · Feed=피드 · News=소식 · Reactions=받은 관심 ·
Your Supporters=받은 응원 · Knock=노크 · Like=좋아요 · Follow=팔로우 · Memo=메모 ·
In Progress=진행 중 · Done=완료 · Reminders=리마인더 · Visibility=공개설정 ·
Public/Private=전체 공개/나만 보기 · Selected Followers=일부 공개 ·
"each task shapes who we become." (brand motto shown in feed).

---

## 9. Design assumptions & gaps (explicit)

**Unavailable (not public / behind auth):**
- Exact typeface names and licensed fonts.
- Exact full category-color picker palette (only 6 colors publicly visible).
- Live login screen pixel layout (string table confirms the 4 auth options; layout is inferred).
- Full profile page, chat UI, premium/paywall screens, notification row icons.
- Exact px dimensions (all measurements are proportional estimates from screenshots).

**Assumptions a visual engineer may rely on:**
- 4px spacing grid; 16–20px screen padding; pill radii 999px; card/sheet radii 20–24px.
- Monochrome-first UI with violet `#8437FF` as the primary brand accent and per-category colors.
- Bottom 5-icon tab bar on mobile; two-pane (calendar+feed) layout on ≥1024px; dark mode supported.
- Squircle checkbox + colored calendar chips + dot-matrix stats are the three strongest
  "recognizably TodoMate" visual signatures to preserve.

**Stop condition check:** this brief covers login, today/todo, calendar, friends/activity,
profile/settings, plus routine/timer/diary/stats/backlog, with colors, type, spacing, components,
mobile nav, and desktop adaptation — sufficient to implement an original TodoMate-inspired PWA
without further public research.
