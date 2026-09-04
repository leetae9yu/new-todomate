import type { Hono } from "hono";
import { z } from "zod";
import type { AuthRuntime } from "../auth/runtime";
import { badRequest, notFound, type QueryRow, unauthorized } from "../planner/shared";
import {
	createInvitationCode,
	INVITATION_LIMIT,
	invitationCodeHash,
} from "./invitation-shared";
import { membership, socialUser } from "./shared";

const respondSchema = z.object({ accept: z.boolean() }).strict();
const previewSchema = z.object({ code: z.uuid() }).strict();

async function expireInvitations(auth: AuthRuntime, userId: string) {
	await auth.planner.query(
		`UPDATE group_invite SET status = 'expired'
		 WHERE status = 'pending' AND expires_at <= now() AND created_by = $1`,
		[userId],
	);
}

async function remainingInvitations(auth: AuthRuntime, userId: string) {
	const [row] = await auth.planner.query<QueryRow>(
		`SELECT COUNT(*) AS count FROM group_invite
		 WHERE created_by = $1 AND invite_slot IS NOT NULL
		 AND status IN ('pending', 'provisioning', 'accepted')`,
		[userId],
	);
	return Math.max(0, INVITATION_LIMIT - Number(row?.count ?? 0));
}

export function installInvitationRoutes(app: Hono, auth: AuthRuntime) {
	app.get("/api/invitations", async (context) => {
		const userId = await socialUser(auth, context);
		if (!userId) return unauthorized(context);
		await expireInvitations(auth, userId);
		const invitations = await auth.planner.query<QueryRow>(
			`SELECT i.id, i.expires_at AS "expiresAt", i.invite_slot AS "slot",
			 g.id AS "groupId", g.name AS "groupName"
			 FROM group_invite i JOIN social_group g ON g.id = i.group_id
			 WHERE i.created_by = $1 AND i.invite_slot IS NOT NULL
			 AND i.status = 'pending' AND i.expires_at > now()
			 ORDER BY i.invite_slot`,
			[userId],
		);
		return context.json({
			limit: INVITATION_LIMIT,
			remaining: await remainingInvitations(auth, userId),
			invitations,
		});
	});

	app.post("/api/groups/:id/invites", async (context) => {
		const userId = await socialUser(auth, context);
		const groupId = z.uuid().safeParse(context.req.param("id"));
		if (!userId) return unauthorized(context);
		if (!groupId.success) return badRequest(context);
		if (!(await membership(auth, groupId.data, userId))) {
			return context.json({ error: { code: "FORBIDDEN" } }, 403);
		}
		await expireInvitations(auth, userId);
		for (let slot = 1; slot <= INVITATION_LIMIT; slot += 1) {
			const code = createInvitationCode();
			const codeHash = await invitationCodeHash(code);
			const [created] = await auth.planner.query<QueryRow>(
				`INSERT INTO group_invite
				 (id, group_id, created_by, token, code_hash, invite_slot, expires_at)
				 VALUES ($1, $2, $3, $4, $5, $6, now() + interval '7 days')
				 ON CONFLICT DO NOTHING
				 RETURNING id, expires_at AS "expiresAt"`,
				[
					crypto.randomUUID(),
					groupId.data,
					userId,
					crypto.randomUUID(),
					codeHash,
					slot,
				],
			);
			if (created) {
				return context.json(
					{
						id: String(created.id),
						code,
						token: code,
						expiresAt: String(created.expiresAt),
						remaining: await remainingInvitations(auth, userId),
					},
					201,
				);
			}
		}
		return context.json({ error: { code: "INVITE_LIMIT_REACHED" } }, 409);
	});

	app.delete("/api/invitations/:id", async (context) => {
		const userId = await socialUser(auth, context);
		if (!userId) return unauthorized(context);
		const [revoked] = await auth.planner.query<QueryRow>(
			`UPDATE group_invite SET status = 'revoked', responded_at = now()
			 WHERE id = $1 AND created_by = $2 AND status = 'pending'
			 RETURNING id`,
			[context.req.param("id"), userId],
		);
		return revoked ? context.body(null, 204) : notFound(context);
	});

	app.post("/api/invitations/preview", async (context) => {
		const input = previewSchema.safeParse(await context.req.json().catch(() => null));
		if (!input.success) return badRequest(context);
		const codeHash = await invitationCodeHash(input.data.code);
		const [invitation] = await auth.planner.query<QueryRow>(
			`SELECT i.expires_at AS "expiresAt", g.id AS "groupId", g.name AS "groupName",
			 u.name AS "inviterName"
			 FROM group_invite i
			 JOIN social_group g ON g.id = i.group_id
			 JOIN "user" u ON u.id = i.created_by
			 WHERE i.code_hash = $1 AND i.status = 'pending' AND i.expires_at > now()`,
			[codeHash],
		);
		if (!invitation) return notFound(context);
		return context.json({
			group: { id: String(invitation.groupId), name: String(invitation.groupName) },
			inviter: { name: String(invitation.inviterName) },
			expiresAt: String(invitation.expiresAt),
		});
	});

	app.post("/api/invites/:token/respond", async (context) => {
		const userId = await socialUser(auth, context);
		const input = respondSchema.safeParse(await context.req.json().catch(() => null));
		if (!userId) return unauthorized(context);
		if (!input.success) return badRequest(context);
		const code = context.req.param("token");
		const codeHash = await invitationCodeHash(code);
		const status = input.data.accept ? "accepted" : "rejected";
		const [invitation] = await auth.planner.query<QueryRow>(
			`UPDATE group_invite SET status = $3, responded_by = $2, responded_at = now()
			 WHERE (token = $1 OR code_hash = $4) AND status = 'pending' AND expires_at > now()
			 RETURNING group_id AS "groupId"`,
			[code, userId, status, codeHash],
		);
		if (!invitation) return notFound(context);
		if (input.data.accept) {
			await auth.planner.query(
				`INSERT INTO group_membership (group_id, user_id, role)
				 VALUES ($1, $2, 'member') ON CONFLICT (group_id, user_id) DO NOTHING`,
				[String(invitation.groupId), userId],
			);
		}
		return context.json({
			groupId: String(invitation.groupId),
			role: input.data.accept ? "member" : null,
			status,
		});
	});
}
