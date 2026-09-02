import type { AuthRuntime } from "./auth/runtime";
import { createNeonAuthRuntime } from "./auth/neon";
import { createApp } from "./app";
import { CHAT_ROOM_HEADER, CHAT_USER_HEADER } from "./chat/durable-object";
import type { ChatGateway } from "./chat/contracts";
import { isCanonicalRoomId, requireRoomAccess } from "./chat/shared";
import type { QueryRow } from "./planner/shared";

export { ChatRoom } from "./chat/durable-object";

type DurableObjectId = object;

type DurableObjectNamespace = {
	idFromName(name: string): DurableObjectId;
	get(id: DurableObjectId): { fetch(request: Request): Promise<Response> };
};

type WorkerEnvironment = {
	ASSETS: { fetch: (request: Request) => Promise<Response> };
	BETTER_AUTH_SECRET: string;
	CHAT_ROOM: DurableObjectNamespace;
	DATABASE_URL: string;
};

let cached:
	| {
		app: ReturnType<typeof createApp>;
		chatRoom: DurableObjectNamespace;
		databaseURL: string;
		origin: string;
	}
	| undefined;

function runtimeApp(environment: WorkerEnvironment, origin: string) {
	if (
		cached?.databaseURL === environment.DATABASE_URL &&
		cached.origin === origin &&
		cached.chatRoom === environment.CHAT_ROOM
	) {
		return cached.app;
	}
	const auth: AuthRuntime = createNeonAuthRuntime({
		baseURL: origin,
		databaseURL: environment.DATABASE_URL,
		secret: environment.BETTER_AUTH_SECRET,
	});
	const app = createApp({ auth, chatGateway: chatGateway(environment.CHAT_ROOM) });
	cached = { app, chatRoom: environment.CHAT_ROOM, databaseURL: environment.DATABASE_URL, origin };
	return app;
}

function chatGateway(rooms: DurableObjectNamespace): ChatGateway {
	return {
		connect: (roomId, actorId, request) => connectRoom(rooms, roomId, actorId, request),
		async publish(roomId, event) {
			const response = await roomStub(rooms, roomId).fetch(
				new Request("https://chat-room.internal/publish", {
					method: "POST",
					headers: {
						"content-type": "application/json",
						[CHAT_ROOM_HEADER]: roomId,
					},
					body: JSON.stringify({ v: 1, ...event }),
				}),
			);
			if (!response.ok) throw new Error(`Chat publish failed with ${response.status}`);
		},
		async revoke(roomId, userId) {
			const response = await roomStub(rooms, roomId).fetch(
				new Request("https://chat-room.internal/revoke", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ userId }),
				}),
			);
			if (!response.ok) throw new Error(`Chat revoke failed with ${response.status}`);
		},
	};
}

function roomStub(rooms: DurableObjectNamespace, roomId: string) {
	return rooms.get(rooms.idFromName(roomId));
}

function connectRoom(
	rooms: DurableObjectNamespace,
	roomId: string,
	userId: string,
	request: Request,
): Promise<Response> {
	const headers = new Headers(request.headers);
	headers.set(CHAT_ROOM_HEADER, roomId);
	headers.set(CHAT_USER_HEADER, userId);
	return roomStub(rooms, roomId).fetch(new Request(request, { headers }));
}

function liveRoomId(url: URL): string | undefined {
	const match = /^\/api\/chat\/rooms\/([^/]+)\/live$/.exec(url.pathname);
	if (!match?.[1]) return undefined;
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return undefined;
	}
}

async function authenticatedLiveConnection(
	request: Request,
	auth: AuthRuntime,
	rooms: DurableObjectNamespace,
	roomId: string,
): Promise<Response> {
	if (request.method !== "GET" || request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
		return Response.json({ error: { code: "UPGRADE_REQUIRED" } }, { status: 426 });
	}
	if (!isCanonicalRoomId(roomId)) {
		return Response.json({ error: { code: "BAD_REQUEST" } }, { status: 400 });
	}

	const session = await auth.getSession(request.headers);
	const userId = session?.user?.id;
	if (!userId) return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
	const [activeUser] = await auth.planner.query<QueryRow>(
		`SELECT id FROM "user" WHERE id = $1 AND status = 'active'`,
		[userId],
	);
	if (!activeUser || !(await requireRoomAccess(auth, roomId, userId))) {
		return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
	}
	return connectRoom(rooms, roomId, userId, request);
}

export default {
	async fetch(request: Request, environment: WorkerEnvironment) {
		const url = new URL(request.url);
		const roomId = liveRoomId(url);
		if (roomId !== undefined) {
			if (request.method !== "GET" || request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
				return Response.json({ error: { code: "UPGRADE_REQUIRED" } }, { status: 426 });
			}
			if (!environment.DATABASE_URL || !environment.BETTER_AUTH_SECRET) {
				return Response.json({ error: { code: "SERVER_NOT_CONFIGURED" } }, { status: 503 });
			}
			const auth = createNeonAuthRuntime({
				baseURL: url.origin,
				databaseURL: environment.DATABASE_URL,
				secret: environment.BETTER_AUTH_SECRET,
			});
			return authenticatedLiveConnection(request, auth, environment.CHAT_ROOM, roomId);
		}
		if (url.pathname.startsWith("/api/")) {
			if (!environment.DATABASE_URL || !environment.BETTER_AUTH_SECRET) {
				return Response.json({ error: { code: "SERVER_NOT_CONFIGURED" } }, { status: 503 });
			}
			return runtimeApp(environment, url.origin).fetch(request);
		}
		return environment.ASSETS.fetch(request);
	},
};
