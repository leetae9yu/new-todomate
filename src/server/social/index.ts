import type { Hono } from "hono";
import type { AuthRuntime } from "../auth/runtime";
import { installGroupRoutes } from "./group-routes";
import { installInteractionRoutes } from "./interaction-routes";
import { installProfileRoutes } from "./profile-routes";

export function installSocialRoutes(app: Hono, auth: AuthRuntime) {
	installGroupRoutes(app, auth);
	installInteractionRoutes(app, auth);
	installProfileRoutes(app, auth);
}
