import { Archive, BookOpen, Timer } from "lucide-react";
import type { Category, PlannerDay, Task } from "../api/planner";
import { CalendarScreen } from "./calendar";
import { TodayScreen } from "./today";

type PlannerHomeProps = {
	date: string;
	monthAnchor: string;
	planner: PlannerDay | undefined;
	loading: boolean;
	error: boolean;
	categories: Category[] | undefined;
	activeTimerTaskId: string | null;
	timerLabelFor: (taskId: string) => string | null;
	onSelectDate: (date: string) => void;
	onToggleTask: (task: Task) => void;
	onUpdateTask: (taskId: string, body: { title?: string; date?: string | null }) => void;
	onBacklogTask: (taskId: string) => void;
	onAddTask: (categoryId: string, title: string) => void;
	onStartTimer: (taskId: string) => void;
	onToggleRoutine: (routineId: string, completed: boolean) => void;
	onCreateCategory: (body: { name: string; color: string }) => void;
	onOpen: (view: "diary" | "timer" | "backlog") => void;
};

export function PlannerHome({
	date,
	monthAnchor,
	planner,
	loading,
	error,
	categories,
	activeTimerTaskId,
	timerLabelFor,
	onSelectDate,
	onToggleTask,
	onUpdateTask,
	onBacklogTask,
	onAddTask,
	onStartTimer,
	onToggleRoutine,
	onCreateCategory,
	onOpen,
}: PlannerHomeProps) {
	return (
		<div className="home__grid">
			<div className="home__month">
				<CalendarScreen
					month={monthAnchor}
					planner={planner}
					selectedDate={date}
					onSelect={onSelectDate}
					compact
				/>
			</div>
			<div>
				<TodayScreen
					planner={planner}
					loading={loading}
					error={error}
					categories={categories}
					timerFor={(taskId) => activeTimerTaskId === taskId}
					elapsedFor={(taskId) => (timerLabelFor(taskId) ? "타이머 중" : "")}
					onToggle={onToggleTask}
					onUpdate={onUpdateTask}
					onBacklog={onBacklogTask}
					onAdd={onAddTask}
					onTimerStart={onStartTimer}
					onRoutineToggle={onToggleRoutine}
					onCreateCategory={onCreateCategory}
				/>
				<div className="home__shortcuts">
					<button type="button" className="btn-ghost" onClick={() => onOpen("diary")}>
						<BookOpen size={14} aria-hidden="true" />
						일기
					</button>
					<button type="button" className="btn-ghost" onClick={() => onOpen("timer")}>
						<Timer size={14} aria-hidden="true" />
						타이머
					</button>
					<button type="button" className="btn-ghost" onClick={() => onOpen("backlog")}>
						<Archive size={14} aria-hidden="true" />
						보관함
					</button>
				</div>
			</div>
		</div>
	);
}
