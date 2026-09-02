import type { Context } from "hono";
import { z } from "zod";

export const localDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((value) => {
		const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
		if (!match) return false;
		const date = new Date(
			Date.UTC(Number(match[1] ?? ""), Number(match[2] ?? "") - 1, Number(match[3] ?? "")),
		);
		return date.toISOString().slice(0, 10) === value;
	}, "Expected an exact local date in YYYY-MM-DD format");

export const categorySchema = z
	.object({
		name: z.string().trim().min(1).max(100),
		color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
		visibility: z.enum(["private", "group"]),
		groupId: z.uuid().optional(),
	})
	.strict();

export const taskSchema = z
	.object({
		categoryId: z.uuid(),
		title: z.string().trim().min(1).max(500),
		date: localDateSchema.nullable(),
	})
	.strict();

export const taskPatchSchema = z
	.object({
		title: z.string().trim().min(1).max(500).optional(),
		date: localDateSchema.nullable().optional(),
		position: z.number().int().min(0).optional(),
	})
	.strict()
	.refine((value) => value.title !== undefined || value.date !== undefined || value.position !== undefined);

export const completionSchema = z.object({ completed: z.boolean() }).strict();

const frequencySchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("daily") }).strict(),
	z
		.object({
			type: z.literal("weekdays"),
			days: z.array(z.number().int().min(0).max(6)).min(1),
		})
		.strict(),
	z
		.object({
			type: z.literal("monthly"),
			days: z.array(z.number().int().min(1).max(31)).min(1),
		})
		.strict(),
]);

export const routineSchema = z
	.object({
		categoryId: z.uuid(),
		title: z.string().trim().min(1).max(500),
		startDate: localDateSchema,
		endDate: localDateSchema.optional(),
		frequency: frequencySchema,
	})
	.strict()
	.refine((value) => !value.endDate || value.endDate >= value.startDate, "Invalid date range");

export const diarySchema = z
	.object({
		mood: z.string().trim().min(1).max(32),
		body: z.string().trim().min(1).max(10_000),
	})
	.strict();

export async function parseBody<T extends z.ZodType>(context: Context, schema: T) {
	return schema.safeParse(await context.req.json().catch(() => null));
}
