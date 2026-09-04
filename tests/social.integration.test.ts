import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSocialTestApp } from "./helpers/social-test-app";

type SocialHarness = Awaited<ReturnType<typeof createSocialTestApp>>;

describe("private group social API", () => {
	let harness: SocialHarness;

	beforeAll(async () => {
		harness = await createSocialTestApp();
	}, 20_000);

	afterAll(async () => {
		await harness.close();
	}, 20_000);

	test("shares only group-visible completed work and protects owner mutations", async () => {
		const groupResponse = await harness.demo("/api/groups", {
			method: "POST",
			body: { name: "함께 하는 계획" },
		});
		expect(groupResponse.status).toBe(201);
		const group = (await groupResponse.json()) as { id: string; role: string };
		expect(group.role).toBe("owner");

		const inviteResponse = await harness.demo(`/api/groups/${group.id}/invites`, {
			method: "POST",
		});
		expect(inviteResponse.status).toBe(201);
		const invite = (await inviteResponse.json()) as { token: string };

		const accepted = await harness.friend(`/api/invites/${invite.token}/respond`, {
			method: "POST",
			body: { accept: true },
		});
		expect(accepted.status).toBe(200);
		expect(await accepted.json()).toMatchObject({ groupId: group.id, role: "member" });

		const memberInvite = await harness.friend(`/api/groups/${group.id}/invites`, {
			method: "POST",
		});
		expect(memberInvite.status).toBe(201);

		const members = await harness.demo(`/api/groups/${group.id}/members`);
		expect(members.status).toBe(200);
		const friend = (await members.json()).find((member: { username: string }) => member.username === "friend") as {
			id: string;
			role: string;
		};
		expect(friend.role).toBe("member");
		const promoted = await harness.demo(`/api/groups/${group.id}/members/${friend.id}`, {
			method: "PATCH",
			body: { role: "admin" },
		});
		expect(promoted.status).toBe(200);
		expect(await promoted.json()).toMatchObject({ role: "admin" });

		const privateCategory = await createCategory(harness, { name: "비공개", visibility: "private" });
		const privateTask = await createTask(harness, privateCategory.id, "나만의 일", "2026-09-02");
		const groupCategory = await createCategory(harness, {
			name: "공유",
			visibility: "group",
			groupId: group.id,
		});
		const groupTask = await createTask(harness, groupCategory.id, "함께 보는 일", "2026-09-02");

		const crossUserMutation = await harness.friend(`/api/tasks/${groupTask.id}`, {
			method: "PATCH",
			body: { title: "탈취" },
		});
		expect(crossUserMutation.status).toBe(404);

		const privateFeed = await harness.friend(`/api/groups/${group.id}/feed?date=2026-09-02`);
		expect(privateFeed.status).toBe(200);
		expect(await privateFeed.json()).toMatchObject({
			tasks: [expect.objectContaining({ id: groupTask.id, title: "함께 보는 일" })],
		});
		expect(await (await harness.friend(`/api/groups/${group.id}/feed?date=2026-09-02`)).json()).not.toMatchObject({
			tasks: [expect.objectContaining({ id: privateTask.id })],
		});

		const incompleteReaction = await harness.friend(`/api/tasks/${groupTask.id}/reactions`, {
			method: "POST",
			body: { emoji: "👏" },
		});
		expect(incompleteReaction.status).toBe(409);
		await harness.demo(`/api/tasks/${groupTask.id}/completion`, {
			method: "PUT",
			body: { completed: true },
		});

		expect(
			(await harness.friend(`/api/tasks/${groupTask.id}/reactions`, {
				method: "POST",
				body: { emoji: "👏" },
			})).status,
		).toBe(201);
		expect(
			(await harness.friend(`/api/tasks/${groupTask.id}/reactions`, {
				method: "POST",
				body: { emoji: "🔥" },
			})).status,
		).toBe(200);

		const reactedFeed = await harness.friend(`/api/groups/${group.id}/feed?date=2026-09-02`);
		expect(await reactedFeed.json()).toMatchObject({
			tasks: [expect.objectContaining({ id: groupTask.id, reactions: [{ emoji: "🔥", count: 1 }] })],
		});

		const inbox = await harness.demo("/api/notifications");
		expect(inbox.status).toBe(200);
		const notification = (await inbox.json()).notifications[0] as {
			id: string;
			readAt: string | null;
			deepLink: { taskId: string; groupId: string };
		};
		expect(notification).toMatchObject({
			readAt: null,
			deepLink: { taskId: groupTask.id, groupId: group.id },
		});
		expect((await harness.demo(`/api/notifications/${notification.id}/read`, { method: "PATCH" })).status).toBe(
			200,
		);

		expect(
			(await harness.friend(`/api/tasks/${groupTask.id}/reactions`, { method: "DELETE" })).status,
		).toBe(200);
		expect(await (await harness.friend(`/api/groups/${group.id}/feed?date=2026-09-02`)).json()).toMatchObject({
			tasks: [expect.objectContaining({ id: groupTask.id, reactions: [] })],
		});
	});

	test("reads and updates the signed-in profile and settings", async () => {
		const profile = await harness.friend("/api/profile", {
			method: "PATCH",
			body: { name: "새 친구", image: "https://example.test/friend.png" },
		});
		expect(profile.status).toBe(200);
		expect(await profile.json()).toMatchObject({ username: "friend", name: "새 친구" });
		expect((await harness.friend("/api/profile")).status).toBe(200);

		const settings = await harness.friend("/api/settings", {
			method: "PUT",
			body: { theme: "dark", notificationsEnabled: false },
		});
		expect(settings.status).toBe(200);
		expect(await settings.json()).toEqual({ theme: "dark", notificationsEnabled: false });
	});
});

async function createCategory(
	harness: SocialHarness,
	body: { name: string; visibility: "private" | "group"; groupId?: string },
) {
	const response = await harness.demo("/api/categories", {
		method: "POST",
		body: { ...body, color: "#8437FF" },
	});
	expect(response.status).toBe(201);
	return (await response.json()) as { id: string };
}

async function createTask(harness: SocialHarness, categoryId: string, title: string, date: string) {
	const response = await harness.demo("/api/tasks", {
		method: "POST",
		body: { categoryId, title, date },
	});
	expect(response.status).toBe(201);
	return (await response.json()) as { id: string };
}
