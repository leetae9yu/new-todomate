import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.APP_URL ?? "http://127.0.0.1:4173";
const username = process.env.QA_USERNAME ?? "demo";
const password = process.env.QA_PASSWORD ?? "demo-pass";
const evidenceDirectory = process.env.EVIDENCE_DIR ?? ".omo/evidence/responsive";
const viewports = [
	{ name: "phone-small", width: 320, height: 568 },
	{ name: "phone", width: 390, height: 844 },
	{ name: "tablet", width: 768, height: 1024 },
	{ name: "desktop-small", width: 1024, height: 768 },
	{ name: "desktop-wide", width: 1440, height: 1000 },
];

await mkdir(evidenceDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: viewports[0] });
const page = await context.newPage();
const failures = [];

function check(condition, message) {
	if (!condition) failures.push(message);
}

async function box(selector) {
	const bounds = await page.locator(selector).first().boundingBox();
	if (!bounds) throw new Error(`missing layout target: ${selector}`);
	return {
		left: bounds.x,
		right: bounds.x + bounds.width,
		top: bounds.y,
		bottom: bounds.y + bounds.height,
		width: bounds.width,
		height: bounds.height,
	};
}

try {
	await page.goto(baseURL, { waitUntil: "networkidle" });
	await page.locator("#login-username").fill(username);
	await page.locator("#login-password").fill(password);
	await page.getByRole("button", { name: "로그인", exact: true }).click();
	await page.locator(".shell").waitFor({ timeout: 15_000 });

	for (const viewport of viewports) {
		await page.setViewportSize(viewport);
		await page.evaluate(
			() =>
				new Promise((resolve) => {
					requestAnimationFrame(() => requestAnimationFrame(resolve));
				}),
		);

		const metrics = await page.evaluate(() => ({
			clientWidth: document.documentElement.clientWidth,
			scrollWidth: document.documentElement.scrollWidth,
		}));
		check(
			metrics.scrollWidth === metrics.clientWidth,
			`${viewport.name}: document width ${metrics.scrollWidth} exceeds ${metrics.clientWidth}`,
		);

		const tabButtons = await page.locator(".tabbar button").evaluateAll((buttons) =>
			buttons.map((button) => {
				const rect = button.getBoundingClientRect();
				return {
					left: rect.left,
					right: rect.right,
					top: rect.top,
					bottom: rect.bottom,
					width: rect.width,
					height: rect.height,
				};
			}),
		);
		check(tabButtons.length === 8, `${viewport.name}: expected 8 navigation items`);
		for (const [index, bounds] of tabButtons.entries()) {
			check(
				bounds.left >= -0.5 && bounds.right <= viewport.width + 0.5,
				`${viewport.name}: navigation item ${index + 1} is clipped`,
			);
			if (viewport.width <= 480) {
				check(
					bounds.width >= 44 && bounds.height >= 44,
					`${viewport.name}: navigation item ${index + 1} touch target is below 44px`,
				);
			}
		}

		const dateTitle = await box(".date-head__title");
		const dateControls = await box(".date-head__controls");
		const overlaps =
			dateTitle.left < dateControls.right &&
			dateTitle.right > dateControls.left &&
			dateTitle.top < dateControls.bottom &&
			dateTitle.bottom > dateControls.top;
		check(!overlaps, `${viewport.name}: date title overlaps controls`);
		check(
			dateTitle.left >= -0.5 && dateTitle.right <= viewport.width + 0.5,
			`${viewport.name}: date title exceeds viewport`,
		);
		check(
			dateControls.left >= -0.5 && dateControls.right <= viewport.width + 0.5,
			`${viewport.name}: date controls exceed viewport`,
		);
		if (viewport.width <= 480) {
			const dateButtons = await page.locator(".date-head__controls button").evaluateAll((buttons) =>
				buttons.map((button) => {
					const rect = button.getBoundingClientRect();
					return { width: rect.width, height: rect.height };
				}),
			);
			for (const [index, bounds] of dateButtons.entries()) {
				check(
					bounds.width >= 44 && bounds.height >= 44,
					`${viewport.name}: date control ${index + 1} touch target is below 44px`,
				);
			}
			const weekDays = await page.locator(".week-strip__day").evaluateAll((buttons) =>
				buttons.map((button) => button.getBoundingClientRect().height),
			);
			check(
				weekDays.every((height) => height >= 44),
				`${viewport.name}: week-strip touch target is below 44px tall`,
			);
		}

		if (viewport.width >= 1024) {
			const rail = await box(".tabbar");
			const plane = await box(".plane");
			const logo = await box(".topbar__logo");
			const profile = await box(".profile");
			const homeGrid = await box(".home__grid");
			check(
				rail.left >= -0.5 && rail.right <= viewport.width + 0.5,
				`${viewport.name}: desktop rail exceeds viewport`,
			);
			check(rail.right <= plane.left + 0.5, `${viewport.name}: desktop rail intersects content`);
			check(
				logo.left >= rail.right + 16,
				`${viewport.name}: desktop rail covers the brand`,
			);
			check(
				Math.abs(homeGrid.left - profile.left) <= 2,
				`${viewport.name}: planner grid is offset from date navigation`,
			);
			check(
				homeGrid.right <= viewport.width - 16,
				`${viewport.name}: planner grid exceeds usable desktop width`,
			);
		}

		await page.getByRole("button", { name: "캘린더" }).click();
		await page.locator("section.calendar").waitFor();
		const calendar = await box("section.calendar");
		const calendarGrid = await box(".calendar__grid");
		const calendarMetrics = await page.locator(".calendar__grid").evaluate((grid) => ({
			clientWidth: grid.clientWidth,
			scrollWidth: grid.scrollWidth,
		}));
		check(
			calendar.left >= -0.5 && calendar.right <= viewport.width + 0.5,
			`${viewport.name}: calendar exceeds viewport`,
		);
		check(
			calendarMetrics.clientWidth === calendarMetrics.scrollWidth,
			`${viewport.name}: calendar grid has internal horizontal overflow`,
		);
		const calendarDays = await page.locator(".calendar__day").evaluateAll((days) =>
			days.map((day) => {
				const rect = day.getBoundingClientRect();
				return { left: rect.left, right: rect.right };
			}),
		);
		check(calendarDays.length === 42, `${viewport.name}: expected 42 calendar cells`);
		check(
			calendarDays.every(
				(bounds) =>
					bounds.left >= calendarGrid.left - 0.5 &&
					bounds.right <= calendarGrid.right + 0.5 &&
					bounds.left >= -0.5 &&
					bounds.right <= viewport.width + 0.5,
			),
			`${viewport.name}: calendar cell exceeds its grid bounds`,
		);
		await page.getByRole("button", { name: "홈" }).click();
		await page.locator(".home__grid").waitFor();

		await page.screenshot({
			path: `${evidenceDirectory}/${viewport.name}.png`,
			fullPage: false,
		});
	}
} finally {
	await context.close();
	await browser.close();
}

if (failures.length > 0) {
	throw new Error(`Responsive layout QA failed:\n- ${failures.join("\n- ")}`);
}

console.log(`PASS responsive layout at ${viewports.map(({ width }) => width).join(", ")}px`);
