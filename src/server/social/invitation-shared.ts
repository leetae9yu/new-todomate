export const INVITATION_LIMIT = 3;

export async function invitationCodeHash(code: string) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

export function createInvitationCode() {
	return crypto.randomUUID();
}
