export const CHAT_ROOM_HEADER = "x-chat-room-id";
export const CHAT_USER_HEADER = "x-chat-user-id";

const MAX_CLIENT_FRAME_BYTES = 4 * 1024;
const MAX_INTERNAL_FRAME_BYTES = 16 * 1024;
const TYPING_START_INTERVAL_MS = 3_000;
const TYPING_LEASE_MS = 5_000;

export type ChatRoomAttachment = {
	roomId: string;
	userId: string;
};

export type RealtimeClientFrame = { v: 1; type: "typing.start" } | { v: 1; type: "typing.stop" };

export type PersistedChatMessage = {
	id: string;
	roomId: string;
	sequence: number;
	clientMessageId: string;
	sender: { id: string; name: string; image: string | null };
	body: string;
	createdAt: string;
};

export type MessageCreatedEvent = {
	v: 1;
	type: "message.created";
	roomId: string;
	message: PersistedChatMessage;
};

type ChatRoomSocket = WebSocket & {
	serializeAttachment(value: unknown): void;
	deserializeAttachment(): unknown;
};

type DurableObjectContext = {
	acceptWebSocket(socket: WebSocket, tags?: string[]): void;
	getWebSockets(tag?: string): WebSocket[];
};

type WebSocketPairValue = {
	0: WebSocket;
	1: WebSocket;
};

type WebSocketPairConstructor = new () => WebSocketPairValue;

type UpgradeResponseInit = ResponseInit & { webSocket: WebSocket };

export type RealtimeFrameParseResult =
	| { ok: true; frame: RealtimeClientFrame }
	| { ok: false; error: "invalid_frame" };

export function parseRealtimeClientFrame(message: string | ArrayBuffer): RealtimeFrameParseResult {
	const raw = decodeFrame(message);
	if (raw === undefined) return { ok: false, error: "invalid_frame" };

	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return { ok: false, error: "invalid_frame" };
	}
	if (
		!isRecord(value) ||
		!hasExactKeys(value, ["v", "type"]) ||
		value.v !== 1 ||
		(value.type !== "typing.start" && value.type !== "typing.stop")
	) {
		return { ok: false, error: "invalid_frame" };
	}
	return { ok: true, frame: { v: 1, type: value.type } };
}

export function parseChatRoomAttachment(value: unknown): ChatRoomAttachment | undefined {
	if (
		!isRecord(value) ||
		!hasExactKeys(value, ["roomId", "userId"]) ||
		!isNonEmptyString(value.roomId) ||
		!isNonEmptyString(value.userId)
	) {
		return undefined;
	}
	return { roomId: value.roomId, userId: value.userId };
}

export function connectionCountsFromAttachments(
	attachments: Iterable<unknown>,
): Map<string, number> {
	const counts = new Map<string, number>();
	for (const value of attachments) {
		const attachment = parseChatRoomAttachment(value);
		if (!attachment) continue;
		counts.set(attachment.userId, (counts.get(attachment.userId) ?? 0) + 1);
	}
	return counts;
}

/**
 * Per-room hibernating WebSocket coordinator. Persistent messages enter only
 * through the trusted Worker's /publish call; browser sockets are typing-only.
 */
export class ChatRoom {
	private readonly sockets = new Set<ChatRoomSocket>();
	private readonly removedSockets = new WeakSet<ChatRoomSocket>();
	private readonly connectionCounts = new Map<string, number>();
	private readonly lastTypingStart = new Map<string, number>();
	private readonly typingUsers = new Set<string>();
	private roomId: string | undefined;

	constructor(private readonly ctx: DurableObjectContext) {
		for (const rawSocket of ctx.getWebSockets()) {
			const socket = rawSocket as ChatRoomSocket;
			const attachment = safeAttachment(socket);
			if (!attachment || (this.roomId !== undefined && this.roomId !== attachment.roomId)) {
				safeClose(socket, 1008, "protocol-error");
				continue;
			}
			this.roomId = attachment.roomId;
			this.sockets.add(socket);
			this.connectionCounts.set(
				attachment.userId,
				(this.connectionCounts.get(attachment.userId) ?? 0) + 1,
			);
		}
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (request.method === "GET" && request.headers.get("upgrade")?.toLowerCase() === "websocket") {
			return this.connect(request);
		}
		if (request.method === "POST" && url.pathname.endsWith("/publish")) {
			return this.publish(request);
		}
		if (request.method === "POST" && url.pathname.endsWith("/revoke")) {
			return this.revoke(request);
		}
		return Response.json({ error: "not_found" }, { status: 404 });
	}

	webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
		const chatSocket = socket as ChatRoomSocket;
		const attachment = safeAttachment(chatSocket);
		const parsed = parseRealtimeClientFrame(message);
		if (!attachment || attachment.roomId !== this.roomId || !parsed.ok) {
			this.rejectSocket(chatSocket);
			return;
		}

		if (parsed.frame.type === "typing.start") {
			this.startTyping(attachment.userId, Date.now());
		} else {
			this.stopTyping(attachment.userId);
		}
	}

	webSocketClose(socket: WebSocket, code: number, reason: string): void {
		const chatSocket = socket as ChatRoomSocket;
		this.removeSocket(chatSocket, true);
		safeClose(chatSocket, code, reason);
	}

	webSocketError(socket: WebSocket): void {
		this.removeSocket(socket as ChatRoomSocket, true);
	}

	private connect(request: Request): Response {
		if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
			return Response.json({ error: "upgrade_required" }, { status: 426 });
		}
		const roomId = request.headers.get(CHAT_ROOM_HEADER);
		const userId = request.headers.get(CHAT_USER_HEADER);
		if (!isNonEmptyString(roomId) || !isNonEmptyString(userId)) {
			return Response.json({ error: "invalid_identity" }, { status: 400 });
		}
		if (this.roomId !== undefined && this.roomId !== roomId) {
			return Response.json({ error: "room_mismatch" }, { status: 409 });
		}

		const Pair = (globalThis as typeof globalThis & { WebSocketPair: WebSocketPairConstructor })
			.WebSocketPair;
		const pair = new Pair();
		const client = pair[0];
		const server = pair[1] as ChatRoomSocket;
		const wasOffline = (this.connectionCounts.get(userId) ?? 0) === 0;

		server.serializeAttachment({ roomId, userId } satisfies ChatRoomAttachment);
		this.ctx.acceptWebSocket(server, [userId]);
		this.roomId = roomId;
		this.sockets.add(server);
		this.connectionCounts.set(userId, (this.connectionCounts.get(userId) ?? 0) + 1);

		const readySent = this.send(server, {
			v: 1,
			type: "chat.ready",
			roomId,
			onlineUserIds: [...this.connectionCounts.keys()].sort(),
		});
		if (wasOffline && readySent) {
			this.broadcast({ v: 1, type: "presence.changed", roomId, userId, status: "online" }, server);
		}

		return new Response(null, { status: 101, webSocket: client } as UpgradeResponseInit);
	}

	private async publish(request: Request): Promise<Response> {
		const raw = await readBoundedBody(request, MAX_INTERNAL_FRAME_BYTES);
		const value = parseJson(raw);
		const event = parsePublishedMessage(value, request.headers.get(CHAT_ROOM_HEADER));
		if (!event || (this.roomId !== undefined && event.roomId !== this.roomId)) {
			return Response.json({ error: "invalid_event" }, { status: 400 });
		}
		this.roomId = event.roomId;
		this.broadcast(event);
		return new Response(null, { status: 204 });
	}

	private async revoke(request: Request): Promise<Response> {
		const raw = await readBoundedBody(request, MAX_INTERNAL_FRAME_BYTES);
		const value = parseJson(raw);
		if (!isRecord(value) || !hasExactKeys(value, ["userId"]) || !isNonEmptyString(value.userId)) {
			return Response.json({ error: "invalid_revoke" }, { status: 400 });
		}
		for (const rawSocket of [...this.ctx.getWebSockets(value.userId)]) {
			const socket = rawSocket as ChatRoomSocket;
			this.removeSocket(socket, true);
			safeClose(socket, 4003, "membership-revoked");
		}
		return new Response(null, { status: 204 });
	}

	private startTyping(userId: string, now: number): void {
		const previous = this.lastTypingStart.get(userId);
		if (previous !== undefined && now - previous < TYPING_START_INTERVAL_MS) return;
		this.lastTypingStart.set(userId, now);
		this.typingUsers.add(userId);
		this.broadcast({
			v: 1,
			type: "typing.changed",
			roomId: this.requiredRoomId(),
			userId,
			isTyping: true,
			expiresAt: new Date(now + TYPING_LEASE_MS).toISOString(),
		});
	}

	private stopTyping(userId: string): void {
		this.lastTypingStart.delete(userId);
		if (!this.typingUsers.delete(userId)) return;
		this.broadcast({
			v: 1,
			type: "typing.changed",
			roomId: this.requiredRoomId(),
			userId,
			isTyping: false,
			expiresAt: new Date(0).toISOString(),
		});
	}

	private rejectSocket(socket: ChatRoomSocket): void {
		this.removeSocket(socket, true);
		safeClose(socket, 1008, "protocol-error");
	}

	private removeSocket(socket: ChatRoomSocket, emitTransitions: boolean): void {
		if (this.removedSockets.has(socket)) return;
		this.removedSockets.add(socket);
		this.sockets.delete(socket);
		const attachment = safeAttachment(socket);
		if (!attachment) return;

		const count = this.connectionCounts.get(attachment.userId) ?? 0;
		if (count > 1) {
			this.connectionCounts.set(attachment.userId, count - 1);
			return;
		}
		this.connectionCounts.delete(attachment.userId);
		this.lastTypingStart.delete(attachment.userId);
		const wasTyping = this.typingUsers.delete(attachment.userId);
		if (!emitTransitions || this.roomId === undefined) return;
		if (wasTyping) {
			this.broadcast({
				v: 1,
				type: "typing.changed",
				roomId: this.roomId,
				userId: attachment.userId,
				isTyping: false,
				expiresAt: new Date(0).toISOString(),
			});
		}
		this.broadcast({
			v: 1,
			type: "presence.changed",
			roomId: this.roomId,
			userId: attachment.userId,
			status: "offline",
		});
	}

	private broadcast(event: unknown, excluded?: ChatRoomSocket): void {
		const payload = JSON.stringify(event);
		for (const socket of [...this.sockets]) {
			if (socket === excluded) continue;
			this.send(socket, payload);
		}
	}

	private send(socket: ChatRoomSocket, event: unknown): boolean {
		try {
			socket.send(typeof event === "string" ? event : JSON.stringify(event));
			return true;
		} catch {
			this.removeSocket(socket, true);
			safeClose(socket, 1011, "send-failed");
			return false;
		}
	}

	private requiredRoomId(): string {
		if (this.roomId === undefined) throw new Error("Chat room identity is not initialized");
		return this.roomId;
	}
}

export function parsePublishedMessage(
	value: unknown,
	headerRoomId: string | null,
): MessageCreatedEvent | undefined {
	if (!isRecord(value)) return undefined;
	let roomId: unknown;
	let message: unknown;
	if (hasExactKeys(value, ["type", "message"]) && value.type === "message.created") {
		roomId = headerRoomId;
		message = value.message;
	} else if (
		hasExactKeys(value, ["v", "type", "roomId", "message"]) &&
		value.v === 1 &&
		value.type === "message.created"
	) {
		roomId = value.roomId;
		message = value.message;
	} else {
		return undefined;
	}
	if (!isNonEmptyString(roomId) || !isPersistedMessage(message) || message.roomId !== roomId) {
		return undefined;
	}
	return { v: 1, type: "message.created", roomId, message };
}

function isPersistedMessage(value: unknown): value is PersistedChatMessage {
	if (
		!isRecord(value) ||
		!hasExactKeys(value, [
			"id",
			"roomId",
			"sequence",
			"clientMessageId",
			"sender",
			"body",
			"createdAt",
		]) ||
		!isNonEmptyString(value.id) ||
		!isNonEmptyString(value.roomId) ||
		!Number.isSafeInteger(value.sequence) ||
		(value.sequence as number) <= 0 ||
		!isNonEmptyString(value.clientMessageId) ||
		!isNonEmptyString(value.body) ||
		!isNonEmptyString(value.createdAt) ||
		!isRecord(value.sender) ||
		!hasExactKeys(value.sender, ["id", "name", "image"]) ||
		!isNonEmptyString(value.sender.id) ||
		typeof value.sender.name !== "string" ||
		(value.sender.image !== null && typeof value.sender.image !== "string")
	) {
		return false;
	}
	return true;
}

function safeAttachment(socket: ChatRoomSocket): ChatRoomAttachment | undefined {
	try {
		return parseChatRoomAttachment(socket.deserializeAttachment());
	} catch {
		return undefined;
	}
}

function safeClose(socket: WebSocket, code: number, reason: string): void {
	try {
		socket.close(code, reason);
	} catch {
		// A peer may already have completed the close handshake.
	}
}

function decodeFrame(message: string | ArrayBuffer): string | undefined {
	if (typeof message === "string") {
		return new TextEncoder().encode(message).byteLength <= MAX_CLIENT_FRAME_BYTES
			? message
			: undefined;
	}
	if (message.byteLength > MAX_CLIENT_FRAME_BYTES) return undefined;
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(message);
	} catch {
		return undefined;
	}
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<string | undefined> {
	const body = await request.arrayBuffer();
	if (body.byteLength > maxBytes) return undefined;
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(body);
	} catch {
		return undefined;
	}
}

function parseJson(raw: string | undefined): unknown {
	if (raw === undefined) return undefined;
	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
	const actual = Object.keys(value);
	return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
