import { describe, expect, test } from "bun:test";
import {
	createChatState,
	parseClientFrame,
	reduceChatState,
	type ChatClientFrame,
	type ChatServerMessage,
} from "../src/server/chat/protocol-state";
import { parsePublishedMessage } from "../src/server/chat/durable-object";

describe("realtime chat protocol", () => {
	test("accepts strictly typed typing start and stop frames", () => {
		const start: ChatClientFrame = { type: "typing.start", conversationId: "room-1" };
		const stop: ChatClientFrame = { type: "typing.stop", conversationId: "room-1" };
		const started = reduceChatState(createChatState(), start, { senderId: "user-1", now: 1_000 });
		const stopped = reduceChatState(started, stop, { senderId: "user-1", now: 1_100 });

		expect(started.typing["room-1"]).toEqual({ "user-1": 1_000 });
		expect(stopped.typing["room-1"]).toEqual({});
	});

	test("reduces the server message.created event", () => {
		const message: ChatServerMessage = {
			type: "message.created",
			conversationId: "room-1",
			message: { id: "message-1", senderId: "user-2", body: "hello", createdAt: 2_000 },
		};

		expect(reduceChatState(createChatState(), message, { senderId: "user-1", now: 2_001 }).messages).toEqual([
			message.message,
		]);
	});

	test("tracks presence joins and leaves from server messages", () => {
		let state = createChatState();
		state = reduceChatState(state, { type: "presence.joined", conversationId: "room-1", userId: "user-2" }, { senderId: "user-1", now: 1 });
		expect(state.presence["room-1"]).toEqual(["user-2"]);
		state = reduceChatState(state, { type: "presence.left", conversationId: "room-1", userId: "user-2" }, { senderId: "user-1", now: 2 });
		expect(state.presence["room-1"]).toEqual([]);
	});

	test("rejects malformed frames", () => {
		expect(parseClientFrame('{"type":"typing.start"}')).toEqual({ ok: false, error: "invalid_frame" });
		expect(parseClientFrame("not-json")).toEqual({ ok: false, error: "invalid_frame" });
	});

	test("does not accept sender identity from client input", () => {
		const frame: ChatClientFrame = { type: "message.send", conversationId: "room-1", body: "hi" };
		const state = reduceChatState(createChatState(), frame, { senderId: "authenticated-user", now: 3_000 });

		expect(state.messages[0]?.senderId).toBe("authenticated-user");
	});

	test("deduplicates replayed messages after reconnect", () => {
		const message: ChatServerMessage = {
			type: "message.created",
			conversationId: "room-1",
			message: { id: "message-1", senderId: "user-2", body: "hello", createdAt: 2_000 },
		};
		let state = reduceChatState(createChatState(), message, { senderId: "user-1", now: 2_001 });
		state = reduceChatState(state, message, { senderId: "user-1", now: 2_002 });
		expect(state.messages).toHaveLength(1);
	});

	test("cleans stale typing deterministically with an injected timestamp", () => {
		let state = reduceChatState(createChatState(), { type: "typing.start", conversationId: "room-1" }, { senderId: "user-1", now: 1_000 });
		state = reduceChatState(state, { type: "typing.start", conversationId: "room-1" }, { senderId: "user-2", now: 4_000 });
		state = reduceChatState(state, { type: "typing.cleanup", conversationId: "room-1", maxAgeMs: 2_000 }, { senderId: "user-1", now: 5_001 });
		expect(state.typing["room-1"]).toEqual({ "user-2": 4_000 });
	});

	test("accepts the versioned persisted-message frame published by the Worker", () => {
		const message = {
			id: "message-1",
			roomId: "group:room-1",
			sequence: 1,
			clientMessageId: "client-message-1",
			sender: { id: "user-1", name: "사용자", image: null },
			body: "hello",
			createdAt: "2026-09-02T00:00:00.000Z",
		};
		expect(
			parsePublishedMessage(
				{ v: 1, type: "message.created", roomId: "group:room-1", message },
				"group:room-1",
			),
		).toEqual({ v: 1, type: "message.created", roomId: "group:room-1", message });
	});
});
