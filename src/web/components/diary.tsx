import { useEffect, useRef, useState } from "react";
import { koreanFullDate, parseKey, weekRange } from "../api/dates";
import type { DiaryEntry } from "../api/planner";
import { SubpageHeader } from "./chrome";

const MOODS = ["🍟", "☀️", "🌧", "😊", "🥰", "😴", "😤", "✨"] as const;
type PresetMood = (typeof MOODS)[number];
const DEFAULT_MOOD: PresetMood = "🍟";

export type DiaryScreenProps = {
	date: string;
	diary: DiaryEntry | null | undefined;
	loading: boolean;
	error: boolean;
	onSave: (body: { mood: string; body: string }) => Promise<DiaryEntry>;
	onRetry: () => void;
	onSelectDate: (date: string) => void;
	onBack: () => void;
};

export function DiaryScreen({
	date,
	diary,
	loading,
	error,
	onSave,
	onRetry,
	onSelectDate,
	onBack,
}: DiaryScreenProps) {
	const [editing, setEditing] = useState(false);
	const [mood, setMood] = useState<string>(DEFAULT_MOOD);
	const [body, setBody] = useState("");
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState(false);
	const currentDate = useRef(date);

	useEffect(() => {
		currentDate.current = date;
		setEditing(false);
		setMood(DEFAULT_MOOD);
		setBody("");
		setSaving(false);
		setSaveError(false);
	}, [date]);

	const week = weekRange(date);
	const now = new Date();
	const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
		now.getDate(),
	).padStart(2, "0")}`;

	const startEdit = () => {
		setMood(diary?.mood ?? DEFAULT_MOOD);
		setBody(diary?.body ?? "");
		setSaveError(false);
		setEditing(true);
	};

	const cancelEdit = () => {
		setEditing(false);
		setMood(DEFAULT_MOOD);
		setBody("");
		setSaveError(false);
	};

	const selectDate = (nextDate: string) => {
		if (nextDate === date) {
			return;
		}
		cancelEdit();
		onSelectDate(nextDate);
	};

	const submit = async () => {
		const trimmedMood = mood.trim();
		const trimmedBody = body.trim();
		if (!trimmedMood || !trimmedBody || saving) {
			return;
		}

		const saveDate = date;
		setSaving(true);
		setSaveError(false);
		try {
			await onSave({ mood: trimmedMood, body: trimmedBody });
			if (currentDate.current === saveDate) {
				setEditing(false);
			}
		} catch {
			if (currentDate.current === saveDate) {
				setSaveError(true);
			}
		} finally {
			if (currentDate.current === saveDate) {
				setSaving(false);
			}
		}
	};

	const saveDisabled = saving || !mood.trim() || !body.trim();

	return (
		<div className="diary">
			<SubpageHeader title="일기" onBack={onBack} />
			<ol className="diary__week" aria-label="이번 주 일기">
				{week.map((day) => {
					const weekday = parseKey(day).getDay();
					const isToday = day === todayStr;
					const isSelected = day === date;
					const weekdayState = weekday === 0 ? "sun" : weekday === 6 ? "sat" : "";
					return (
						<li key={day}>
							<button
								type="button"
								className="diary__day"
								onClick={() => selectDate(day)}
								aria-current={isSelected ? "date" : undefined}
								aria-label={day}
							>
								<span
									className={`week-strip__weekday${weekdayState ? ` week-strip__weekday--${weekdayState}` : ""}`}
								>
									{["일", "월", "화", "수", "목", "금", "토"][weekday]}
								</span>
								<span className={`diary__emoji${diary && isSelected ? "" : " diary__emoji--none"}`}>
									{isSelected && diary ? diary.mood : "·"}
								</span>
								<span className={`week-strip__num${isToday ? " week-strip__num--today" : ""}`}>
									{Number(day.split("-")[2])}
								</span>
							</button>
						</li>
					);
				})}
			</ol>

			<section className="diary-sheet" aria-label="일기" aria-busy={loading || undefined}>
				<h3>{koreanFullDate(date)}</h3>
				{loading ? (
					<div className="diary-sheet__loading" role="status">
						<span className="skeleton" />
						<span className="skeleton" />
						<span className="skeleton" />
					</div>
				) : error ? (
					<div className="diary-sheet__state">
						<p className="error-box" role="alert">
							일기를 불러오지 못했어요.
						</p>
						<button type="button" className="btn-ghost" onClick={onRetry}>
							다시 시도
						</button>
					</div>
				) : editing ? (
					<div className="diary-edit">
						<fieldset className="mood-picker">
							<legend>대표 이모지</legend>
							<div className="mood-picker__options">
								{MOODS.map((emoji) => (
									<button
										key={emoji}
										type="button"
										className={mood === emoji ? "is-on" : ""}
										onClick={() => setMood(emoji)}
										aria-pressed={mood === emoji}
									>
										{emoji}
									</button>
								))}
							</div>
						</fieldset>
						<label className="diary-edit__field">
							<span>대표 이모지 직접 입력</span>
							<input
								type="text"
								value={mood}
								onChange={(event) => setMood(event.target.value)}
								maxLength={32}
							/>
						</label>
						<label className="diary-edit__field">
							<span>일기 내용</span>
							<textarea
								value={body}
								onChange={(event) => setBody(event.target.value)}
								rows={5}
								maxLength={10_000}
								placeholder="오늘을 한 줄로 기록해보세요."
							/>
						</label>
						{saveError ? (
							<p className="error-box" role="alert">
								일기를 저장하지 못했어요. 내용을 유지했으니 다시 시도해 주세요.
							</p>
						) : null}
						<div className="diary-edit__actions">
							<button type="button" className="btn-ghost" onClick={cancelEdit} disabled={saving}>
								취소
							</button>
							<button
								type="button"
								className="btn-primary"
								onClick={submit}
								disabled={saveDisabled}
							>
								{saving ? "저장 중…" : "저장하기"}
							</button>
						</div>
					</div>
				) : diary ? (
					<div className="diary-sheet__state">
						<span className="diary-sheet__mood" role="img" aria-label={`대표 이모지 ${diary.mood}`}>
							{diary.mood}
						</span>
						<p className="diary-sheet__body">{diary.body}</p>
						<button type="button" className="btn-ghost" onClick={startEdit}>
							수정하기
						</button>
					</div>
				) : (
					<div className="diary-sheet__state">
						<p className="diary-sheet__body">이날의 기분과 기억을 남겨보세요.</p>
						<button type="button" className="btn-primary" onClick={startEdit}>
							작성하기
						</button>
					</div>
				)}
			</section>
		</div>
	);
}
