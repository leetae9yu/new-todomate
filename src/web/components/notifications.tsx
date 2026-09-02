import { Bell, Check } from "lucide-react";
import type { ReturnTypeOfNotifications } from "./social-types";

export function NotificationsScreen({
	state,
}: {
	state: ReturnTypeOfNotifications;
}) {
	const items = state.notifications.data?.notifications ?? [];
	return (
		<section className="social-screen">
			<header className="social-screen__head">
				<div>
					<p className="eyebrow">NEWS</p>
					<h2>알림</h2>
				</div>
				<Bell aria-hidden="true" />
			</header>
			{items.length === 0 ? (
				<p className="backlog__hint">새로운 알림이 없어요.</p>
			) : (
				<div className="notification-list">
					{items.map((item) => (
						<button
							type="button"
							key={item.id}
							className={`notification-row${item.readAt ? "" : " is-unread"}`}
							onClick={() => state.read.mutate(item.id)}
						>
							<span className="avatar">N</span>
							<span>
								<strong>친구가 할 일에 반응했어요.</strong>
								<small>{item.deepLink ? "해당 할 일로 이동할 수 있어요." : "새 소식"}</small>
							</span>
							{item.readAt ? <Check size={16} aria-label="읽음" /> : <i title="읽지 않음" />}
						</button>
					))}
				</div>
			)}
		</section>
	);
}
