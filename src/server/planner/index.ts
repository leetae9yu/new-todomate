import type { Hono } from "hono";
import type { AuthRuntime } from "../auth/runtime";
import { installPlannerReadRoutes } from "./planner-routes";
import { installRoutineRoutes } from "./routine-routes";
import { installTaskRoutes } from "./task-routes";
import { installToolRoutes } from "./tool-routes";

export function installPlannerRoutes(app: Hono, auth: AuthRuntime) {
	installTaskRoutes(app, auth);
	installRoutineRoutes(app, auth);
	installToolRoutes(app, auth);
	installPlannerReadRoutes(app, auth);
}
