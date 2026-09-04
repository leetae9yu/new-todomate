import type { Hono } from "hono";
import type { AuthRuntime } from "../auth/runtime";
import type { ChatGateway } from "../chat";
import { installGroupRoutes } from "./group-routes";
import { installInvitationRoutes } from "./invitation-routes";
import { installInvitationSignupRoutes } from "./invitation-signup-routes";
import { installInteractionRoutes } from "./interaction-routes";
import { installProfileRoutes } from "./profile-routes";

export function installSocialRoutes(app: Hono, auth: AuthRuntime, chatGateway?: ChatGateway) {
	installGroupRoutes(app, auth, chatGateway);
	installInvitationRoutes(app, auth);
	installInvitationSignupRoutes(app, auth);
	installInteractionRoutes(app, auth);
	installProfileRoutes(app, auth);
}
