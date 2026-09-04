import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createSocialTestApp } from "./helpers/social-test-app";

type SocialHarness = Awaited<ReturnType<typeof createSocialTestApp>>;
type Category = { id: string };
type Routine = { id: string };

const daily = { type: "daily" } as const;

describe("settings and planner management API", () => {
	let harness: SocialHarness;

	beforeEach(async () => {
		harness = await createSocialTestApp();
	}, 20_000);

	afterEach(async () => {
		await harness.close();
	}, 20_000);

	test("persists strict session-scoped settings through a fresh GET", async () => {
		const defaults = await harness.demo("/api/settings");
		expect(defaults.status).toBe(200);
		expect(await defaults.json()).toEqual({ theme: "system", notificationsEnabled: true });

		const saved = await harness.demo("/api/settings", {
			method: "PUT",
			body: { theme: "dark", notificationsEnabled: false },
		});
		expect(saved.status).toBe(200);
		expect(await saved.json()).toEqual({ theme: "dark", notificationsEnabled: false });

		const fresh = await harness.demo("/api/settings");
		expect(fresh.status).toBe(200);
		expect(await fresh.json()).toEqual({ theme: "dark", notificationsEnabled: false });

		const friendSettings = await harness.friend("/api/settings");
		expect(friendSettings.status).toBe(200);
		expect(await friendSettings.json()).toEqual({ theme: "system", notificationsEnabled: true });

		const partial = await harness.demo("/api/settings", {
			method: "PUT",
			body: { theme: "light" },
		});
		expect(partial.status).toBe(400);
	});

	test("renames, recolors, and changes category visibility only for a current group member", async () => {
		const category = await createCategory(harness, "처음 이름");
		const friendGroup = await createGroup(harness, "친구만의 그룹", "friend");
		const rejected = await harness.demo(`/api/categories/${category.id}`, {
			method: "PATCH",
			body: { visibility: "group", groupId: friendGroup.id },
		});
		expect(rejected.status).toBe(404);

		const group = await createGroup(harness, "함께 관리할 그룹", "demo");
		const renamed = await harness.demo(`/api/categories/${category.id}`, {
			method: "PATCH",
			body: { name: "바뀐 이름", color: "#2C34FF" },
		});
		expect(renamed.status).toBe(200);
		expect(await renamed.json()).toMatchObject({
			category: {
				id: category.id,
				name: "바뀐 이름",
				color: "#2C34FF",
				visibility: "private",
				groupId: null,
			},
		});

		const shared = await harness.demo(`/api/categories/${category.id}`, {
			method: "PATCH",
			body: { visibility: "group", groupId: group.id },
		});
		expect(shared.status).toBe(200);
		expect(await shared.json()).toMatchObject({
			category: { id: category.id, visibility: "group", groupId: group.id },
		});

		const privateAgain = await harness.demo(`/api/categories/${category.id}`, {
			method: "PATCH",
			body: { visibility: "private" },
		});
		expect(privateAgain.status).toBe(200);
		expect(await privateAgain.json()).toMatchObject({
			category: { id: category.id, visibility: "private", groupId: null },
		});
	});

	test("reorders categories authoritatively and isolates foreign category mutations", async () => {
		const first = await createCategory(harness, "첫 번째");
		const second = await createCategory(harness, "두 번째");
		const third = await createCategory(harness, "세 번째");

		const reordered = await harness.demo(`/api/categories/${third.id}`, {
			method: "PATCH",
			body: { position: 0 },
		});
		expect(reordered.status).toBe(200);
		const reorderBody = (await reordered.json()) as {
			category: { id: string; position: number };
			categories: Array<{ id: string; position: number }>;
		};
		expect(reorderBody.category).toEqual({ id: third.id, position: 0 });
		expect(reorderBody.categories.slice(0, 3)).toEqual([
			{ id: third.id, position: 0 },
			{ id: first.id, position: 1 },
			{ id: second.id, position: 2 },
		]);

		const freshPlanner = await harness.demo("/api/planner?date=2026-09-02");
		expect(freshPlanner.status).toBe(200);
		expect(
			(
				(await freshPlanner.json()) as { categories: Array<{ id: string; position: number }> }
			).categories.slice(0, 3).map(({ id, position }) => ({ id, position })),
		).toEqual([
			{ id: third.id, position: 0 },
			{ id: first.id, position: 1 },
			{ id: second.id, position: 2 },
		]);

		const foreignUpdate = await harness.friend(`/api/categories/${third.id}`, {
			method: "PATCH",
			body: { name: "탈취" },
		});
		expect(foreignUpdate.status).toBe(404);
		expect((await harness.friend(`/api/categories/${third.id}`, { method: "DELETE" })).status).toBe(
			404,
		);
	});

	test("deletes a non-empty category with its task, routine, and occurrence history", async () => {
		const category = await createCategory(harness, "삭제 대상");
		const task = await createTask(harness, category.id, "같이 삭제될 할 일");
		const routine = await createRoutine(harness, category.id, "같이 삭제될 루틴");
		const completed = await harness.demo(
			`/api/routines/${routine.id}/occurrences/2026-09-02/completion`,
			{ method: "PUT", body: { completed: true } },
		);
		expect(completed.status).toBe(200);

		const deleted = await harness.demo(`/api/categories/${category.id}`, { method: "DELETE" });
		expect(deleted.status).toBe(204);
		expect(await deleted.text()).toBe("");

		const planner = await harness.demo("/api/planner?date=2026-09-02");
		expect(planner.status).toBe(200);
		const plannerBody = (await planner.json()) as {
			categories: Array<{ id: string }>;
			routines: Array<{ id: string }>;
		};
		expect(plannerBody.categories.map((item) => item.id)).not.toContain(category.id);
		expect(plannerBody.routines.map((item) => item.id)).not.toContain(routine.id);
		const backlog = (await (await harness.demo("/api/backlog")).json()) as {
			tasks: Array<{ id: string }>;
		};
		expect(backlog.tasks.map((item) => item.id)).not.toContain(task.id);
		expect(
			(
				await harness.demo(`/api/routines/${routine.id}/occurrences/2026-09-02/completion`, {
					method: "PUT",
					body: { completed: false },
				})
			).status,
		).toBe(404);
	});

	test("edits, pauses, resumes, and deletes routines without exposing them to another owner", async () => {
		const category = await createCategory(harness, "루틴 관리");
		const routine = await createRoutine(harness, category.id, "원래 루틴");
		const completed = await harness.demo(
			`/api/routines/${routine.id}/occurrences/2026-09-02/completion`,
			{ method: "PUT", body: { completed: true } },
		);
		expect(completed.status).toBe(200);

		const allRoutines = await harness.demo("/api/routines");
		expect(allRoutines.status).toBe(200);
		expect(await allRoutines.json()).toMatchObject({
			routines: [
				expect.objectContaining({
					id: routine.id,
					categoryId: category.id,
					title: "원래 루틴",
					status: "active",
				}),
			],
		});

		const edited = await harness.demo(`/api/routines/${routine.id}`, {
			method: "PATCH",
			body: {
				categoryId: category.id,
				title: "수정한 루틴",
				startDate: "2026-09-01",
				frequency: daily,
			},
		});
		expect(edited.status).toBe(200);
		expect(await edited.json()).toMatchObject({
			id: routine.id,
			title: "수정한 루틴",
			status: "active",
		});

		const paused = await harness.demo(`/api/routines/${routine.id}`, {
			method: "PATCH",
			body: { status: "paused" },
		});
		expect(paused.status).toBe(200);
		expect(await paused.json()).toMatchObject({ id: routine.id, status: "paused" });
		expect(await plannerRoutineIds(harness, "2026-09-02")).not.toContain(routine.id);
		expect(
			(
				await harness.demo(`/api/routines/${routine.id}/occurrences/2026-09-02/completion`, {
					method: "PUT",
					body: { completed: false },
				})
			).status,
		).toBe(404);

		const resumed = await harness.demo(`/api/routines/${routine.id}`, {
			method: "PATCH",
			body: { status: "active" },
		});
		expect(resumed.status).toBe(200);
		expect(await resumed.json()).toMatchObject({ id: routine.id, status: "active" });
		const resumedPlanner = await harness.demo("/api/planner?date=2026-09-02");
		expect(resumedPlanner.status).toBe(200);
		expect(await resumedPlanner.json()).toMatchObject({
			routines: [
				expect.objectContaining({ id: routine.id, title: "수정한 루틴", completed: true }),
			],
		});

		expect(
			(
				await harness.friend(`/api/routines/${routine.id}`, {
					method: "PATCH",
					body: { status: "paused" },
				})
			).status,
		).toBe(404);
		expect((await harness.friend(`/api/routines/${routine.id}`, { method: "DELETE" })).status).toBe(
			404,
		);

		const deleted = await harness.demo(`/api/routines/${routine.id}`, { method: "DELETE" });
		expect(deleted.status).toBe(204);
		expect(await deleted.text()).toBe("");
		expect(await plannerRoutineIds(harness, "2026-09-02")).not.toContain(routine.id);
		expect(
			(
				await harness.demo(`/api/routines/${routine.id}/occurrences/2026-09-02/completion`, {
					method: "PUT",
					body: { completed: false },
				})
			).status,
		).toBe(404);
	});
});

async function createGroup(harness: SocialHarness, name: string, owner: "demo" | "friend") {
	const response = await harness[owner]("/api/groups", { method: "POST", body: { name } });
	expect(response.status).toBe(201);
	return (await response.json()) as { id: string };
}

async function createCategory(harness: SocialHarness, name: string): Promise<Category> {
	const response = await harness.demo("/api/categories", {
		method: "POST",
		body: { name, color: "#8437FF", visibility: "private" },
	});
	expect(response.status).toBe(201);
	return (await response.json()) as Category;
}

async function createTask(harness: SocialHarness, categoryId: string, title: string) {
	const response = await harness.demo("/api/tasks", {
		method: "POST",
		body: { categoryId, title, date: null },
	});
	expect(response.status).toBe(201);
	return (await response.json()) as { id: string };
}

async function createRoutine(
	harness: SocialHarness,
	categoryId: string,
	title: string,
): Promise<Routine> {
	const response = await harness.demo("/api/routines", {
		method: "POST",
		body: { categoryId, title, startDate: "2026-09-01", frequency: daily },
	});
	expect(response.status).toBe(201);
	return (await response.json()) as Routine;
}

async function plannerRoutineIds(harness: SocialHarness, date: string) {
	const response = await harness.demo(`/api/planner?date=${date}`);
	expect(response.status).toBe(200);
	const body = (await response.json()) as { routines: Array<{ id: string }> };
	return body.routines.map((routine) => routine.id);
}
