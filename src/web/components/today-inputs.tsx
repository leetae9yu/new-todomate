import { useState } from "react";
import type { Category } from "../api/planner";
import { Squircle } from "./ui";

export function InlineAdd({
	category,
	onSubmit,
}: {
	category: Category;
	onSubmit: (title: string) => void;
}) {
	const [draft, setDraft] = useState("");
	const submit = () => {
		const title = draft.trim();
		if (!title) return;
		onSubmit(title);
		setDraft("");
	};

	return (
		<div className="task-inline">
			<Squircle done={false} color={category.color} staticBox />
			<input
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") submit();
				}}
				onBlur={submit}
				placeholder={`${category.name}에 추가…`}
				aria-label={`${category.name} 새 할 일`}
			/>
		</div>
	);
}

const CATEGORY_COLORS = ["#8437FF", "#2C34FF", "#FF5CB5", "#FFA6DD", "#191919", "#D5D9DC"];

export function AddCategory({
	onCreate,
}: {
	onCreate: (body: { name: string; color: string }) => void;
}) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [color, setColor] = useState(CATEGORY_COLORS[0] ?? "#8437FF");

	if (!open) {
		return (
			<button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
				+ 새 카테고리
			</button>
		);
	}

	const submit = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		onCreate({ name: trimmed, color });
		setName("");
		setOpen(false);
	};

	return (
		<div className="routine-form">
			<div className="field">
				<label htmlFor="new-category-name">카테고리 이름</label>
				<input
					id="new-category-name"
					value={name}
					onChange={(event) => setName(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") submit();
					}}
					placeholder="예: 운동"
				/>
			</div>
			<div className="routine-days" role="radiogroup" aria-label="카테고리 색상">
				{CATEGORY_COLORS.map((option) => (
					<button
						key={option}
						type="button"
						className={color === option ? "is-on" : ""}
						style={{ background: option }}
						onClick={() => setColor(option)}
						aria-label={option}
						aria-pressed={color === option}
					/>
				))}
			</div>
			<div>
				<button type="button" className="btn-primary" onClick={submit}>
					만들기
				</button>{" "}
				<button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
					취소
				</button>
			</div>
		</div>
	);
}
