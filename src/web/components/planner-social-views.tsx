import { useNotifications, useProfileSettings, useSocial } from "../hooks/social";
import { NotificationsScreen } from "./notifications";
import { ProfileSettingsScreen } from "./profile-settings";
import { SocialScreen } from "./social";

export function PlannerSocialViews({ view, date }: { view: string; date: string }) {
	const social = useSocial(date, view === "social");
	const notifications = useNotifications(view === "notifications");
	const profileSettings = useProfileSettings(view === "profile");

	if (view === "social") return <SocialScreen social={social} />;
	if (view === "notifications") return <NotificationsScreen state={notifications} />;
	if (view === "profile") return <ProfileSettingsScreen state={profileSettings} />;
	return null;
}
