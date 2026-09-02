import { useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, Save, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { User } from "../api/planner";
import { useSettings } from "../hooks/planner";
import type { ReturnTypeOfProfileSettings } from "./social-types";

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : "설정을 저장하지 못했어요.";
}

export function ProfileSettingsScreen({ state }: { state: ReturnTypeOfProfileSettings }) {
	const queryClient = useQueryClient();
	const settings = useSettings(true);
	const [name, setName] = useState("");
	const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
	const [notificationsEnabled, setNotificationsEnabled] = useState(true);
	const [profileNotice, setProfileNotice] = useState("");
	const [profileError, setProfileError] = useState("");
	const [settingsNotice, setSettingsNotice] = useState("");
	const [settingsError, setSettingsError] = useState("");

	useEffect(() => {
		if (state.profile.data?.name) setName(state.profile.data.name);
	}, [state.profile.data?.name]);

	useEffect(() => {
		if (!settings.query.data) return;
		setTheme(settings.query.data.theme);
		setNotificationsEnabled(settings.query.data.notificationsEnabled);
	}, [settings.query.data]);

	const saveProfile = async () => {
		const trimmed = name.trim();
		if (!trimmed) {
			setProfileError("표시 이름을 입력해 주세요.");
			return;
		}
		setProfileNotice("");
		setProfileError("");
		try {
			const updated = await state.updateProfile.mutateAsync({ name: trimmed });
			queryClient.setQueryData<{ user: User } | null>(["session"], (current) =>
				current ? { user: { ...current.user, ...updated } } : current,
			);
			setProfileNotice("프로필을 저장했어요.");
		} catch (caught) {
			setProfileError(errorMessage(caught));
		}
	};

	const saveSettings = async () => {
		setSettingsNotice("");
		setSettingsError("");
		try {
			await settings.save.mutateAsync({ theme, notificationsEnabled });
			setSettingsNotice("알림과 화면 설정을 저장했어요.");
		} catch (caught) {
			setSettingsError(errorMessage(caught));
		}
	};

	return (
		<section className="social-screen settings-screen" data-testid="profile-settings">
			<header className="social-screen__head">
				<div>
					<p className="eyebrow">MY PROFILE</p>
					<h2>프로필 · 설정</h2>
				</div>
				<UserRound aria-hidden="true" />
			</header>

			<div className="social-card profile-editor settings-card">
				<div className="settings-card__heading">
					<UserRound aria-hidden="true" />
					<div>
						<strong>프로필</strong>
						<span>친구에게 보이는 이름을 관리해요.</span>
					</div>
				</div>
				<label htmlFor="profile-name">표시 이름</label>
				<input
					id="profile-name"
					value={name}
					onChange={(event) => setName(event.target.value)}
					maxLength={100}
					autoComplete="name"
				/>
				<div className="settings-card__footer">
					<span className="settings-card__feedback" aria-live="polite">
						{profileError ? (
							<span className="management-feedback__error">{profileError}</span>
						) : (
							profileNotice
						)}
					</span>
					<button
						type="button"
						className="btn-primary"
						onClick={saveProfile}
						disabled={state.updateProfile.isPending || !name.trim()}
					>
						{profileNotice ? (
							<Check size={16} aria-hidden="true" />
						) : (
							<Save size={16} aria-hidden="true" />
						)}
						프로필 저장
					</button>
				</div>
			</div>

			<div className="social-card profile-editor settings-card">
				<div className="settings-card__heading">
					<BellRing aria-hidden="true" />
					<div>
						<strong>알림 · 화면</strong>
						<span>집중 방식에 맞게 앱 경험을 조정하세요.</span>
					</div>
				</div>
				{settings.query.isError ? (
					<div className="error-box">저장된 설정을 불러오지 못했어요.</div>
				) : null}
				<label htmlFor="theme">테마</label>
				<select
					id="theme"
					value={theme}
					onChange={(event) => setTheme(event.target.value as typeof theme)}
					disabled={settings.query.isLoading}
				>
					<option value="system">시스템 설정</option>
					<option value="light">라이트</option>
					<option value="dark">다크</option>
				</select>
				<label className="toggle-row settings-toggle">
					<input
						type="checkbox"
						checked={notificationsEnabled}
						onChange={(event) => setNotificationsEnabled(event.target.checked)}
						disabled={settings.query.isLoading}
					/>
					<span>
						<strong>반응과 그룹 알림 받기</strong>
						<small>친구의 반응과 그룹 활동을 놓치지 않아요.</small>
					</span>
				</label>
				<div className="settings-card__footer">
					<span className="settings-card__feedback" aria-live="polite">
						{settingsError ? (
							<span className="management-feedback__error">{settingsError}</span>
						) : (
							settingsNotice
						)}
					</span>
					<button
						type="button"
						className="btn-primary"
						onClick={saveSettings}
						disabled={settings.query.isLoading || settings.save.isPending}
					>
						{settingsNotice ? (
							<Check size={16} aria-hidden="true" />
						) : (
							<Save size={16} aria-hidden="true" />
						)}
						설정 저장
					</button>
				</div>
			</div>
		</section>
	);
}
