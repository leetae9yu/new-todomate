import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.APP_URL;
const adminPassword = process.env.ADMIN_PASSWORD;
const friendPassword = process.env.FRIEND_PASSWORD;
const evidenceDirectory = process.env.EVIDENCE_DIR ?? ".omo/evidence/chat";
if (!baseURL || !adminPassword || !friendPassword) {
	throw new Error("APP_URL, ADMIN_PASSWORD and FRIEND_PASSWORD are required");
}

await mkdir(evidenceDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const adminContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const friendContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const log = [];

async function login(context, username, password) {
	const page = await context.newPage();
	page.on("websocket", (socket) => {
		socket.on("framereceived", (event) => {
			log.push({
				action: "ws-received",
				username,
				payload: String(event.payload).slice(0, 2_000),
			});
		});
		socket.on("framesent", (event) => {
			log.push({
				action: "ws-sent",
				username,
				payload: String(event.payload).slice(0, 2_000),
			});
		});
	});
	page.on("response", async (response) => {
		if (response.request().method() !== "POST" || !response.url().includes("/api/chat/rooms/")) {
			return;
		}
		log.push({
			action: "chat-post-response",
			username,
			url: response.url(),
			status: response.status(),
			body: await response.text().catch(() => ""),
		});
	});
	await page.goto(baseURL, { waitUntil: "networkidle" });
	await page.locator("#login-username").fill(username);
	await page.locator("#login-password").fill(password);
	await page.getByRole("button", { name: "로그인", exact: true }).click();
	await page.locator(".shell").waitFor({ timeout: 15_000 });
	log.push({ action: "login", username, verdict: "passed" });
	return page;
}

async function json(page, path, init = {}) {
	return page.evaluate(
		async ({ path: target, init: options }) => {
			const response = await fetch(target, {
				credentials: "same-origin",
				...options,
				headers: { "content-type": "application/json", ...(options.headers ?? {}) },
			});
			const text = response.status === 204 ? "" : await response.text();
			let body = null;
			if (text) {
				try {
					body = JSON.parse(text);
				} catch {
					body = text;
				}
			}
			return { status: response.status, body };
		},
		{ path, init },
	);
}

async function openRoom(page, roomName) {
	await page.getByRole("button", { name: "친구 피드" }).click();
	await page.getByRole("tab", { name: "채팅", exact: true }).click();
	const room = page.locator(".chat-room-button").filter({ hasText: roomName }).first();
	await room.waitFor({ timeout: 15_000 });
	await room.click();
	await page.getByRole("textbox", { name: `${roomName}에 메시지 보내기` }).waitFor();
}

async function waitForRealtime(page) {
	await expect(page.locator(".chat-thread__identity")).toContainText("온라인", {
		timeout: 10_000,
	});
}

async function rejectedSocket(page, roomId) {
	return page.evaluate(
		({ roomId: id }) =>
			new Promise((resolve) => {
				const protocol = location.protocol === "https:" ? "wss:" : "ws:";
				const socket = new WebSocket(
					`${protocol}//${location.host}/api/chat/rooms/${encodeURIComponent(id)}/live`,
				);
				const timeout = window.setTimeout(() => {
					socket.close();
					resolve("timeout");
				}, 5_000);
				socket.addEventListener("open", () => {
					window.clearTimeout(timeout);
					socket.close();
					resolve("opened");
				});
				socket.addEventListener("error", () => {
					window.clearTimeout(timeout);
					resolve("rejected");
				});
			}),
		{ roomId },
	);
}

try {
	const admin = await login(adminContext, "admin", adminPassword);
	const friend = await login(friendContext, "friend", friendPassword);
	const suffix = Date.now().toString().slice(-6);
	const groupName = `실시간 QA ${suffix}`;

	const group = await json(admin, "/api/groups", {
		method: "POST",
		body: JSON.stringify({ name: groupName }),
	});
	expect(group.status).toBe(201);
	const groupId = group.body.id;
	const invite = await json(admin, `/api/groups/${groupId}/invites`, { method: "POST" });
	expect(invite.status).toBe(201);
	const accepted = await json(friend, `/api/invites/${invite.body.token}/respond`, {
		method: "POST",
		body: JSON.stringify({ accept: true }),
	});
	expect(accepted.status).toBe(200);
	const members = await json(admin, `/api/groups/${groupId}/members`);
	const friendMember = members.body.find((member) => member.username === "friend");
	expect(friendMember).toBeTruthy();
	const [adminRooms, friendRooms] = await Promise.all([
		json(admin, "/api/chat/rooms"),
		json(friend, "/api/chat/rooms"),
	]);
	expect(adminRooms.status).toBe(200);
	expect(friendRooms.status).toBe(200);
	expect(adminRooms.body.rooms.some((room) => room.id === `group:${groupId}`)).toBe(true);
	expect(friendRooms.body.rooms.some((room) => room.id === `group:${groupId}`)).toBe(true);
	log.push({ action: "group-ready", groupId, groupName, verdict: "passed" });

	await Promise.all([
		admin.reload({ waitUntil: "networkidle" }),
		friend.reload({ waitUntil: "networkidle" }),
	]);
	await Promise.all([openRoom(admin, groupName), openRoom(friend, groupName)]);
	await Promise.all([waitForRealtime(admin), waitForRealtime(friend)]);
	const adminComposer = admin.getByRole("textbox", { name: `${groupName}에 메시지 보내기` });
	await adminComposer.fill("입력 중 확인");
	await expect(friend.getByText("관리자님이 입력 중...", { exact: true })).toBeVisible({
		timeout: 10_000,
	});
	log.push({ action: "group-typing", verdict: "passed" });

	const groupMessage = `그룹 실시간 메시지 ${suffix}`;
	await adminComposer.fill(groupMessage);
	const groupPost = admin.waitForResponse(
		(response) =>
			response.request().method() === "POST" &&
			response.url().includes(`/api/chat/rooms/${encodeURIComponent(`group:${groupId}`)}/messages`),
	);
	await adminComposer.press("Enter");
	expect((await groupPost).status()).toBe(201);
	const groupHistory = await json(friend, `/api/chat/rooms/${encodeURIComponent(`group:${groupId}`)}/messages`);
	log.push({
		action: "group-history-after-send",
		status: groupHistory.status,
		messages: groupHistory.body?.messages,
	});
	await expect(friend.locator(".chat-message").filter({ hasText: groupMessage })).toBeVisible({
		timeout: 10_000,
	});
	log.push({ action: "group-message", body: groupMessage, verdict: "passed" });

	const dm = await json(admin, "/api/chat/dms", {
		method: "POST",
		body: JSON.stringify({ participantId: friendMember.id }),
	});
	expect(dm.status).toBe(201);
	await Promise.all([admin.reload({ waitUntil: "networkidle" }), friend.reload({ waitUntil: "networkidle" })]);
	await Promise.all([openRoom(admin, "친구"), openRoom(friend, "관리자")]);
	await Promise.all([waitForRealtime(admin), waitForRealtime(friend)]);
	const friendComposer = friend.getByRole("textbox", { name: "관리자에 메시지 보내기" });
	await friendComposer.fill("DM 입력 확인");
	await expect(admin.getByText("친구님이 입력 중...", { exact: true })).toBeVisible({
		timeout: 10_000,
	});
	const dmMessage = `DM 실시간 메시지 ${suffix}`;
	await friendComposer.fill(dmMessage);
	const dmPost = friend.waitForResponse(
		(response) =>
			response.request().method() === "POST" &&
			response.url().includes(`/api/chat/rooms/${encodeURIComponent(dm.body.id)}/messages`),
	);
	await friendComposer.press("Enter");
	expect((await dmPost).status()).toBe(201);
	await expect(admin.locator(".chat-message").filter({ hasText: dmMessage })).toBeVisible({
		timeout: 10_000,
	});
	log.push({ action: "dm-message-and-typing", roomId: dm.body.id, verdict: "passed" });

	await admin.getByRole("button", { name: "대화 목록" }).click();
	const secondDmMessage = `안 읽음 확인 ${suffix}`;
	await friendComposer.fill(secondDmMessage);
	const unreadPost = friend.waitForResponse(
		(response) =>
			response.request().method() === "POST" &&
			response.url().includes(`/api/chat/rooms/${encodeURIComponent(dm.body.id)}/messages`),
	);
	await friendComposer.press("Enter");
	expect((await unreadPost).status()).toBe(201);
	const roomsBeforeRead = await json(admin, "/api/chat/rooms");
	const unreadRoom = roomsBeforeRead.body.rooms.find((room) => room.id === dm.body.id);
	expect(unreadRoom.unreadCount).toBeGreaterThan(0);
	await json(admin, `/api/chat/rooms/${encodeURIComponent(dm.body.id)}/read`, {
		method: "PATCH",
		body: JSON.stringify({ throughSequence: unreadRoom.lastMessage.sequence }),
	});
	const roomsAfterRead = await json(admin, "/api/chat/rooms");
	expect(roomsAfterRead.body.rooms.find((room) => room.id === dm.body.id).unreadCount).toBe(0);
	log.push({ action: "unread-read", verdict: "passed" });

	const privateGroup = await json(admin, "/api/groups", {
		method: "POST",
		body: JSON.stringify({ name: `관리자 전용 ${suffix}` }),
	});
	expect(privateGroup.status).toBe(201);
	const privateRoomId = `group:${privateGroup.body.id}`;
	const deniedHistory = await json(friend, `/api/chat/rooms/${encodeURIComponent(privateRoomId)}/messages`);
	expect(deniedHistory.status).toBe(404);
	expect(await rejectedSocket(friend, privateRoomId)).toBe("rejected");
	log.push({ action: "cross-room-denied", verdict: "passed" });

	await Promise.all([
		admin.screenshot({ path: `${evidenceDirectory}/admin-chat.png`, fullPage: false }),
		friend.screenshot({ path: `${evidenceDirectory}/friend-chat.png`, fullPage: false }),
	]);
	console.log("PASS live group chat, DM, typing, unread/read, and cross-room denial");
} finally {
	await adminContext.close();
	await friendContext.close();
	await browser.close();
	log.push({ action: "cleanup", contexts: 0, browserClosed: true });
	await Bun.write(`${evidenceDirectory}/result.json`, `${JSON.stringify(log, null, 2)}\n`);
}
