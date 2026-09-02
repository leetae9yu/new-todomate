import { useState, type CSSProperties } from "react";
import { frequencyLabel } from "../api/dates";
import type { Category, Frequency, Routine } from "../api/planner";

export type RoutineScreenProps = {
	categories: Category[] | undefined;
	routines: Routine[] | undefined;
	loading: boolean;
	error: boolean;
	onCreate: (body: { categoryId: string; title: string; startDate: string; frequency: Frequency }) => void;
};

type DraftState =
	| { kind: "closed" }
	| { kind: "form"; categoryId: string };

const FREQUENCY_TYPES: Array<{ value: Frequency["type"]; label: string }> = [
	{ value: "daily", label: "매일" },
	{ value: "weekdays", label: "특정 요일" },
	{ value: "monthly", label: "특정 날짜" },
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function RoutinesScreen({ categories, routines, loading, error, onCreate }: RoutineScreenProps) {
	const [draft, setDraft] = useState<DraftState>({ kind: "closed" });
	const [title, setTitle] = useState("");
	const [frequencyType, setFrequencyType] = useState<Frequency["type"]>("daily");
	const [weekDays, setWeekDays] = useState<number[]>([]);
	const [monthDays, setMonthDays] = useState<number[]>([]);
	const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

	const openForm = (categoryId: string) => {
		setDraft({ kind: "form", categoryId });
		setTitle("");
		setFrequencyType("daily");
		setWeekDays([]);
		setMonthDays([]);
		setStartDate(new Date().toISOString().slice(0, 10));
	};

	const submit = () => {
		if (draft.kind !== "form") {
			return;
		}
		const trimmed = title.trim();
		if (!trimmed) {
			return;
		}
		const frequency: Frequency =
			frequencyType === "weekdays"
				? { type: "weekdays", days: weekDays.length > 0 ? weekDays : [1] }
				: frequencyType === "monthly"
					? { type: "monthly", days: monthDays.length > 0 ? monthDays : [1] }
					: { type: "daily" };
		onCreate({
			categoryId: draft.categoryId,
			title: trimmed,
			startDate,
			frequency,
		});
		setDraft({ kind: "closed" });
	};

	if (loading) {
		return (
			<div className="routines" aria-busy="true">
				<span className="skeleton" style={{ width: 180 }} />
				<span className="skeleton" />
			</div>
		);
	}

	if (error || !categories || categories.length === 0) {
		return (
			<div className="error-box">
				{error ? "루틴을 불러오지 못했어요." : "카테고리를 먼저 만들어 주세요."}
			</div>
		);
	}

	return (
		<div className="routines">
			{categories.map((category) => {
				const items = (routines ?? []).filter((routine) => routine.categoryId === category.id);
				return (
					<section key={category.id} className="feed-group">
						<header className="category-pill" style={{ "--cat-color": category.color } as CSSProperties}>
							<span className="category-pill__dot" aria-hidden="true" />
							<strong className="category-pill__label">{category.name}</strong>
							<button
								type="button"
								className="category-pill__add"
								onClick={() => openForm(category.id)}
								aria-label={`${category.name} 루틴 추가`}
							>
								+
							</button>
						</header>
						{items.length === 0 ? (
							<p className="routine-item__meta">{category.name} 루틴이 없어요. 위 + 버튼으로 추가해 보세요.</p>
						) : (
							items.map((routine) => (
								<div key={routine.id} className="routine-item">
									<div className="routine-item__title">
										<span className="routine-item__tag">진행 중</span>
										<span>{routine.title}</span>
									</div>
									<span className="routine-item__meta">
										{routine.startDate} ~ {routine.endDate ?? "종료 없음"} /{" "}
										{frequencyLabel(routine.frequency)}
									</span>
								</div>
							))
						)}
						{draft.kind === "form" && draft.categoryId === category.id ? (
							<div className="routine-form">
								<div className="field">
									<label htmlFor="routine-title">루틴 이름</label>
									<input
										id="routine-title"
										value={title}
										onChange={(event) => setTitle(event.target.value)}
										placeholder="예: 아침 루틴"
									/>
								</div>
								<div className="field">
									<label htmlFor="routine-start">시작일</label>
									<input
										id="routine-start"
										type="date"
										value={startDate}
										onChange={(event) => setStartDate(event.target.value)}
									/>
								</div>
								<div className="field">
									<label htmlFor="routine-freq">반복</label>
									<select
										id="routine-freq"
										value={frequencyType}
										onChange={(event) => setFrequencyType(event.target.value as Frequency["type"])}
									>
										{FREQUENCY_TYPES.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</div>
								{frequencyType === "weekdays" ? (
									<div className="routine-days">
										{WEEKDAYS.map((day, index) => (
											<button
												key={day}
												type="button"
												className={weekDays.includes(index) ? "is-on" : ""}
												onClick={() =>
													setWeekDays((current) =>
														current.includes(index)
															? current.filter((d) => d !== index)
															: [...current, index],
													)
												}
											>
												{day}
											</button>
										))}
									</div>
								) : null}
								{frequencyType === "monthly" ? (
									<div className="routine-days">
										{Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
											<button
												key={day}
												type="button"
												className={monthDays.includes(day) ? "is-on" : ""}
												onClick={() =>
													setMonthDays((current) =>
														current.includes(day)
															? current.filter((d) => d !== day)
															: [...current, day],
													)
												}
											>
												{day}일
											</button>
										))}
									</div>
								) : null}
								<div>
									<button type="button" className="btn-primary" onClick={submit}>
										루틴 만들기
									</button>
									{" "}
									<button type="button" className="btn-ghost" onClick={() => setDraft({ kind: "closed" })}>
										취소
									</button>
								</div>
							</div>
						) : null}
					</section>
				);
			})}
		</div>
	);
}
