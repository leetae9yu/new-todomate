# new todomate

친구들과 날짜별 할 일, 루틴, 반응을 공유하는 비공개 그룹형 PWA입니다.

## Stack

- Vite + React + TypeScript
- Hono
- Neon PostgreSQL + Drizzle ORM
- Better Auth
- Bun + Biome

## Local development

```bash
cp .env.example .env
bun install
bun run dev:api
bun run dev
```

웹은 `http://localhost:5173`, API는 `http://localhost:8787`에서 실행됩니다.
