export type ChatClientFrame =
	| { type: "typing.start"; conversationId: string }
	| { type: "typing.stop"; conversationId: string }
	| { type: "message.send"; conversationId: string; body: string }
	| { type: "typing.cleanup"; conversationId: string; maxAgeMs: number };

export type ChatServerMessage =
	| {
			type: "message.created";
			conversationId: string;
			message: { id: string; senderId: string; body: string; createdAt: number };
	  }
	| { type: "presence.joined"; conversationId: string; userId: string }
	| { type: "presence.left"; conversationId: string; userId: string };

export type ChatState = {
	messages: Array<{ id: string; senderId: string; body: string; createdAt: number }>;
	typing: Record<string, Record<string, number>>;
	presence: Record<string, string[]>;
};

export function createChatState(): ChatState {
	return { messages: [], typing: {}, presence: {} };
}

export function parseClientFrame(
	raw: string,
): { ok: true; value: ChatClientFrame } | { ok: false; error: "invalid_frame" } {
	try {
		if (new TextEncoder().encode(raw).byteLength > 4 * 1024) {
			return { ok: false, error: "invalid_frame" };
		}
		const frame: unknown = JSON.parse(raw);
		if (
			!isRecord(frame) ||
			typeof frame.type !== "string" ||
			typeof frame.conversationId !== "string" ||
			frame.conversationId.length === 0
		) {
			return { ok: false, error: "invalid_frame" };
		}
		if (frame.type === "typing.start" || frame.type === "typing.stop") {
			return Object.keys(frame).length === 2
				? { ok: true, value: { type: frame.type, conversationId: frame.conversationId } }
				: { ok: false, error: "invalid_frame" };
		}
		if (
			frame.type === "message.send" &&
			typeof frame.body === "string" &&
			frame.body.length > 0 &&
			Object.keys(frame).length === 3
		) {
			return {
				ok: true,
				value: { type: "message.send", conversationId: frame.conversationId, body: frame.body },
			};
		}
		return { ok: false, error: "invalid_frame" };
	} catch {
		return { ok: false, error: "invalid_frame" };
	}
}

export function reduceChatState(
	state: ChatState,
	frame: ChatClientFrame | ChatServerMessage,
	context: { senderId: string; now: number },
): ChatState {
	const next: ChatState = {
		messages: [...state.messages],
		typing: Object.fromEntries(
			Object.entries(state.typing).map(([room, users]) => [room, { ...users }]),
		),
		presence: Object.fromEntries(
			Object.entries(state.presence).map(([room, users]) => [room, [...users]]),
		),
	};
	if (frame.type === "message.created") {
		if (!next.messages.some((message) => message.id === frame.message.id))
			next.messages.push(frame.message);
		return next;
	}
	if (frame.type === "presence.joined" || frame.type === "presence.left") {
		const users = next.presence[frame.conversationId] ?? [];
		next.presence[frame.conversationId] =
			frame.type === "presence.joined"
				? users.includes(frame.userId)
					? users
					: [...users, frame.userId]
				: users.filter((userId) => userId !== frame.userId);
		return next;
	}
	const typing = next.typing[frame.conversationId] ?? {};
	if (frame.type === "typing.start") {
		next.typing[frame.conversationId] = { ...typing, [context.senderId]: context.now };
	} else if (frame.type === "typing.stop") {
		const { [context.senderId]: _, ...remaining } = typing;
		next.typing[frame.conversationId] = remaining;
	} else if (frame.type === "typing.cleanup") {
		next.typing[frame.conversationId] = Object.fromEntries(
			Object.entries(typing).filter(([, startedAt]) => context.now - startedAt <= frame.maxAgeMs),
		);
	} else {
		next.messages.push({
			id: `local:${frame.conversationId}:${context.senderId}:${context.now}`,
			senderId: context.senderId,
			body: frame.body,
			createdAt: context.now,
		});
	}
	return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
