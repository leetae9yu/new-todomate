import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSocialTestApp } from "./helpers/social-test-app";

type SocialHarness = Awaited<ReturnType<typeof createSocialTestApp>>;
type Member = { id: string; username: string; name: string; role: string };
type Room = {
	id: string;
	kind: "group" | "dm";
	groupId?: string;
	title: string;
	members: Array<{ id: string; name: string; image: string | null }>;
	lastMessage: { sequence: number; body: string } | null;
	lastMessageAt: string | null;
	joinedSequence: number;
	lastReadSequence: number;
	unreadCount: number;
};

type Message = {
	id: string;
	roomId: string;
	sequence: number;
	clientMessageId: string;
	body: string;
	sender: { id: string; name: string; image: string | null };
	createdAt: string;
};

const firstMessageId = "00000000-0000-4000-8000-000000000001";
const secondMessageId = "00000000-0000-4000-8000-000000000002";

describe("authorized durable chat HTTP API", () => {
	let harness: SocialHarness;

	beforeAll(async () => {
		harness = await createSocialTestApp();
	}, 20_000);

	afterAll(async () => {
		await harness.close();
	}, 20_000);

	test("creates exactly one automatic room for a private group", async () => {
		const group = await createGroup(harness, "자동 채팅방");
		const owner = await memberNamed(harness, group.id, "demo");

		const response = await harness.demo("/api/chat/rooms");
		expect(response.status).toBe(200);
		const payload = (await response.json()) as { rooms: Room[] };
		expect(payload.rooms).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: `group:${group.id}`,
					kind: "group",
					groupId: group.id,
					title: "자동 채팅방",
					members: [expect.objectContaining({ id: owner.id, name: "데모" })],
					lastMessage: null,
					lastMessageAt: null,
					joinedSequence: 0,
					lastReadSequence: 0,
					unreadCount: 0,
				}),
			]),
		);
	});

	test("returns an indistinguishable JSON 404 to a group outsider", async () => {
		const group = await createGroup(harness, "비공개 대화");

		const response = await harness.friend(`/api/chat/rooms/group:${group.id}/messages`);
		expect(response.status).toBe(404);
		expect(response.headers.get("content-type")).toContain("application/json");
		expect(await response.json()).toEqual({ error: { code: "NOT_FOUND" } });
	});

	test("creates one canonical DM only after users share a private group and is idempotent", async () => {
		const group = await createGroup(harness, "DM 권한");
		const demo = await memberNamed(harness, group.id, "demo");

		const forbidden = await harness.demo("/api/chat/dms", {
			method: "POST",
			body: { participantId: await friendId(harness) },
		});
		expect(forbidden.status).toBe(403);
		expect(await forbidden.json()).toEqual({ error: { code: "FORBIDDEN" } });

		await inviteFriend(harness, group.id);
		const friend = await memberNamed(harness, group.id, "friend");
		const canonicalId = `dm:${[demo.id, friend.id].sort().join(":")}`;

		const created = await harness.demo("/api/chat/dms", {
			method: "POST",
			body: { participantId: friend.id },
		});
		expect(created.status).toBe(201);
		expect((await created.json()) as Room).toMatchObject({
			id: canonicalId,
			kind: "dm",
			title: "친구",
			members: [expect.objectContaining({ id: friend.id, name: "친구" })],
		});

		const oppositeDirection = await harness.friend("/api/chat/dms", {
			method: "POST",
			body: { participantId: demo.id },
		});
		expect(oppositeDirection.status).toBe(200);
		expect((await oppositeDirection.json()) as Room).toMatchObject({ id: canonicalId, kind: "dm" });

		const duplicate = await harness.demo("/api/chat/dms", {
			method: "POST",
			body: { participantId: friend.id },
		});
		expect(duplicate.status).toBe(200);
		expect((await duplicate.json()) as Room).toMatchObject({ id: canonicalId, kind: "dm" });
	});

	test("persists ordered messages, tracks unread counts, and advances a monotonic read cursor", async () => {
		const group = await createGroup(harness, "메시지 순서");
		const demo = await memberNamed(harness, group.id, "demo");
		await inviteFriend(harness, group.id);
		const friend = await memberNamed(harness, group.id, "friend");
		const roomId = `dm:${[demo.id, friend.id].sort().join(":")}`;

		const room = await harness.demo("/api/chat/dms", {
			method: "POST",
			body: { participantId: friend.id },
		});
		expect(room.status).toBe(201);

		const first = await harness.demo(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
			method: "POST",
			body: { clientMessageId: firstMessageId, body: "첫 번째 메시지" },
		});
		expect(first.status).toBe(201);
		expect((await first.json()) as Message).toMatchObject({
			roomId,
			sequence: 1,
			clientMessageId: firstMessageId,
			body: "첫 번째 메시지",
			sender: { id: demo.id, name: "데모" },
			createdAt: expect.any(String),
		});

		const second = await harness.demo(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
			method: "POST",
			body: { clientMessageId: secondMessageId, body: "두 번째 메시지" },
		});
		expect(second.status).toBe(201);
		expect((await second.json()) as Message).toMatchObject({ sequence: 2, body: "두 번째 메시지" });

		const history = await harness.friend(
			`/api/chat/rooms/${encodeURIComponent(roomId)}/messages?limit=50`,
		);
		expect(history.status).toBe(200);
		expect(await history.json()).toMatchObject({
			messages: [
				expect.objectContaining({ sequence: 1, body: "첫 번째 메시지" }),
				expect.objectContaining({ sequence: 2, body: "두 번째 메시지" }),
			],
			joinedSequence: 0,
			latestSequence: 2,
			hasOlder: false,
			hasNewer: false,
		});

		const unreadRooms = await harness.friend("/api/chat/rooms");
		expect(unreadRooms.status).toBe(200);
		const unreadRoomList = ((await unreadRooms.json()) as { rooms: Room[] }).rooms;
		expect(unreadRoomList.find((candidate) => candidate.id === roomId)).toMatchObject({
			id: roomId,
			unreadCount: 2,
			lastReadSequence: 0,
		});

		const read = await harness.friend(`/api/chat/rooms/${encodeURIComponent(roomId)}/read`, {
			method: "PATCH",
			body: { throughSequence: 2 },
		});
		expect(read.status).toBe(200);
		expect(await read.json()).toEqual({ roomId, lastReadSequence: 2, unreadCount: 0 });

		const staleRead = await harness.friend(`/api/chat/rooms/${encodeURIComponent(roomId)}/read`, {
			method: "PATCH",
			body: { throughSequence: 1 },
		});
		expect(staleRead.status).toBe(200);
		expect(await staleRead.json()).toEqual({ roomId, lastReadSequence: 2, unreadCount: 0 });
	});

	test("revokes removed members from their group room while retaining the DM", async () => {
		const group = await createGroup(harness, "제거 권한");
		const demo = await memberNamed(harness, group.id, "demo");
		await inviteFriend(harness, group.id);
		const friend = await memberNamed(harness, group.id, "friend");
		const dmId = `dm:${[demo.id, friend.id].sort().join(":")}`;

		const dm = await harness.demo("/api/chat/dms", {
			method: "POST",
			body: { participantId: friend.id },
		});
		expect(dm.status).toBe(201);

		const removed = await harness.demo(`/api/groups/${group.id}/members/${friend.id}`, {
			method: "DELETE",
		});
		expect(removed.status).toBe(204);

		const revokedHistory = await harness.friend(
			`/api/chat/rooms/${encodeURIComponent(`group:${group.id}`)}/messages`,
		);
		expect(revokedHistory.status).toBe(404);
		expect(revokedHistory.headers.get("content-type")).toContain("application/json");
		expect(await revokedHistory.json()).toEqual({ error: { code: "NOT_FOUND" } });

		const retainedDm = await harness.friend(`/api/chat/rooms/${encodeURIComponent(dmId)}/messages`);
		expect(retainedDm.status).toBe(200);
	});
});

async function createGroup(harness: SocialHarness, name: string) {
	const response = await harness.demo("/api/groups", { method: "POST", body: { name } });
	expect(response.status).toBe(201);
	return (await response.json()) as { id: string; name: string; role: "owner" };
}

async function inviteFriend(harness: SocialHarness, groupId: string) {
	const invite = await harness.demo(`/api/groups/${groupId}/invites`, { method: "POST" });
	expect(invite.status).toBe(201);
	const { token } = (await invite.json()) as { token: string };

	const accepted = await harness.friend(`/api/invites/${token}/respond`, {
		method: "POST",
		body: { accept: true },
	});
	expect(accepted.status).toBe(200);
}

async function memberNamed(harness: SocialHarness, groupId: string, username: string) {
	const response = await harness.demo(`/api/groups/${groupId}/members`);
	expect(response.status).toBe(200);
	const member = ((await response.json()) as Member[]).find(
		(candidate) => candidate.username === username,
	);
	expect(member).toBeDefined();
	return member as Member;
}

async function friendId(harness: SocialHarness) {
	const response = await harness.friend("/api/profile");
	expect(response.status).toBe(200);
	return ((await response.json()) as { id: string }).id;
}
