export type ChatSender = {
	id: string;
	name: string;
	image: string | null;
};

export type ChatMessage = {
	id: string;
	roomId: string;
	sequence: number;
	clientMessageId: string;
	body: string;
	sender: ChatSender;
	createdAt: string;
};

export type ChatRoomEvent = {
	type: "message.created";
	roomId: string;
	message: ChatMessage;
};

export type ChatGateway = {
	connect: (roomId: string, actorId: string, request: Request) => Response | Promise<Response>;
	publish: (roomId: string, event: ChatRoomEvent) => void | Promise<void>;
	revoke: (roomId: string, userId: string) => void | Promise<void>;
};
