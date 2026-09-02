import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createPlannerTestApp } from "./helpers/planner-test-app";

type PlannerHarness = Awaited<ReturnType<typeof createPlannerTestApp>>;

describe("extended personal planning tools", () => {
	let harness: PlannerHarness;
	let categoryId: string;

	beforeAll(async () => {
		harness = await createPlannerTestApp();
		const categoryResponse = await harness.request("/api/categories", {
			method: "POST",
			body: {
				name: "개인",
				color: "#191919",
				visibility: "private",
			},
		});
		expect(categoryResponse.status).toBe(201);
		const category = (await categoryResponse.json()) as { id: string };
		categoryId = category.id;
	});

	afterAll(async () => {
		await harness.close();
	});

	test("moves undated backlog work onto the calendar", async () => {
		const created = await harness.request("/api/tasks", {
			method: "POST",
			body: {
				categoryId,
				title: "언젠가 읽을 책",
				date: null,
			},
		});
		expect(created.status).toBe(201);
		const task = (await created.json()) as { id: string };

		const backlog = await harness.request("/api/backlog");
		expect(backlog.status).toBe(200);
		expect(await backlog.json()).toMatchObject({
			tasks: [expect.objectContaining({ id: task.id, title: "언젠가 읽을 책" })],
		});

		const scheduled = await harness.request(`/api/tasks/${task.id}`, {
			method: "PATCH",
			body: { date: "2026-09-20" },
		});
		expect(scheduled.status).toBe(200);

		expect(await (await harness.request("/api/backlog")).json()).toEqual({ tasks: [] });
		expect(await (await harness.request("/api/planner?date=2026-09-20")).json()).toMatchObject({
			categories: [
				expect.objectContaining({
					tasks: [expect.objectContaining({ id: task.id })],
				}),
			],
		});
	});

	test("tracks one active task timer without sleeps", async () => {
		const task = await createTask(harness, categoryId, "집중 작업", "2026-09-21");

		const started = await harness.request(`/api/tasks/${task.id}/timer/start`, {
			method: "POST",
		});
		expect(started.status).toBe(201);
		expect(await started.json()).toMatchObject({
			status: "running",
			taskId: task.id,
			startedAt: expect.any(String),
		});

		const stopped = await harness.request(`/api/tasks/${task.id}/timer/stop`, {
			method: "POST",
		});
		expect(stopped.status).toBe(200);
		expect(await stopped.json()).toMatchObject({
			status: "stopped",
			taskId: task.id,
			elapsedSeconds: expect.any(Number),
		});
	});

	test("upserts one mood diary per local date", async () => {
		const first = await harness.request("/api/diary/2026-09-22", {
			method: "PUT",
			body: {
				mood: "🍟",
				body: "작은 할 일을 차근차근 끝냈다.",
			},
		});
		expect(first.status).toBe(200);

		const updated = await harness.request("/api/diary/2026-09-22", {
			method: "PUT",
			body: {
				mood: "☀️",
				body: "친구와 함께하니 더 즐거웠다.",
			},
		});
		expect(updated.status).toBe(200);

		const diary = await harness.request("/api/diary/2026-09-22");
		expect(diary.status).toBe(200);
		expect(await diary.json()).toMatchObject({
			date: "2026-09-22",
			mood: "☀️",
			body: "친구와 함께하니 더 즐거웠다.",
		});
	});

	test("aggregates category completion statistics", async () => {
		const completedTask = await createTask(
			harness,
			categoryId,
			"완료할 일",
			"2026-09-23",
		);
		await createTask(harness, categoryId, "남은 일", "2026-09-23");
		await harness.request(`/api/tasks/${completedTask.id}/completion`, {
			method: "PUT",
			body: { completed: true },
		});

		const stats = await harness.request(
			"/api/stats?from=2026-09-23&to=2026-09-23",
		);
		expect(stats.status).toBe(200);
		expect(await stats.json()).toMatchObject({
			categories: [
				expect.objectContaining({
					categoryId,
					completed: 1,
					total: 2,
					rate: 0.5,
				}),
			],
		});
	});
});

async function createTask(
	harness: PlannerHarness,
	taskCategoryId: string,
	title: string,
	date: string,
) {
	const response = await harness.request("/api/tasks", {
		method: "POST",
		body: { categoryId: taskCategoryId, title, date },
	});
	expect(response.status).toBe(201);
	return (await response.json()) as { id: string };
}
