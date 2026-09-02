import {
	approvedCredentials,
	createAuthTestApp,
} from "./auth-test-app";

type JsonRequestInit = {
	method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
	body?: unknown;
};

export async function createPlannerTestApp() {
	const harness = await createAuthTestApp();
	const signIn = await harness.app.request("https://todomate.test/api/auth/sign-in", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify(approvedCredentials),
	});
	const setCookie = signIn.headers.get("set-cookie");
	const cookie = setCookie?.split(";")[0];

	if (!cookie) {
		await harness.close();
		throw new Error("Planner test session cookie was not issued");
	}

	return {
		request: (path: string, init: JsonRequestInit = {}) =>
			harness.app.request(`https://todomate.test${path}`, {
				method: init.method ?? "GET",
				headers: {
					cookie,
					...(init.body === undefined ? {} : { "content-type": "application/json" }),
				},
				...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
			}),
		close: harness.close,
	};
}
