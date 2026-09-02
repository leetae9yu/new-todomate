import { useState } from "react";
import { koreanFullDate, parseKey, weekRange } from "../api/dates";
import type { DiaryEntry } from "../api/planner";

const MOODS = ["🍟", "☀️", "🌧", "😊", "🥰", "😴", "😤", "✨"];

export type DiaryScreenProps = {
	date: string;
	diary: DiaryEntry | null | undefined;
	loading: boolean;
	error: boolean;
	onSave: (body: { mood: string; body: string }) => void;
	onSelectDate: (date: string) => void;
};

export function DiaryScreen({ date, diary, loading, error, onSave, onSelectDate }: DiaryScreenProps) {
	const [mood, setMood] = useState("🍟");
	const [body, setBody] = useState("");

	const week = weekRange(date);
	const now = new Date();
	const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
		now.getDate(),
	).padStart(2, "0")}`;

	const startEdit = () => {
		setMood(diary?.mood ?? "🍟");
		setBody(diary?.body ?? "");
	};

	const submit = () => {
		const trimmed = body.trim();
		if (!trimmed) {
			return;
		}
		onSave({ mood, body: trimmed });
	};

	return (
		<div className="diary">
			<ol className="diary__week" aria-label="이번 주 일기">
				{week.map((day) => {
					const weekday = parseKey(day).getDay();
					const isToday = day === todayStr;
					const isSelected = day === date;
					return (
						<li key={day}>
							<button
								type="button"
								className="diary__day"
								onClick={() => onSelectDate(day)}
								aria-current={isSelected ? "date" : undefined}
								aria-label={day}
							>
								<span className="week-strip__weekday" style={weekday === 0 ? { color: "var(--sunday)" } : weekday === 6 ? { color: "var(--saturday)" } : undefined}>
									{["일", "월", "화", "수", "목", "금", "토"][weekday]}
								</span>
								<span className={`diary__emoji${diary && isSelected ? "" : " diary__emoji--none"}`}>
									{isSelected && diary ? diary.mood : isToday ? "·" : "·"}
								</span>
								<span className={`week-strip__num${isToday ? " week-strip__num--today" : ""}`}>
									{Number(day.split("-")[2])}
								</span>
							</button>
						</li>
					);
				})}
			</ol>

			<section className="diary-sheet" aria-label="일기 쓰기">
				<span className="diary-sheet__handle" aria-hidden="true" />
				<h3>일기</h3>
				{loading ? (
					<span className="skeleton" style={{ width: 140 }} />
				) : error ? (
					<p className="error-box">일기를 불러오지 못했어요.</p>
				) : diary ? (
					<>
						<span className="diary-sheet__mood" aria-hidden="true">
							{diary.mood}
						</span>
						<p className="diary-sheet__body">{diary.body}</p>
					</>
				) : (
					<p className="diary-sheet__body">{koreanFullDate(date)}의 일기를 적어보세요.</p>
				)}
				<button type="button" className="btn-ghost" onClick={startEdit}>
					{diary ? "수정하기" : "작성하기"}
				</button>
				<div className="diary-edit">
					<fieldset className="mood-picker" aria-label="대표 이모지">
						{MOODS.map((emoji) => (
							<button
								key={emoji}
								type="button"
								className={mood === emoji ? "is-on" : ""}
								onClick={() => setMood(emoji)}
							>
								{emoji}
							</button>
						))}
					</fieldset>
					<input
						type="text"
						value={mood}
						onChange={(event) => setMood(event.target.value)}
						placeholder="대표 이모지"
						aria-label="대표 이모지"
					/>
					<textarea
						value={body}
						onChange={(event) => setBody(event.target.value)}
						rows={5}
						placeholder="오늘을 한 줄로 기록해보세요."
					/>
					<button type="button" className="btn-primary" onClick={submit}>
						저장하기
					</button>
				</div>
			</section>
		</div>
	);
}
