import { monthGrid } from "../api/dates";
import type { PlannerDay } from "../api/planner";

export type CalendarScreenProps = {
	month: string;
	planner: PlannerDay | undefined;
	selectedDate: string;
	onSelect: (date: string) => void;
	weekData?: Record<string, PlannerDay | undefined>;
	compact?: boolean;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function CalendarScreen({ month, planner, selectedDate, onSelect, weekData, compact = false }: CalendarScreenProps) {
	const cells = monthGrid(month);
	const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(
		new Date().getDate(),
	).padStart(2, "0")}`;

	const monthPrefix = `${month.split("-")[0]}-${month.split("-")[1]}`;

	const chipSource = (date: string) => {
		const data = weekData?.[date] ?? planner;
		if (!data) {
			return { chips: [], mood: null } as const;
		}
		const chips = data.categories
			.flatMap((category) =>
				category.tasks.map((task) => ({
					id: task.id,
					title: task.title,
					color: category.color,
				})),
			)
			.slice(0, 3);
		return { chips, mood: null } as const;
	};

	return (
		<section className="calendar">
			<header className="calendar__head">
				{WEEKDAYS.map((day, index) => (
					<span key={day} className={index === 0 ? "sunday" : index === 6 ? "saturday" : undefined}>
						{day}
					</span>
				))}
			</header>
			<div className="calendar__grid">
				{cells.map((date) => {
					const isOwnMonth = date.startsWith(monthPrefix as string);
					const weekdayIndex = new Date(Number(date.split("-")[0]), Number(date.split("-")[1]) - 1, Number(date.split("-")[2])).getDay();
					const { chips } = chipSource(date);
					const isToday = date === today;
					const isSelected = date === selectedDate;
					return (
						<button
							key={date}
							type="button"
							className={`calendar__day${isSelected ? " calendar__day--selected" : ""}`}
							onClick={() => onSelect(date)}
							aria-current={isSelected ? "date" : undefined}
							aria-label={date}
						>
							<span
								className={`calendar__num${isToday ? " calendar__num--today" : ""}${!isOwnMonth && !isToday ? " calendar__num--other" : ""
									}${isOwnMonth && weekdayIndex === 0 && !isToday
										? " calendar__num--sun"
										: ""
									}${isOwnMonth && weekdayIndex === 6 && !isToday
										? " calendar__num--sat"
										: ""
									}`}
							>
								{Number(date.split("-")[2])}
							</span>
							{!compact && chips.length > 0 ? (
								<span className="calendar__chips">
									{chips.map((chip) => (
										<span
											key={chip.id}
											className="task-chip"
											style={{ background: chip.color }}
											title={chip.title}
										>
											{chip.title}
										</span>
									))}
								</span>
							) : null}
						</button>
					);
				})}
			</div>
		</section>
	);
}
