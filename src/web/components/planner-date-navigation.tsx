import { koreanMonthTitle, koreanWeekTitle, weekRange } from "../api/dates";
import type { PlannerDay } from "../api/planner";
import { CalendarScreen } from "./calendar";
import { DateHead, Profile, WeekStrip } from "./chrome";

type PlannerDateNavigationProps = {
	view: string;
	date: string;
	monthAnchor: string;
	calendarView: "주" | "월";
	planner: PlannerDay | undefined;
	username: string;
	onCalendarView: (view: "주" | "월") => void;
	onPrev: () => void;
	onNext: () => void;
	onSelectDate: (date: string) => void;
};

export function PlannerDateNavigation({
	view,
	date,
	monthAnchor,
	calendarView,
	planner,
	username,
	onCalendarView,
	onPrev,
	onNext,
	onSelectDate,
}: PlannerDateNavigationProps) {
	if (view !== "home" && view !== "calendar") {
		return null;
	}

	return (
		<>
			<Profile name={username} motto="each task shapes who we become." />
			<DateHead
				title={view === "calendar" ? koreanMonthTitle(monthAnchor) : koreanWeekTitle(date)}
				badge={view === "calendar" ? undefined : String(new Date(date).getDate())}
				view={calendarView}
				onView={(next) => onCalendarView(next as "주" | "월")}
				onPrev={onPrev}
				onNext={onNext}
			/>
			{view === "home" ? (
				<WeekStrip week={weekRange(date)} selectedDate={date} onSelect={onSelectDate} />
			) : (
				<CalendarScreen
					month={monthAnchor}
					planner={planner}
					selectedDate={date}
					onSelect={onSelectDate}
				/>
			)}
		</>
	);
}
