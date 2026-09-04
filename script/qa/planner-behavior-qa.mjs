import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.APP_URL;
const password = process.env.QA_PASSWORD;
const username = process.env.QA_USERNAME ?? "admin";
const evidenceDirectory = process.env.EVIDENCE_DIR;
if (!baseURL || !password) throw new Error("APP_URL and QA_PASSWORD are required");
if (evidenceDirectory) await mkdir(evidenceDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
let categoryId = null;
let releaseCompletionRequest;
const completionRequestReleased = new Promise((resolve) => {
	releaseCompletionRequest = resolve;
});

async function json(path, init = {}) {
	return page.evaluate(
		async ({ path: target, init: options }) => {
			const response = await fetch(target, {
				credentials: "same-origin",
				...options,
				headers: { "content-type": "application/json", ...(options.headers ?? {}) },
			});
			const body = response.status === 204 ? null : await response.json();
			return { status: response.status, body };
		},
		{ path, init },
	);
}

try {
	await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 30_000 });
	await page.locator("#login-username").fill(username);
	await page.locator("#login-password").fill(password);
	await page.getByRole("button", { name: "로그인", exact: true }).click();
	await page.locator(".shell").waitFor({ state: "visible", timeout: 30_000 });

	const suffix = Date.now().toString().slice(-6);
	const categoryName = `전역 카테고리 QA ${suffix}`;
	const taskTitle = `즉시 체크 QA ${suffix}`;
	const today = new Date().toISOString().slice(0, 10);
	const category = await json("/api/categories", {
		method: "POST",
		body: JSON.stringify({ name: categoryName, color: "#8437FF", visibility: "private" }),
	});
	expect(category.status).toBe(201);
	categoryId = category.body.id;
	const task = await json("/api/tasks", {
		method: "POST",
		body: JSON.stringify({ categoryId, title: taskTitle, date: today }),
	});
	expect(task.status).toBe(201);

	await page.reload({ waitUntil: "networkidle", timeout: 30_000 });
	const checkbox = page.getByRole("button", { name: `${taskTitle} 완료 전환`, exact: true });
	await checkbox.waitFor({ state: "visible", timeout: 30_000 });

	let signalCompletionRequest;
	const completionRequestStarted = new Promise((resolve) => {
		signalCompletionRequest = resolve;
	});
	await page.route(`**/api/tasks/${task.body.id}/completion`, async (route) => {
		signalCompletionRequest();
		await completionRequestReleased;
		await route.continue();
	});

	await checkbox.click();
	await completionRequestStarted;
	expect(await checkbox.getAttribute("aria-pressed")).toBe("true");
	if (evidenceDirectory) {
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.screenshot({
			path: `${evidenceDirectory}/optimistic-completion.png`,
			fullPage: false,
		});
	}
	const completionResponse = page.waitForResponse(
		(response) =>
			response.request().method() === "PUT" &&
			new URL(response.url()).pathname === `/api/tasks/${task.body.id}/completion`,
	);
	releaseCompletionRequest();
	expect((await completionResponse).status()).toBe(200);
	await expect(checkbox).toHaveAttribute("aria-pressed", "true");

	const emptyDatePlanner = await json("/api/planner?date=2000-01-01");
	expect(emptyDatePlanner.status).toBe(200);
	expect(
		emptyDatePlanner.body.categories.find((candidate) => candidate.id === categoryId),
	).toEqual({
		id: categoryId,
		name: categoryName,
		color: "#8437FF",
		visibility: "private",
		position: expect.any(Number),
		tasks: [],
	});

	const nextDatePlanner = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === "/api/planner" &&
			!response.url().includes(`date=${today}`),
	);
	await page.getByRole("button", { name: "다음", exact: true }).click();
	expect((await nextDatePlanner).status()).toBe(200);
	await expect(page.getByText(categoryName, { exact: true })).toBeVisible();
	if (evidenceDirectory) {
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.screenshot({
			path: `${evidenceDirectory}/cross-date-category.png`,
			fullPage: false,
		});
	}

	console.log("PASS immediate completion and cross-date category behavior");
} finally {
	releaseCompletionRequest();
	if (categoryId) {
		await json(`/api/categories/${categoryId}`, { method: "DELETE" });
	}
	await context.close();
	await browser.close();
}
