import { Save, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReturnTypeOfProfileSettings } from "./social-types";

export function ProfileSettingsScreen({
	state,
}: {
	state: ReturnTypeOfProfileSettings;
}) {
	const [name, setName] = useState("");
	const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
	const [notificationsEnabled, setNotificationsEnabled] = useState(true);

	useEffect(() => {
		if (state.profile.data?.name) setName(state.profile.data.name);
	}, [state.profile.data?.name]);

	return (
		<section className="social-screen">
			<header className="social-screen__head">
				<div>
					<p className="eyebrow">MY PROFILE</p>
					<h2>프로필 · 설정</h2>
				</div>
				<UserRound aria-hidden="true" />
			</header>
			<div className="social-card profile-editor">
				<label htmlFor="profile-name">표시 이름</label>
				<input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} />
				<button
					type="button"
					className="btn-primary"
					onClick={() => state.updateProfile.mutate({ name })}
				>
					<Save size={16} aria-hidden="true" />
					프로필 저장
				</button>
			</div>
			<div className="social-card profile-editor">
				<label htmlFor="theme">테마</label>
				<select
					id="theme"
					value={theme}
					onChange={(event) => setTheme(event.target.value as typeof theme)}
				>
					<option value="system">시스템 설정</option>
					<option value="light">라이트</option>
					<option value="dark">다크</option>
				</select>
				<label className="toggle-row">
					<input
						type="checkbox"
						checked={notificationsEnabled}
						onChange={(event) => setNotificationsEnabled(event.target.checked)}
					/>
					반응과 그룹 알림 받기
				</label>
				<button
					type="button"
					className="btn-primary"
					onClick={() => state.updateSettings.mutate({ theme, notificationsEnabled })}
				>
					설정 저장
				</button>
			</div>
		</section>
	);
}
