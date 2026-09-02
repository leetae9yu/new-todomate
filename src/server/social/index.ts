import type { Hono } from "hono";
import type { AuthRuntime } from "../auth/runtime";
import type { ChatGateway } from "../chat";
import { installGroupRoutes } from "./group-routes";
import { installInteractionRoutes } from "./interaction-routes";
import { installProfileRoutes } from "./profile-routes";

export function installSocialRoutes(app: Hono, auth: AuthRuntime, chatGateway?: ChatGateway) {
	installGroupRoutes(app, auth, chatGateway);
	installInteractionRoutes(app, auth);
	installProfileRoutes(app, auth);
}
