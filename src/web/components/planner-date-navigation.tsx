import type { Ref } from "react";
import { koreanMonthTitle, koreanWeekTitle, weekRange } from "../api/dates";
import type { PlannerDay } from "../api/planner";
import { CalendarScreen } from "./calendar";
import { DateHead, Profile, WeekStrip } from "./chrome";

type PlannerDateNavigationProps = {
	view: string;
	date: string;
	monthAnchor: string;
	planner: PlannerDay | undefined;
	username: string;
	homeHeadingRef?: Ref<HTMLHeadingElement> | undefined;
	onPrev: () => void;
	onNext: () => void;
	onSelectDate: (date: string) => void;
};

export function PlannerDateNavigation({
	view,
	date,
	monthAnchor,
	planner,
	username,
	homeHeadingRef,
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
				headingRef={view === "home" ? homeHeadingRef : undefined}
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
