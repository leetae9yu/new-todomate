import { Copy, MessagesSquare, Rows3, Users } from "lucide-react";
import { useState } from "react";
import type { useChat } from "../hooks/chat";
import { ChatScreen } from "./chat";
import type { ReturnTypeOfUseSocial } from "./social-types";

const REACTIONS = ["👏", "🔥", "💜", "✨"];

type ChatState = ReturnType<typeof useChat>;

export function SocialScreen({ social, chat }: { social: ReturnTypeOfUseSocial; chat: ChatState }) {
	const [mode, setMode] = useState<"feed" | "chat">("feed");
	const [groupName, setGroupName] = useState("");
	const [inviteToken, setInviteToken] = useState("");
	const [issuedLink, setIssuedLink] = useState("");
	const groups = social.groups.data?.groups ?? [];
	const invitationSummary = social.invitations.data;
	const remainingInvitations = invitationSummary?.remaining;
	const unreadCount =
		chat.rooms.data?.rooms.reduce((total, room) => total + room.unreadCount, 0) ?? 0;

	return (
		<section
			className={`social-screen social-screen--friends${mode === "chat" ? " social-screen--chat" : ""}`}
		>
			<header className="social-screen__head">
				<div>
					<p className="eyebrow">PRIVATE CREW</p>
					<h2>{mode === "feed" ? "친구 피드" : "친구 채팅"}</h2>
				</div>
				<Users aria-hidden="true" />
			</header>

			<div className="social-mode-switch" role="tablist" aria-label="친구 보기">
				<button
					type="button"
					role="tab"
					className={mode === "feed" ? "is-active" : ""}
					aria-selected={mode === "feed"}
					onClick={() => setMode("feed")}
				>
					<Rows3 aria-hidden="true" />
					피드
				</button>
				<button
					type="button"
					role="tab"
					className={mode === "chat" ? "is-active" : ""}
					aria-selected={mode === "chat"}
					onClick={() => setMode("chat")}
				>
					<MessagesSquare aria-hidden="true" />
					채팅
					{unreadCount > 0 ? (
						<span role="status" aria-label={`읽지 않은 메시지 ${unreadCount}개`}>
							{unreadCount > 99 ? "99+" : unreadCount}
						</span>
					) : null}
				</button>
			</div>

			{mode === "chat" ? (
				<ChatScreen chat={chat} />
			) : (
				<>
					{groups.length === 0 ? (
						<div className="social-card">
							<h3>우리만의 그룹 만들기</h3>
							<input
								value={groupName}
								onChange={(event) => setGroupName(event.target.value)}
								placeholder="그룹 이름"
							/>
							<button
								type="button"
								className="btn-primary"
								onClick={() => {
									if (groupName.trim()) social.createGroup.mutate(groupName.trim());
								}}
							>
								그룹 만들기
							</button>
						</div>
					) : (
						<>
							<ul className="avatar-strip" aria-label="그룹 멤버">
								{social.members.data?.map((member) => (
									<li className="avatar-chip" key={member.id}>
										<span className="avatar">{member.name.charAt(0)}</span>
										{member.name}
									</li>
								))}
							</ul>
							<div className="social-card">
								<div className="invite-heading">
									<div>
										<strong>{groups[0]?.name}</strong>
										<small>
											초대권 {remainingInvitations ?? "…"}/{invitationSummary?.limit ?? 3}
										</small>
									</div>
									<span>코드당 1명 · 7일간 유효</span>
								</div>
								<button
									type="button"
									className="btn-ghost"
									onClick={() =>
										social.createInvite.mutate(groups[0]?.id ?? "", {
											onSuccess: (result) =>
												setIssuedLink(
													`${window.location.origin}/?invite=${encodeURIComponent(result.code)}`,
												),
										})
									}
									disabled={
										social.createInvite.isPending ||
										remainingInvitations === undefined ||
										remainingInvitations === 0
									}
								>
									{remainingInvitations === 0
										? "초대권을 모두 사용했어요"
										: "초대 링크 만들기"}
								</button>
								{issuedLink ? (
									<button
										type="button"
										className="invite-token"
										onClick={() => void navigator.clipboard.writeText(issuedLink)}
										aria-label="초대 링크 복사"
									>
										<Copy size={14} aria-hidden="true" />
										{issuedLink}
									</button>
								) : null}
								{invitationSummary?.invitations.length ? (
									<ul className="invite-list" aria-label="사용 가능한 초대">
										{invitationSummary.invitations.map((invitation) => (
											<li key={invitation.id}>
												<span>
													{invitation.groupName} ·{" "}
													{new Date(invitation.expiresAt).toLocaleDateString("ko-KR")}까지
												</span>
												<button
													type="button"
													onClick={() => social.revokeInvitation.mutate(invitation.id)}
													disabled={social.revokeInvitation.isPending}
												>
													취소
												</button>
											</li>
										))}
									</ul>
								) : null}
							</div>
							<div className="social-feed">
								{social.feed.data?.tasks.map((task) => (
									<article className="social-task" key={task.id}>
										<span className="category-dot" style={{ background: task.color }} />
										<div>
											<strong>{task.title}</strong>
											<small>{task.categoryName}</small>
											<div className="reaction-row">
												{REACTIONS.map((emoji) => (
													<button
														key={emoji}
														type="button"
														onClick={() => social.react.mutate({ taskId: task.id, emoji })}
														disabled={!task.completed}
													>
														{emoji}
													</button>
												))}
												{task.reactions.map((reaction) => (
													<span key={reaction.emoji}>
														{reaction.emoji} {reaction.count}
													</span>
												))}
											</div>
										</div>
									</article>
								))}
							</div>
						</>
					)}
					<form
						className="social-card"
						onSubmit={(event) => {
							event.preventDefault();
							if (inviteToken.trim()) {
								social.respondInvite.mutate({ token: inviteToken.trim(), accept: true });
							}
						}}
					>
						<label htmlFor="invite-token">초대 코드로 참여</label>
						<input
							id="invite-token"
							value={inviteToken}
							onChange={(event) => setInviteToken(event.target.value)}
							placeholder="초대 코드"
						/>
						<button type="submit" className="btn-primary">
							그룹 참여
						</button>
					</form>
				</>
			)}
		</section>
	);
}
