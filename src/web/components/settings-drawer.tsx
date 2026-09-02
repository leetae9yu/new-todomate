import {
	Archive,
	Bell,
	ChevronDown,
	LogOut,
	Palette,
	Repeat,
	SlidersHorizontal,
	Tags,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PlannerSettings } from "../api/planner";

export type SettingsDestination = "category-management" | "routine-management" | "backlog";

const CONTENT_ROWS = [
	{ key: "category-management", label: "카테고리 관리", icon: Tags },
	{ key: "routine-management", label: "루틴 관리", icon: Repeat },
	{ key: "backlog", label: "보관함", icon: Archive },
] as const;

const THEME_OPTIONS: Array<{ value: PlannerSettings["theme"]; label: string }> = [
	{ value: "system", label: "시스템" },
	{ value: "light", label: "라이트" },
	{ value: "dark", label: "다크" },
];

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

export function Drawer({
	open,
	onClose,
	onNavigate,
	userName,
	signedOut = false,
	settings,
	settingsError = false,
	savingSettings = false,
	onSaveSettings,
	onSignOut,
}: {
	open: boolean;
	onClose: () => void;
	onNavigate: (destination: SettingsDestination) => void;
	userName: string;
	signedOut?: boolean;
	settings: PlannerSettings | undefined;
	settingsError?: boolean;
	savingSettings?: boolean;
	onSaveSettings: (body: PlannerSettings) => Promise<unknown> | undefined;
	onSignOut: () => Promise<void> | void;
}) {
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const [themeOpen, setThemeOpen] = useState(false);
	const [signingOut, setSigningOut] = useState(false);
	const [drawerError, setDrawerError] = useState("");

	useEffect(() => {
		if (!open) return;
		setDrawerError("");
		setThemeOpen(false);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		closeButtonRef.current?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [open, onClose]);

	if (!open) return null;

	const navigate = (destination: SettingsDestination) => {
		onNavigate(destination);
		onClose();
	};

	const saveSettings = async (next: PlannerSettings) => {
		setDrawerError("");
		try {
			await onSaveSettings(next);
		} catch (caught) {
			setDrawerError(errorMessage(caught, "설정을 저장하지 못했어요."));
		}
	};

	const selectTheme = (theme: PlannerSettings["theme"]) => {
		if (savingSettings) return;
		if (!settings) {
			setDrawerError(settingsError ? "설정을 불러오지 못했어요." : "설정을 불러오는 중이에요.");
			return;
		}
		void saveSettings({ ...settings, theme });
	};

	const toggleNotifications = () => {
		if (savingSettings) return;
		if (!settings) {
			setDrawerError(settingsError ? "설정을 불러오지 못했어요." : "설정을 불러오는 중이에요.");
			return;
		}
		void saveSettings({ ...settings, notificationsEnabled: !settings.notificationsEnabled });
	};

	const signOut = async () => {
		setSigningOut(true);
		setDrawerError("");
		try {
			await onSignOut();
		} catch (caught) {
			setDrawerError(errorMessage(caught, "로그아웃하지 못했어요."));
			setSigningOut(false);
		}
	};

	return (
		<>
			<button
				type="button"
				className="drawer-backdrop"
				onClick={onClose}
				aria-label="메뉴 닫기"
				tabIndex={-1}
			/>
			<aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title">
				<header className="drawer__head">
					<div>
						<span className="drawer__eyebrow">
							<SlidersHorizontal aria-hidden="true" /> SETTINGS
						</span>
						<h2 id="settings-title">설정</h2>
					</div>
					<button
						ref={closeButtonRef}
						type="button"
						className="icon-btn"
						onClick={onClose}
						aria-label="설정 닫기"
					>
						<X aria-hidden="true" />
					</button>
				</header>

				<div className="drawer__user">
					<span className="avatar" aria-hidden="true">
						{userName.charAt(0)}
					</span>
					<div>
						<strong>{userName}</strong>
						<span>{signedOut ? "로그아웃됨" : "로그인됨"}</span>
					</div>
				</div>

				<nav className="drawer__section" aria-labelledby="drawer-content">
					<h3 id="drawer-content">콘텐츠</h3>
					{CONTENT_ROWS.map((row) => {
						const Icon = row.icon;
						return (
							<button
								key={row.key}
								type="button"
								className="drawer__item"
								onClick={() => navigate(row.key)}
							>
								<Icon aria-hidden="true" />
								<span>{row.label}</span>
							</button>
						);
					})}
				</nav>

				<section className="drawer__section" aria-labelledby="drawer-preferences">
					<h3 id="drawer-preferences">개인 설정</h3>
					<button
						type="button"
						className="drawer__item drawer__item--disclosure"
						onClick={() => setThemeOpen((current) => !current)}
						aria-expanded={themeOpen}
						aria-controls="drawer-theme-options"
					>
						<Palette aria-hidden="true" />
						<span>테마</span>
						<ChevronDown className={themeOpen ? "is-open" : ""} aria-hidden="true" />
					</button>
					{themeOpen ? (
						<fieldset
							className="drawer__theme-options"
							id="drawer-theme-options"
							aria-label="테마 선택"
						>
							{THEME_OPTIONS.map((option) => (
								<button
									key={option.value}
									type="button"
									className={settings?.theme === option.value ? "is-selected" : ""}
									onClick={() => selectTheme(option.value)}
									disabled={savingSettings}
									aria-pressed={settings?.theme === option.value}
								>
									{option.label}
								</button>
							))}
						</fieldset>
					) : null}
					<button
						type="button"
						className="drawer__item drawer__item--toggle"
						onClick={toggleNotifications}
						aria-pressed={settings?.notificationsEnabled ?? false}
					>
						<Bell aria-hidden="true" />
						<span>소식 알림</span>
						<span
							className={`drawer__switch-visual${settings?.notificationsEnabled ? " is-on" : ""}`}
							aria-hidden="true"
						>
							<span />
						</span>
					</button>
				</section>

				<div className="drawer__footer">
					<button
						type="button"
						className="drawer__item drawer__item--danger"
						onClick={signOut}
						disabled={signingOut}
					>
						<LogOut aria-hidden="true" />
						{signingOut ? "로그아웃 중…" : "로그아웃"}
					</button>
					<div className="drawer__error" aria-live="polite">
						{drawerError}
					</div>
				</div>
			</aside>
		</>
	);
}
