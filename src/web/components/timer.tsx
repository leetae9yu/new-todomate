import { Pause, Play, Square } from "lucide-react";
import { formatElapsed } from "../api/dates";
import type { PlannerDay } from "../api/planner";
import { SubpageHeader } from "./chrome";

export type TimerScreenProps = {
	planner: PlannerDay | undefined;
	activeTaskId: string | null;
	activeTaskTitle: string | null;
	elapsedSeconds: number;
	hydrating: boolean;
	loadError: boolean;
	actionError: boolean;
	onRetry: () => void;
	onBack: () => void;
	onStart: (taskId: string) => void;
	onStop: (taskId: string) => void;
	pending: boolean;
};

export function TimerScreen({
	planner,
	activeTaskId,
	activeTaskTitle,
	elapsedSeconds,
	hydrating,
	loadError,
	actionError,
	onRetry,
	onBack,
	onStart,
	onStop,
	pending,
}: TimerScreenProps) {
	const tasks =
		planner?.categories.flatMap((category) =>
			category.tasks
				.filter((task) => !task.completed)
				.map((task) => ({
					...task,
					categoryColor: category.color,
					categoryName: category.name,
				})),
		) ?? [];

	const selectedDayTask = activeTaskId ? tasks.find((task) => task.id === activeTaskId) : null;
	const runningTitle = activeTaskTitle ?? selectedDayTask?.title ?? "집중 중인 할 일";
	const running = activeTaskId !== null;

	return (
		<div className="timer">
			<SubpageHeader title="타이머" onBack={onBack} />
			<p className="timer__announcement" aria-live="polite">
				{hydrating
					? "타이머 상태를 확인하고 있어요."
					: running
						? `${runningTitle} 타이머가 진행 중이에요.`
						: "타이머가 대기 중이에요."}
			</p>

			{hydrating ? (
				<div className="timer__loading" aria-busy="true" role="status">
					<span className="spinner" aria-hidden="true" />
					<p>진행 중인 타이머를 확인하고 있어요.</p>
				</div>
			) : loadError ? (
				<div className="timer__loading">
					<p className="error-box" role="alert">
						타이머를 불러오지 못했어요.
					</p>
					<button type="button" className="btn-ghost" onClick={onRetry}>
						다시 시도
					</button>
				</div>
			) : (
				<>
					<div className="timer__body">
						<p className={`timer__task${running ? "" : " timer__task--idle"}`}>
							{running ? runningTitle : "집중할 할 일을 선택해 보세요."}
						</p>
						<hr className="timer__rule" />
						<p className="timer__clock" role="timer" aria-label="경과 시간">
							{formatElapsed(elapsedSeconds)}
						</p>
						<hr className="timer__rule" />
					</div>

					<div className="timer__actions">
						{running ? (
							<>
								<span className="pill-btn pill-btn--live" role="status">
									<Pause aria-hidden="true" />
									진행 중
								</span>
								<button
									type="button"
									className="pill-btn pill-btn--done"
									onClick={() => onStop(activeTaskId)}
									disabled={pending}
								>
									<Square aria-hidden="true" />
									{pending ? "완료 중…" : "완료하기"}
								</button>
							</>
						) : (
							<p className="timer__task timer__task--idle">선택하면 타이머가 시작돼요.</p>
						)}
					</div>

					{!running ? (
						<fieldset className="timer__pick">
							<legend>타이머를 시작할 할 일</legend>
							{tasks.length > 0 ? (
								tasks.map((task) => (
									<button
										key={task.id}
										type="button"
										onClick={() => onStart(task.id)}
										disabled={pending}
									>
										<Play aria-hidden="true" style={{ color: task.categoryColor }} />
										<span>
											<strong>{task.title}</strong>
											<small>{task.categoryName}</small>
										</span>
									</button>
								))
							) : (
								<p className="timer__empty">선택할 미완료 할 일이 없어요.</p>
							)}
						</fieldset>
					) : null}
				</>
			)}

			{actionError ? (
				<p className="error-box timer__error" role="alert">
					타이머 요청을 처리하지 못했어요. 현재 상태는 그대로 유지돼요.
				</p>
			) : null}
		</div>
	);
}
