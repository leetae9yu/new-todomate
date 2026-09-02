import { ArrowLeft, MessageCircle, Plus, Send, Users } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChatContact, ChatMessage, ChatRoom } from "../api/chat";
import { type useChat, useChatRoom } from "../hooks/chat";

type ChatState = ReturnType<typeof useChat>;

const roomDateFormatter = new Intl.DateTimeFormat("ko-KR", {
	month: "short",
	day: "numeric",
});
const messageTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
	hour: "2-digit",
	minute: "2-digit",
});
const messageDayFormatter = new Intl.DateTimeFormat("ko-KR", {
	year: "numeric",
	month: "long",
	day: "numeric",
	weekday: "short",
});

export function ChatScreen({ chat }: { chat: ChatState }) {
	const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
	const rooms = chat.rooms.data?.rooms ?? [];
	const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
	const contacts = chat.contacts.data?.contacts ?? [];

	return (
		<div className={`chat-layout${selectedRoom ? " has-thread" : ""}`}>
			<aside className="chat-sidebar" aria-label="대화 목록">
				<div className="chat-sidebar__head">
					<div>
						<strong>메시지</strong>
						<span>그룹과 친구의 오늘을 이어 보세요.</span>
					</div>
					<MessageCircle aria-hidden="true" />
				</div>

				<div className="chat-sidebar__scroll">
					<section className="chat-directory" aria-labelledby="chat-room-heading">
						<div className="chat-section-heading">
							<h3 id="chat-room-heading">대화</h3>
							<span>{rooms.length}</span>
						</div>
						{chat.rooms.isLoading ? (
							<div className="chat-loading" role="status" aria-label="대화 목록 불러오는 중">
								<span className="spinner" />
							</div>
						) : chat.rooms.isError ? (
							<div className="error-box">대화 목록을 불러오지 못했어요.</div>
						) : rooms.length === 0 ? (
							<p className="chat-directory__empty">
								그룹에 참여하거나 아래 친구에게 먼저 인사해 보세요.
							</p>
						) : (
							<ul className="chat-room-list">
								{rooms.map((room) => (
									<li key={room.id}>
										<RoomButton
											room={room}
											selected={room.id === selectedRoom?.id}
											onSelect={() => setSelectedRoomId(room.id)}
										/>
									</li>
								))}
							</ul>
						)}
					</section>

					<section className="chat-directory" aria-labelledby="chat-contact-heading">
						<div className="chat-section-heading">
							<h3 id="chat-contact-heading">새 메시지</h3>
							<span>{contacts.length}</span>
						</div>
						{chat.contacts.isLoading ? (
							<div className="chat-loading" role="status" aria-label="친구 목록 불러오는 중">
								<span className="spinner" />
							</div>
						) : chat.contacts.isError ? (
							<div className="error-box">친구 목록을 불러오지 못했어요.</div>
						) : contacts.length === 0 ? (
							<p className="chat-directory__empty">같은 그룹의 친구가 여기에 보여요.</p>
						) : (
							<ul className="chat-contact-list">
								{contacts.map((contact) => {
									const isPending =
										chat.createDm.isPending && chat.createDm.variables === contact.id;
									return (
										<li key={contact.id}>
											<button
												type="button"
												className="chat-contact-button"
												disabled={chat.createDm.isPending}
												onClick={() =>
													chat.createDm.mutate(contact.id, {
														onSuccess: (room) => setSelectedRoomId(room.id),
													})
												}
											>
												<ContactAvatar contact={contact} />
												<span>{contact.name}</span>
												{isPending ? <span className="spinner" /> : <Plus aria-hidden="true" />}
											</button>
										</li>
									);
								})}
							</ul>
						)}
						{chat.createDm.isError ? (
							<p className="chat-inline-error" role="alert">
								대화를 열지 못했어요. 다시 시도해 주세요.
							</p>
						) : null}
					</section>
				</div>
			</aside>

			{selectedRoom ? (
				<ChatThread
					key={selectedRoom.id}
					room={selectedRoom}
					currentUserId={chat.currentUserId}
					onBack={() => setSelectedRoomId(null)}
				/>
			) : (
				<div className="chat-thread chat-thread--empty">
					<span className="chat-thread__mark">
						<MessageCircle aria-hidden="true" />
					</span>
					<strong>대화를 선택해 주세요.</strong>
					<p>그룹 이야기와 친구의 응원을 한곳에서 이어갈 수 있어요.</p>
				</div>
			)}
		</div>
	);
}

function RoomButton({
	room,
	selected,
	onSelect,
}: {
	room: ChatRoom;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			className={`chat-room-button${selected ? " is-selected" : ""}`}
			onClick={onSelect}
			aria-current={selected ? "page" : undefined}
		>
			<RoomAvatar room={room} />
			<span className="chat-room-button__copy">
				<span className="chat-room-button__topline">
					<strong>{room.title || "이름 없는 대화"}</strong>
					{room.lastMessageAt ? <time>{formatRoomDate(room.lastMessageAt)}</time> : null}
				</span>
				<span className="chat-room-button__preview">
					<span>
						{room.lastMessage?.body ??
							(room.kind === "group"
								? `${room.members.length}명의 그룹 대화`
								: "첫 인사를 건네요.")}
					</span>
					{room.unreadCount > 0 ? (
						<b role="status" aria-label={`읽지 않은 메시지 ${room.unreadCount}개`}>
							{formatUnread(room.unreadCount)}
						</b>
					) : null}
				</span>
			</span>
		</button>
	);
}

function ChatThread({
	room,
	currentUserId,
	onBack,
}: {
	room: ChatRoom;
	currentUserId: string | null;
	onBack: () => void;
}) {
	const state = useChatRoom(room, currentUserId, true);
	const [draft, setDraft] = useState("");
	const messageListRef = useRef<HTMLOListElement | null>(null);
	const stickToBottomRef = useRef(true);
	const preserveScrollRef = useRef<{ height: number; top: number } | null>(null);
	const oldestSequence = state.messages[0]?.sequence;
	const messageCount = state.messages.length;

	useLayoutEffect(() => {
		const list = messageListRef.current;
		if (!list || messageCount === 0 || oldestSequence === undefined) return;
		const previous = preserveScrollRef.current;
		if (previous) {
			list.scrollTop = previous.top + list.scrollHeight - previous.height;
			preserveScrollRef.current = null;
			return;
		}
		if (stickToBottomRef.current) list.scrollTop = list.scrollHeight;
	}, [messageCount, oldestSequence]);

	useEffect(() => () => state.setTyping(false), [state.setTyping]);

	const typingNames = useMemo(() => {
		const names = new Map(room.members.map((member) => [member.id, member.name]));
		return state.typingUserIds
			.filter((userId) => userId !== currentUserId)
			.map((userId) => names.get(userId) ?? "친구");
	}, [currentUserId, room.members, state.typingUserIds]);
	const presence = presenceLabel(room, currentUserId, state.onlineUserIds, state.connectionState);

	const loadOlder = async () => {
		const list = messageListRef.current;
		if (list) preserveScrollRef.current = { height: list.scrollHeight, top: list.scrollTop };
		await state.history.fetchNextPage();
		if (state.history.data?.pages.at(-1)?.messages.length === 0) {
			preserveScrollRef.current = null;
		}
	};

	const submitMessage = async () => {
		const body = draft.trim();
		if (!body || state.send.isPending) return;
		setDraft("");
		state.setTyping(false);
		stickToBottomRef.current = true;
		try {
			await state.sendMessage(body);
		} catch {
			setDraft((current) => current || body);
		}
	};

	return (
		<section className="chat-thread" aria-label={`${room.title} 대화`}>
			<header className="chat-thread__head">
				<button
					type="button"
					className="icon-btn chat-back-button"
					onClick={onBack}
					aria-label="대화 목록"
				>
					<ArrowLeft aria-hidden="true" />
				</button>
				<RoomAvatar room={room} />
				<div className="chat-thread__identity">
					<strong>{room.title || "이름 없는 대화"}</strong>
					<span>
						<i className={`chat-presence-dot is-${state.connectionState}`} />
						{presence}
					</span>
				</div>
			</header>

			<ol
				className="chat-message-list"
				ref={messageListRef}
				role="log"
				aria-live="polite"
				onScroll={(event) => {
					const list = event.currentTarget;
					stickToBottomRef.current =
						list.scrollHeight - list.scrollTop - list.clientHeight <= list.clientHeight / 5;
				}}
			>
				{state.history.hasNextPage ? (
					<li className="chat-load-older">
						<button
							type="button"
							className="btn-ghost"
							disabled={state.history.isFetchingNextPage}
							onClick={() => void loadOlder()}
						>
							{state.history.isFetchingNextPage ? "불러오는 중" : "이전 메시지 보기"}
						</button>
					</li>
				) : null}
				{state.history.isLoading ? (
					<li className="chat-loading" aria-label="메시지 불러오는 중" role="status">
						<span className="spinner" />
					</li>
				) : state.history.isError ? (
					<li className="chat-history-error">
						<div className="error-box">메시지를 불러오지 못했어요.</div>
						<button
							type="button"
							className="btn-ghost"
							onClick={() => void state.history.refetch()}
						>
							다시 불러오기
						</button>
					</li>
				) : state.messages.length === 0 ? (
					<li className="chat-thread__welcome">
						<MessageCircle aria-hidden="true" />
						<strong>오늘의 첫 메시지</strong>
						<span>짧은 응원 한마디로 대화를 시작해 보세요.</span>
					</li>
				) : (
					state.messages.map((message, index) => {
						const previous = state.messages[index - 1];
						const showDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
						return (
							<MessageRow
								key={message.id}
								message={message}
								room={room}
								own={message.sender.id === currentUserId}
								showDay={showDay}
							/>
						);
					})
				)}
			</ol>

			<div className="chat-typing" aria-live="polite">
				{typingLabel(typingNames)}
			</div>
			<form
				className="chat-composer"
				onSubmit={(event) => {
					event.preventDefault();
					void submitMessage();
				}}
			>
				<textarea
					value={draft}
					rows={1}
					maxLength={4000}
					aria-label={`${room.title}에 메시지 보내기`}
					placeholder="응원의 메시지를 입력하세요"
					onBlur={() => state.setTyping(false)}
					onChange={(event) => {
						setDraft(event.target.value);
						state.setTyping(event.target.value.trim().length > 0);
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
							event.preventDefault();
							void submitMessage();
						}
					}}
				/>
				<button
					type="submit"
					className="chat-send-button"
					disabled={!draft.trim() || state.send.isPending}
					aria-label="메시지 보내기"
				>
					{state.send.isPending ? <span className="spinner" /> : <Send aria-hidden="true" />}
				</button>
			</form>
			{state.send.isError ? (
				<p className="chat-inline-error chat-inline-error--composer" role="alert">
					메시지를 보내지 못했어요. 내용은 입력창에 보관했어요.
				</p>
			) : null}
		</section>
	);
}

function MessageRow({
	message,
	room,
	own,
	showDay,
}: {
	message: ChatMessage;
	room: ChatRoom;
	own: boolean;
	showDay: boolean;
}) {
	return (
		<>
			{showDay ? (
				<li className="chat-day-divider">
					<time dateTime={message.createdAt}>{formatMessageDay(message.createdAt)}</time>
				</li>
			) : null}
			<li className={`chat-message${own ? " is-own" : ""}`}>
				{own ? null : <ContactAvatar contact={message.sender} />}
				<div className="chat-message__content">
					{!own && room.kind === "group" ? (
						<span className="chat-message__sender">{message.sender.name}</span>
					) : null}
					<div className="chat-message__line">
						<p>{message.body}</p>
						<time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
					</div>
				</div>
			</li>
		</>
	);
}

function RoomAvatar({ room }: { room: ChatRoom }) {
	if (room.kind === "group") {
		return (
			<span className="avatar chat-avatar chat-avatar--group" aria-hidden="true">
				<Users />
			</span>
		);
	}
	return (
		<ContactAvatar contact={room.members[0] ?? { id: room.id, name: room.title, image: null }} />
	);
}

function ContactAvatar({ contact }: { contact: ChatContact }) {
	return (
		<span className="avatar chat-avatar" aria-hidden="true">
			{contact.image ? <img src={contact.image} alt="" /> : contact.name.trim().charAt(0) || "?"}
		</span>
	);
}

function presenceLabel(
	room: ChatRoom,
	currentUserId: string | null,
	onlineUserIds: string[],
	connectionState: ReturnType<typeof useChatRoom>["connectionState"],
) {
	if (connectionState === "offline") return "연결을 기다리는 중";
	if (connectionState === "connecting") return "연결 중";
	if (connectionState === "reconnecting") return "다시 연결 중";
	if (connectionState !== "connected") return "실시간 상태 준비 중";
	if (room.kind === "dm") {
		const friendId = room.members.find((member) => member.id !== currentUserId)?.id;
		return friendId && onlineUserIds.includes(friendId) ? "온라인" : "오프라인";
	}
	const count = onlineUserIds.filter((userId) => userId !== currentUserId).length;
	return count > 0 ? `${count}명 온라인` : "멤버를 기다리는 중";
}

function typingLabel(names: string[]) {
	if (names.length === 0) return "\u00a0";
	if (names.length === 1) return `${names[0]}님이 입력 중...`;
	if (names.length === 2) return `${names[0]}, ${names[1]}님이 입력 중...`;
	return `${names[0]} 외 ${names.length - 1}명이 입력 중...`;
}

function formatUnread(count: number) {
	return count > 99 ? "99+" : String(count);
}

function formatRoomDate(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : roomDateFormatter.format(date);
}

function formatMessageTime(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : messageTimeFormatter.format(date);
}

function formatMessageDay(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : messageDayFormatter.format(date);
}

function dayKey(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
