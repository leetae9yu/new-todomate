import { chromium, expect } from "@playwright/test";

const baseURL = process.env.APP_URL;
const password = process.env.ADMIN_PASSWORD;
const username = process.env.QA_USERNAME ?? "admin";
if (!baseURL || !password) throw new Error("APP_URL and ADMIN_PASSWORD are required");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => {
	window.__performanceQaLcp = 0;
	new PerformanceObserver((list) => {
		for (const entry of list.getEntries()) {
			window.__performanceQaLcp = Math.max(window.__performanceQaLcp, entry.startTime);
		}
	}).observe({ type: "largest-contentful-paint", buffered: true });
});
const page = await context.newPage();
const plannerRequests = [];
const observedResponses = [];
let recordRequests = false;

page.on("request", (request) => {
	if (recordRequests && new URL(request.url()).pathname === "/api/planner") {
		plannerRequests.push(request.url());
	}
});
page.on("response", (response) => {
	const url = new URL(response.url());
	if (recordRequests && url.pathname.startsWith("/api/")) {
		observedResponses.push({ path: url.pathname, status: response.status() });
	}
});

class MissingResponseError extends Error {
	constructor(label, observed, cause) {
		super(`Missing ${label} response; observed ${JSON.stringify(observed)}`, { cause });
		this.name = "MissingResponseError";
	}
}

const waitForResponse = (label, predicate) =>
	page.waitForResponse(predicate).catch((error) => {
		throw new MissingResponseError(label, observedResponses, error);
	});

try {
	await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 30_000 });
	await page.locator("#login-username").fill(username);
	await page.locator("#login-password").fill(password);

	const requiredResponses = Promise.all([
		waitForResponse("sign-in", (response) => response.url().includes("/api/auth/sign-in")),
		waitForResponse("session", (response) => response.url().includes("/api/auth/get-session")),
		waitForResponse("planner", (response) => new URL(response.url()).pathname === "/api/planner"),
		waitForResponse("settings", (response) => new URL(response.url()).pathname === "/api/settings"),
		waitForResponse(
			"active timer",
			(response) => new URL(response.url()).pathname === "/api/timer/active",
		),
	]);
	recordRequests = true;
	const startedAt = performance.now();
	await page.getByRole("button", { name: "로그인", exact: true }).click();
	await page.locator(".shell").waitFor({ state: "visible", timeout: 30_000 });
	const shellVisibleMs = Math.round(performance.now() - startedAt);
	await requiredResponses;

	expect(plannerRequests).toHaveLength(1);
	recordRequests = false;
	const reloadStartedAt = performance.now();
	await page.reload({ waitUntil: "networkidle", timeout: 30_000 });
	await page.locator(".shell").waitFor({ state: "visible", timeout: 30_000 });
	const authenticatedReloadSettledMs = Math.round(performance.now() - reloadStartedAt);
	const authenticatedReloadLcpMs = Math.round(
		await page.evaluate(() => window.__performanceQaLcp),
	);
	console.log(
		JSON.stringify({
			shellVisibleMs,
			plannerRequestCount: plannerRequests.length,
			authenticatedReloadLcpMs,
			authenticatedReloadSettledMs,
		}),
	);
} finally {
	recordRequests = false;
	await context.close();
	await browser.close();
}
