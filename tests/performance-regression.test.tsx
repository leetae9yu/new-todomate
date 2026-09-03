import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PlannerShell } from "../src/web/planner-shell";

describe("startup performance regressions", () => {
	test("renders the authenticated shell immediately without a decorative delay", () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { enabled: false } },
		});
		const html = renderToStaticMarkup(
			<QueryClientProvider client={queryClient}>
				<PlannerShell username="성능 점검" />
			</QueryClientProvider>,
		);

		expect(html).toContain('class="shell shell__with-rail"');
		expect(html).not.toContain('class="splash"');
	});
});
