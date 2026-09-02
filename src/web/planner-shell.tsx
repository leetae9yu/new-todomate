import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { addDays, addMonths, todayKey } from "./api/dates";
import { api, type Category } from "./api/planner";
import { BacklogScreen } from "./components/backlog";
import { Drawer, TabBar, TopBar } from "./components/chrome";
import { DiaryScreen } from "./components/diary";
import { PlannerHome } from "./components/planner-home";
import { PlannerDateNavigation } from "./components/planner-date-navigation";
import { PlannerSocialViews } from "./components/planner-social-views";
import { RoutinesScreen } from "./components/routines";
import { Splash } from "./components/splash";
import { StatsScreen } from "./components/stats";
import { TimerScreen } from "./components/timer";
import { TABS } from "./planner-tabs";
import {
	useBacklog,
	useBacklogMutations,
	useCategories,
	useCategoryMutations,
	useDiary,
	useDiaryMutation,
	usePlanner,
	usePlannerMutations,
	useRoutineMutations,
	useStats,
	useTimer,
} from "./hooks/planner";

export function PlannerShell({ username }: { username: string }) {
	const queryClient = useQueryClient();
	const [view, setView] = useState("home");
	const [date, setDate] = useState(todayKey());
	const [menuOpen, setMenuOpen] = useState(false);
	const [calendarView, setCalendarView] = useState<"주" | "월">("주");
	const [monthAnchor, setMonthAnchor] = useState(todayKey());

	const signedIn = true;
	const planner = usePlanner(date, signedIn);
	const categories = useCategories(signedIn);
	const backlog = useBacklog(signedIn && view === "backlog");
	const diary = useDiary(date, signedIn && view === "diary");
	const monthStart = `${date.slice(0, 7)}-01`;
	const monthEnd = addDays(addMonths(monthStart, 1), -1);
	const stats = useStats(monthStart, monthEnd, signedIn && view === "stats");

	const plannerMutations = usePlannerMutations(date);
	const routineMutations = useRoutineMutations(date);
	const backlogMutations = useBacklogMutations();
	const diaryMutation = useDiaryMutation(date);
	const categoryMutations = useCategoryMutations();
	const timer = useTimer();

	const activeTimerTaskId = timer.active?.status === "running" ? timer.active.taskId ?? null : null;

	const timerLabelFor = (taskId: string) => {
		if (timer.active?.taskId !== taskId) {
			return null;
		}
		return timer.active.status === "running" ? "진행 중" : "완료";
	};

	const categoryMap = useMemo(() => {
		const map = new Map<string, Category>();
		for (const category of categories.data?.categories ?? []) {
			map.set(category.id, category);
		}
		return map;
	}, [categories.data]);

	const shiftWeek = (direction: -1 | 1) => {
		setDate(addDays(date, direction * 7));
	};

	const shiftMonth = (direction: -1 | 1) => {
		const next = addMonths(monthAnchor, direction);
		setMonthAnchor(next);
	};

	const onSelectDate = (next: string) => {
		setDate(next);
		if (view === "calendar") {
			setMonthAnchor(next);
		}
	};

	const startTimerFor = (taskId: string) => {
		setView("timer");
		timer.begin(taskId);
	};

	const [splashDone, setSplashDone] = useState(false);
	useEffect(() => {
		const timer = window.setTimeout(() => setSplashDone(true), 1700);
		return () => window.clearTimeout(timer);
	}, []);

	if (!splashDone) {
		return <Splash />;
	}

	return (
		<div className="shell shell__with-rail">
			<TopBar userName={username} onOpenMenu={() => setMenuOpen(true)} />
			<main className="plane">
				<PlannerDateNavigation
					view={view}
					date={date}
					monthAnchor={monthAnchor}
					calendarView={calendarView}
					planner={planner.data}
					username={username}
					onCalendarView={setCalendarView}
					onPrev={() => (view === "calendar" ? shiftMonth(-1) : shiftWeek(-1))}
					onNext={() => (view === "calendar" ? shiftMonth(1) : shiftWeek(1))}
					onSelectDate={onSelectDate}
				/>

				{view === "home" && (
					<PlannerHome
						date={date}
						monthAnchor={monthAnchor}
						planner={planner.data}
						loading={planner.isLoading}
						error={planner.isError}
						categories={categories.data?.categories}
						activeTimerTaskId={activeTimerTaskId}
						timerLabelFor={timerLabelFor}
						onSelectDate={onSelectDate}
						onToggleTask={(task) =>
							plannerMutations.setCompletion.mutate({
								id: task.id,
								completed: !task.completed,
							})
						}
						onUpdateTask={(taskId, body) =>
							plannerMutations.updateTask.mutate({ id: taskId, body })
						}
						onBacklogTask={(taskId) =>
							plannerMutations.updateTask.mutate({ id: taskId, body: { date: null } })
						}
						onAddTask={(categoryId, title) =>
							plannerMutations.createTask.mutate({ categoryId, title, date })
						}
						onStartTimer={startTimerFor}
						onToggleRoutine={(routineId, completed) =>
							routineMutations.setOccurrence.mutate({ routineId, date, completed })
						}
						onCreateCategory={(body) =>
							categoryMutations.createCategory.mutate({ ...body, visibility: "private" })
						}
						onOpen={setView}
					/>
				)}

				{view === "routines" && (
					<RoutinesScreen
						categories={categories.data?.categories}
						routines={planner.data?.routines?.map((routine) => ({
							id: routine.id,
							categoryId: routine.categoryId,
							title: routine.title,
							frequency: routine.frequency ?? { type: "daily" },
							startDate: routine.startDate ?? date,
							endDate: routine.endDate ?? null,
						}))}
						loading={categories.isLoading}
						error={categories.isError}
						onCreate={(body) => routineMutations.createRoutine.mutate(body)}
					/>
				)}

				{view === "backlog" && (
					<BacklogScreen
						tasks={backlog.data?.tasks}
						loading={backlog.isLoading}
						error={backlog.isError}
						categories={categories.data?.categories}
						onSchedule={(taskId, targetDate) =>
							backlogMutations.scheduleBacklog.mutate({ id: taskId, date: targetDate })
						}
						onAdd={(categoryId, title) =>
							backlogMutations.createBacklogTask.mutate({ categoryId, title })
						}
					/>
				)}

				{view === "stats" && (
					<StatsScreen
						stats={stats.data?.categories.map((stat) => ({
							...stat,
							name: categoryMap.get(stat.categoryId)?.name ?? stat.name,
							color: categoryMap.get(stat.categoryId)?.color ?? stat.color,
						}))}
						loading={stats.isLoading}
						error={stats.isError}
					/>
				)}

				{view === "diary" && (
					<DiaryScreen
						date={date}
						diary={diary.data}
						loading={diary.isLoading}
						error={diary.isError}
						onSave={(body) => diaryMutation.mutate(body)}
						onSelectDate={setDate}
					/>
				)}

				{view === "timer" && (
					<TimerScreen
						planner={planner.data}
						activeTaskId={activeTimerTaskId}
						elapsedSeconds={timer.elapsedSeconds}
						onStart={timer.begin}
						onStop={timer.finish}
						pending={timer.isPending}
					/>
				)}
				<PlannerSocialViews view={view} date={date} />
			</main>
			<TabBar
				items={TABS}
				view={view}
				onChange={(key) => {
					setView(key);
					if (key === "calendar") {
						setMonthAnchor(date);
					}
				}}
			/>
			<Drawer
				open={menuOpen}
				onClose={() => setMenuOpen(false)}
				userName={username}
				onSignOut={() => {
					api
						.signOut()
						.catch(() => undefined)
						.finally(() => {
							queryClient.clear();
							setMenuOpen(false);
						});
				}}
			/>
		</div>
	);
}
