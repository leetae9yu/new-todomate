import { Hono } from "hono";
import { z } from "zod";
import type { AuthRuntime } from "./auth/runtime";
import { installPlannerRoutes } from "./planner";
import { installSocialRoutes } from "./social";

type CreateAppOptions = {
	auth?: AuthRuntime;
};

const signInSchema = z.object({
	username: z.string().trim().min(3).max(30),
	password: z.string().min(8).max(128),
});

const signedInUserSchema = z.object({
	id: z.string(),
	name: z.string(),
	username: z.string(),
	displayUsername: z.string().nullable().optional(),
	status: z.literal("active"),
	image: z.string().nullable().optional(),
});

function invalidCredentials() {
	return new Response(
		JSON.stringify({
			error: {
				code: "INVALID_CREDENTIALS",
				message: "아이디 또는 비밀번호를 확인해 주세요.",
			},
		}),
		{
			status: 401,
			headers: { "content-type": "application/json; charset=UTF-8" },
		},
	);
}

export function createApp(options: CreateAppOptions = {}) {
	const app = new Hono();
	app.get("/api/health", (context) =>
		context.json({ status: "ok", service: "new-todomate-api" }),
	);

	if (!options.auth) return app;
	const auth = options.auth;
	installPlannerRoutes(app, auth);
	installSocialRoutes(app, auth);

	app.post("/api/auth/sign-in", async (context) => {
		const input = signInSchema.safeParse(await context.req.json().catch(() => null));
		if (!input.success) return invalidCredentials();
		const account = await auth.findByUsername(input.data.username);
		if (account?.status !== "active") return invalidCredentials();
		const targetURL = new URL(context.req.url);
		targetURL.pathname = "/api/auth/sign-in/username";
		const response = await auth.handler(
			new Request(targetURL, {
				method: "POST",
				headers: context.req.raw.headers,
				body: JSON.stringify(input.data),
			}),
		);
		if (!response.ok) return invalidCredentials();
		const payload = z
			.object({ redirect: z.boolean().optional(), user: signedInUserSchema })
			.safeParse(await response.json());
		if (!payload.success) {
			return context.json(
				{ error: { code: "AUTH_RESPONSE_INVALID", message: "로그인 응답을 처리하지 못했어요." } },
				500,
			);
		}
		const headers = new Headers(response.headers);
		headers.delete("content-length");
		return new Response(
			JSON.stringify({ redirect: payload.data.redirect ?? false, user: payload.data.user }),
			{ status: 200, headers },
		);
	});

	app.all("/api/auth/sign-up/*", (context) => context.notFound());
	app.all("/api/auth/*", (context) => auth.handler(context.req.raw));
	return app;
}

export const app = createApp();
