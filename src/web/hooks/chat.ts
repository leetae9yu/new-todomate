import {
	type InfiniteData,
	type QueryClient,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type ChatClientFrame,
	type ChatMessage,
	type ChatMessagePage,
	type ChatRoom,
	chatApi,
	parseChatServerEvent,
} from "../api/chat";
import { api } from "../api/planner";

const MESSAGE_PAGE_SIZE = 40;
const CATCH_UP_PAGE_SIZE = 100;
const ROOM_REFRESH_INTERVAL_MS = 30_000;
const RECONNECT_INITIAL_MS = 500;
const RECONNECT_MAX_MS = 30_000;
const TYPING_REFRESH_MS = 3_000;

const CHAT_ROOMS_KEY = ["chat", "rooms"] as const;
const chatMessagesKey = (roomId: string) => ["chat", "messages", roomId] as const;

type RoomsPayload = { rooms: ChatRoom[] };
type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "offline";

export function useChat(enabled: boolean) {
	const queryClient = useQueryClient();
	const session = useQuery({
		queryKey: ["session"],
		queryFn: api.session,
		enabled,
		staleTime: 60_000,
	});
	const rooms = useQuery({
		queryKey: CHAT_ROOMS_KEY,
		queryFn: chatApi.rooms,
		enabled,
		refetchInterval: enabled ? ROOM_REFRESH_INTERVAL_MS : false,
	});
	const contacts = useQuery({
		queryKey: ["chat", "contacts"],
		queryFn: chatApi.contacts,
		enabled,
		staleTime: 60_000,
	});
	const createDm = useMutation({
		mutationFn: chatApi.createDm,
		onSuccess: (room) => {
			queryClient.setQueryData<RoomsPayload>(CHAT_ROOMS_KEY, (current) => ({
				rooms: [room, ...(current?.rooms ?? []).filter((item) => item.id !== room.id)],
			}));
		},
	});

	return {
		rooms,
		contacts,
		createDm,
		currentUserId: session.data?.user.id ?? null,
	};
}

export function useChatRoom(room: ChatRoom, currentUserId: string | null, enabled: boolean) {
	const queryClient = useQueryClient();
	const history = useInfiniteQuery({
		queryKey: chatMessagesKey(room.id),
		queryFn: ({ pageParam }) =>
			chatApi.messages(room.id, {
				limit: MESSAGE_PAGE_SIZE,
				...(pageParam === undefined ? {} : { beforeSequence: pageParam }),
			}),
		initialPageParam: undefined as number | undefined,
		getNextPageParam: (page) => {
			const oldestSequence = page.messages[0]?.sequence;
			return page.hasOlder && oldestSequence !== undefined ? oldestSequence : undefined;
		},
		enabled,
	});

	const [liveState, setLiveState] = useState<{
		roomId: string;
		messages: Map<number, ChatMessage>;
	}>(() => ({ roomId: room.id, messages: new Map() }));
	const observedRef = useRef<{ roomId: string; sequences: Set<number> }>({
		roomId: room.id,
		sequences: new Set(),
	});
	const latestSequenceRef = useRef({
		roomId: room.id,
		sequence: room.lastMessage?.sequence ?? room.joinedSequence,
	});
	const currentUserIdRef = useRef(currentUserId);
	const socketRef = useRef<WebSocket | null>(null);
	const typingControlRef = useRef({ roomId: room.id, isTyping: false, lastStartedAt: 0 });

	if (observedRef.current.roomId !== room.id) {
		observedRef.current = { roomId: room.id, sequences: new Set() };
	}
	if (latestSequenceRef.current.roomId !== room.id) {
		latestSequenceRef.current = {
			roomId: room.id,
			sequence: room.lastMessage?.sequence ?? room.joinedSequence,
		};
	} else {
		latestSequenceRef.current.sequence = Math.max(
			latestSequenceRef.current.sequence,
			room.lastMessage?.sequence ?? room.joinedSequence,
		);
	}
	if (typingControlRef.current.roomId !== room.id) {
		typingControlRef.current = { roomId: room.id, isTyping: false, lastStartedAt: 0 };
	}
	currentUserIdRef.current = currentUserId;

	const historyMessages = useMemo(
		() => history.data?.pages.flatMap((page) => page.messages) ?? [],
		[history.data],
	);
	for (const message of historyMessages) {
		observedRef.current.sequences.add(message.sequence);
	}

	const recordMessages = useCallback(
		(incoming: ChatMessage[]) => {
			if (observedRef.current.roomId !== room.id) {
				observedRef.current = { roomId: room.id, sequences: new Set() };
			}
			const fresh = incoming.filter((message) => {
				if (message.roomId !== room.id || observedRef.current.sequences.has(message.sequence)) {
					return false;
				}
				observedRef.current.sequences.add(message.sequence);
				latestSequenceRef.current = {
					roomId: room.id,
					sequence: Math.max(latestSequenceRef.current.sequence, message.sequence),
				};
				return true;
			});
			if (fresh.length > 0) {
				setLiveState((current) => {
					const next = new Map(current.roomId === room.id ? current.messages : []);
					for (const message of fresh) next.set(message.sequence, message);
					return { roomId: room.id, messages: next };
				});
			}
			return fresh;
		},
		[room.id],
	);

	const messages = useMemo(() => {
		const bySequence = new Map<number, ChatMessage>();
		for (const message of historyMessages) bySequence.set(message.sequence, message);
		if (liveState.roomId === room.id) {
			for (const [sequence, message] of liveState.messages) bySequence.set(sequence, message);
		}
		return [...bySequence.values()].sort((first, second) => first.sequence - second.sequence);
	}, [historyMessages, liveState, room.id]);
	const latestSequence =
		messages.at(-1)?.sequence ?? room.lastMessage?.sequence ?? room.joinedSequence;
	latestSequenceRef.current = {
		roomId: room.id,
		sequence: Math.max(latestSequenceRef.current.sequence, latestSequence),
	};

	const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
	const [onlineUsers, setOnlineUsers] = useState<Set<string>>(() => new Set());
	const [typingUsers, setTypingUsers] = useState<Set<string>>(() => new Set());
	const [isPageVisible, setIsPageVisible] = useState(() => document.visibilityState === "visible");

	useEffect(() => {
		const handleVisibility = () => setIsPageVisible(document.visibilityState === "visible");
		document.addEventListener("visibilitychange", handleVisibility);
		return () => document.removeEventListener("visibilitychange", handleVisibility);
	}, []);

	useEffect(() => {
		if (!enabled) {
			setConnectionState("idle");
			return;
		}

		let disposed = false;
		let socket: WebSocket | null = null;
		let removeSocketListeners: (() => void) | null = null;
		let reconnectTimer: number | null = null;
		let reconnectAttempt = 0;
		let catchUpController: AbortController | null = null;
		const typingExpiryTimers = new Map<string, number>();

		const clearTypingUser = (userId: string) => {
			const timer = typingExpiryTimers.get(userId);
			if (timer !== undefined) window.clearTimeout(timer);
			typingExpiryTimers.delete(userId);
			setTypingUsers((current) => {
				if (!current.has(userId)) return current;
				const next = new Set(current);
				next.delete(userId);
				return next;
			});
		};

		const clearTransientState = () => {
			for (const timer of typingExpiryTimers.values()) window.clearTimeout(timer);
			typingExpiryTimers.clear();
			setTypingUsers(new Set());
			setOnlineUsers(new Set());
		};

		const catchUp = async () => {
			catchUpController?.abort();
			const controller = new AbortController();
			catchUpController = controller;
			let cursor =
				latestSequenceRef.current.roomId === room.id
					? latestSequenceRef.current.sequence
					: room.joinedSequence;
			try {
				while (!controller.signal.aborted) {
					const page = await chatApi.messages(
						room.id,
						{ limit: CATCH_UP_PAGE_SIZE, afterSequence: cursor },
						controller.signal,
					);
					const fresh = recordMessages(page.messages);
					for (const message of fresh) {
						updateRoomForMessage(queryClient, message, currentUserIdRef.current);
					}
					const nextCursor = page.messages.at(-1)?.sequence;
					if (!page.hasNewer || nextCursor === undefined || nextCursor <= cursor) break;
					cursor = nextCursor;
				}
			} catch {
				if (!controller.signal.aborted) {
					void queryClient.invalidateQueries({ queryKey: CHAT_ROOMS_KEY });
				}
			} finally {
				if (catchUpController === controller) catchUpController = null;
			}
		};

		const applyTypingEvent = (userId: string, isTyping: boolean, expiresAt: string) => {
			const existingTimer = typingExpiryTimers.get(userId);
			if (existingTimer !== undefined) window.clearTimeout(existingTimer);
			typingExpiryTimers.delete(userId);
			const expiry = Date.parse(expiresAt);
			if (!isTyping || !Number.isFinite(expiry) || expiry <= Date.now()) {
				clearTypingUser(userId);
				return;
			}
			setTypingUsers((current) => new Set(current).add(userId));
			typingExpiryTimers.set(
				userId,
				window.setTimeout(() => clearTypingUser(userId), expiry - Date.now()),
			);
		};

		const scheduleReconnect = () => {
			if (disposed || reconnectTimer !== null) return;
			if (!navigator.onLine) {
				setConnectionState("offline");
				return;
			}
			const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_INITIAL_MS * 2 ** reconnectAttempt);
			reconnectAttempt += 1;
			setConnectionState("reconnecting");
			reconnectTimer = window.setTimeout(() => {
				reconnectTimer = null;
				connect();
			}, delay);
		};

		const connect = () => {
			if (disposed) return;
			if (!navigator.onLine) {
				setConnectionState("offline");
				return;
			}
			if (
				socket !== null &&
				(socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)
			) {
				return;
			}
			setConnectionState(reconnectAttempt === 0 ? "connecting" : "reconnecting");

			let next: WebSocket;
			try {
				next = new WebSocket(chatApi.liveUrl(room.id));
			} catch {
				scheduleReconnect();
				return;
			}
			socket = next;
			socketRef.current = next;
			let ready = false;

			const handleOpen = () => {
				if (!disposed) {
					setConnectionState(reconnectAttempt === 0 ? "connecting" : "reconnecting");
				}
			};
			const handleMessage = (messageEvent: MessageEvent<unknown>) => {
				const event = parseChatServerEvent(messageEvent.data);
				if (!event || event.roomId !== room.id) return;
				if (event.type === "chat.ready") {
					if (ready) return;
					ready = true;
					reconnectAttempt = 0;
					setConnectionState("connected");
					setOnlineUsers(new Set(event.onlineUserIds));
					if (typingControlRef.current.isTyping) {
						sendFrame(next, { v: 1, type: "typing.start" });
						typingControlRef.current.lastStartedAt = Date.now();
					}
					void catchUp().finally(() => {
						if (!disposed) void queryClient.invalidateQueries({ queryKey: CHAT_ROOMS_KEY });
					});
					return;
				}
				if (event.type === "presence.changed") {
					setOnlineUsers((current) => {
						const nextUsers = new Set(current);
						if (event.status === "online") nextUsers.add(event.userId);
						else nextUsers.delete(event.userId);
						return nextUsers;
					});
					if (event.status === "offline") clearTypingUser(event.userId);
					return;
				}
				if (event.type === "typing.changed") {
					applyTypingEvent(event.userId, event.isTyping, event.expiresAt);
					return;
				}
				const fresh = recordMessages([event.message]);
				if (fresh.length > 0) {
					updateRoomForMessage(queryClient, event.message, currentUserIdRef.current);
				}
				upsertHistoryMessage(queryClient, event.message);
				void queryClient.invalidateQueries({ queryKey: chatMessagesKey(room.id) });
			};
			const handleError = () => {
				if (disposed) return;
				setConnectionState("reconnecting");
				try {
					next.close();
				} catch {
					// The close event is the single reconnect trigger.
				}
			};
			const handleClose = (closeEvent: CloseEvent) => {
				const wasCurrent = socket === next;
				if (wasCurrent) {
					socket = null;
					if (socketRef.current === next) socketRef.current = null;
				}
				removeListeners();
				if (!wasCurrent || disposed) return;
				clearTransientState();
				if (closeEvent.code === 4003 || closeEvent.code === 1008) {
					setConnectionState("offline");
					void queryClient.invalidateQueries({ queryKey: CHAT_ROOMS_KEY });
					return;
				}
				scheduleReconnect();
			};
			const removeListeners = () => {
				next.removeEventListener("open", handleOpen);
				next.removeEventListener("message", handleMessage);
				next.removeEventListener("error", handleError);
				next.removeEventListener("close", handleClose);
				if (removeSocketListeners === removeListeners) removeSocketListeners = null;
			};

			next.addEventListener("open", handleOpen);
			next.addEventListener("message", handleMessage);
			next.addEventListener("error", handleError);
			next.addEventListener("close", handleClose);
			removeSocketListeners = removeListeners;
		};

		const handleOffline = () => {
			if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
			reconnectTimer = null;
			setConnectionState("offline");
			socket?.close();
		};
		const handleOnline = () => {
			if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
			reconnectTimer = null;
			connect();
		};

		window.addEventListener("offline", handleOffline);
		window.addEventListener("online", handleOnline);
		connect();

		return () => {
			disposed = true;
			window.removeEventListener("offline", handleOffline);
			window.removeEventListener("online", handleOnline);
			if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
			catchUpController?.abort();
			for (const timer of typingExpiryTimers.values()) window.clearTimeout(timer);
			typingExpiryTimers.clear();
			if (socket?.readyState === WebSocket.OPEN && typingControlRef.current.isTyping) {
				sendFrame(socket, { v: 1, type: "typing.stop" });
			}
			removeSocketListeners?.();
			if (socketRef.current === socket) socketRef.current = null;
			socket?.close(1000, "view-closed");
		};
	}, [enabled, queryClient, recordMessages, room.id, room.joinedSequence]);

	const send = useMutation({
		mutationFn: ({ body, clientMessageId }: { body: string; clientMessageId: string }) =>
			chatApi.sendMessage(room.id, body, clientMessageId),
		retry: 1,
		onSuccess: (message) => {
			recordMessages([message]);
			upsertHistoryMessage(queryClient, message);
			updateRoomForMessage(queryClient, message, currentUserIdRef.current, true);
		},
	});

	const readRequestedRef = useRef({ roomId: room.id, sequence: room.lastReadSequence });
	if (readRequestedRef.current.roomId !== room.id) {
		readRequestedRef.current = { roomId: room.id, sequence: room.lastReadSequence };
	}
	const markRead = useMutation({
		mutationFn: (throughSequence: number) => chatApi.markRead(room.id, throughSequence),
		onSuccess: (update) => {
			queryClient.setQueryData<RoomsPayload>(CHAT_ROOMS_KEY, (current) => {
				if (!current) return current;
				return {
					rooms: current.rooms.map((item) =>
						item.id === update.roomId
							? {
								...item,
								lastReadSequence: Math.max(item.lastReadSequence, update.lastReadSequence),
								unreadCount: update.unreadCount,
							}
							: item,
					),
				};
			});
		},
		onError: () => {
			readRequestedRef.current = { roomId: room.id, sequence: room.lastReadSequence };
		},
	});
	const markReadMutate = markRead.mutate;

	useEffect(() => {
		if (!enabled || !isPageVisible || !history.isSuccess) return;
		const alreadyRead = Math.max(
			room.lastReadSequence,
			readRequestedRef.current.roomId === room.id ? readRequestedRef.current.sequence : 0,
		);
		if (latestSequence <= alreadyRead) return;
		readRequestedRef.current = { roomId: room.id, sequence: latestSequence };
		markReadMutate(latestSequence);
	}, [
		enabled,
		history.isSuccess,
		isPageVisible,
		latestSequence,
		markReadMutate,
		room.id,
		room.lastReadSequence,
	]);

	const setTyping = useCallback((isTyping: boolean) => {
		const state = typingControlRef.current;
		const socket = socketRef.current;
		const now = Date.now();
		if (isTyping) {
			state.isTyping = true;
			if (socket?.readyState === WebSocket.OPEN && now - state.lastStartedAt >= TYPING_REFRESH_MS) {
				sendFrame(socket, { v: 1, type: "typing.start" });
				state.lastStartedAt = now;
			}
			return;
		}
		if (state.isTyping && socket?.readyState === WebSocket.OPEN) {
			sendFrame(socket, { v: 1, type: "typing.stop" });
		}
		state.isTyping = false;
		state.lastStartedAt = 0;
	}, []);

	const onlineUserIds = useMemo(() => [...onlineUsers], [onlineUsers]);
	const typingUserIds = useMemo(() => [...typingUsers], [typingUsers]);

	return {
		messages,
		history,
		connectionState,
		onlineUserIds,
		typingUserIds,
		send,
		sendMessage: (body: string) => send.mutateAsync({ body, clientMessageId: crypto.randomUUID() }),
		setTyping,
	};
}

function upsertHistoryMessage(queryClient: QueryClient, message: ChatMessage) {
	queryClient.setQueryData<InfiniteData<ChatMessagePage, number | undefined>>(
		chatMessagesKey(message.roomId),
		(current) => {
			if (!current || current.pages.some((page) => page.messages.some((item) => item.id === message.id))) {
				return current;
			}
			const [latestPage, ...olderPages] = current.pages;
			if (!latestPage) return current;
			return {
				...current,
				pages: [
					{
						...latestPage,
						messages: [...latestPage.messages, message].sort(
							(first, second) => first.sequence - second.sequence,
						),
						latestSequence: Math.max(latestPage.latestSequence, message.sequence),
					},
					...olderPages,
				],
			};
		},
	);
}

function updateRoomForMessage(
	queryClient: QueryClient,
	message: ChatMessage,
	currentUserId: string | null,
	markAsRead = false,
) {
	queryClient.setQueryData<RoomsPayload>(CHAT_ROOMS_KEY, (current) => {
		if (!current) return current;
		const next = current.rooms.map((room) => {
			if (room.id !== message.roomId) return room;
			const isOwn = message.sender.id === currentUserId;
			return {
				...room,
				lastMessage: message,
				lastMessageAt: message.createdAt,
				lastReadSequence:
					isOwn || markAsRead
						? Math.max(room.lastReadSequence, message.sequence)
						: room.lastReadSequence,
				unreadCount: isOwn || markAsRead ? 0 : room.unreadCount + 1,
			};
		});
		return {
			rooms: next.sort((first, second) =>
				(second.lastMessageAt ?? "").localeCompare(first.lastMessageAt ?? ""),
			),
		};
	});
}

function sendFrame(socket: WebSocket, frame: ChatClientFrame) {
	try {
		socket.send(JSON.stringify(frame));
		return true;
	} catch {
		try {
			socket.close();
		} catch {
			// A failed socket can already be closed by the browser.
		}
		return false;
	}
}
