/** Local-date helpers — the planner treats YYYY-MM-DD strings as exact. */

export const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function todayKey(): string {
	return formatKey(new Date());
}

export function formatKey(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function parseKey(key: string): Date {
	const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
	return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
	const date = parseKey(key);
	date.setDate(date.getDate() + days);
	return formatKey(date);
}

export function addMonths(key: string, months: number): string {
	const date = parseKey(key);
	const day = date.getDate();
	date.setDate(1);
	date.setMonth(date.getMonth() + months);
	const max = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
	date.setDate(Math.min(day, max));
	return formatKey(date);
}

export function weekStart(key: string): string {
	const date = parseKey(key);
	date.setDate(date.getDate() - date.getDay());
	return formatKey(date);
}

export function weekRange(key: string): string[] {
	const start = weekStart(key);
	return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthGrid(key: string): string[] {
	const date = parseKey(key);
	const first = new Date(date.getFullYear(), date.getMonth(), 1);
	const start = formatKey(new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay()));
	const cells: string[] = [];
	for (let i = 0; i < 42; i += 1) {
		cells.push(addDays(start, i));
	}
	return cells;
}

export function isSameDay(a: string, b: string): boolean {
	return a === b;
}

export function koreanMonthTitle(key: string): string {
	const date = parseKey(key);
	return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export function koreanWeekTitle(key: string): string {
	const date = parseKey(key);
	return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${weekOrdinal(key)}주차`;
}

export function koreanFullDate(key: string): string {
	const date = parseKey(key);
	const weekday = WEEKDAY_KO[date.getDay()] ?? "";
	return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
		date.getDate(),
	).padStart(2, "0")} ${weekday}요일`;
}

export function weekOrdinal(key: string): number {
	const date = parseKey(key);
	return Math.max(1, Math.ceil(date.getDate() / 7));
}

export function frequencyLabel(frequency: {
	type: "daily" | "weekdays" | "monthly";
	days?: number[];
}): string {
	switch (frequency.type) {
		case "daily":
			return "매일";
		case "weekdays": {
			const days = (frequency.days ?? [])
				.map((day) => WEEKDAY_KO[day] ?? "")
				.sort((a, b) => a.localeCompare(b, "ko"));
			return days.length > 0 ? `매주 ${days.join("·")}` : "매주";
		}
		case "monthly": {
			const days = (frequency.days ?? []).map((day) => `${day}일`).sort();
			return days.length > 0 ? `매월 ${days.join("·")}` : "매월";
		}
		default:
			return "";
	}
}

export function weekdayOf(key: string): number {
	return parseKey(key).getDay();
}

export function formatElapsed(totalSeconds: number): string {
	const safe = Math.max(0, Math.floor(totalSeconds));
	const hours = String(Math.floor(safe / 3600)).padStart(2, "0");
	const minutes = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
	const seconds = String(safe % 60).padStart(2, "0");
	return `${hours}:${minutes}:${seconds}`;
}
