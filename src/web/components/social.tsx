import { Copy, Users } from "lucide-react";
import { useState } from "react";
import type { ReturnTypeOfUseSocial } from "./social-types";

const REACTIONS = ["👏", "🔥", "💜", "✨"];

export function SocialScreen({ social }: { social: ReturnTypeOfUseSocial }) {
	const [groupName, setGroupName] = useState("");
	const [inviteToken, setInviteToken] = useState("");
	const [issuedToken, setIssuedToken] = useState("");
	const groups = social.groups.data?.groups ?? [];

	return (
		<section className="social-screen">
			<header className="social-screen__head">
				<div>
					<p className="eyebrow">PRIVATE CREW</p>
					<h2>친구 피드</h2>
				</div>
				<Users aria-hidden="true" />
			</header>
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
						<strong>{groups[0]?.name}</strong>
						<button
							type="button"
							className="btn-ghost"
							onClick={() =>
								social.createInvite.mutate(groups[0]?.id ?? "", {
									onSuccess: (result) => setIssuedToken(result.token),
								})
							}
						>
							초대 링크 만들기
						</button>
						{issuedToken ? (
							<code className="invite-token">
								<Copy size={14} aria-hidden="true" />
								{issuedToken}
							</code>
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
					if (inviteToken.trim()) social.respondInvite.mutate({ token: inviteToken.trim(), accept: true });
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
		</section>
	);
}
