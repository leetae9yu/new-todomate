import { useEffect, useState } from "react";

type HealthState = "checking" | "ready" | "offline";

export function App() {
	const [health, setHealth] = useState<HealthState>("checking");

	useEffect(() => {
		const controller = new AbortController();

		fetch("/api/health", { signal: controller.signal })
			.then((response) => {
				setHealth(response.ok ? "ready" : "offline");
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setHealth("offline");
				}
			});

		return () => controller.abort();
	}, []);

	return (
		<main className="bootstrap-shell">
			<p className="eyebrow">PRIVATE BETA</p>
			<h1>new todomate</h1>
			<p>친구들과 오늘 할 일을 나누는 공간을 준비하고 있어요.</p>
			<span className={`health health--${health}`}>API {health}</span>
		</main>
	);
}
