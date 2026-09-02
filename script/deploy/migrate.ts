import { neon } from "@neondatabase/serverless";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const databaseURL = process.env.DATABASE_URL;
if (!databaseURL) {
	throw new Error("DATABASE_URL is required");
}

const sql = neon(databaseURL);
await sql.query(
	`CREATE TABLE IF NOT EXISTS app_migration (
		name text PRIMARY KEY,
		applied_at timestamptz DEFAULT now() NOT NULL
	)`,
	[],
);

const migrationDirectory = join(import.meta.dir, "../../drizzle");
const migrations = (await readdir(migrationDirectory))
	.filter((name) => name.endsWith(".sql"))
	.sort();

for (const name of migrations) {
	const applied = await sql.query("SELECT 1 FROM app_migration WHERE name = $1", [name]);
	if (applied.length > 0) {
		console.log(`skip ${name}`);
		continue;
	}
	const source = await Bun.file(join(migrationDirectory, name)).text();
	const statements = source
		.split("--> statement-breakpoint")
		.map((statement) => statement.trim())
		.filter(Boolean);
	await sql.transaction([
		...statements.map((statement) => sql.query(statement, [])),
		sql.query("INSERT INTO app_migration (name) VALUES ($1)", [name]),
	]);
	console.log(`applied ${name}`);
}
