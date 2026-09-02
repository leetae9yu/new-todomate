import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialApi } from "../api/social";

export function useSocial(date: string, enabled: boolean) {
	const queryClient = useQueryClient();
	const groups = useQuery({
		queryKey: ["groups"],
		queryFn: socialApi.groups,
		enabled,
	});
	const selectedGroupId = groups.data?.groups[0]?.id ?? null;
	const members = useQuery({
		queryKey: ["group-members", selectedGroupId],
		queryFn: () => socialApi.groupMembers(selectedGroupId ?? ""),
		enabled: enabled && selectedGroupId !== null,
	});
	const feed = useQuery({
		queryKey: ["group-feed", selectedGroupId, date],
		queryFn: () => socialApi.groupFeed(selectedGroupId ?? "", date),
		enabled: enabled && selectedGroupId !== null,
	});
	const refreshGroups = () => queryClient.invalidateQueries({ queryKey: ["groups"] });
	const refreshFeed = () =>
		queryClient.invalidateQueries({ queryKey: ["group-feed", selectedGroupId, date] });

	return {
		groups,
		members,
		feed,
		selectedGroupId,
		createGroup: useMutation({ mutationFn: socialApi.createGroup, onSuccess: refreshGroups }),
		createInvite: useMutation({ mutationFn: socialApi.createInvite }),
		respondInvite: useMutation({
			mutationFn: ({ token, accept }: { token: string; accept: boolean }) =>
				socialApi.respondInvite(token, accept),
			onSuccess: refreshGroups,
		}),
		react: useMutation({
			mutationFn: ({ taskId, emoji }: { taskId: string; emoji: string }) =>
				socialApi.react(taskId, emoji),
			onSuccess: refreshFeed,
		}),
		removeReaction: useMutation({
			mutationFn: socialApi.removeReaction,
			onSuccess: refreshFeed,
		}),
	};
}

export function useNotifications(enabled: boolean) {
	const queryClient = useQueryClient();
	const notifications = useQuery({
		queryKey: ["notifications"],
		queryFn: socialApi.notifications,
		enabled,
	});
	const read = useMutation({
		mutationFn: socialApi.readNotification,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
	});
	return { notifications, read };
}

export function useProfileSettings(enabled: boolean) {
	const queryClient = useQueryClient();
	const profile = useQuery({ queryKey: ["profile"], queryFn: socialApi.profile, enabled });
	const updateProfile = useMutation({
		mutationFn: socialApi.updateProfile,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
	});
	const updateSettings = useMutation({ mutationFn: socialApi.updateSettings });
	return { profile, updateProfile, updateSettings };
}
