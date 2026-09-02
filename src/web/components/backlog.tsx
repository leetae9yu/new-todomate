import { useState } from "react";
import type { Category, Task } from "../api/planner";
import { EmptyState, Squircle } from "./ui";

export type BacklogScreenProps = {
	tasks: Task[] | undefined;
	loading: boolean;
	error: boolean;
	categories: Category[] | undefined;
	onSchedule: (taskId: string, date: string) => void;
	onAdd: (categoryId: string, title: string) => void;
};

export function BacklogScreen({ tasks, loading, error, categories, onSchedule, onAdd }: BacklogScreenProps) {
	const [draft, setDraft] = useState("");
	const [scheduleTaskId, setScheduleTaskId] = useState<string | null>(null);
	const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10));

	if (loading) {
		return (
			<div className="backlog" aria-busy="true">
				<span className="skeleton" style={{ width: 200 }} />
				<span className="skeleton" />
			</div>
		);
	}

	if (error || !tasks) {
		return <div className="error-box">보관함을 불러오지 못했어요.</div>;
	}

	const submit = () => {
		const title = draft.trim();
		if (!title || !categories || categories.length === 0) {
			return;
		}
		onAdd(categories[0]?.id ?? "", title);
		setDraft("");
	};

	if (tasks.length === 0) {
		return (
			<>
				<EmptyState
					message="앞으로 해야 할 일이 없어요. 아래에서 새 할 일을 추가하거나 남은 할 일을 여기에 담아 보세요."
				/>
				<div className="task-inline">
					<input
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								submit();
							}
						}}
						placeholder="보관함에 추가…"
						aria-label="새 보관함 할 일"
					/>
					<button type="button" className="btn-primary" onClick={submit}>
						추가
					</button>
				</div>
			</>
		);
	}

	return (
		<div className="backlog">
			<p className="backlog__hint">날짜를 정하면 오늘 피드로 이동해요.</p>
			<ul className="tasklist">
				{tasks.map((task) => {
					const category = categories?.find((entry) => entry.id === task.categoryId);
					return (
						<li key={task.id} className="task">
							<Squircle done={false} color={category?.color ?? ""} staticBox />
							<span className="task__label">{task.title}</span>
							<div className="task__menu">
								<button
									type="button"
									onClick={() => setScheduleTaskId((current) => (current === task.id ? null : task.id))}
									aria-label="날짜 정하기"
								>
									달력으로
								</button>
							</div>
							{scheduleTaskId === task.id ? (
								<div className="pop-menu" role="dialog" aria-label="날짜 정하기">
									<input
										type="date"
										value={scheduleDate}
										onChange={(event) => setScheduleDate(event.target.value)}
									/>
									<button
										type="button"
										onClick={() => {
											onSchedule(task.id, scheduleDate);
											setScheduleTaskId(null);
										}}
									>
										이 날짜로 이동
									</button>
								</div>
							) : null}
						</li>
					);
				})}
			</ul>
			<div className="task-inline">
				<input
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							submit();
						}
					}}
					placeholder="보관함에 추가…"
					aria-label="새 보관함 할 일"
				/>
				<button type="button" className="btn-primary" onClick={submit}>
					추가
				</button>
			</div>
		</div>
	);
}
