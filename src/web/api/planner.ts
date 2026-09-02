/**
 * Typed client for the authenticated personal-planner API.
 * All requests flow through `requestJson`, which surfaces API error payloads
 * on `ApiClientError` and preserves credentials via same-origin cookies.
 */

export type Frequency =
	| { type: "daily" }
	| { type: "weekdays"; days: number[] }
	| { type: "monthly"; days: number[] };

export type User = {
	id: string;
	name: string;
	username: string;
	displayUsername?: string | null;
	status: "active";
	image?: string | null;
};

export type Category = {
	id: string;
	name: string;
	color: string;
	visibility: "private" | "group";
};

export type Task = {
	id: string;
	categoryId?: string;
	title: string;
	completed: boolean;
	completedAt: string | null;
	date: string | null;
	position: number;
};

export type PlannerCategory = Category & {
	tasks: Task[];
	routines?: RoutineOccurrence[];
};

export type RoutineOccurrence = {
	id: string;
	categoryId: string;
	title: string;
	completed: boolean;
	frequency?: Frequency;
	startDate?: string;
	endDate?: string | null;
};

export type Routine = {
	id: string;
	categoryId: string;
	title: string;
	frequency: Frequency;
	startDate: string;
	endDate: string | null;
};

export type PlannerDay = {
	date: string;
	categories: PlannerCategory[];
	routines: RoutineOccurrence[];
	overdue: Task[];
};

export type DiaryEntry = {
	date: string;
	mood: string;
	body: string;
};

export type TimerState = {
	status: "idle" | "running" | "paused" | "stopped";
	taskId?: string | null;
	taskTitle?: string | null;
	startedAt?: string | null;
	elapsedSeconds?: number;
};

export type CategoryStat = {
	categoryId: string;
	name?: string | undefined;
	color?: string | undefined;
	completed: number;
	total: number;
	rate: number;
	days?: Array<{ date: string; completed: boolean }> | undefined;
};

export class ApiClientError extends Error {
	code: string;
	status: number;

	constructor(status: number, payload: unknown) {
		const parsed = payload as { error?: { code?: string; message?: string } };
		super(parsed?.error?.message ?? "요청을 처리하지 못했어요.");
		this.code = parsed?.error?.code ?? "UNKNOWN";
		this.status = status;
	}
}

export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
	const response = await fetch(path, {
		credentials: "same-origin",
		...init,
		headers: {
			...(init.body !== undefined ? { "content-type": "application/json" } : {}),
			...init.headers,
		},
	});

	if (!response.ok) {
		let payload: unknown = null;
		try {
			payload = await response.json();
		} catch {
			payload = null;
		}
		throw new ApiClientError(response.status, payload);
	}

	if (response.status === 204) {
		return undefined as T;
	}
	return (await response.json()) as T;
}

export const api = {
	/* ---- auth ---- */
	session: () => requestJson<{ user: User }>("/api/auth/get-session"),
	signIn: (username: string, password: string) =>
		requestJson<{ user: User }>("/api/auth/sign-in", {
			method: "POST",
			body: JSON.stringify({ username, password }),
		}),
	signOut: () => requestJson<unknown>("/api/auth/sign-out", { method: "POST", body: "{}" }),

	/* ---- categories ---- */
	createCategory: (body: { name: string; color: string; visibility?: Category["visibility"] }) =>
		requestJson<Category>("/api/categories", { method: "POST", body: JSON.stringify(body) }),

	/* ---- planner day ---- */
	planner: (date: string) => requestJson<PlannerDay>(`/api/planner?date=${date}`),

	/* ---- tasks ---- */
	createTask: (body: { categoryId: string; title: string; date: string | null }) =>
		requestJson<Task>("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
	updateTask: (
		id: string,
		body: { title?: string; date?: string | null; position?: number },
	) => requestJson<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
	setCompletion: (id: string, completed: boolean) =>
		requestJson<Task>(`/api/tasks/${id}/completion`, {
			method: "PUT",
			body: JSON.stringify({ completed }),
		}),

	/* ---- routines ---- */
	createRoutine: (body: { categoryId: string; title: string; startDate: string; frequency: Frequency }) =>
		requestJson<Routine>("/api/routines", { method: "POST", body: JSON.stringify(body) }),
	setRoutineOccurrence: (routineId: string, date: string, completed: boolean) =>
		requestJson<RoutineOccurrence>(
			`/api/routines/${routineId}/occurrences/${date}/completion`,
			{ method: "PUT", body: JSON.stringify({ completed }) },
		),

	/* ---- backlog ---- */
	backlog: () => requestJson<{ tasks: Task[] }>("/api/backlog"),

	/* ---- diary ---- */
	getDiary: (date: string) => requestJson<DiaryEntry>(`/api/diary/${date}`),
	putDiary: (date: string, body: { mood: string; body: string }) =>
		requestJson<DiaryEntry>(`/api/diary/${date}`, {
			method: "PUT",
			body: JSON.stringify(body),
		}),

	/* ---- timer ---- */
	timerStart: (taskId: string) =>
		requestJson<TimerState>(`/api/tasks/${taskId}/timer/start`, {
			method: "POST",
			body: "{}",
		}),
	timerStop: (taskId: string) =>
		requestJson<TimerState>(`/api/tasks/${taskId}/timer/stop`, {
			method: "POST",
			body: "{}",
		}),

	/* ---- stats ---- */
	stats: (from: string, to: string) =>
		requestJson<{ categories: CategoryStat[] }>(
			`/api/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
		),
};
