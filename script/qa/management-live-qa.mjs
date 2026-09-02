import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.APP_URL;
const password = process.env.ADMIN_PASSWORD;
const evidenceDirectory = process.env.EVIDENCE_DIR ?? ".omo/evidence/management";
if (!baseURL || !password) throw new Error("APP_URL and ADMIN_PASSWORD are required");

await mkdir(evidenceDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const log = [];

async function json(path, init = {}) {
	return page.evaluate(
		async ({ path: target, init: options }) => {
			const response = await fetch(target, {
				credentials: "same-origin",
				...options,
				headers: { "content-type": "application/json", ...(options.headers ?? {}) },
			});
			const text = response.status === 204 ? "" : await response.text();
			return { status: response.status, body: text ? JSON.parse(text) : null };
		},
		{ path, init },
	);
}

async function openManagement(label, testId) {
	await page.getByRole("button", { name: "메뉴 열기" }).click();
	await page.getByRole("button", { name: label, exact: true }).click();
	await page.getByTestId(testId).waitFor({ timeout: 15_000 });
}

try {
	await page.goto(baseURL, { waitUntil: "networkidle" });
	await page.locator("#login-username").fill("admin");
	await page.locator("#login-password").fill(password);
	await page.getByRole("button", { name: "로그인", exact: true }).click();
	await page.locator(".shell").waitFor({ timeout: 15_000 });

	const suffix = Date.now().toString().slice(-6);
	const categoryName = `관리 QA ${suffix}`;
	const routineCategoryName = `루틴 QA ${suffix}`;
	const category = await json("/api/categories", {
		method: "POST",
		body: JSON.stringify({ name: categoryName, color: "#6C4DFF", visibility: "private" }),
	});
	const routineCategory = await json("/api/categories", {
		method: "POST",
		body: JSON.stringify({ name: routineCategoryName, color: "#00A86B", visibility: "private" }),
	});
	expect(category.status).toBe(201);
	expect(routineCategory.status).toBe(201);
	const routineTitle = `관리 루틴 ${suffix}`;
	const routine = await json("/api/routines", {
		method: "POST",
		body: JSON.stringify({
			categoryId: routineCategory.body.id,
			title: routineTitle,
			startDate: new Date().toISOString().slice(0, 10),
			frequency: { type: "daily" },
		}),
	});
	expect(routine.status).toBe(201);

	await page.reload({ waitUntil: "networkidle" });
	await page.locator(".shell").waitFor();
	await openManagement("카테고리 관리", "category-management");
	const categoryCard = page.locator(`[data-category-id="${category.body.id}"]`);
	await categoryCard.getByRole("button", { name: `${categoryName} 수정` }).click();
	const renamedCategory = `${categoryName} 수정`;
	await categoryCard.locator(`#category-name-${category.body.id}`).fill(renamedCategory);
	await categoryCard.locator(`#category-color-${category.body.id}`).fill("#3366ff");
	await categoryCard.getByRole("button", { name: "저장", exact: true }).click();
	await expect(page.getByText(`${renamedCategory} 카테고리를 저장했어요.`, { exact: true })).toBeVisible();

	const moveUp = categoryCard.getByRole("button", { name: `${renamedCategory} 위로 이동` });
	const moveDown = categoryCard.getByRole("button", { name: `${renamedCategory} 아래로 이동` });
	if (await moveUp.isEnabled()) {
		await moveUp.click();
	} else {
		await moveDown.click();
	}
	await expect(page.getByText(`${renamedCategory} 순서를 변경했어요.`, { exact: true })).toBeVisible();
	await page.screenshot({ path: `${evidenceDirectory}/category-management.png`, fullPage: true });

	await page.reload({ waitUntil: "networkidle" });
	await openManagement("카테고리 관리", "category-management");
	await expect(page.getByText(renamedCategory, { exact: true })).toBeVisible();
	page.once("dialog", (dialog) => dialog.accept());
	await page.getByRole("button", { name: `${renamedCategory} 삭제` }).click();
	await expect(page.getByText(`${renamedCategory} 카테고리를 삭제했어요.`, { exact: true })).toBeVisible();
	log.push({ action: "category-update-reorder-delete", verdict: "passed" });

	await page.getByRole("button", { name: "홈으로 돌아가기" }).click();
	await openManagement("루틴 관리", "routine-management");
	const routineCard = page.locator(`[data-routine-id="${routine.body.id}"]`);
	await routineCard.getByRole("button", { name: `${routineTitle} 수정` }).click();
	const renamedRoutine = `${routineTitle} 수정`;
	await routineCard.locator(`#routine-name-${routine.body.id}`).fill(renamedRoutine);
	await routineCard.getByRole("button", { name: "저장", exact: true }).click();
	await expect(page.getByText(`${renamedRoutine} 루틴을 저장했어요.`, { exact: true })).toBeVisible();
	await page.getByRole("button", { name: `${renamedRoutine} 일시정지` }).click();
	await expect(page.getByText(`${renamedRoutine} 루틴을 잠시 멈췄어요.`, { exact: true })).toBeVisible();
	await page.getByRole("button", { name: `${renamedRoutine} 다시 시작` }).click();
	await expect(page.getByText(`${renamedRoutine} 루틴을 다시 시작했어요.`, { exact: true })).toBeVisible();
	await page.screenshot({ path: `${evidenceDirectory}/routine-management.png`, fullPage: true });

	page.once("dialog", (dialog) => dialog.accept());
	await page.getByRole("button", { name: `${renamedRoutine} 삭제` }).click();
	await expect(page.getByText(`${renamedRoutine} 루틴을 삭제했어요.`, { exact: true })).toBeVisible();
	await page.reload({ waitUntil: "networkidle" });
	await openManagement("루틴 관리", "routine-management");
	await expect(page.getByText(renamedRoutine, { exact: true })).toHaveCount(0);
	log.push({ action: "routine-edit-pause-resume-delete", verdict: "passed" });

	console.log("PASS live category and routine management persistence");
} finally {
	await context.close();
	await browser.close();
	log.push({ action: "cleanup", contexts: 0, browserClosed: true });
	await Bun.write(`${evidenceDirectory}/result.json`, `${JSON.stringify(log, null, 2)}\n`);
}
