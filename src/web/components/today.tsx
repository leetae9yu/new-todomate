import { CloudOff } from "lucide-react";
import type { CSSProperties } from "react";
import type { Category, PlannerDay, Task } from "../api/planner";
import { TaskRow } from "./task-row";
import { AddCategory, InlineAdd } from "./today-inputs";
import { EmptyState, Squircle } from "./ui";

export type TodayScreenProps = {
	planner: PlannerDay | undefined;
	loading: boolean;
	error: boolean;
	categories: Category[] | undefined;
	onCreateCategory: (body: { name: string; color: string }) => void;
	timerFor: (taskId: string) => boolean;
	elapsedFor: (taskId: string) => string;
	onToggle: (task: Task) => void;
	onUpdate: (taskId: string, body: { title?: string; date?: string | null }) => void;
	onBacklog: (taskId: string) => void;
	onAdd: (categoryId: string, title: string) => void;
	onTimerStart: (taskId: string) => void;
	onRoutineToggle: (routineId: string, completed: boolean) => void;
};

export function TodayScreen({
	planner,
	loading,
	error,
	categories,
	timerFor,
	elapsedFor,
	onToggle,
	onUpdate,
	onBacklog,
	onAdd,
	onTimerStart,
	onRoutineToggle,
	onCreateCategory,
}: TodayScreenProps) {
	if (loading) {
		return (
			<div className="feed-groups" aria-busy="true">
				{[1, 2].map((group) => (
					<section key={group} className="feed-group">
						<span className="skeleton" style={{ width: 160 }} />
						<span className="skeleton" />
						<span className="skeleton" style={{ width: "72%" }} />
					</section>
				))}
			</div>
		);
	}
	if (error || !planner) {
		return <div className="error-box">오늘 할 일을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>;
	}

	const groupCategory =
		categories && categories.length > 0
			? categories
			: planner.categories.map(({ routines: _r, ...category }) => category as Category);
	const overdue = planner.overdue ?? [];

	if (planner.categories.length === 0 && overdue.length === 0) {
		return (
			<div className="feed-groups">
				<EmptyState icon={<CloudOff />} message="카테고리를 만들고 오늘 할 일을 추가해 보세요." />
				<AddCategory onCreate={onCreateCategory} />
			</div>
		);
	}

	const renderTask = (task: Task, color: string) => (
		<TaskRow
			key={task.id}
			task={task}
			color={color}
			onToggle={onToggle}
			onUpdate={onUpdate}
			onMoveToBacklog={onBacklog}
			onStartTimer={onTimerStart}
			timerActiveFor={timerFor}
			timerLabel={(id) => (timerFor(id) ? elapsedFor(id) : null)}
			onMenuClose={() => { }}
		/>
	);

	return (
		<>
			{overdue.length > 0 ? (
				<section className="overdue" aria-label="지난 할 일">
					<h3>
						<CloudOff aria-hidden="true" />
						지난 할 일 {overdue.length}개
					</h3>
					<ul className="tasklist">
						{overdue.map((task) => {
							const category = groupCategory.find((entry) => entry.id === task.categoryId);
							return renderTask(task, category?.color ?? "");
						})}
					</ul>
				</section>
			) : null}

			<div className="feed-groups">
				{planner.categories.map((group) => {
					const seen = new Set((group.routines ?? []).map((routine) => routine.id));
					const extraRoutines = (planner.routines ?? []).filter(
						(routine) => routine.categoryId === group.id && !seen.has(routine.id),
					);
					const routines = [...(group.routines ?? []), ...extraRoutines];
					const category = groupCategory.find((entry) => entry.id === group.id) ?? {
						id: group.id,
						name: group.name,
						color: group.color,
						visibility: group.visibility,
					};
					return (
						<section key={group.id} className="feed-group">
							<header
								className="category-pill"
								style={{ "--cat-color": category.color } as CSSProperties}
							>
								<span className="category-pill__dot" aria-hidden="true" />
								<strong className="category-pill__label">{group.name}</strong>
								<button
									type="button"
									className="category-pill__add"
									onClick={() =>
										document.querySelector<HTMLInputElement>(`#add-${group.id} input`)?.focus()
									}
									aria-label={`${group.name} 추가`}
								>
									+
								</button>
							</header>
							<ul className="tasklist">
								{group.tasks.map((task) => renderTask(task, category.color))}
								{routines.map((routine) => (
									<li key={routine.id} className={`task${routine.completed ? " task--done" : ""}`}>
										<button
											type="button"
											onClick={() => onRoutineToggle(routine.id, !routine.completed)}
											aria-pressed={routine.completed}
											aria-label={`${routine.title} 루틴 완료 전환`}
										>
											<Squircle done={routine.completed} color={category.color} />
										</button>
										<span className="task__label">{routine.title}</span>
									</li>
								))}
								<li id={`add-${group.id}`}>
									<InlineAdd category={category} onSubmit={(title) => onAdd(group.id, title)} />
								</li>
							</ul>
						</section>
					);
				})}
				<AddCategory onCreate={onCreateCategory} />
			</div>
		</>
	);
}
