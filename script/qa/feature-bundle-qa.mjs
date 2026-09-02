import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseURL = process.env.APP_URL;
const username = process.env.QA_USERNAME ?? "admin";
const password = process.env.QA_PASSWORD;
const evidenceDirectory = process.env.EVIDENCE_DIR ?? ".omo/evidence/feature-bundle";
if (!baseURL || !password) {
	throw new Error("APP_URL and QA_PASSWORD are required");
}

const viewports = [
	{ name: "phone-small", width: 320, height: 568 },
	{ name: "phone", width: 390, height: 844 },
	{ name: "tablet", width: 768, height: 1024 },
	{ name: "desktop-small", width: 1024, height: 768 },
	{ name: "desktop-wide", width: 1440, height: 1000 },
];

const EXPECTED_DRAWER_ROWS = [
	"카테고리 관리",
	"루틴 관리",
	"보관함",
	"테마",
	"소식 알림",
	"로그아웃",
];
const EXIT_NAME = "홈으로 돌아가기";

const passes = [];
const failures = [];
const pass = (message) => passes.push(`PASS ${message}`);
const fail = (message) => failures.push(`FAIL ${message}`);
const elapsedValue = (clock) => {
	const [hours, minutes, seconds] = clock.split(":").map(Number);
	return hours * 3600 + minutes * 60 + seconds;
};

await mkdir(evidenceDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: viewports[0] });
const page = await context.newPage();

let startedTimerTaskId = null;

async function json(path, init = {}) {
	return page.evaluate(
		async ({ path: target, init: options }) => {
			const response = await fetch(target, {
				credentials: "same-origin",
				...options,
				headers: { "content-type": "application/json", ...(options.headers ?? {}) },
			});
			const body = await response.json();
			if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
			return body;
		},
		{ path, init },
	);
}

async function openHomeShortcut(label) {
	await page.locator(".home__shortcuts button").filter({ hasText: label }).click();
}

async function goHome() {
	await page.locator(".tabbar button[aria-label='홈']").click();
	await page.locator(".home__grid").waitFor();
}

async function assertExitControl(viewName, rootSelector) {
	const exit = page.locator(rootSelector).getByRole("button", { name: EXIT_NAME, exact: true });
	const count = await exit.count();
	if (count === 0) {
		fail(`${viewName}: no exit/back control exists (first second-class return to home missing)`);
		return;
	}
	const bounds = await exit.first().boundingBox();
	if (!bounds || bounds.width < 44 || bounds.height < 44) {
		fail(`${viewName}: exit control is ${bounds?.width}x${bounds?.height}, below the 44px floor`);
		return;
	}
	pass(`${viewName}: exit control exists at >=44px`);
	await exit.first().click();
	await page
		.locator(".home__grid")
		.waitFor({ timeout: 5000 })
		.catch(() => {
			fail(`${viewName}: exit control did not return to home`);
		});
}

try {
	await page.goto(baseURL, { waitUntil: "networkidle" });
	await page.locator("#login-username").fill(username);
	await page.locator("#login-password").fill(password);
	await page.getByRole("button", { name: "로그인", exact: true }).click();
	await page.locator(".shell").waitFor({ timeout: 20_000 });
	pass("login with provided credentials");

	// 1. Geometry: eight responsive tabs preserved and no horizontal overflow.
	for (const viewport of viewports) {
		await page.setViewportSize(viewport);
		const metrics = await page.evaluate(() => ({
			clientWidth: document.documentElement.clientWidth,
			scrollWidth: document.documentElement.scrollWidth,
		}));
		if (metrics.scrollWidth === metrics.clientWidth) {
			pass(`${viewport.name}: document width ${metrics.clientWidth} has no horizontal overflow`);
		} else {
			fail(
				`${viewport.name}: document width ${metrics.scrollWidth} exceeds ${metrics.clientWidth}`,
			);
		}
		const tabs = await page.locator(".tabbar button").evaluateAll((buttons) =>
			buttons.map((button) => {
				const rect = button.getBoundingClientRect();
				return { label: button.getAttribute("aria-label"), left: rect.left, right: rect.right };
			}),
		);
		if (tabs.length !== 8) {
			fail(`${viewport.name}: ${tabs.length} tab buttons, expected exactly eight`);
		} else {
			const clipped = tabs.filter((tab) => tab.left < -0.5 || tab.right > viewport.width + 0.5);
			if (clipped.length > 0) {
				fail(`${viewport.name}: tab items clipped (${clipped.map((tab) => tab.label).join(", ")})`);
			} else {
				pass(`${viewport.name}: eight responsive tabs fit the viewport`);
			}
		}
		await page.setViewportSize(viewports[1]);
	}

	// 2. Dead selector: the 뷰 전환 segment must not exist on home or calendar.
	const checkDeadSelector = async (viewName) => {
		const segments = await page
			.locator(".date-head nav.segment, .date-head nav[aria-label='뷰 전환']")
			.count();
		if (segments > 0) {
			fail(`${viewName}: dead 뷰 전환 view-toggle segment is still rendered`);
			return;
		}
		const controls = await page.locator(".date-head__controls button").count();
		if (controls !== 2) {
			fail(`${viewName}: date header has ${controls} controls, expected exactly 이전/다음`);
			return;
		}
		pass(`${viewName}: no view-toggle nav and exactly 이전/다음 controls`);
	};
	await checkDeadSelector("home");
	await page.locator(".tabbar button[aria-label='캘린더']").click();
	await page.locator("section.calendar").waitFor();
	await checkDeadSelector("calendar");
	await goHome();

	// 3. Diary: white surfaces (no violet sheet) and a >=44px exit control.
	await openHomeShortcut("일기");
	await page.locator(".diary").waitFor();
	const sheetColor = await page
		.locator(".diary-sheet")
		.evaluate((sheet) => getComputedStyle(sheet).backgroundColor);
	if (sheetColor === "rgb(255, 255, 255)") {
		pass("diary: sheet surface is white");
	} else {
		fail(`diary: sheet surface is violet (${sheetColor}), not white`);
	}
	if ((await page.locator(".diary-sheet__handle").count()) > 0) {
		fail("diary: violet-sheet drag handle is still rendered");
	} else {
		pass("diary: no violet-sheet handle");
	}
	await assertExitControl("diary", ".diary");
	await goHome();

	// 4. Timer continuity: in-session survival plus rehydration across reload.
	const todayKey = await page.evaluate(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	});
	const suffix = Date.now().toString().slice(-6);
	const categoryName = `UXQA-${suffix}`;
	const taskTitle = `타이머 계약 ${suffix}`;
	const category = await json("/api/categories", {
		method: "POST",
		body: JSON.stringify({ name: categoryName, color: "#191919", visibility: "private" }),
	});
	const task = await json("/api/tasks", {
		method: "POST",
		body: JSON.stringify({ categoryId: category.id, title: taskTitle, date: todayKey }),
	});
	await page.reload({ waitUntil: "networkidle" });
	await page.locator(".shell").waitFor();
	const row = page.locator("li.task", { hasText: taskTitle });
	await row.waitFor({ timeout: 10_000 });
	await row.locator("button[aria-label='할 일 옵션']").click();
	await page.locator("nav.pop-menu button").filter({ hasText: "타이머 열기" }).click();
	await page.locator(".timer").waitFor();
	startedTimerTaskId = task.id;
	const runningTask = page.locator(".timer__task").first();
	await runningTask.filter({ hasText: taskTitle }).waitFor({ timeout: 10_000 });
	pass("timer: start from task menu engages the running screen");

	const clock = page.locator(".timer__clock");
	await page.waitForFunction(
		() => document.querySelector(".timer__clock")?.textContent !== "00:00:00",
		{ timeout: 10_000 },
	);
	const beforeAway = await clock.innerText();

	await page.locator(".tabbar button[aria-label='캘린더']").click();
	await page.locator("section.calendar").waitFor();
	await goHome();
	await openHomeShortcut("타이머");
	const stillRunning = await page.locator(".timer__task").first().innerText();
	const afterAway = await page.locator(".timer__clock").innerText();
	if (stillRunning.includes(taskTitle) && elapsedValue(afterAway) >= elapsedValue(beforeAway)) {
		pass(`timer: in-session continuity kept ${taskTitle} running at ${afterAway}`);
	} else {
		fail(`timer: in-session continuity lost or reduced the running task (${afterAway})`);
	}
	await assertExitControl("timer", ".timer");

	await page.reload({ waitUntil: "networkidle" });
	await page.locator(".shell").waitFor();
	await openHomeShortcut("타이머");
	const rehydrated = await page.locator(".timer__task").first().innerText();
	const rehydratedClock = await page.locator(".timer__clock").innerText();
	if (rehydrated.includes(taskTitle) && elapsedValue(rehydratedClock) >= elapsedValue(afterAway)) {
		pass(`timer: survived reload at ${rehydratedClock} (rehydrated by owner)`);
	} else {
		fail(`timer: reload fell back or reduced elapsed time (${rehydratedClock})`);
	}
	await goHome();

	// 5. Drawer: only functional rows, exactly the approved six.
	await page.locator("button[aria-label='메뉴 열기']").click();
	await page.locator(".drawer").waitFor();
	const rows = await page
		.locator(".drawer__item")
		.evaluateAll((items) =>
			items.map((item) => ({ name: item.textContent.trim(), disabled: item.disabled })),
		);
	const names = rows.map((row) => row.name);
	const disabled = rows.filter((row) => row.disabled).map((row) => row.name);
	const exact =
		names.length === EXPECTED_DRAWER_ROWS.length &&
		names.every((name, index) => name === EXPECTED_DRAWER_ROWS[index]);
	if (!exact) {
		fail(
			`drawer: rows are [${names.join(", ")}], expected exactly [${EXPECTED_DRAWER_ROWS.join(", ")}]`,
		);
	} else if (disabled.length > 0) {
		fail(`drawer: ${disabled.length} row(s) are disabled placeholders (${disabled.join(", ")})`);
	} else {
		pass("drawer: exactly the approved functional rows, none disabled");
	}
	await page.locator(".drawer-backdrop").click({ force: true });
	await page
		.locator(".drawer")
		.waitFor({ state: "detached" })
		.catch(() => undefined);
} finally {
	if (startedTimerTaskId) {
		try {
			await page.evaluate(async (id) => {
				const response = await fetch(`/api/tasks/${id}/timer/stop`, {
					method: "POST",
					credentials: "same-origin",
				});
				return response.status;
			}, startedTimerTaskId);
			passes.push("PASS cleanup: timer stopped");
		} catch (error) {
			passes.push(`PASS cleanup: timer stop best-effort (${error.message})`);
		}
	}
	await context.close();
	await browser.close();
	passes.push("PASS cleanup: context and browser closed");
}

const sanitize = (text) => text.split(password).join("***");
const lines = [
	`feature-bundle UX QA against ${baseURL}`,
	`user: ${username}`,
	"",
	"(credentials passed via environment; not recorded here)",
	...passes,
	...failures,
	"",
	failures.length === 0 ? "GREEN - no UX defects" : `RED - ${failures.length} UX defect(s) named`,
];
await writeFile(`${evidenceDirectory}/red-ux.txt`, `${lines.map(sanitize).join("\n")}\n`);
console.log(lines.map(sanitize).join("\n"));

if (failures.length > 0) {
	throw new Error(`feature-bundle UX QA is RED:\n- ${failures.join("\n- ")}`);
}
