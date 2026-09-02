import { requestJson } from "./planner";

export type ChatContact = {
	id: string;
	name: string;
	image: string | null;
};

export type ChatMessage = {
	id: string;
	roomId: string;
	sequence: number;
	clientMessageId: string;
	body: string;
	sender: ChatContact;
	createdAt: string;
};

export type ChatRoom = {
	id: string;
	kind: "group" | "dm";
	groupId?: string;
	title: string;
	members: ChatContact[];
	lastMessage: ChatMessage | null;
	lastMessageAt: string | null;
	joinedSequence: number;
	lastReadSequence: number;
	unreadCount: number;
};

export type ChatMessagePage = {
	messages: ChatMessage[];
	joinedSequence: number;
	latestSequence: number;
	hasOlder: boolean;
	hasNewer: boolean;
};

export type ChatReadUpdate = {
	roomId: string;
	lastReadSequence: number;
	unreadCount: number;
};

export type ChatServerEvent =
	| {
			v: 1;
			type: "chat.ready";
			roomId: string;
			onlineUserIds: string[];
	  }
	| {
			v: 1;
			type: "presence.changed";
			roomId: string;
			userId: string;
			status: "online" | "offline";
	  }
	| {
			v: 1;
			type: "typing.changed";
			roomId: string;
			userId: string;
			isTyping: boolean;
			expiresAt: string;
	  }
	| {
			v: 1;
			type: "message.created";
			roomId: string;
			message: ChatMessage;
	  };

export type ChatClientFrame = { v: 1; type: "typing.start" | "typing.stop" };

export const chatApi = {
	contacts: () => requestJson<{ contacts: ChatContact[] }>("/api/chat/contacts"),
	rooms: () => requestJson<{ rooms: ChatRoom[] }>("/api/chat/rooms"),
	createDm: (participantId: string) =>
		requestJson<ChatRoom>("/api/chat/dms", {
			method: "POST",
			body: JSON.stringify({ participantId }),
		}),
	messages: (
		roomId: string,
		page: { limit?: number; beforeSequence?: number; afterSequence?: number } = {},
		signal?: AbortSignal,
	) => {
		const params = new URLSearchParams();
		if (page.limit !== undefined) params.set("limit", String(page.limit));
		if (page.beforeSequence !== undefined) {
			params.set("beforeSequence", String(page.beforeSequence));
		}
		if (page.afterSequence !== undefined) {
			params.set("afterSequence", String(page.afterSequence));
		}
		const query = params.size > 0 ? `?${params.toString()}` : "";
		return requestJson<ChatMessagePage>(
			`/api/chat/rooms/${encodeURIComponent(roomId)}/messages${query}`,
			signal ? { signal } : {},
		);
	},
	sendMessage: (roomId: string, body: string, clientMessageId: string) =>
		requestJson<ChatMessage>(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
			method: "POST",
			body: JSON.stringify({ clientMessageId, body }),
		}),
	markRead: (roomId: string, throughSequence: number) =>
		requestJson<ChatReadUpdate>(`/api/chat/rooms/${encodeURIComponent(roomId)}/read`, {
			method: "PATCH",
			body: JSON.stringify({ throughSequence }),
		}),
	liveUrl: (roomId: string) => {
		const url = new URL(`/api/chat/rooms/${encodeURIComponent(roomId)}/live`, window.location.href);
		url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
		return url.toString();
	},
};

export function parseChatServerEvent(raw: unknown): ChatServerEvent | null {
	let value = raw;
	if (typeof raw === "string") {
		try {
			value = JSON.parse(raw);
		} catch {
			return null;
		}
	}
	if (!isRecord(value) || value.v !== 1 || typeof value.roomId !== "string") return null;

	if (
		value.type === "chat.ready" &&
		Array.isArray(value.onlineUserIds) &&
		value.onlineUserIds.every((userId) => typeof userId === "string")
	) {
		return {
			v: 1,
			type: "chat.ready",
			roomId: value.roomId,
			onlineUserIds: value.onlineUserIds,
		};
	}
	if (
		value.type === "presence.changed" &&
		typeof value.userId === "string" &&
		(value.status === "online" || value.status === "offline")
	) {
		return {
			v: 1,
			type: "presence.changed",
			roomId: value.roomId,
			userId: value.userId,
			status: value.status,
		};
	}
	if (
		value.type === "typing.changed" &&
		typeof value.userId === "string" &&
		typeof value.isTyping === "boolean" &&
		typeof value.expiresAt === "string"
	) {
		return {
			v: 1,
			type: "typing.changed",
			roomId: value.roomId,
			userId: value.userId,
			isTyping: value.isTyping,
			expiresAt: value.expiresAt,
		};
	}
	if (value.type === "message.created" && isChatMessage(value.message)) {
		return {
			v: 1,
			type: "message.created",
			roomId: value.roomId,
			message: value.message,
		};
	}
	return null;
}

function isChatMessage(value: unknown): value is ChatMessage {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.roomId === "string" &&
		Number.isSafeInteger(value.sequence) &&
		Number(value.sequence) > 0 &&
		typeof value.clientMessageId === "string" &&
		typeof value.body === "string" &&
		typeof value.createdAt === "string" &&
		isChatContact(value.sender)
	);
}

function isChatContact(value: unknown): value is ChatContact {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.name === "string" &&
		(value.image === null || typeof value.image === "string")
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
