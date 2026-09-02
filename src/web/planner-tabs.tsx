import {
	Archive,
	Bell,
	CalendarDays,
	ChartColumn,
	Home,
	Repeat,
	UserRound,
	Users,
} from "lucide-react";

export const TABS = [
	{ key: "home", label: "홈", icon: <Home /> },
	{ key: "calendar", label: "캘린더", icon: <CalendarDays /> },
	{ key: "routines", label: "루틴", icon: <Repeat /> },
	{ key: "backlog", label: "보관함", icon: <Archive /> },
	{ key: "stats", label: "통계", icon: <ChartColumn /> },
	{ key: "social", label: "친구 피드", icon: <Users /> },
	{ key: "notifications", label: "알림", icon: <Bell /> },
	{ key: "profile", label: "프로필", icon: <UserRound /> },
];
