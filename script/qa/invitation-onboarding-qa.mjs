import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.APP_URL;
const ownerUsername = process.env.OWNER_USERNAME ?? "admin";
const ownerPassword = process.env.OWNER_PASSWORD;
const evidenceDirectory = process.env.EVIDENCE_DIR;
if (!baseURL || !ownerPassword) throw new Error("APP_URL and OWNER_PASSWORD are required");
if (evidenceDirectory) await mkdir(evidenceDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const contexts = [];
const suffix = Date.now().toString().slice(-6);
const firstUsername = `invite_${suffix}`;
const secondUsername = `chain_${suffix}`;
const signupPassword = `Invite_${suffix}!`;

async function newPage() {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
	contexts.push(context);
	return context.newPage();
}

async function json(page, path, init = {}) {
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

async function signIn(page, username, password) {
	await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 30_000 });
	await page.locator("#login-username").fill(username);
	await page.locator("#login-password").fill(password);
	await page.getByRole("button", { name: "로그인", exact: true }).click();
	await page.locator(".shell").waitFor({ state: "visible", timeout: 30_000 });
}

async function openSocial(page) {
	await page.getByRole("button", { name: "친구 피드", exact: true }).click();
	await page.getByRole("heading", { name: "친구 피드", exact: true }).waitFor();
}

async function createInvitationLink(page) {
	const response = page.waitForResponse(
		(candidate) =>
			candidate.request().method() === "POST" &&
			/^\/api\/groups\/[^/]+\/invites$/.test(new URL(candidate.url()).pathname),
	);
	await page.getByRole("button", { name: "초대 링크 만들기", exact: true }).click();
	expect((await response).status()).toBe(201);
	const link = page.getByRole("button", { name: "초대 링크 복사", exact: true });
	await link.waitFor({ state: "visible" });
	return (await link.innerText()).trim();
}

async function signUp(page, link, username, name) {
	await page.goto(link, { waitUntil: "domcontentloaded", timeout: 30_000 });
	await page.getByRole("heading", { name: "초대 코드로 가입", exact: true }).waitFor();
	const previewResponse = page.waitForResponse(
		(candidate) => new URL(candidate.url()).pathname === "/api/invitations/preview",
	);
	await page.getByRole("button", { name: "코드 확인", exact: true }).click();
	expect((await previewResponse).status()).toBe(200);
	if (evidenceDirectory && username === firstUsername) {
		await page.screenshot({
			path: `${evidenceDirectory}/invitation-signup.png`,
			fullPage: true,
		});
	}
	await page.locator("#signup-name").fill(name);
	await page.locator("#signup-username").fill(username);
	await page.locator("#signup-password").fill(signupPassword);
	await page.locator("#signup-password-confirmation").fill(signupPassword);
	const signupResponse = page.waitForResponse(
		(candidate) => new URL(candidate.url()).pathname === "/api/invitations/signup",
	);
	await page.getByRole("button", { name: "가입하고 그룹 참여", exact: true }).click();
	expect((await signupResponse).status()).toBe(201);
	await page.locator(".shell").waitFor({ state: "visible", timeout: 30_000 });
}

try {
	const owner = await newPage();
	await signIn(owner, ownerUsername, ownerPassword);
	const groups = await json(owner, "/api/groups");
	expect(groups.status).toBe(200);
	let targetGroup = groups.body.groups[0];
	if (!targetGroup) {
		const createdGroup = await json(owner, "/api/groups", {
			method: "POST",
			body: JSON.stringify({ name: `실시간 초대 테스트 ${suffix}` }),
		});
		expect(createdGroup.status).toBe(201);
		targetGroup = createdGroup.body;
	}
	const ownerInvitations = await json(owner, "/api/invitations");
	expect(ownerInvitations.status).toBe(200);
	expect(ownerInvitations.body.remaining).toBeGreaterThan(0);

	await openSocial(owner);
	const firstLink = await createInvitationLink(owner);

	const firstMember = await newPage();
	await signUp(firstMember, firstLink, firstUsername, `초대 친구 ${suffix}`);
	const firstMemberGroups = await json(firstMember, "/api/groups");
	expect(firstMemberGroups.body.groups).toEqual(
		expect.arrayContaining([expect.objectContaining({ id: targetGroup.id, role: "member" })]),
	);
	await openSocial(firstMember);
	await expect(firstMember.getByText("초대권 3/3", { exact: true })).toBeVisible();
	await expect(firstMember.locator(".tabbar button")).toHaveCount(8);
	if (evidenceDirectory) {
		await firstMember.screenshot({
			path: `${evidenceDirectory}/new-member-three-invites.png`,
			fullPage: false,
		});
	}
	const secondLink = await createInvitationLink(firstMember);
	await expect(firstMember.getByText("초대권 2/3", { exact: true })).toBeVisible();

	const secondMember = await newPage();
	await signUp(secondMember, secondLink, secondUsername, `연쇄 친구 ${suffix}`);
	const secondMemberGroups = await json(secondMember, "/api/groups");
	expect(secondMemberGroups.body.groups).toEqual(
		expect.arrayContaining([expect.objectContaining({ id: targetGroup.id, role: "member" })]),
	);
	await openSocial(secondMember);
	await expect(secondMember.getByText(targetGroup.name, { exact: true })).toBeVisible();
	await expect(secondMember.getByText("초대권 3/3", { exact: true })).toBeVisible();
	await expect(secondMember.locator(".tabbar button")).toHaveCount(8);
	if (evidenceDirectory) {
		await secondMember.screenshot({
			path: `${evidenceDirectory}/second-generation-member.png`,
			fullPage: false,
		});
	}

	console.log(
		JSON.stringify({
			status: "passed",
			groupId: targetGroup.id,
			usernames: [firstUsername, secondUsername],
			newMemberInvitations: 3,
			afterIssuingInvitation: 2,
		}),
	);
} finally {
	await Promise.all(contexts.map((context) => context.close()));
	await browser.close();
}
