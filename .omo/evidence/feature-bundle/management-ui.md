# Management UI browser evidence

Executed against `http://127.0.0.1:4173` with Playwright Chromium.

- [x] Local login reached the authenticated planner shell.
- [x] Drawer exposes exactly six approved rows in order and none is disabled.
- [x] Theme and news-notification controls persist through fresh GET /api/settings reads.
- [x] Category rename, color, and group visibility persist through a fresh planner GET.
- [x] Category reorder persists authoritatively.
- [x] Category delete is confirmation-gated; cancel is a no-op and confirm persists deletion.
- [x] Routine edit, pause, and resume persist through fresh GET /api/routines reads.
- [x] Routine delete is confirmation-gated; cancel is a no-op and confirm persists deletion.
- [x] Profile settings hydrates the persisted theme/notification record instead of hardcoded defaults.

## Executable selectors

- Drawer rows: `.drawer__item`
- Category screen: `[data-testid='category-management']`
- Category item/actions: `[data-category-id='<id>']`, buttons named `<name> 수정|위로 이동|아래로 이동|삭제`
- Routine screen: `[data-testid='routine-management']`
- Routine item/actions: `[data-routine-id='<id>']`, buttons named `<title> 수정|일시정지|다시 시작|삭제`
- Profile settings: `[data-testid='profile-settings']`, `#theme`

## Screenshots

- `management-category-mobile.png` (390x844)
- `management-routine-desktop.png` (1024x768)
