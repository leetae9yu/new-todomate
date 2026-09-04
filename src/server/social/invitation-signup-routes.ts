import type { Hono } from "hono";
import { z } from "zod";
import type { AuthRuntime } from "../auth/runtime";
import { badRequest, notFound, type QueryRow } from "../planner/shared";
import { invitationCodeHash } from "./invitation-shared";

const signupSchema = z
	.object({
		code: z.uuid(),
		username: z
			.string()
			.trim()
			.min(3)
			.max(30)
			.regex(/^[a-zA-Z0-9_]+$/),
		password: z.string().min(8).max(128),
		name: z.string().trim().min(1).max(50),
	})
	.strict();

class InvitationSignupError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvitationSignupError";
	}
}

type SignupStage =
	| "account.create"
	| "membership.create"
	| "invitation.accept"
	| "session.create";

async function rollbackSignup(auth: AuthRuntime, invitationId: string, accountId: string | null) {
	if (accountId) {
		const [deleted] = await auth.planner.query<QueryRow>(
			`DELETE FROM "user" WHERE id = $1 AND status = 'provisioning' RETURNING id`,
			[accountId],
		);
		if (!deleted) return;
	}
	await auth.planner.query(
		`UPDATE group_invite
		 SET status = 'pending', claim_id = NULL, claimed_username = NULL, claimed_at = NULL
		 WHERE id = $1 AND status = 'provisioning'`,
		[invitationId],
	);
}

export function installInvitationSignupRoutes(app: Hono, auth: AuthRuntime) {
	app.post("/api/invitations/signup", async (context) => {
		const input = signupSchema.safeParse(await context.req.json().catch(() => null));
		if (!input.success) return badRequest(context);
		const username = input.data.username.toLowerCase();
		if (await auth.findByUsername(username)) {
			return context.json({ error: { code: "USERNAME_TAKEN" } }, 409);
		}

		const codeHash = await invitationCodeHash(input.data.code);
		const claimId = crypto.randomUUID();
		const [invitation] = await auth.planner.query<QueryRow>(
			`UPDATE group_invite
			 SET status = 'provisioning', claim_id = $2, claimed_username = $3, claimed_at = now()
			 WHERE code_hash = $1 AND status = 'pending' AND expires_at > now()
			 RETURNING id, group_id AS "groupId"`,
			[codeHash, claimId, username],
		);
		if (!invitation) return notFound(context);

		const invitationId = String(invitation.id);
		const groupId = String(invitation.groupId);
		let accountId: string | null = null;
		let stage: SignupStage = "account.create";
		try {
			const account = await auth.createAccount({
				username,
				password: input.data.password,
				name: input.data.name,
				status: "provisioning",
			});
			accountId = account.id;
			stage = "invitation.accept";
			const [membership] = await auth.planner.query<QueryRow>(
				`WITH accepted AS (
				 UPDATE group_invite
				 SET status = 'accepted', responded_by = $3, responded_at = now()
				 WHERE id = $1 AND status = 'provisioning' AND claim_id = $2
				 RETURNING group_id
				), activated AS (
				 UPDATE "user" SET status = 'active', updated_at = now()
				 WHERE id = $3 AND status = 'provisioning'
				 AND EXISTS (SELECT 1 FROM accepted)
				 RETURNING id
				)
				INSERT INTO group_membership (group_id, user_id, role)
				SELECT accepted.group_id, activated.id, 'member'
				FROM accepted CROSS JOIN activated
				RETURNING user_id AS id`,
				[invitationId, claimId, accountId],
			);
			if (!membership) throw new InvitationSignupError("Invitation finalization failed");

			stage = "session.create";
			const targetURL = new URL(context.req.url);
			targetURL.pathname = "/api/auth/sign-in/username";
			const signInHeaders = new Headers({ "content-type": "application/json" });
			const userAgent = context.req.header("user-agent");
			if (userAgent) signInHeaders.set("user-agent", userAgent);
			const signInResponse = await auth.handler(
				new Request(targetURL, {
					method: "POST",
					headers: signInHeaders,
					body: JSON.stringify({ username, password: input.data.password }),
				}),
			);
			if (!signInResponse.ok) throw new InvitationSignupError("Created account could not sign in");
			const headers = new Headers(signInResponse.headers);
			headers.delete("content-length");
			headers.set("content-type", "application/json; charset=UTF-8");
			return new Response(
				JSON.stringify({
					user: { ...account, status: "active" },
					group: { id: groupId },
					invitations: { limit: 3, remaining: 3 },
				}),
				{ status: 201, headers },
			);
		} catch (error) {
			if (stage === "session.create" && accountId) {
				if (error instanceof Error) {
					console.error("Invitation signup session creation failed", { error });
				}
				return context.json({ error: { code: "SIGN_IN_REQUIRED" } }, 503);
			}
			await rollbackSignup(auth, invitationId, accountId);
			if (error instanceof Error) {
				console.error("Invitation signup failed", { stage, error });
				return context.json({ error: { code: "SIGNUP_FAILED" } }, 500);
			}
			throw error;
		}
	});
}
