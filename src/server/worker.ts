import type { AuthRuntime } from "./auth/runtime";
import { createNeonAuthRuntime } from "./auth/neon";
import { createApp } from "./app";

type WorkerEnvironment = {
	ASSETS: { fetch: (request: Request) => Promise<Response> };
	BETTER_AUTH_SECRET: string;
	DATABASE_URL: string;
};

let cached:
	| {
		app: ReturnType<typeof createApp>;
		databaseURL: string;
		origin: string;
	}
	| undefined;

function runtimeApp(environment: WorkerEnvironment, origin: string) {
	if (cached?.databaseURL === environment.DATABASE_URL && cached.origin === origin) {
		return cached.app;
	}
	const auth: AuthRuntime = createNeonAuthRuntime({
		baseURL: origin,
		databaseURL: environment.DATABASE_URL,
		secret: environment.BETTER_AUTH_SECRET,
	});
	const app = createApp({ auth });
	cached = { app, databaseURL: environment.DATABASE_URL, origin };
	return app;
}

export default {
	async fetch(request: Request, environment: WorkerEnvironment) {
		const url = new URL(request.url);
		if (url.pathname.startsWith("/api/")) {
			if (!environment.DATABASE_URL || !environment.BETTER_AUTH_SECRET) {
				return Response.json({ error: { code: "SERVER_NOT_CONFIGURED" } }, { status: 503 });
			}
			return runtimeApp(environment, url.origin).fetch(request);
		}
		return environment.ASSETS.fetch(request);
	},
};
