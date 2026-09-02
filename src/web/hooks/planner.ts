import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { todayKey } from "../api/dates";
import { api, ApiClientError } from "../api/planner";
import type { DiaryEntry, Frequency, TimerState, User } from "../api/planner";

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
		mutationFn: ({ id, body }: { id: string; body: { title?: string; date?: string | null; position?: number } }) =>
			api.updateTask(id, body),
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
				categories: planner.categories.map(({ tasks: _tasks, routines: _routines, ...category }) => category),
			};
		},
		enabled,
	});
}

export function useCategoryMutations() {
	const queryClient = useQueryClient();

	const createCategory = useMutation({
		mutationFn: (body: { name: string; color: string; visibility?: "private" | "group" }) =>
			api.createCategory(body),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planner"] }),
	});

	return { createCategory };
}

/* ------------------------------ routines ------------------------------ */

export function useRoutineMutations(date: string) {
	const queryClient = useQueryClient();
	const invalidate = () => queryClient.invalidateQueries({ queryKey: ["planner", date] });

	const createRoutine = useMutation({
		mutationFn: (body: { categoryId: string; title: string; startDate: string; frequency: Frequency }) =>
			api.createRoutine(body),
		onSuccess: invalidate,
	});

	const setOccurrence = useMutation({
		mutationFn: ({ routineId, date: occurrenceDate, completed }: { routineId: string; date: string; completed: boolean }) =>
			api.setRoutineOccurrence(routineId, occurrenceDate, completed),
		onSuccess: invalidate,
	});

	return { createRoutine, setOccurrence };
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
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["diary", date] }),
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

export function useTimer() {
	const [elapsedTick, setElapsedTick] = useState(0);

	const start = useMutation({ mutationFn: (taskId: string) => api.timerStart(taskId) });
	const stop = useMutation({ mutationFn: (taskId: string) => api.timerStop(taskId) });
	const [active, setActive] = useState<TimerState | null>(null);

	useEffect(() => {
		if (active?.status !== "running") {
			return;
		}
		const interval = window.setInterval(() => setElapsedTick((tick) => tick + 1), 1000);
		return () => window.clearInterval(interval);
	}, [active?.status]);

	const elapsedSeconds =
		active?.status === "running"
			? (active.elapsedSeconds ?? 0) + elapsedTick
			: (active?.elapsedSeconds ?? 0);

	const begin = (taskId: string) => {
		start.mutate(taskId, {
			onSuccess: (state) => {
				setElapsedTick(0);
				setActive({ ...state, status: "running" });
			},
		});
	};

	const finish = (taskId: string) => {
		stop.mutate(taskId, {
			onSuccess: (state) => {
				setActive({ ...state, status: "stopped" });
			},
		});
	};

	return {
		active,
		elapsedSeconds,
		begin,
		finish,
		isPending: start.isPending || stop.isPending,
	};
}
