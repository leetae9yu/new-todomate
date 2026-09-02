import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.APP_URL;
const password = process.env.ADMIN_PASSWORD;
const expectedTask = process.env.EXPECTED_TASK;
if (!baseURL || !password || !expectedTask) {
	throw new Error("APP_URL, ADMIN_PASSWORD and EXPECTED_TASK are required");
}

const evidenceDirectory = ".omo/evidence/deployment";
await mkdir(evidenceDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

try {
	const page = await context.newPage();
	await page.goto(baseURL, { waitUntil: "networkidle" });
	await page.locator("#login-username").fill("admin");
	await page.locator("#login-password").fill(password);
	await page.getByRole("button", { name: "로그인", exact: true }).click();
	await page.locator(".shell").waitFor({ timeout: 15_000 });
	await expect(page.getByText(expectedTask, { exact: true })).toBeVisible();

	const mobileOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth > window.innerWidth,
	);
	if (mobileOverflow) throw new Error("live mobile layout has horizontal overflow");
	const manifest = await page.evaluate(async () => (await fetch("/manifest.webmanifest")).json());
	if (manifest.display !== "standalone") throw new Error("live manifest is not standalone");
	const serviceWorkerActive = await page.evaluate(async () =>
		Boolean((await navigator.serviceWorker.ready).active),
	);
	if (!serviceWorkerActive) throw new Error("live service worker is not active");
	await page.screenshot({ path: `${evidenceDirectory}/live-mobile.png`, fullPage: true });

	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.reload({ waitUntil: "networkidle" });
	await page.locator(".shell").waitFor();
	if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
		throw new Error("live desktop layout has horizontal overflow");
	}
	await page.screenshot({ path: `${evidenceDirectory}/live-desktop.png`, fullPage: true });
	console.log("PASS live login, persisted Todo, PWA, mobile and desktop");
} finally {
	await context.close();
	await browser.close();
}
