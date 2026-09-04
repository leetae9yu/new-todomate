import { describe, expect, test } from "bun:test";
import { createSocialTestApp } from "./helpers/social-test-app";

describe("invitation-code onboarding", () => {
	test("reserves at most three active invitation codes per account", async () => {
		const harness = await createSocialTestApp();
		try {
			const group = await createGroup(harness, "세 명 초대");
			const initial = await harness.demo("/api/invitations");
			expect(initial.status).toBe(200);
			expect(await initial.json()).toMatchObject({ limit: 3, remaining: 3, invitations: [] });

			const responses = await Promise.all(
				Array.from({ length: 4 }, () =>
					harness.demo(`/api/groups/${group.id}/invites`, {
						method: "POST",
					}),
				),
			);
			expect(responses.map(({ status }) => status).sort()).toEqual([201, 201, 201, 409]);
			const accepted = responses.filter(({ status }) => status === 201);
			for (const response of accepted) {
				expect(await response.json()).toMatchObject({
					token: expect.any(String),
					expiresAt: expect.any(String),
				});
			}
			const summary = await harness.demo("/api/invitations");
			expect(await summary.json()).toMatchObject({ limit: 3, remaining: 0 });
			const blocked = responses.find(({ status }) => status === 409);
			expect(blocked).toBeDefined();
			if (blocked) {
				expect(await blocked.json()).toEqual({ error: { code: "INVITE_LIMIT_REACHED" } });
			}
		} finally {
			await harness.close();
		}
	}, 20_000);

	test("creates an active account and group membership from one invitation", async () => {
		const harness = await createSocialTestApp();
		try {
			const group = await createGroup(harness, "가입 초대");
			const invitation = await createInvitation(harness, group.id);
			const preview = await harness.request("/api/invitations/preview", {
				method: "POST",
				body: { code: invitation.token },
			});
			expect(preview.status).toBe(200);
			expect(await preview.json()).toMatchObject({
				group: { id: group.id, name: "가입 초대" },
				inviter: { name: "데모" },
				expiresAt: expect.any(String),
			});

			const collision = await harness.request("/api/invitations/signup", {
				method: "POST",
				body: {
					code: invitation.token,
					username: "demo",
					password: "invited-pass",
					name: "중복 아이디",
				},
			});
			expect(collision.status).toBe(409);
			const signup = await harness.request("/api/invitations/signup", {
				method: "POST",
				body: {
					code: invitation.token,
					username: "invited_one",
					password: "invited-pass",
					name: "초대된 친구",
				},
			});
			expect(signup.status).toBe(201);
			const setCookie = signup.headers.get("set-cookie");
			expect(setCookie).toContain("HttpOnly");
			expect(setCookie).toContain("Secure");
			expect(setCookie).toContain("SameSite=Lax");
			const cookie = setCookie?.split(";")[0];
			expect(cookie).toBeTruthy();
			const invited = harness.withCookie(cookie ?? "");
			expect(await (await invited("/api/auth/get-session")).json()).toMatchObject({
				user: { username: "invited_one", name: "초대된 친구", status: "active" },
			});
			expect(await (await invited("/api/groups")).json()).toMatchObject({
				groups: [expect.objectContaining({ id: group.id, role: "member" })],
			});
			expect(
				(
					await harness.request("/api/invitations/preview", {
						method: "POST",
						body: { code: invitation.token },
					})
				).status,
			).toBe(404);
		} finally {
			await harness.close();
		}
	}, 20_000);

	test("allows only one concurrent account claim per invitation", async () => {
		const harness = await createSocialTestApp();
		try {
			const group = await createGroup(harness, "동시 가입");
			const invitation = await createInvitation(harness, group.id);
			const attempts = await Promise.all(
				["claim_one", "claim_two"].map((username) =>
					harness.request("/api/invitations/signup", {
						method: "POST",
						body: {
							code: invitation.token,
							username,
							password: "invited-pass",
							name: username,
						},
					}),
				),
			);

			expect(attempts.map(({ status }) => status).sort()).toEqual([201, 404]);
			const members = await harness.demo(`/api/groups/${group.id}/members`);
			const memberRows = (await members.json()) as Array<{ username: string }>;
			expect(memberRows.filter(({ username }) => username.startsWith("claim_"))).toHaveLength(1);
		} finally {
			await harness.close();
		}
	}, 20_000);

	test("lets a newly invited member issue three invitations immediately", async () => {
		const harness = await createSocialTestApp();
		try {
			const group = await createGroup(harness, "연쇄 초대");
			const firstInvitation = await createInvitation(harness, group.id);
			const signup = await harness.request("/api/invitations/signup", {
				method: "POST",
				body: {
					code: firstInvitation.token,
					username: "invited_two",
					password: "invited-pass",
					name: "바로 초대하는 친구",
				},
			});
			expect(signup.status).toBe(201);
			const cookie = signup.headers.get("set-cookie")?.split(";")[0];
			expect(cookie).toBeTruthy();
			const invited = harness.withCookie(cookie ?? "");

			const invitation = await invited(`/api/groups/${group.id}/invites`, {
				method: "POST",
			});
			expect(invitation.status).toBe(201);
			expect(await invitation.json()).toMatchObject({
				token: expect.any(String),
				remaining: 2,
			});
		} finally {
			await harness.close();
		}
	}, 20_000);
});

type InvitationHarness = Awaited<ReturnType<typeof createSocialTestApp>>;

async function createGroup(harness: InvitationHarness, name: string) {
	const response = await harness.demo("/api/groups", {
		method: "POST",
		body: { name },
	});
	expect(response.status).toBe(201);
	return (await response.json()) as { id: string };
}

async function createInvitation(harness: InvitationHarness, groupId: string) {
	const response = await harness.demo(`/api/groups/${groupId}/invites`, {
		method: "POST",
	});
	expect(response.status).toBe(201);
	return (await response.json()) as { token: string };
}
