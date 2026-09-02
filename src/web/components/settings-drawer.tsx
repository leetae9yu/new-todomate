import { LogOut, Settings } from "lucide-react";

const SETTINGS_GROUPS = [
	{
		section: "콘텐츠",
		rows: ["카테고리 관리", "루틴 관리", "리마인더 관리", "보관함"],
	},
	{
		section: "개인정보",
		rows: ["공개설정", "차단/신고", "팔로우 승인 후 허용"],
	},
	{
		section: "알림",
		rows: ["리마인더 시간", "소식 알림", "마케팅 알림"],
	},
	{
		section: "화면",
		rows: ["테마", "글꼴", "24시간 표시", "달력 시작 요일"],
	},
	{
		section: "정보",
		rows: ["이용약관", "개인정보처리방침", "버전", "문의하기"],
	},
] as const;

export function Drawer({
	open,
	onClose,
	userName,
	signedOut = false,
	onSignOut,
}: {
	open: boolean;
	onClose: () => void;
	userName: string;
	signedOut?: boolean;
	onSignOut: () => void;
}) {
	if (!open) {
		return null;
	}

	return (
		<>
			<button
				type="button"
				className="drawer-backdrop"
				onClick={onClose}
				aria-label="메뉴 닫기"
				tabIndex={-1}
			/>
			<aside className="drawer" aria-label="설정">
				<div className="drawer__user">
					<span className="avatar" aria-hidden="true">
						{userName.charAt(0)}
					</span>
					<div>
						<strong>{userName}</strong>
						<span>{signedOut ? "로그아웃됨" : "로그인됨"}</span>
					</div>
				</div>
				{SETTINGS_GROUPS.map((group) => (
					<nav className="drawer__section" key={group.section}>
						<h3>{group.section}</h3>
						{group.rows.map((row) => (
							<button
								key={row}
								type="button"
								className="drawer__item"
								disabled
								title="곧 제공 예정"
							>
								<Settings aria-hidden="true" />
								{row}
							</button>
						))}
					</nav>
				))}
				<button type="button" className="drawer__item" onClick={onSignOut}>
					<LogOut aria-hidden="true" />
					로그아웃
				</button>
			</aside>
		</>
	);
}
