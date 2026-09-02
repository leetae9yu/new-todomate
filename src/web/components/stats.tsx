import type { CSSProperties } from "react";
import type { CategoryStat } from "../api/planner";

export type StatsScreenProps = {
	stats: CategoryStat[] | undefined;
	loading: boolean;
	error: boolean;
};

export function StatsScreen({ stats, loading, error }: StatsScreenProps) {
	if (loading) {
		return (
			<div className="stats__grid" aria-busy="true">
				{[1, 2].map((index) => (
					<section key={index} className="stat-card">
						<span className="skeleton" style={{ width: 120 }} />
						<span className="skeleton" />
					</section>
				))}
			</div>
		);
	}

	if (error || !stats) {
		return <div className="error-box">통계를 불러오지 못했어요.</div>;
	}

	if (stats.length === 0) {
		return <p className="backlog__hint">아직 완료한 할 일이 없어요. 이번 주 할 일을 끝내면 통계가 채워져요.</p>;
	}

	return (
		<div className="stats__grid">
			{stats.map((category) => {
				const color = category.color ?? "#8437ff";
				const cells = category.days
					? [...category.days, ...Array(Math.max(0, 35 - category.days.length)).fill(null)].slice(0, 35)
					: Array.from({ length: 35 }, (_, index) =>
						index < Math.min(category.completed, 35)
							? { date: "", completed: true }
							: null,
					);
				const displayCells = cells.map((day, index) => ({
					day,
					slot: `slot-${index + 1}`,
				}));
				return (
					<section key={category.categoryId} className="stat-card" style={{ "--cat-color": color } as CSSProperties}>
						<h3>
							{category.name ?? "카테고리"} / {category.total}
						</h3>
						<div
							className="dot-matrix"
							role="img"
							aria-label={`${category.name ?? "카테고리"} 완료 추이`}
						>
							{displayCells.map(({ day, slot }) => {
								if (!day) {
									return <span key={slot} className="dot-matrix__empty" aria-hidden="true" />;
								}
								return (
									<span
										key={slot}
										className={day.completed ? undefined : "dot-matrix__empty"}
										title={day.date}
									/>
								);
							})}
						</div>
						<span className="stat-card__rate">완료율 {Math.round(category.rate * 100)}%</span>
					</section>
				);
			})}
		</div>
	);
}
