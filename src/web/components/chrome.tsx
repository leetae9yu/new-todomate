import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { weekdayOf } from "../api/dates";
import { BrandCloud, CloudMark } from "./ui";

export { Drawer } from "./settings-drawer";

/** Profile block — avatar + display name + brand motto. */
export function Profile({ name, motto }: { name: string; motto: string }) {
	return (
		<div className="profile">
			<span className="avatar avatar--lg" aria-hidden="true">
				{name.charAt(0)}
			</span>
			<div className="profile__text">
				<strong>{name}</strong>
				<p>{motto}</p>
			</div>
		</div>
	);
}

/** Date header — gradient badge, title, segmented view toggle, chevrons. */
export function DateHead({
	title,
	badge,
	view,
	onView,
	onPrev,
	onNext,
	dayNumber,
	variants = ["월", "주"],
}: {
	title: string;
	badge?: string | undefined;
	view: string;
	onView?: (view: string) => void;
	onPrev: () => void;
	onNext: () => void;
	dayNumber?: number | undefined;
	variants?: string[];
}) {
	return (
		<header className="date-head">
			<div className="date-head__title">
				<span className="date-badge" aria-hidden="true">
					{badge ?? (dayNumber !== undefined ? String(dayNumber) : "")}
				</span>
				<h2>{title}</h2>
			</div>
			{onView ? (
				<div className="date-head__controls">
					<nav className="segment" aria-label="뷰 전환">
						{variants.map((variant) => (
							<button
								key={variant}
								type="button"
								className={`segment__item${view === variant ? " segment__item--active" : ""}`}
								onClick={() => onView(variant)}
								aria-pressed={view === variant}
							>
								{variant}
							</button>
						))}
					</nav>
					<button type="button" className="icon-btn" onClick={onPrev} aria-label="이전">
						<ChevronLeft />
					</button>
					<button type="button" className="icon-btn" onClick={onNext} aria-label="다음">
						<ChevronRight />
					</button>
				</div>
			) : (
				<div className="date-head__controls">
					<button type="button" className="icon-btn" onClick={onPrev} aria-label="이전">
						<ChevronLeft />
					</button>
					<button type="button" className="icon-btn" onClick={onNext} aria-label="다음">
						<ChevronRight />
					</button>
				</div>
			)}
		</header>
	);
}

/** Week strip — 7 columns of completion clouds + day numbers. */
export function WeekStrip({
	week,
	selectedDate,
	dayColors,
	onSelect,
}: {
	week: string[];
	selectedDate: string;
	dayColors?: Record<string, string | null | undefined>;
	onSelect: (date: string) => void;
}) {
	const today = new Date();
	const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
		today.getDate(),
	).padStart(2, "0")}`;

	return (
		<ol className="week-strip" aria-label="이번 주">
			{week.map((date) => {
				const weekday = weekdayOf(date);
				const color = dayColors?.[date];
				const state = weekday === 0 ? "sun" : weekday === 6 ? "sat" : "";
				const isToday = date === todayKey;
				const isSelected = date === selectedDate;
				return (
					<li key={date}>
						<button
							type="button"
							className={`week-strip__day${color ? " week-strip__day--done" : ""}`}
							style={color ? ({ "--cat-color": color } as CSSProperties) : undefined}
							onClick={() => onSelect(date)}
							aria-current={isSelected ? "date" : undefined}
							aria-label={date}
						>
							<span className={`week-strip__weekday${state ? ` week-strip__weekday--${state}` : ""}`}>
								{["일", "월", "화", "수", "목", "금", "토"][weekday]}
							</span>
							<CloudMark done={Boolean(color)} />
							<span
								className={`week-strip__num${isToday ? " week-strip__num--today" : ""}${state && !isToday ? ` week-strip__num--${state}` : ""
									}`}
							>
								{Number(date.split("-")[2])}
							</span>
						</button>
					</li>
				);
			})}
		</ol>
	);
}

/** Mobile bottom tab bar / desktop left rail. */
export function TabBar({
	items,
	view,
	onChange,
}: {
	items: Array<{ key: string; label: string; icon: ReactNode }>;
	view: string;
	onChange: (key: string) => void;
}) {
	return (
		<nav className="tabbar" aria-label="주요 화면">
			{items.map((item) => (
				<button
					key={item.key}
					type="button"
					className={view === item.key ? "is-active" : ""}
					onClick={() => onChange(item.key)}
					aria-label={item.label}
					aria-current={view === item.key ? "page" : undefined}
				>
					{item.icon}
				</button>
			))}
		</nav>
	);
}

export function TopBar({
	userName,
	onOpenMenu,
}: {
	userName: string;
	onOpenMenu: () => void;
}) {
	return (
		<header className="topbar">
			<div className="topbar__logo">
				<BrandCloud className="brand-cloud" />
				<span>todo mate</span>
			</div>
			<div className="topbar__right">
				<span className="avatar avatar--sm" aria-hidden="true" title={userName}>
					{userName.charAt(0)}
				</span>
				<button type="button" className="icon-btn" onClick={onOpenMenu} aria-label="메뉴 열기">
					<Menu />
				</button>
			</div>
		</header>
	);
}
