import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { todayKey } from "../api/dates";
import type {
	CategoryUpdateInput,
	DiaryEntry,
	PlannerSettings,
	RoutineInput,
	TimerState,
	User,
} from "../api/planner";
import { ApiClientError, api } from "../api/planner";

/* ------------------------------ session ------------------------------ */

export function useSession() {
	return useQuery<{ user: User } | null>({
		queryKey: ["session"],
		queryFn: async () => {
			try {
				const data = await api.session();
				return data?.user ? data : null;
			} catch {
				return null;
			}
		},
		staleTime: 60_000,
		retry: false,
	});
}

/* ------------------------------ planner day ------------------------------ */

export function usePlanner(date: string, enabled: boolean) {
	return useQuery({
		queryKey: ["planner", date],
		queryFn: () => api.planner(date),
		enabled,
	});
}

export function usePlannerMutations(date: string) {
	const queryClient = useQueryClient();
	const invalidate = () => queryClient.invalidateQueries({ queryKey: ["planner", date] });

	const createTask = useMutation({
		mutationFn: (body: { categoryId: string; title: string; date: string | null }) =>
			api.createTask(body),
		onSuccess: invalidate,
	});

	const updateTask = useMutation({
		mutationFn: ({
			id,
			body,
		}: {
			id: string;
			body: { title?: string; date?: string | null; position?: number };
		}) => api.updateTask(id, body),
		onSuccess: invalidate,
	});

	const setCompletion = useMutation({
		mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
			api.setCompletion(id, completed),
		onSuccess: invalidate,
	});

	return { createTask, updateTask, setCompletion };
}

/* ------------------------------ categories ------------------------------ */

export function useCategories(enabled: boolean) {
	return useQuery({
		queryKey: ["categories"],
		queryFn: async () => {
			const planner = await api.planner(todayKey());
			return {
				categories: planner.categories.map(
					({ tasks: _tasks, routines: _routines, ...category }) => category,
				),
			};
		},
		enabled,
	});
}

/** Planner-day queries affected by category/routine shape changes. */
const PLANNER_KEYS = [["planner"], ["categories"], ["routines"], ["backlog"], ["stats"]] as const;

export function useCategoryGroups(enabled: boolean) {
	return useQuery({
		queryKey: ["groups"],
		queryFn: () => api.categoryGroups(),
		enabled,
	});
}

export function useCategoryMutations() {
	const queryClient = useQueryClient();
	const invalidatePlannerData = () =>
		Promise.all(
			PLANNER_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: key })),
		);

	const createCategory = useMutation({
		mutationFn: (body: { name: string; color: string; visibility?: "private" | "group" }) =>
			api.createCategory(body),
		onSuccess: invalidatePlannerData,
	});

	const updateCategory = useMutation({
		mutationFn: ({ id, body }: { id: string; body: CategoryUpdateInput }) =>
			api.updateCategory(id, body),
		onSuccess: invalidatePlannerData,
	});

	const reorderCategory = useMutation({
		mutationFn: ({ id, position }: { id: string; position: number }) =>
			api.reorderCategory(id, position),
		onSuccess: invalidatePlannerData,
	});

	const deleteCategory = useMutation({
		mutationFn: (id: string) => api.deleteCategory(id),
		onSuccess: invalidatePlannerData,
	});

	return { createCategory, updateCategory, reorderCategory, deleteCategory };
}

/* ------------------------------ routines ------------------------------ */

export function useRoutines(enabled: boolean) {
	return useQuery({
		queryKey: ["routines"],
		queryFn: () => api.routines(),
		enabled,
	});
}

export function useRoutineMutations(date: string) {
	const queryClient = useQueryClient();
	const invalidate = () => queryClient.invalidateQueries({ queryKey: ["planner", date] });
	const invalidateRoutineData = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: ["routines"] }),
			queryClient.invalidateQueries({ queryKey: ["planner"] }),
		]);

	const createRoutine = useMutation({
		mutationFn: (body: RoutineInput) => api.createRoutine(body),
		onSuccess: invalidateRoutineData,
	});

	const updateRoutine = useMutation({
		mutationFn: ({ id, body }: { id: string; body: RoutineInput }) => api.updateRoutine(id, body),
		onSuccess: invalidateRoutineData,
	});

	const setRoutineStatus = useMutation({
		mutationFn: ({ id, status }: { id: string; status: "active" | "paused" }) =>
			api.setRoutineStatus(id, status),
		onSuccess: invalidateRoutineData,
	});

	const deleteRoutine = useMutation({
		mutationFn: (id: string) => api.deleteRoutine(id),
		onSuccess: invalidateRoutineData,
	});

	const setOccurrence = useMutation({
		mutationFn: ({
			routineId,
			date: occurrenceDate,
			completed,
		}: {
			routineId: string;
			date: string;
			completed: boolean;
		}) => api.setRoutineOccurrence(routineId, occurrenceDate, completed),
		onSuccess: invalidate,
	});

	return { createRoutine, updateRoutine, setRoutineStatus, deleteRoutine, setOccurrence };
}

/* ------------------------------ settings ------------------------------ */

export function useSettings(enabled: boolean) {
	const queryClient = useQueryClient();
	const query = useQuery({
		queryKey: ["settings"],
		queryFn: () => api.settings(),
		enabled,
		staleTime: 60_000,
	});
	const save = useMutation({
		mutationFn: (body: PlannerSettings) => api.updateSettings(body),
		onSuccess: (saved) => queryClient.setQueryData(["settings"], saved),
	});
	return { query, save };
}

/* ------------------------------ backlog ------------------------------ */

export function useBacklog(enabled: boolean) {
	return useQuery({
		queryKey: ["backlog"],
		queryFn: () => api.backlog(),
		enabled,
	});
}

export function useBacklogMutations() {
	const queryClient = useQueryClient();

	const scheduleBacklog = useMutation({
		mutationFn: ({ id, date }: { id: string; date: string }) => api.updateTask(id, { date }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backlog"] }),
	});

	const createBacklogTask = useMutation({
		mutationFn: (body: { categoryId: string; title: string }) =>
			api.createTask({ ...body, date: null }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backlog"] }),
	});

	return { scheduleBacklog, createBacklogTask };
}

/* ------------------------------ diary ------------------------------ */

export function useDiary(date: string, enabled: boolean) {
	return useQuery<DiaryEntry | null>({
		queryKey: ["diary", date],
		queryFn: async () => {
			try {
				return await api.getDiary(date);
			} catch (error) {
				if (error instanceof ApiClientError && error.status === 404) {
					return null;
				}
				throw error;
			}
		},
		enabled,
		retry: false,
	});
}

export function useDiaryMutation(date: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (body: { mood: string; body: string }) => api.putDiary(date, body),
		onSuccess: (entry) => queryClient.setQueryData(["diary", date], entry),
	});
}

/* ------------------------------ stats ------------------------------ */

export function useStats(from: string, to: string, enabled: boolean) {
	return useQuery({
		queryKey: ["stats", from, to],
		queryFn: () => api.stats(from, to),
		enabled,
	});
}

/* ------------------------------ timer ------------------------------ */

const ACTIVE_TIMER_QUERY_KEY = ["timer", "active"] as const;
const IDLE_TIMER_STATE: TimerState = {
	status: "idle",
	taskId: null,
	taskTitle: null,
	startedAt: null,
	elapsedSeconds: 0,
};

export function useTimer() {
	const queryClient = useQueryClient();
	const activeQuery = useQuery({
		queryKey: ACTIVE_TIMER_QUERY_KEY,
		queryFn: () => api.timerActive(),
		refetchOnWindowFocus: true,
		staleTime: 0,
	});
	const start = useMutation({
		mutationFn: (taskId: string) => api.timerStart(taskId),
		onMutate: () => queryClient.cancelQueries({ queryKey: ACTIVE_TIMER_QUERY_KEY }),
		onSuccess: (state) => queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, state),
		onError: () => queryClient.invalidateQueries({ queryKey: ACTIVE_TIMER_QUERY_KEY }),
	});
	const stop = useMutation({
		mutationFn: (taskId: string) => api.timerStop(taskId),
		onMutate: () => queryClient.cancelQueries({ queryKey: ACTIVE_TIMER_QUERY_KEY }),
		onSuccess: () => queryClient.setQueryData(ACTIVE_TIMER_QUERY_KEY, IDLE_TIMER_STATE),
	});
	const [displayClock, setDisplayClock] = useState({
		taskId: null as string | null,
		elapsedSeconds: 0,
	});

	const active = activeQuery.data;
	const runningTaskId = active?.status === "running" ? (active.taskId ?? null) : null;
	const serverElapsed = active?.elapsedSeconds ?? 0;

	useEffect(() => {
		setDisplayClock((current) => {
			if (!runningTaskId) {
				if (current.taskId === null && current.elapsedSeconds === serverElapsed) {
					return current;
				}
				return { taskId: null, elapsedSeconds: serverElapsed };
			}
			if (current.taskId !== runningTaskId) {
				return { taskId: runningTaskId, elapsedSeconds: serverElapsed };
			}
			const elapsedSeconds = Math.max(current.elapsedSeconds, serverElapsed);
			return elapsedSeconds === current.elapsedSeconds
				? current
				: { taskId: runningTaskId, elapsedSeconds };
		});
	}, [runningTaskId, serverElapsed]);

	useEffect(() => {
		if (!runningTaskId) {
			return;
		}
		const interval = window.setInterval(() => {
			setDisplayClock((current) =>
				current.taskId === runningTaskId
					? { ...current, elapsedSeconds: current.elapsedSeconds + 1 }
					: current,
			);
		}, 1000);
		return () => window.clearInterval(interval);
	}, [runningTaskId]);

	const elapsedSeconds = runningTaskId
		? displayClock.taskId === runningTaskId
			? Math.max(displayClock.elapsedSeconds, serverElapsed)
			: serverElapsed
		: serverElapsed;

	return {
		active,
		elapsedSeconds,
		begin: start.mutate,
		finish: stop.mutate,
		refetch: activeQuery.refetch,
		isHydrating: activeQuery.isPending && active === undefined,
		hasLoadError: activeQuery.isError && active === undefined,
		hasActionError: runningTaskId ? stop.isError : start.isError,
		isPending: start.isPending || stop.isPending,
	};
}
