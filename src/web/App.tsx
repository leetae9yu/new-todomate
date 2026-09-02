import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginScreen } from "./components/login";
import { Splash } from "./components/splash";
import { useSession } from "./hooks/planner";
import { PlannerShell } from "./planner-shell";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: 1 },
	},
});

function PlannerGate() {
	const session = useSession();

	if (session.isLoading) {
		return <Splash />;
	}
	if (!session.data) {
		return <LoginScreen />;
	}
	return <PlannerShell username={session.data.user.name} />;
}

export function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<PlannerGate />
		</QueryClientProvider>
	);
}
