import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = "http://127.0.0.1:4173";
const evidenceDir = ".omo/evidence/browser";
const plannerEvidenceDir = ".omo/evidence/planner";
const socialEvidenceDir = ".omo/evidence/social";
const visualEvidenceDir = ".omo/evidence/visual";
await Promise.all(
	[evidenceDir, plannerEvidenceDir, socialEvidenceDir, visualEvidenceDir].map((path) =>
		mkdir(path, { recursive: true }),
	),
);

const browser = await chromium.launch({ headless: true });
const log = [];

async function login(context, username, password) {
	const page = await context.newPage();
	await page.goto(baseURL, { waitUntil: "networkidle" });
	await page.locator("#login-username").fill(username);
	await page.locator("#login-password").fill(password);
	await page.getByRole("button", { name: "로그인", exact: true }).click();
	await page.locator(".shell").waitFor({ state: "visible", timeout: 15_000 });
	log.push(`PASS login ${username}`);
	return page;
}

async function json(page, path, init = {}) {
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

try {
	const demoContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const demo = await login(demoContext, "demo", "demo-pass");
	const suffix = Date.now().toString().slice(-6);
	const categoryName = `QA-${suffix}`;
	const taskTitle = `브라우저 할 일 ${suffix}`;

	const emptyCategory = demo.getByRole("button", { name: "+ 새 카테고리" });
	if (await emptyCategory.isVisible().catch(() => false)) {
		await emptyCategory.click();
		await demo.locator("#new-category-name").fill(categoryName);
		await demo.getByRole("button", { name: "만들기" }).click();
		await demo.getByPlaceholder(`${categoryName}에 추가…`).waitFor();
	}

	let addInput = demo.getByPlaceholder(`${categoryName}에 추가…`);
	if (!(await addInput.isVisible().catch(() => false))) {
		const category = await json(demo, "/api/categories", {
			method: "POST",
			body: JSON.stringify({
				name: categoryName,
				color: "#8437FF",
				visibility: "private",
			}),
		});
		await demo.reload({ waitUntil: "networkidle" });
		await demo.locator(".shell").waitFor();
		addInput = demo.getByPlaceholder(`${category.name}에 추가…`);
	}
	await addInput.fill(taskTitle);
	await addInput.press("Enter");
	const toggle = demo.getByRole("button", { name: `${taskTitle} 완료 전환` });
	await toggle.waitFor();
	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-pressed", "true");
	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-pressed", "false");
	log.push("PASS planner create/complete/uncomplete");

	await demo.getByRole("button", { name: "캘린더" }).click();
	await demo.locator("section.calendar").waitFor();
	await demo.getByRole("button", { name: "루틴" }).click();
	const routineAdd = demo.getByRole("button", { name: /루틴 추가$/ }).first();
	await routineAdd.click();
	await demo.locator("#routine-title").fill(`수요일 루틴 ${suffix}`);
	await demo.locator("#routine-freq").selectOption("weekdays");
	await demo.locator(".routine-days").getByRole("button", { name: "수", exact: true }).click();
	await demo.getByRole("button", { name: "루틴 만들기" }).click();
	await demo.getByText(`수요일 루틴 ${suffix}`).waitFor();
	log.push("PASS calendar and weekday routine");

	await demo.reload({ waitUntil: "networkidle" });
	await demo.locator(".shell").waitFor();
	await demo.getByText(taskTitle).waitFor();
	const mobileOverflow = await demo.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
	if (mobileOverflow) throw new Error("mobile horizontal overflow");
	await demo.screenshot({ path: `${plannerEvidenceDir}/planner-mobile.png`, fullPage: true });
	await demo.screenshot({ path: `${visualEvidenceDir}/mobile.png`, fullPage: true });

	const manifest = await demo.evaluate(async () => {
		const response = await fetch("/manifest.webmanifest");
		return response.json();
	});
	if (manifest.display !== "standalone") throw new Error("manifest is not standalone");
	const sw = await demo.evaluate(async () => {
		const registration = await navigator.serviceWorker.ready;
		return Boolean(registration.active);
	});
	if (!sw) throw new Error("service worker is not active");
	log.push("PASS mobile responsive manifest service-worker");

	await demo.setViewportSize({ width: 1440, height: 1000 });
	await demo.reload({ waitUntil: "networkidle" });
	await demo.locator(".shell").waitFor();
	const desktopOverflow = await demo.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
	if (desktopOverflow) throw new Error("desktop horizontal overflow");
	await demo.screenshot({ path: `${visualEvidenceDir}/desktop.png`, fullPage: true });
	log.push("PASS desktop responsive layout");

	await demo.getByRole("button", { name: "친구 피드" }).click();
	const groupName = `QA 그룹 ${suffix}`;
	const initialGroups = await json(demo, "/api/groups");
	if (initialGroups.groups.length === 0) {
		await demo.getByPlaceholder("그룹 이름").fill(groupName);
		await demo.getByRole("button", { name: "그룹 만들기" }).click();
	}
	await demo.getByRole("button", { name: "초대 링크 만들기" }).waitFor();
	await demo.getByRole("button", { name: "초대 링크 만들기" }).click();
	const token = (await demo.locator(".invite-token").innerText()).trim();

	const friendContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const friend = await login(friendContext, "friend", "friend-pass");
	await friend.getByRole("button", { name: "친구 피드" }).click();
	await friend.locator("#invite-token").fill(token);
	await friend.getByRole("button", { name: "그룹 참여" }).click();

	const groups = await json(demo, "/api/groups");
	const groupId = groups.groups[0].id;
	const privateCategory = await json(demo, "/api/categories", {
		method: "POST",
		body: JSON.stringify({ name: `비공개-${suffix}`, color: "#191919", visibility: "private" }),
	});
	const groupCategory = await json(demo, "/api/categories", {
		method: "POST",
		body: JSON.stringify({
			name: `공유-${suffix}`,
			color: "#6C4DFF",
			visibility: "group",
			groupId,
		}),
	});
	await json(demo, "/api/tasks", {
		method: "POST",
		body: JSON.stringify({
			categoryId: privateCategory.id,
			title: `숨김-${suffix}`,
			date: new Date().toISOString().slice(0, 10),
		}),
	});
	const sharedTask = await json(demo, "/api/tasks", {
		method: "POST",
		body: JSON.stringify({
			categoryId: groupCategory.id,
			title: `공유-${suffix}`,
			date: new Date().toISOString().slice(0, 10),
		}),
	});
	await json(demo, `/api/tasks/${sharedTask.id}/completion`, {
		method: "PUT",
		body: JSON.stringify({ completed: true }),
	});

	await friend.reload({ waitUntil: "networkidle" });
	await friend.locator(".shell").waitFor();
	await friend.getByRole("button", { name: "친구 피드" }).click();
	const sharedCard = friend.locator(".social-task").filter({ hasText: `공유-${suffix}` });
	await sharedCard.waitFor();
	if (await friend.getByText(`숨김-${suffix}`, { exact: true }).isVisible().catch(() => false)) {
		throw new Error("private task leaked into friend feed");
	}
	await sharedCard.getByRole("button", { name: "👏" }).click();
	await demo.getByRole("button", { name: "알림" }).click();
	await demo.getByText("친구가 할 일에 반응했어요.").first().waitFor();
	await friend.screenshot({ path: `${socialEvidenceDir}/social-friend.png`, fullPage: true });
	await demo.screenshot({ path: `${socialEvidenceDir}/social-notification.png`, fullPage: true });
	log.push("PASS two-context group privacy reaction notification");
	await friendContext.close();
	await demoContext.close();
} finally {
	await browser.close();
}

await Bun.write(`${evidenceDir}/browser-qa.txt`, `${log.join("\n")}\n`);
console.log(log.join("\n"));
