import { Pause, Play, Square, Timer as TimerIcon } from "lucide-react";
import { formatElapsed } from "../api/dates";
import type { PlannerDay } from "../api/planner";

export type TimerScreenProps = {
	planner: PlannerDay | undefined;
	activeTaskId: string | null;
	elapsedSeconds: number;
	onStart: (taskId: string) => void;
	onStop: (taskId: string) => void;
	pending: boolean;
};

export function TimerScreen({ planner, activeTaskId, elapsedSeconds, onStart, onStop, pending }: TimerScreenProps) {
	const tasks = planner?.categories.flatMap((category) =>
		category.tasks.filter((task) => !task.completed).map((task) => ({
			...task,
			categoryColor: category.color,
			categoryName: category.name,
		})),
	) ?? [];

	const activeTask = activeTaskId ? tasks.find((task) => task.id === activeTaskId) : null;

	return (
		<div className="timer">
			<header className="timer__head">
				<h2>타이머</h2>
				<span className="icon-btn" aria-hidden="true" style={{ color: "var(--timer-live)" }}>
					<TimerIcon />
				</span>
			</header>
			<div className="timer__body">
				{activeTask ? (
					<>
						<p className="timer__task">{activeTask.title}</p>
						<hr className="timer__rule" />
						<p className="timer__clock">{formatElapsed(elapsedSeconds)}</p>
						<hr className="timer__rule" />
					</>
				) : (
					<>
						<p className="timer__task timer__task--idle">집중할 할 일을 선택해 보세요.</p>
						<hr className="timer__rule" />
						<p className="timer__clock">{formatElapsed(elapsedSeconds)}</p>
						<hr className="timer__rule" />
					</>
				)}
			</div>
			<div className="timer__actions">
				{activeTask ? (
					<>
						<button
							type="button"
							className="pill-btn pill-btn--live"
							onClick={() => onStop(activeTask.id)}
							disabled={pending}
						>
							<Pause aria-hidden="true" />
							진행 중
						</button>
						<button
							type="button"
							className="pill-btn pill-btn--done"
							onClick={() => onStop(activeTask.id)}
							disabled={pending}
						>
							<Square aria-hidden="true" />
							완료하기
						</button>
					</>
				) : (
					<p className="timer__task timer__task--idle">선택하면 타이머가 시작돼요.</p>
				)}
			</div>
			{!activeTask ? (
				<div className="timer__pick">
					{tasks.map((task) => (
						<button key={task.id} type="button" onClick={() => onStart(task.id)}>
							<Play aria-hidden="true" style={{ color: task.categoryColor }} />
							{task.title}
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}
