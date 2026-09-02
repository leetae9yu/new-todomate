import { describe, expect, test } from "bun:test";
import { exists } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

describe("installable PWA contract", () => {
	test("ships a standalone manifest and service worker registration", async () => {
		const viteConfig = await Bun.file(join(root, "vite.config.ts")).text();
		const entry = await Bun.file(join(root, "src/web/main.tsx")).text();

		expect(viteConfig).toContain("VitePWA");
		expect(viteConfig).toContain('display: "standalone"');
		expect(viteConfig).toContain('start_url: "/"');
		expect(entry).toContain("virtual:pwa-register");
	});

	test("ships install icons and Korean primary navigation", async () => {
		const tabs = await Bun.file(join(root, "src/web/planner-tabs.tsx")).text();

		expect(await exists(join(root, "public/icon.svg"))).toBe(true);
		for (const label of ["홈", "캘린더", "친구 피드", "알림", "프로필"]) {
			expect(tabs).toContain(`label: "${label}"`);
		}
	});
});
