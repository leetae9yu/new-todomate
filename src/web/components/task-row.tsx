import { Archive, Calendar, Edit3, Flag, MoreHorizontal, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { todayKey } from "../api/dates";
import type { Task } from "../api/planner";
import { Squircle } from "./ui";

type TaskMenu =
	| { kind: "closed" }
	| { kind: "menu"; task: Task }
	| { kind: "edit"; task: Task }
	| { kind: "move"; task: Task };

type TaskRowProps = {
	task: Task;
	color: string;
	onToggle: (task: Task) => void;
	onUpdate: (taskId: string, body: { title?: string; date?: string | null }) => void;
	onMoveToBacklog: (taskId: string) => void;
	onStartTimer: (taskId: string) => void;
	timerActiveFor: (taskId: string) => boolean;
	timerLabel: (taskId: string) => string | null;
	onMenuClose: () => void;
};

export function TaskRow({
	task,
	color,
	onToggle,
	onUpdate,
	onMoveToBacklog,
	onStartTimer,
	timerActiveFor,
	timerLabel,
	onMenuClose,
}: TaskRowProps) {
	const [menu, setMenu] = useState<TaskMenu>({ kind: "closed" });
	const [draft, setDraft] = useState(task.title);
	const [moveDate, setMoveDate] = useState(task.date ?? todayKey());
	const containerRef = useRef<HTMLLIElement | null>(null);

	useEffect(() => setDraft(task.title), [task.title]);
	useEffect(() => {
		if (menu.kind === "closed") {
			return;
		}
		const handleClick = (event: MouseEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) {
				setMenu({ kind: "closed" });
				onMenuClose();
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [menu.kind, onMenuClose]);

	const finishEdit = () => {
		const title = draft.trim();
		if (!title) {
			setDraft(task.title);
		} else if (title !== task.title) {
			onUpdate(task.id, { title });
		}
		setMenu({ kind: "closed" });
	};

	return (
		<li className={`task${task.completed ? " task--done" : ""}`} ref={containerRef}>
			<button
				type="button"
				onClick={() => onToggle(task)}
				aria-pressed={task.completed}
				aria-label={`${task.title} 완료 전환`}
			>
				<Squircle done={task.completed} color={color} />
			</button>
			{menu.kind === "edit" ? (
				<input
					className="task-inline"
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") finishEdit();
						if (event.key === "Escape") {
							setDraft(task.title);
							setMenu({ kind: "closed" });
						}
					}}
					onBlur={finishEdit}
					aria-label="할 일 수정"
				/>
			) : (
				<span className="task__label">{task.title}</span>
			)}
			{timerLabel(task.id) ? (
				<span className="task__timer-live">
					<Flag aria-hidden="true" />
					{timerLabel(task.id)}
				</span>
			) : null}
			<div className={`task__menu${menu.kind !== "closed" ? " task__menu--open" : ""}`}>
				<button
					type="button"
					onClick={() =>
						setMenu((current) =>
							current.kind === "menu" ? { kind: "closed" } : { kind: "menu", task },
						)
					}
					aria-label="할 일 옵션"
				>
					<MoreHorizontal />
				</button>
			</div>
			{menu.kind === "menu" ? (
				<nav className="pop-menu" aria-label="할 일 메뉴">
					<button type="button" onClick={() => setMenu({ kind: "edit", task })}>
						<Edit3 aria-hidden="true" />
						수정하기
					</button>
					<button
						type="button"
						onClick={() => {
							setMenu({ kind: "move", task });
							setMoveDate(task.date ?? todayKey());
						}}
					>
						<Calendar aria-hidden="true" />
						날짜 바꾸기
					</button>
					<button
						type="button"
						onClick={() => {
							onUpdate(task.id, { date: null });
							setMenu({ kind: "closed" });
							onMoveToBacklog(task.id);
						}}
						className="pop-menu--danger"
					>
						<Archive aria-hidden="true" />
						보관함으로 이동
					</button>
					<button
						type="button"
						onClick={() => {
							onStartTimer(task.id);
							setMenu({ kind: "closed" });
						}}
						disabled={timerActiveFor(task.id)}
					>
						<Flag aria-hidden="true" />
						타이머 열기
					</button>
					<button
						type="button"
						className="pop-menu--danger"
						disabled
						title="삭제는 서버 계약에서 제공하지 않아요"
					>
						<Trash2 aria-hidden="true" />
						삭제하기
					</button>
				</nav>
			) : null}
			{menu.kind === "move" ? (
				<nav className="pop-menu" aria-label="날짜 바꾸기">
					<input
						type="date"
						value={moveDate}
						onChange={(event) => setMoveDate(event.target.value)}
						aria-label="이동할 날짜"
					/>
					<button
						type="button"
						onClick={() => {
							onUpdate(task.id, { date: moveDate });
							setMenu({ kind: "closed" });
						}}
					>
						<Calendar aria-hidden="true" />
						이 날짜로 이동
					</button>
					<button type="button" onClick={() => setMenu({ kind: "closed" })}>
						닫기
					</button>
				</nav>
			) : null}
		</li>
	);
}
