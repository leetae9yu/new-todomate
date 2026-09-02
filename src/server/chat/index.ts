import type { Hono } from "hono";
import type { AuthRuntime } from "../auth/runtime";
import type { ChatGateway } from "./contracts";
import { installChatRoutes as installRoutes } from "./routes";

export type { ChatGateway, ChatMessage, ChatRoomEvent, ChatSender } from "./contracts";
export { directRoomId, groupRoomId } from "./shared";

export function installChatRoutes(app: Hono, auth: AuthRuntime, gateway?: ChatGateway) {
	installRoutes(app, auth, gateway);
}

export const installChatBoundary = installChatRoutes;
