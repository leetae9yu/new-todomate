import { Check, Pause, Pencil, Play, Repeat, Trash2, X } from "lucide-react";
import { type CSSProperties, type SyntheticEvent, useMemo, useState } from "react";
import { frequencyLabel } from "../api/dates";
import type { Category, Frequency, Routine, RoutineInput } from "../api/planner";
import { SubpageHeader } from "./chrome";

const FREQUENCY_OPTIONS: Array<{ value: Frequency["type"]; label: string }> = [
	{ value: "daily", label: "매일" },
	{ value: "weekdays", label: "특정 요일" },
	{ value: "monthly", label: "특정 날짜" },
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type RoutineDraft = {
	id: string;
	categoryId: string;
	title: string;
	startDate: string;
	endDate: string;
	frequencyType: Frequency["type"];
	days: number[];
};

type RoutineManagementProps = {
	categories: Category[] | undefined;
	routines: Routine[] | undefined;
	loading: boolean;
	error: boolean;
	onBack: () => void;
	onUpdate: (id: string, body: RoutineInput) => Promise<unknown>;
	onStatus: (id: string, status: Routine["status"]) => Promise<unknown>;
	onDelete: (id: string) => Promise<unknown>;
};

function categoryStyle(color: string | undefined) {
	return color ? ({ "--cat-color": color } as CSSProperties) : undefined;
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : "요청을 처리하지 못했어요.";
}

function draftFor(routine: Routine): RoutineDraft {
	return {
		id: routine.id,
		categoryId: routine.categoryId,
		title: routine.title,
		startDate: routine.startDate,
		endDate: routine.endDate ?? "",
		frequencyType: routine.frequency.type,
		days: routine.frequency.type === "daily" ? [] : [...routine.frequency.days],
	};
}

export function RoutineManagementScreen({
	categories,
	routines,
	loading,
	error,
	onBack,
	onUpdate,
	onStatus,
	onDelete,
}: RoutineManagementProps) {
	const [draft, setDraft] = useState<RoutineDraft | null>(null);
	const [pendingAction, setPendingAction] = useState<string | null>(null);
	const [notice, setNotice] = useState("");
	const [actionError, setActionError] = useState("");

	const categoryMap = useMemo(
		() => new Map((categories ?? []).map((category) => [category.id, category])),
		[categories],
	);
	const orderedRoutines = routines ?? [];

	const beginEdit = (routine: Routine) => {
		setNotice("");
		setActionError("");
		setDraft(draftFor(routine));
	};

	const toggleDay = (day: number) => {
		if (!draft) return;
		setDraft({
			...draft,
			days: draft.days.includes(day)
				? draft.days.filter((current) => current !== day)
				: [...draft.days, day].sort((left, right) => left - right),
		});
	};

	const saveRoutine = async (event: SyntheticEvent<HTMLFormElement>, routine: Routine) => {
		event.preventDefault();
		if (!draft || draft.id !== routine.id) return;
		const title = draft.title.trim();
		if (!title) {
			setActionError("루틴 이름을 입력해 주세요.");
			return;
		}
		if (draft.endDate && draft.endDate < draft.startDate) {
			setActionError("종료일은 시작일보다 빠를 수 없어요.");
			return;
		}
		if (draft.frequencyType !== "daily" && draft.days.length === 0) {
			setActionError(
				draft.frequencyType === "weekdays"
					? "반복할 요일을 하나 이상 선택해 주세요."
					: "반복할 날짜를 하나 이상 선택해 주세요.",
			);
			return;
		}

		const frequency: Frequency =
			draft.frequencyType === "weekdays"
				? { type: "weekdays", days: draft.days }
				: draft.frequencyType === "monthly"
					? { type: "monthly", days: draft.days }
					: { type: "daily" };
		const body: RoutineInput = {
			categoryId: draft.categoryId,
			title,
			startDate: draft.startDate,
			frequency,
			...(draft.endDate ? { endDate: draft.endDate } : {}),
		};

		setPendingAction(`save:${routine.id}`);
		setActionError("");
		try {
			await onUpdate(routine.id, body);
			setDraft(null);
			setNotice(`${title} 루틴을 저장했어요.`);
		} catch (caught) {
			setActionError(errorMessage(caught));
		} finally {
			setPendingAction(null);
		}
	};

	const changeStatus = async (routine: Routine) => {
		const status: Routine["status"] = routine.status === "active" ? "paused" : "active";
		setPendingAction(`status:${routine.id}`);
		setNotice("");
		setActionError("");
		try {
			await onStatus(routine.id, status);
			setNotice(
				status === "paused"
					? `${routine.title} 루틴을 잠시 멈췄어요.`
					: `${routine.title} 루틴을 다시 시작했어요.`,
			);
		} catch (caught) {
			setActionError(errorMessage(caught));
		} finally {
			setPendingAction(null);
		}
	};

	const removeRoutine = async (routine: Routine) => {
		if (!window.confirm("이 루틴과 완료 기록을 삭제할까요?")) return;
		setPendingAction(`delete:${routine.id}`);
		setNotice("");
		setActionError("");
		try {
			await onDelete(routine.id);
			setNotice(`${routine.title} 루틴을 삭제했어요.`);
		} catch (caught) {
			setActionError(errorMessage(caught));
		} finally {
			setPendingAction(null);
		}
	};

	return (
		<section className="management-screen" data-testid="routine-management" aria-label="루틴 관리">
			<SubpageHeader title="루틴 관리" onBack={onBack} />
			<p className="management-screen__intro">
				반복 조건을 다듬거나, 지금 필요하지 않은 루틴을 잠시 멈춰 두세요.
			</p>

			<div className="management-feedback" aria-live="polite">
				{actionError ? <span className="management-feedback__error">{actionError}</span> : notice}
			</div>

			{loading ? (
				<div
					className="management-skeleton"
					role="status"
					aria-busy="true"
					aria-label="루틴 불러오는 중"
				>
					<span className="skeleton" />
					<span className="skeleton" />
					<span className="skeleton" />
				</div>
			) : error ? (
				<div className="error-box">루틴을 불러오지 못했어요.</div>
			) : orderedRoutines.length === 0 ? (
				<div className="empty-state">
					<Repeat aria-hidden="true" />
					<p>관리할 루틴이 없어요. 루틴 탭에서 새 루틴을 만들어 주세요.</p>
				</div>
			) : (
				<ol className="management-list">
					{orderedRoutines.map((routine) => {
						const category = categoryMap.get(routine.categoryId);
						const editing = draft?.id === routine.id;
						const busy = pendingAction !== null;
						const selectedCategory = editing ? categoryMap.get(draft.categoryId) : category;
						return (
							<li
								key={routine.id}
								className={`management-card${routine.status === "paused" ? " management-card--paused" : ""}`}
								data-routine-id={routine.id}
								style={categoryStyle(category?.color)}
							>
								<div className="management-card__summary">
									<span className="management-card__color" aria-hidden="true" />
									<div className="management-card__copy">
										<div className="management-card__title-line">
											<strong>{routine.title}</strong>
											<span className={`management-status management-status--${routine.status}`}>
												{routine.status === "active" ? "진행 중" : "일시정지"}
											</span>
										</div>
										<span className="management-card__meta">
											{category?.name ?? "카테고리 없음"} · {frequencyLabel(routine.frequency)} ·{" "}
											{routine.startDate} ~ {routine.endDate ?? "종료 없음"}
										</span>
									</div>
									<div className="management-card__actions">
										<button
											type="button"
											className="icon-btn"
											onClick={() => changeStatus(routine)}
											disabled={busy}
											aria-label={`${routine.title} ${routine.status === "active" ? "일시정지" : "다시 시작"}`}
										>
											{routine.status === "active" ? (
												<Pause aria-hidden="true" />
											) : (
												<Play aria-hidden="true" />
											)}
										</button>
										<button
											type="button"
											className="icon-btn"
											onClick={() => beginEdit(routine)}
											disabled={busy}
											aria-label={`${routine.title} 수정`}
										>
											<Pencil aria-hidden="true" />
										</button>
										<button
											type="button"
											className="icon-btn management-icon-btn--danger"
											onClick={() => void removeRoutine(routine)}
											disabled={busy}
											aria-label={`${routine.title} 삭제`}
										>
											<Trash2 aria-hidden="true" />
										</button>
									</div>
								</div>

								{editing && draft ? (
									<form
										className="management-editor"
										onSubmit={(event) => saveRoutine(event, routine)}
									>
										<div className="management-editor__grid">
											<label
												className="management-field management-field--wide"
												htmlFor={`routine-name-${routine.id}`}
											>
												<span>루틴 이름</span>
												<input
													id={`routine-name-${routine.id}`}
													value={draft.title}
													onChange={(event) => setDraft({ ...draft, title: event.target.value })}
													maxLength={500}
												/>
											</label>
											<label
												className="management-field"
												htmlFor={`routine-category-${routine.id}`}
											>
												<span>카테고리</span>
												<select
													id={`routine-category-${routine.id}`}
													value={draft.categoryId}
													onChange={(event) =>
														setDraft({ ...draft, categoryId: event.target.value })
													}
												>
													{categories?.map((option) => (
														<option key={option.id} value={option.id}>
															{option.name}
														</option>
													))}
												</select>
											</label>
											<label
												className="management-field"
												htmlFor={`routine-frequency-${routine.id}`}
											>
												<span>반복</span>
												<select
													id={`routine-frequency-${routine.id}`}
													value={draft.frequencyType}
													onChange={(event) =>
														setDraft({
															...draft,
															frequencyType: event.target.value as Frequency["type"],
															days: [],
														})
													}
												>
													{FREQUENCY_OPTIONS.map((option) => (
														<option key={option.value} value={option.value}>
															{option.label}
														</option>
													))}
												</select>
											</label>
											<label className="management-field" htmlFor={`routine-start-${routine.id}`}>
												<span>시작일</span>
												<input
													id={`routine-start-${routine.id}`}
													type="date"
													value={draft.startDate}
													onChange={(event) =>
														setDraft({ ...draft, startDate: event.target.value })
													}
													required
												/>
											</label>
											<label className="management-field" htmlFor={`routine-end-${routine.id}`}>
												<span>종료일 (선택)</span>
												<input
													id={`routine-end-${routine.id}`}
													type="date"
													value={draft.endDate}
													min={draft.startDate}
													onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
												/>
											</label>
										</div>

										{draft.frequencyType === "weekdays" ? (
											<fieldset
												className="management-choices"
												style={categoryStyle(selectedCategory?.color)}
											>
												<legend>반복 요일</legend>
												<div className="management-choice-grid management-choice-grid--weekdays">
													{WEEKDAYS.map((day, index) => (
														<button
															key={day}
															type="button"
															className={draft.days.includes(index) ? "is-selected" : ""}
															onClick={() => toggleDay(index)}
															aria-pressed={draft.days.includes(index)}
														>
															{day}
														</button>
													))}
												</div>
											</fieldset>
										) : null}

										{draft.frequencyType === "monthly" ? (
											<fieldset
												className="management-choices"
												style={categoryStyle(selectedCategory?.color)}
											>
												<legend>반복 날짜</legend>
												<div className="management-choice-grid">
													{Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
														<button
															key={day}
															type="button"
															className={draft.days.includes(day) ? "is-selected" : ""}
															onClick={() => toggleDay(day)}
															aria-pressed={draft.days.includes(day)}
														>
															{day}
														</button>
													))}
												</div>
											</fieldset>
										) : null}

										<div className="management-editor__actions">
											<button
												type="submit"
												className="btn-primary"
												disabled={pendingAction === `save:${routine.id}`}
											>
												<Check aria-hidden="true" /> 저장
											</button>
											<button
												type="button"
												className="btn-ghost"
												onClick={() => setDraft(null)}
												disabled={busy}
											>
												<X aria-hidden="true" /> 취소
											</button>
										</div>
									</form>
								) : null}
							</li>
						);
					})}
				</ol>
			)}
		</section>
	);
}
