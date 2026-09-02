import type { Task, User } from "./planner";
import { requestJson } from "./planner";

export type SocialGroup = { id: string; name: string; role: "owner" | "admin" | "member" };
export type GroupMember = {
	id: string;
	username: string;
	name: string;
	image: string | null;
	role: SocialGroup["role"];
};
export type FeedTask = Task & {
	ownerId: string;
	categoryName: string;
	color: string;
	reactions: Array<{ emoji: string; count: number }>;
};
export type SocialNotification = {
	id: string;
	type: string;
	readAt: string | null;
	createdAt: string;
	deepLink?: { taskId: string; groupId: string };
};

export const socialApi = {
	groups: () => requestJson<{ groups: SocialGroup[] }>("/api/groups"),
	createGroup: (name: string) =>
		requestJson<SocialGroup>("/api/groups", {
			method: "POST",
			body: JSON.stringify({ name }),
		}),
	createInvite: (groupId: string) =>
		requestJson<{ token: string }>(`/api/groups/${groupId}/invites`, {
			method: "POST",
			body: "{}",
		}),
	respondInvite: (token: string, accept: boolean) =>
		requestJson<{ groupId: string; role: SocialGroup["role"] }>(
			`/api/invites/${token}/respond`,
			{ method: "POST", body: JSON.stringify({ accept }) },
		),
	groupMembers: (groupId: string) =>
		requestJson<GroupMember[]>(`/api/groups/${groupId}/members`),
	groupFeed: (groupId: string, date: string) =>
		requestJson<{ tasks: FeedTask[] }>(`/api/groups/${groupId}/feed?date=${date}`),
	react: (taskId: string, emoji: string) =>
		requestJson<{ emoji: string }>(`/api/tasks/${taskId}/reactions`, {
			method: "POST",
			body: JSON.stringify({ emoji }),
		}),
	removeReaction: (taskId: string) =>
		requestJson<{ removed: boolean }>(`/api/tasks/${taskId}/reactions`, {
			method: "DELETE",
		}),
	notifications: () =>
		requestJson<{ notifications: SocialNotification[] }>("/api/notifications"),
	readNotification: (id: string) =>
		requestJson<{ id: string; readAt: string }>(`/api/notifications/${id}/read`, {
			method: "PATCH",
			body: "{}",
		}),
	profile: () => requestJson<User>("/api/profile"),
	updateProfile: (body: { name: string; image?: string | null }) =>
		requestJson<User>("/api/profile", { method: "PATCH", body: JSON.stringify(body) }),
	updateSettings: (body: {
		theme: "system" | "light" | "dark";
		notificationsEnabled: boolean;
	}) =>
		requestJson<{ theme: string; notificationsEnabled: boolean }>("/api/settings", {
			method: "PUT",
			body: JSON.stringify(body),
		}),
};
