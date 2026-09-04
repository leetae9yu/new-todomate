import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createPlannerTestApp } from "./helpers/planner-test-app";

type PlannerHarness = Awaited<ReturnType<typeof createPlannerTestApp>>;

describe("personal planner API", () => {
	let harness: PlannerHarness;

	beforeAll(async () => {
		harness = await createPlannerTestApp();
	}, 20_000);

	afterAll(async () => {
		await harness.close();
	}, 20_000);

	test("creates categories and manages a dated todo lifecycle", async () => {
		const categoryResponse = await harness.request("/api/categories", {
			method: "POST",
			body: {
				name: "운동",
				color: "#8437FF",
				visibility: "group",
			},
		});
		expect(categoryResponse.status).toBe(201);
		const category = (await categoryResponse.json()) as { id: string };

		const firstResponse = await harness.request("/api/tasks", {
			method: "POST",
			body: {
				categoryId: category.id,
				title: "아침 러닝",
				date: "2026-09-02",
			},
		});
		expect(firstResponse.status).toBe(201);
		const first = (await firstResponse.json()) as { id: string };

		const secondResponse = await harness.request("/api/tasks", {
			method: "POST",
			body: {
				categoryId: category.id,
				title: "스트레칭",
				date: "2026-09-02",
			},
		});
		expect(secondResponse.status).toBe(201);
		const second = (await secondResponse.json()) as { id: string };

		const reordered = await harness.request(`/api/tasks/${second.id}`, {
			method: "PATCH",
			body: {
				title: "마무리 스트레칭",
				position: 0,
			},
		});
		expect(reordered.status).toBe(200);

		const completed = await harness.request(`/api/tasks/${first.id}/completion`, {
			method: "PUT",
			body: { completed: true },
		});
		expect(completed.status).toBe(200);
		expect(await completed.json()).toMatchObject({
			completed: true,
			completedAt: expect.any(String),
		});

		const uncompleted = await harness.request(`/api/tasks/${first.id}/completion`, {
			method: "PUT",
			body: { completed: false },
		});
		expect(uncompleted.status).toBe(200);
		expect(await uncompleted.json()).toMatchObject({
			completed: false,
			completedAt: null,
		});

		const moved = await harness.request(`/api/tasks/${first.id}`, {
			method: "PATCH",
			body: { date: "2026-09-03" },
		});
		expect(moved.status).toBe(200);

		const planner = await harness.request("/api/planner?date=2026-09-02");
		expect(planner.status).toBe(200);
		const body = (await planner.json()) as {
			categories: Array<{
				id: string;
				tasks: Array<{
					id: string;
					title: string;
					completed: boolean;
					completedAt: string | null;
					date: string;
					position: number;
				}>;
			}>;
		};
		expect(body.categories[0]?.tasks).toEqual([
			{
				id: second.id,
				title: "마무리 스트레칭",
				completed: false,
				completedAt: null,
				date: "2026-09-02",
				position: 0,
			},
		]);
	});

	test("keeps local dates exact and surfaces previous incomplete tasks", async () => {
		const category = await createCategory(harness, "공부", "#2C34FF");
		const response = await harness.request("/api/tasks", {
			method: "POST",
			body: {
				categoryId: category.id,
				title: "전날 복습",
				date: "2026-01-01",
			},
		});
		expect(response.status).toBe(201);

		const planner = await harness.request("/api/planner?date=2026-01-02");
		expect(planner.status).toBe(200);
		expect(await planner.json()).toMatchObject({
			date: "2026-01-02",
			overdue: [
				{
					title: "전날 복습",
					date: "2026-01-01",
				},
			],
		});

		const invalid = await harness.request("/api/planner?date=2026-02-30");
		expect(invalid.status).toBe(400);
	});

	test("returns complete category metadata on dates without planner items", async () => {
		const category = await createCategory(harness, "모든 날짜 카테고리", "#8437FF");

		const planner = await harness.request("/api/planner?date=2000-01-01");
		expect(planner.status).toBe(200);
		const body = (await planner.json()) as {
			categories: Array<{
				id: string;
				name?: string;
				color?: string;
				visibility?: string;
				position?: number;
				tasks?: unknown[];
			}>;
		};

		expect(body.categories.find(({ id }) => id === category.id)).toEqual({
			id: category.id,
			name: "모든 날짜 카테고리",
			color: "#8437FF",
			visibility: "private",
			position: expect.any(Number),
			tasks: [],
		});
	});

	test("materializes daily, weekday, and monthly routines independently", async () => {
		const category = await createCategory(harness, "루틴", "#FF5CB5");

		const daily = await createRoutine(harness, {
			categoryId: category.id,
			title: "물 마시기",
			startDate: "2026-09-01",
			frequency: { type: "daily" },
		});
		const weekly = await createRoutine(harness, {
			categoryId: category.id,
			title: "수요일 러닝",
			startDate: "2026-09-01",
			frequency: { type: "weekdays", days: [3] },
		});
		const monthly = await createRoutine(harness, {
			categoryId: category.id,
			title: "월간 정산",
			startDate: "2026-09-01",
			frequency: { type: "monthly", days: [15] },
		});

		await expectRoutineTitles(harness, "2026-09-02", ["물 마시기", "수요일 러닝"]);
		await expectRoutineTitles(harness, "2026-09-15", ["물 마시기", "월간 정산"]);

		const completion = await harness.request(
			`/api/routines/${weekly.id}/occurrences/2026-09-02/completion`,
			{ method: "PUT", body: { completed: true } },
		);
		expect(completion.status).toBe(200);

		const history = await harness.request("/api/planner?date=2026-09-02");
		expect(await history.json()).toMatchObject({
			routines: expect.arrayContaining([
				expect.objectContaining({ id: weekly.id, completed: true }),
			]),
		});

		const future = await harness.request("/api/planner?date=2026-09-09");
		expect(await future.json()).toMatchObject({
			routines: expect.arrayContaining([
				expect.objectContaining({ id: weekly.id, completed: false }),
			]),
		});
		expect(daily.id).not.toBe(monthly.id);
	});
});

async function createCategory(harness: PlannerHarness, name: string, color: string) {
	const response = await harness.request("/api/categories", {
		method: "POST",
		body: { name, color, visibility: "private" },
	});
	expect(response.status).toBe(201);
	return (await response.json()) as { id: string };
}

async function createRoutine(
	harness: PlannerHarness,
	body: {
		categoryId: string;
		title: string;
		startDate: string;
		frequency: { type: "daily" } | { type: "weekdays" | "monthly"; days: number[] };
	},
) {
	const response = await harness.request("/api/routines", { method: "POST", body });
	expect(response.status).toBe(201);
	return (await response.json()) as { id: string };
}

async function expectRoutineTitles(
	harness: PlannerHarness,
	date: string,
	expectedTitles: string[],
) {
	const response = await harness.request(`/api/planner?date=${date}`);
	expect(response.status).toBe(200);
	const body = (await response.json()) as { routines: Array<{ title: string }> };
	expect(body.routines.map((routine) => routine.title)).toEqual(expectedTitles);
}
